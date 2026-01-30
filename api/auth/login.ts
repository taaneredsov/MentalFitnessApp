import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyPassword } from "../_lib/password.js"
import { signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser, USER_FIELDS, FIELD_NAMES, escapeFormulaValue } from "../_lib/field-mappings.js"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { email, password } = loginSchema.parse(parseBody(req))

    // Find user by email (filterByFormula requires field names, not IDs)
    // Use escapeFormulaValue to prevent formula injection attacks
    const records = await base(tables.users)
      .select({
        filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(email)}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "Invalid email or password", 401)
    }

    const record = records[0] as any
    const passwordHash = record.fields[USER_FIELDS.passwordHash]

    // User has no password set - needs to create one (first-time setup)
    // This applies regardless of lastLogin (user may have used magic link before)
    if (!passwordHash) {
      return sendSuccess(res, {
        needsPasswordSetup: true,
        userId: record.id,
        email: record.fields[USER_FIELDS.email]
      })
    }

    // Password is required for users with existing password
    if (!password) {
      return sendError(res, "Password is required", 400)
    }

    // Verify password
    const isValid = await verifyPassword(password, passwordHash)
    if (!isValid) {
      return sendError(res, "Invalid email or password", 401)
    }

    // Update last login (Airtable date format: YYYY-MM-DD)
    await base(tables.users).update(record.id, {
      [USER_FIELDS.lastLogin]: new Date().toISOString().split("T")[0]
    })

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: record.id,
      email: record.fields[USER_FIELDS.email]
    })

    const refreshToken = await signRefreshToken({
      userId: record.id,
      email: record.fields[USER_FIELDS.email]
    })

    // Set refresh token as httpOnly cookie
    res.setHeader("Set-Cookie", [
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    const user = transformUser(record)

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
