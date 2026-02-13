import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { PROGRAM_FIELDS, transformMethodUsage } from "../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { isEntityId } from "../_lib/db/id-utils.js"
import { listLatestByProgram, toApiMethodUsage } from "../_lib/repos/method-usage-repo.js"
import { getProgramByAnyId } from "../_lib/repos/program-repo.js"
import type { AirtableRecord } from "../_lib/types.js"

const METHOD_USAGE_BACKEND_ENV = "DATA_BACKEND_METHOD_USAGE"

/**
 * GET /api/method-usage/by-program?programId=xxx&limit=2
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  const { programId, limit = "2" } = req.query

  if (!programId || typeof programId !== "string") {
    return sendError(res, "Program ID is required", 400)
  }

  try {
    await requireAuth(req)

    const mode = getDataBackendMode(METHOD_USAGE_BACKEND_ENV)
    if (mode === "postgres_primary" && isPostgresConfigured()) {
      if (!isEntityId(programId)) {
        return sendError(res, "Invalid Program ID format", 400)
      }
      const program = await getProgramByAnyId(programId)
      if (!program) {
        return sendError(res, "Program not found", 404)
      }
      const limitNum = parseInt(limit as string, 10) || 2
      const usages = await listLatestByProgram(program.id, limitNum)
      return sendSuccess(res, usages.map(toApiMethodUsage))
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      if (isEntityId(programId)) {
        void (async () => {
          const program = await getProgramByAnyId(programId)
          if (program) {
            const limitNum = parseInt(limit as string, 10) || 2
            await listLatestByProgram(program.id, limitNum)
          }
        })().catch((error) => console.warn("[method-usage/by-program] shadow read failed:", error))
      }
    }

    const programRecords = await base(tables.programs)
      .select({
        filterByFormula: `RECORD_ID() = "${programId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .all()

    if (programRecords.length === 0) {
      return sendError(res, "Program not found", 404)
    }

    const methodUsageIds = programRecords[0].fields[PROGRAM_FIELDS.methodUsage] as string[] || []
    if (methodUsageIds.length === 0) {
      return sendSuccess(res, [])
    }

    const limitNum = parseInt(limit as string, 10)
    const idsToFetch = methodUsageIds.slice(0, limitNum)
    const idFormulas = idsToFetch.map(id => `RECORD_ID() = "${id}"`).join(", ")
    const filterFormula = idsToFetch.length === 1 ? idFormulas : `OR(${idFormulas})`

    const records = await base(tables.methodUsage)
      .select({
        filterByFormula: filterFormula,
        returnFieldsByFieldId: true
      })
      .all()

    const usages = records
      .map(record => transformMethodUsage(record as AirtableRecord))
      .sort((a, b) => {
        if (!a.usedAt || !b.usedAt) return 0
        return new Date(b.usedAt).getTime() - new Date(a.usedAt).getTime()
      })

    return sendSuccess(res, usages)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    console.error("Error fetching method usage:", error)
    return handleApiError(res, error)
  }
}
