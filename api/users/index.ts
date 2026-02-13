import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { hashPassword } from "../_lib/password.js"
import { transformUser, USER_FIELDS, FIELD_NAMES, escapeFormulaValue } from "../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { upsertUserFromAirtable } from "../_lib/repos/user-repo.js"
import type { AirtableRecord } from "../_lib/types.js"

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().optional(),
  languageCode: z.string().optional()
})

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    await requireAuth(req)

    const body = createUserSchema.parse(parseBody(req))

    // Force role to "Deelnemer" - never trust client-provided role
    body.role = "Deelnemer"

    // Check if user already exists (filterByFormula requires field names)
    const existing = await base(tables.users)
      .select({
        filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(body.email)}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (existing.length > 0) {
      return sendError(res, "User with this email already exists", 409)
    }

    // Hash password
    const passwordHash = await hashPassword(body.password)

    // Create user with field IDs
    const record = await base(tables.users).create({
      [USER_FIELDS.name]: body.name,
      [USER_FIELDS.email]: body.email,
      [USER_FIELDS.passwordHash]: passwordHash,
      [USER_FIELDS.role]: body.role,
      [USER_FIELDS.languageCode]: body.languageCode
    })

    if (isPostgresConfigured()) {
      await upsertUserFromAirtable({
        id: record.id,
        name: body.name,
        email: body.email,
        role: body.role,
        languageCode: body.languageCode,
        passwordHash
      })
    }

    const user = transformUser(record as AirtableRecord)
    return sendSuccess(res, user, 201)
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
