import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser, USER_FIELDS, FIELD_NAMES, escapeFormulaValue } from "../_lib/field-mappings.js"
import {
  hashCode,
  constantTimeCompare,
  isRateLimited,
  recordFailedAttempt,
  clearRateLimit,
  randomDelay
} from "../_lib/security.js"

const schema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/, "Code must be 6 digits")
})

/**
 * POST /api/auth/verify-code
 * Verify a 6-digit code and create a session
 *
 * Security measures:
 * - Rate limiting: 5 attempts per 15 minutes per email
 * - Constant-time comparison to prevent timing attacks
 * - Code is stored hashed (HMAC-SHA256)
 * - Generic error messages to prevent enumeration
 * - Random delays to add noise to response times
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { email, code } = schema.parse(parseBody(req))
    const normalizedEmail = email.toLowerCase().trim()

    // Check rate limiting BEFORE any database operations
    const rateLimitStatus = isRateLimited(normalizedEmail)
    if (rateLimitStatus.isLimited) {
      const retryAfterSeconds = rateLimitStatus.retryAfter
        ? Math.ceil((rateLimitStatus.retryAfter - Date.now()) / 1000)
        : 900

      console.log(`[verify-code] Rate limited: ${normalizedEmail}`)

      // Add delay to slow down attackers
      await randomDelay(500, 1000)

      return sendError(
        res,
        `Te veel pogingen. Probeer opnieuw over ${Math.ceil(retryAfterSeconds / 60)} minuten.`,
        429
      )
    }

    // Find user by email
    const records = await base(tables.users)
      .select({
        filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(normalizedEmail)}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    // Always do the same operations whether user exists or not (timing attack prevention)
    // Hash the provided code regardless of whether we'll use it
    const hashedInputCode = hashCode(code)

    if (records.length === 0) {
      console.log(`[verify-code] Email not found: ${normalizedEmail}`)
      recordFailedAttempt(normalizedEmail)
      await randomDelay(200, 400)
      return sendError(res, "Ongeldige code", 401)
    }

    const user = records[0] as Record<string, unknown> & { id: string; fields: Record<string, unknown> }
    const storedHashedCode = user.fields[USER_FIELDS.magicLinkCode] as string | undefined
    const expiry = user.fields[USER_FIELDS.magicLinkExpiry] as string | undefined

    // Check expiry first (before code comparison)
    if (!expiry || new Date(expiry) < new Date()) {
      console.log(`[verify-code] Code expired for ${normalizedEmail}`)

      // Clear expired code
      await base(tables.users).update(user.id, {
        [USER_FIELDS.magicLinkToken]: null,
        [USER_FIELDS.magicLinkCode]: null,
        [USER_FIELDS.magicLinkExpiry]: null
      })

      recordFailedAttempt(normalizedEmail)
      await randomDelay(200, 400)
      return sendError(res, "Code is verlopen. Vraag een nieuwe aan.", 401)
    }

    // Constant-time comparison of hashed codes
    // This prevents timing attacks that could reveal correct digits
    const codeMatches = storedHashedCode
      ? constantTimeCompare(hashedInputCode, storedHashedCode)
      : false

    if (!codeMatches) {
      console.log(`[verify-code] Invalid code for ${normalizedEmail}`)
      recordFailedAttempt(normalizedEmail)

      // Check if this attempt triggered a lockout
      const newStatus = isRateLimited(normalizedEmail)
      if (newStatus.isLimited) {
        console.log(`[verify-code] Account locked due to too many attempts: ${normalizedEmail}`)
      }

      await randomDelay(200, 400)
      return sendError(res, "Ongeldige code", 401)
    }

    // Success - clear rate limit and magic link fields
    clearRateLimit(normalizedEmail)

    // Clear magic link fields (one-time use) and update last login
    await base(tables.users).update(user.id, {
      [USER_FIELDS.magicLinkToken]: null,
      [USER_FIELDS.magicLinkCode]: null,
      [USER_FIELDS.magicLinkExpiry]: null,
      [USER_FIELDS.lastLogin]: new Date().toISOString().split("T")[0]
    })

    // Generate session tokens
    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.fields[USER_FIELDS.email] as string
    })

    const refreshToken = await signRefreshToken({
      userId: user.id,
      email: user.fields[USER_FIELDS.email] as string
    })

    // Set refresh token cookie
    res.setHeader("Set-Cookie", [
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    console.log(`[verify-code] User logged in via code: ${normalizedEmail}`)

    return sendSuccess(res, {
      user: transformUser(user),
      accessToken
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
