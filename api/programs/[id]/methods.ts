import type { Request, Response } from "express"
import { base, tables } from "../../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../../_lib/api-utils.js"
import { PROGRAM_FIELDS } from "../../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../../_lib/auth.js"
import { getDataBackendMode } from "../../_lib/data-backend.js"
import { isPostgresConfigured } from "../../_lib/db/client.js"
import { getProgramByAnyId } from "../../_lib/repos/program-repo.js"

const PROGRAMS_BACKEND_ENV = "DATA_BACKEND_PROGRAMS"

/**
 * GET /api/programs/[id]/methods
 * Returns the method IDs linked to a program.
 * Used for polling after Airtable automation populates suggested methods.
 */

async function handleGetPostgres(req: Request, res: Response) {
  const { id } = req.params
  if (!id || typeof id !== "string") {
    return sendError(res, "Program ID is required", 400)
  }

  const auth = await requireAuth(req)
  const program = await getProgramByAnyId(id, auth.userId)

  if (!program) {
    return sendError(res, "Program not found", 404)
  }

  return sendSuccess(res, program.methods)
}

async function handleGetAirtable(req: Request, res: Response) {
  const { id } = req.params
  if (!id || typeof id !== "string") {
    return sendError(res, "Program ID is required", 400)
  }

  await requireAuth(req)

  const records = await base(tables.programs)
    .select({
      filterByFormula: `RECORD_ID() = "${id}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (records.length === 0) {
    return sendError(res, "Program not found", 404)
  }

  const methods = (records[0].fields[PROGRAM_FIELDS.methods] as string[]) || []

  return sendSuccess(res, methods)
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const mode = getDataBackendMode(PROGRAMS_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[programs/id/methods] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
