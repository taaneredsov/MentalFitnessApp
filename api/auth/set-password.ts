import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { hashPassword } from "../_lib/password.js"
import { signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser, USER_FIELDS, FIELD_NAMES } from "../_lib/field-mappings.js"

const setPasswordSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters")
})

/**
 * POST /api/auth/set-password
 * Set initial password for a user during onboarding
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { userId, email, password } = setPasswordSchema.parse(parseBody(req))

    // Verify user exists - use select with returnFieldsByFieldId for consistent field access
    const records = await base(tables.users)
      .select({
        filterByFormula: `RECORD_ID() = "${userId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    const record = records[0] as any
    const fields = record.fields
    const existingHash = fields[USER_FIELDS.passwordHash]
    const lastLogin = fields[USER_FIELDS.lastLogin]

    // Security: only allow setting password for first-time users
    // (no password hash AND no last login)
    if (existingHash) {
      return sendError(res, "Password already set. Use change password instead.", 400)
    }

    if (lastLogin) {
      return sendError(res, "Account niet correct geconfigureerd. Neem contact op met beheerder.", 400)
    }

    // Verify email matches
    if (fields[USER_FIELDS.email] !== email) {
      return sendError(res, "Email does not match", 400)
    }

    // Hash and store the password
    const passwordHash = await hashPassword(password)

    await base(tables.users).update(userId, {
      [USER_FIELDS.passwordHash]: passwordHash,
      [USER_FIELDS.lastLogin]: new Date().toISOString().split("T")[0]
    })

    // Fetch updated record for response (with field IDs for transformUser)
    const updatedRecords = await base(tables.users)
      .select({
        filterByFormula: `RECORD_ID() = "${userId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    const updatedRecord = updatedRecords[0]

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: userId,
      email: email
    })

    const refreshToken = await signRefreshToken({
      userId: userId,
      email: email
    })

    // Set refresh token as httpOnly cookie
    res.setHeader("Set-Cookie", [
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    const user = transformUser({
      id: updatedRecord.id,
      fields: updatedRecord.fields
    } as any)

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
