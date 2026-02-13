import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { hashPassword } from "../_lib/password.js"
import { signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser, USER_FIELDS, FIELD_NAMES, escapeFormulaValue } from "../_lib/field-mappings.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { upsertUserFromAirtable } from "../_lib/repos/user-repo.js"
import {
  hashCode,
  constantTimeCompare,
  isRateLimited,
  recordFailedAttempt,
  clearRateLimit
} from "../_lib/security.js"
import type { AirtableRecord } from "../_lib/types.js"

const setPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6).regex(/^\d+$/, "Code must be 6 digits"),
  password: z.string().min(8, "Password must be at least 8 characters")
})

/**
 * POST /api/auth/set-password
 * Set initial password for a user during onboarding.
 * Requires email + verification code (sent by login endpoint).
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { email, code, password } = setPasswordSchema.parse(parseBody(req))

    // Rate limit by email
    const rateCheck = isRateLimited(email)
    if (rateCheck.isLimited) {
      return sendError(res, "Te veel pogingen. Probeer het later opnieuw.", 429)
    }

    // Find user by email
    const records = await base(tables.users)
      .select({
        filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(email)}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      recordFailedAttempt(email)
      return sendError(res, "Ongeldige code", 401)
    }

    const record = records[0] as AirtableRecord
    const fields = record.fields
    const existingHash = fields[USER_FIELDS.passwordHash]

    // Security: only allow setting password if user doesn't have one yet
    if (existingHash) {
      return sendError(res, "Password already set. Use change password instead.", 400)
    }

    // Verify the code
    const storedHashedCode = fields[USER_FIELDS.magicLinkCode] as string | undefined
    const expiry = fields[USER_FIELDS.magicLinkExpiry] as string | undefined

    // Check expiry
    if (!expiry || new Date(expiry) < new Date()) {
      recordFailedAttempt(email)
      return sendError(res, "Code is verlopen. Probeer opnieuw in te loggen.", 401)
    }

    // Constant-time comparison of hashed codes
    const hashedInputCode = hashCode(code)
    const codeMatches = storedHashedCode
      ? constantTimeCompare(hashedInputCode, storedHashedCode)
      : false

    if (!codeMatches) {
      recordFailedAttempt(email)
      return sendError(res, "Ongeldige code", 401)
    }

    // Code verified - clear rate limit
    clearRateLimit(email)

    // Hash and store the password, clear verification fields
    const passwordHash = await hashPassword(password)

    await base(tables.users).update(record.id, {
      [USER_FIELDS.passwordHash]: passwordHash,
      [USER_FIELDS.lastLogin]: new Date().toISOString().split("T")[0],
      [USER_FIELDS.magicLinkCode]: null,
      [USER_FIELDS.magicLinkExpiry]: null
    })

    // Fetch updated record for response
    const updatedRecords = await base(tables.users)
      .select({
        filterByFormula: `RECORD_ID() = "${record.id}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    const updatedRecord = updatedRecords[0]

    if (isPostgresConfigured()) {
      await upsertUserFromAirtable({
        id: updatedRecord.id,
        name: String(updatedRecord.fields[USER_FIELDS.name] || ""),
        email: String(updatedRecord.fields[USER_FIELDS.email] || email),
        role: updatedRecord.fields[USER_FIELDS.role] as string | undefined,
        languageCode: updatedRecord.fields[USER_FIELDS.languageCode] as string | undefined,
        passwordHash: String(updatedRecord.fields[USER_FIELDS.passwordHash] || passwordHash),
        lastLogin: String(updatedRecord.fields[USER_FIELDS.lastLogin] || new Date().toISOString().split("T")[0])
      })
    }

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: record.id,
      email: email
    })

    const refreshToken = await signRefreshToken({
      userId: record.id,
      email: email
    })

    // Set refresh token as httpOnly cookie
    res.setHeader("Set-Cookie", [
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    const user = transformUser({
      id: updatedRecord.id,
      fields: updatedRecord.fields
    } as AirtableRecord)

    return sendSuccess(res, {
      user,
      accessToken
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
