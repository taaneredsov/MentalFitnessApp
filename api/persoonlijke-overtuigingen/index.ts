import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { PERSOONLIJKE_OVERTUIGING_FIELDS, FIELD_NAMES, transformPersoonlijkeOvertuiging, isValidRecordId } from "../_lib/field-mappings.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { isEntityId } from "../_lib/db/id-utils.js"
import { getProgramByAnyId } from "../_lib/repos/program-repo.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { listByUser, create as createPO } from "../_lib/repos/persoonlijke-overtuigingen-repo.js"

const PERSOONLIJKE_OVERTUIGINGEN_BACKEND_ENV = "DATA_BACKEND_PERSOONLIJKE_OVERTUIGINGEN"

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  programId: z.string().optional()
})

async function resolveProgramAirtableId(programId: string, tokenUserId: string): Promise<string | null> {
  if (isValidRecordId(programId)) {
    return programId
  }

  if (!isPostgresConfigured() || !isEntityId(programId)) {
    return null
  }

  try {
    const program = await getProgramByAnyId(programId, tokenUserId)
    if (program?.airtableRecordId && isValidRecordId(program.airtableRecordId)) {
      return program.airtableRecordId
    }
  } catch (error) {
    console.warn("[persoonlijke-overtuigingen] Failed to resolve program Airtable ID:", error)
  }

  return null
}

// ---------- Postgres handlers ----------

async function handleGetPostgres(_req: Request, res: Response, tokenUserId: string) {
  const records = await listByUser(tokenUserId)
  return sendSuccess(res, records)
}

async function handlePostPostgres(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createSchema.parse(rawBody)

  const record = await createPO({
    userId: tokenUserId,
    name: body.name,
    programId: body.programId
  })

  console.log("[persoonlijke-overtuigingen] Created (postgres):", record.id, "for user:", tokenUserId, "name:", body.name)
  return sendSuccess(res, record, 201)
}

// ---------- Airtable handlers ----------

async function handleGetAirtable(_req: Request, res: Response, tokenUserId: string) {
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

async function handlePostAirtable(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createSchema.parse(rawBody)

  if (!isValidRecordId(tokenUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  const resolvedProgramId = body.programId
    ? await resolveProgramAirtableId(body.programId, tokenUserId)
    : null

  if (body.programId && !resolvedProgramId) {
    console.warn("[persoonlijke-overtuigingen] Program ID could not be resolved, creating without program link:", body.programId)
  }

  const createFields: Record<string, unknown> = {
    [PERSOONLIJKE_OVERTUIGING_FIELDS.name]: body.name,
    [PERSOONLIJKE_OVERTUIGING_FIELDS.user]: [tokenUserId],
    [PERSOONLIJKE_OVERTUIGING_FIELDS.status]: "Actief"
  }

  if (resolvedProgramId) {
    createFields[PERSOONLIJKE_OVERTUIGING_FIELDS.program] = [resolvedProgramId]
  }

  const record = await base(tables.persoonlijkeOvertuigingen).create(createFields, {
    typecast: true
  })

  console.log("[persoonlijke-overtuigingen] Created:", record.id, "for user:", tokenUserId, "name:", body.name)

  const result = transformPersoonlijkeOvertuiging(record as { id: string; fields: Record<string, unknown> })
  return sendSuccess(res, result, 201)
}

// ---------- Router ----------

/**
 * /api/persoonlijke-overtuigingen
 * GET: Returns all active persoonlijke overtuigingen for the user
 * POST: Creates a new persoonlijke overtuiging
 */
export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const mode = getDataBackendMode(PERSOONLIJKE_OVERTUIGINGEN_BACKEND_ENV)
    const usePostgres = mode === "postgres_primary" && isPostgresConfigured()

    switch (req.method) {
      case "GET":
        if (usePostgres) {
          return handleGetPostgres(req, res, auth.userId)
        }
        if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
          void handleGetPostgres(req, res, auth.userId)
            .then(() => undefined)
            .catch((error) => console.warn("[persoonlijke-overtuigingen] shadow read failed:", error))
        }
        return handleGetAirtable(req, res, auth.userId)
      case "POST":
        return usePostgres
          ? handlePostPostgres(req, res, auth.userId)
          : handlePostAirtable(req, res, auth.userId)
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
