import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { hashPassword } from "../_lib/password.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { USER_FIELDS } from "../_lib/field-mappings.js"
import { isRateLimited, clearRateLimit } from "../_lib/security.js"

const changePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters")
})

/**
 * POST /api/users/change-password
 * Change password for authenticated user
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)
    const userId = auth.userId

    const rateCheck = isRateLimited(userId)
    if (rateCheck.isLimited) {
      return sendError(res, "Te veel pogingen. Probeer het later opnieuw.", 429)
    }

    // Validate request body
    const { password } = changePasswordSchema.parse(parseBody(req))

    // Hash and store the new password
    const passwordHash = await hashPassword(password)

    await base(tables.users).update(userId, {
      [USER_FIELDS.passwordHash]: passwordHash
    })

    clearRateLimit(userId)

    return sendSuccess(res, { success: true })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
