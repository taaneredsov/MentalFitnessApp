import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformUser, USER_FIELDS } from "../_lib/field-mappings.js"

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().optional(),
  languageCode: z.string().optional(),
  lastLogin: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") {
    return sendError(res, "Method not allowed", 405)
  }

  const { id } = req.query

  if (!id || typeof id !== "string") {
    return sendError(res, "User ID is required", 400)
  }

  try {
    const body = updateUserSchema.parse(req.body)

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
