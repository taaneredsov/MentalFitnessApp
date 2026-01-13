import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { hashPassword } from "../_lib/password.js"
import { verifyToken } from "../_lib/jwt.js"
import { USER_FIELDS } from "../_lib/field-mappings.js"

const changePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters")
})

/**
 * POST /api/users/change-password
 * Change password for authenticated user
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "Unauthorized", 401)
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)

    if (!payload || !payload.userId) {
      return sendError(res, "Invalid token", 401)
    }

    const userId = payload.userId as string

    // Validate request body
    const { password } = changePasswordSchema.parse(req.body)

    // Hash and store the new password
    const passwordHash = await hashPassword(password)

    await base(tables.users).update(userId, {
      [USER_FIELDS.passwordHash]: passwordHash
    })

    return sendSuccess(res, { success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
