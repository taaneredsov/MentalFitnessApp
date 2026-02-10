import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { transformUser, USER_FIELDS, isValidRecordId } from "../_lib/field-mappings.js"

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  languageCode: z.string().optional(),
  lastLogin: z.string().optional()
})

export default async function handler(req: Request, res: Response) {
  if (req.method !== "PATCH") {
    return sendError(res, "Method not allowed", 405)
  }

  // Verify authentication
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return sendError(res, "Unauthorized", 401)
  }
  const token = authHeader.slice(7)
  const payload = await verifyToken(token)
  if (!payload) {
    return sendError(res, "Invalid token", 401)
  }

  const { id } = req.params

  if (!id || typeof id !== "string") {
    return sendError(res, "User ID is required", 400)
  }

  // Validate record ID format to prevent injection
  if (!isValidRecordId(id)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  // Users can only update their own profile
  if (id !== payload.userId) {
    return sendError(res, "Forbidden: You can only update your own profile", 403)
  }

  try {
    const body = updateUserSchema.parse(parseBody(req))

    // Map to field IDs
    const fields: Record<string, unknown> = {}
    if (body.name) fields[USER_FIELDS.name] = body.name
    if (body.role) fields[USER_FIELDS.role] = body.role
    if (body.languageCode) fields[USER_FIELDS.languageCode] = body.languageCode
    if (body.lastLogin) fields[USER_FIELDS.lastLogin] = body.lastLogin

    const record = await base(tables.users).update(id, fields)
    const user = transformUser(record as any)

    return sendSuccess(res, user)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
