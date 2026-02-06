import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { PERSOONLIJKE_OVERTUIGING_FIELDS, FIELD_NAMES, transformPersoonlijkeOvertuiging, isValidRecordId } from "../_lib/field-mappings.js"

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  programId: z.string().optional()
})

/**
 * GET /api/persoonlijke-overtuigingen
 * Returns active persoonlijke overtuigingen for the authenticated user
 */
async function handleGet(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  if (!isValidRecordId(tokenUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  // Fetch all with Actief status
  const records = await base(tables.persoonlijkeOvertuigingen)
    .select({
      filterByFormula: `{${FIELD_NAMES.persoonlijkeOvertuiging.status}} = "Actief"`,
      returnFieldsByFieldId: true
    })
    .all()

  // Filter by user in JavaScript
  const userRecords = records
    .filter(r => {
      const fields = r.fields as Record<string, unknown>
      const userIds = fields[PERSOONLIJKE_OVERTUIGING_FIELDS.user] as string[] | undefined
      return userIds?.includes(tokenUserId)
    })
    .map(r => transformPersoonlijkeOvertuiging(r as { id: string; fields: Record<string, unknown> }))

  return sendSuccess(res, userRecords)
}

/**
 * POST /api/persoonlijke-overtuigingen
 * Creates a new persoonlijke overtuiging for the authenticated user
 */
async function handlePost(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createSchema.parse(rawBody)

  if (!isValidRecordId(tokenUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  if (body.programId && !isValidRecordId(body.programId)) {
    return sendError(res, "Invalid program ID format", 400)
  }

  const createFields: Record<string, unknown> = {
    [PERSOONLIJKE_OVERTUIGING_FIELDS.name]: body.name,
    [PERSOONLIJKE_OVERTUIGING_FIELDS.user]: [tokenUserId],
    [PERSOONLIJKE_OVERTUIGING_FIELDS.status]: "Actief"
  }

  if (body.programId) {
    createFields[PERSOONLIJKE_OVERTUIGING_FIELDS.program] = [body.programId]
  }

  const record = await base(tables.persoonlijkeOvertuigingen).create(createFields, {
    typecast: true
  })

  console.log("[persoonlijke-overtuigingen] Created:", record.id, "for user:", tokenUserId, "name:", body.name)

  const result = transformPersoonlijkeOvertuiging(record as { id: string; fields: Record<string, unknown> })
  return sendSuccess(res, result, 201)
}

/**
 * /api/persoonlijke-overtuigingen
 * GET: Returns all active persoonlijke overtuigingen for the user
 * POST: Creates a new persoonlijke overtuiging
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await requireAuth(req)

    switch (req.method) {
      case "GET":
        return handleGet(req, res, auth.userId)
      case "POST":
        return handlePost(req, res, auth.userId)
      default:
        return sendError(res, "Method not allowed", 405)
    }
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
