import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { sendMagicLinkEmail } from "../_lib/email.js"
import { USER_FIELDS, FIELD_NAMES, escapeFormulaValue } from "../_lib/field-mappings.js"
import {
  generateSecureToken,
  generateSecureCode,
  hashToken,
  hashCode,
  randomDelay
} from "../_lib/security.js"

const schema = z.object({
  email: z.string().email()
})

/**
 * POST /api/auth/magic-link
 * Request a magic link to be sent to the user's email
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { email } = schema.parse(parseBody(req))

    // Find user by email
    const records = await base(tables.users)
      .select({
        filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(email)}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    // Don't reveal if email exists - always return success message
    // Add random delay to prevent timing-based email enumeration
    if (records.length === 0) {
      console.log(`[magic-link] Email not found: ${email}`)
      await randomDelay(200, 500) // Simulate processing time
      return sendSuccess(res, {
        message: "Als dit email adres bij ons bekend is, ontvang je een login link"
      })
    }

    const user = records[0]

    // Check rate limiting - max 3 requests per 15 minutes
    const existingExpiry = user.fields[USER_FIELDS.magicLinkExpiry] as string | undefined
    if (existingExpiry) {
      const expiryDate = new Date(existingExpiry)
      const now = new Date()
      // If there's a recent token (less than 2 minutes old), rate limit
      const tokenAge = now.getTime() - (expiryDate.getTime() - 15 * 60 * 1000)
      if (tokenAge < 2 * 60 * 1000) {
        console.log(`[magic-link] Rate limited: ${email}`)
        return sendSuccess(res, {
          message: "Als dit email adres bij ons bekend is, ontvang je een login link"
        })
      }
    }

    // Generate cryptographically secure token and code
    const token = generateSecureToken(32)
    const code = generateSecureCode()
    const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes

    // Hash both token and code for secure storage
    // Token uses SHA-256, code uses HMAC-SHA256 with secret (prevents rainbow tables)
    const hashedToken = hashToken(token)
    const hashedCode = hashCode(code)

    // Store hashed values in Airtable
    await base(tables.users).update(user.id, {
      [USER_FIELDS.magicLinkToken]: hashedToken,
      [USER_FIELDS.magicLinkCode]: hashedCode,
      [USER_FIELDS.magicLinkExpiry]: expiry
    })

    // Build magic link URL
    const baseUrl = process.env.APP_URL || "https://mfa.drvn.be"
    const magicLink = `${baseUrl}/auth/verify?token=${token}`

    // Send email
    const emailResult = await sendMagicLinkEmail(
      email,
      magicLink,
      code
    )

    if (!emailResult.success) {
      console.error(`[magic-link] Failed to send email to ${email}:`, emailResult.error)
      // Still return success to not reveal email existence
    } else {
      console.log(`[magic-link] Email sent to ${email}`)
    }

    return sendSuccess(res, {
      message: "Als dit email adres bij ons bekend is, ontvang je een login link"
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
