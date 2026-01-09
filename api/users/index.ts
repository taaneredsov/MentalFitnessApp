import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { hashPassword } from "../../src/lib/password"
import { transformUser, AIRTABLE_FIELDS, type AirtableUser } from "../../src/types/user"

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.string().optional(),
  languageCode: z.string().optional()
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const body = createUserSchema.parse(req.body)

    // Check if user already exists
    const existing = await base(tables.users)
      .select({
        filterByFormula: `{${AIRTABLE_FIELDS.email}} = "${body.email}"`,
        maxRecords: 1
      })
      .firstPage()

    if (existing.length > 0) {
      return sendError(res, "User with this email already exists", 409)
    }

    // Hash password
    const passwordHash = await hashPassword(body.password)

    // Create user with Dutch field names
    const record = await base(tables.users).create({
      [AIRTABLE_FIELDS.name]: body.name,
      [AIRTABLE_FIELDS.email]: body.email,
      [AIRTABLE_FIELDS.passwordHash]: passwordHash,
      [AIRTABLE_FIELDS.role]: body.role,
      [AIRTABLE_FIELDS.languageCode]: body.languageCode,
      [AIRTABLE_FIELDS.createdAt]: new Date().toISOString()
    })

    const user = transformUser(record as unknown as AirtableUser)
    return sendSuccess(res, user, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.errors[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
