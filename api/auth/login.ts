import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { verifyPassword } from "../../src/lib/password"
import { signAccessToken, signRefreshToken } from "../../src/lib/jwt"
import { transformUser, AIRTABLE_FIELDS, type AirtableUser } from "../../src/types/user"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { email, password } = loginSchema.parse(req.body)

    // Find user by email
    const records = await base(tables.users)
      .select({
        filterByFormula: `{${AIRTABLE_FIELDS.email}} = "${email}"`,
        maxRecords: 1
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "Invalid email or password", 401)
    }

    const record = records[0] as unknown as AirtableUser
    const passwordHash = record.fields[AIRTABLE_FIELDS.passwordHash]

    if (!passwordHash) {
      return sendError(res, "Account not set up for password login", 401)
    }

    // Verify password
    const isValid = await verifyPassword(password, passwordHash)
    if (!isValid) {
      return sendError(res, "Invalid email or password", 401)
    }

    // Update last login
    await base(tables.users).update(record.id, {
      [AIRTABLE_FIELDS.lastLogin]: new Date().toISOString()
    })

    // Generate tokens
    const accessToken = await signAccessToken({
      userId: record.id,
      email: record.fields[AIRTABLE_FIELDS.email]
    })

    const refreshToken = await signRefreshToken({
      userId: record.id,
      email: record.fields[AIRTABLE_FIELDS.email]
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
      return sendError(res, error.errors[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
