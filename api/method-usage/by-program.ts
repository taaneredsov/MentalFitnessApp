import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { PROGRAM_FIELDS, transformMethodUsage } from "../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../_lib/auth.js"

/**
 * GET /api/method-usage/by-program?programId=xxx&limit=2
 * Returns method usage records for a specific program, sorted by date (newest first)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  const { programId, limit = "2" } = req.query

  if (!programId || typeof programId !== "string") {
    return sendError(res, "Program ID is required", 400)
  }

  try {
    await requireAuth(req)

    // First, fetch the program to get linked method usage IDs
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

    // Fetch the linked method usage records
    const limitNum = parseInt(limit as string, 10)
    const idsToFetch = methodUsageIds.slice(0, limitNum)

    // Build OR formula to fetch specific records by ID
    const idFormulas = idsToFetch.map(id => `RECORD_ID() = "${id}"`).join(", ")
    const filterFormula = idsToFetch.length === 1 ? idFormulas : `OR(${idFormulas})`

    const records = await base(tables.methodUsage)
      .select({
        filterByFormula: filterFormula,
        returnFieldsByFieldId: true
      })
      .all()

    // Sort by usedAt date (newest first) and transform
    const usages = records
      .map(record => transformMethodUsage(record as any))
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
