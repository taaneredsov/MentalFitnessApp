import type { Request, Response } from "express"
import { base, tables } from "../../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../../_lib/api-utils.js"
import { PROGRAM_FIELDS } from "../../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../../_lib/auth.js"

/**
 * GET /api/programs/[id]/methods
 * Returns the method IDs linked to a program
 * Used for polling after Airtable automation populates suggested methods
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    await requireAuth(req)

    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    // Fetch the program record
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

    // Get the linked method IDs
    const methods = (records[0].fields[PROGRAM_FIELDS.methods] as string[]) || []

    return sendSuccess(res, methods)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
