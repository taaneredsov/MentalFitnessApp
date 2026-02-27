import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformMedia } from "../_lib/field-mappings.js"
import { getMethodById } from "../_lib/repos/reference-repo.js"
import type { AirtableRecord } from "../_lib/types.js"

/**
 * Fetch media details from Airtable for a list of media record IDs.
 * Media stays Airtable-only — this is an explicit exception to postgres-first.
 */
async function fetchMediaDetails(mediaIds: string[]): Promise<Record<string, unknown>[]> {
  if (!mediaIds || mediaIds.length === 0) return []
  const mediaRecords = await base(tables.media)
    .select({
      filterByFormula: `OR(${mediaIds.map((mid: string) => `RECORD_ID() = '${mid}'`).join(',')})`,
      returnFieldsByFieldId: true
    })
    .all()
  return mediaRecords.map(r => transformMedia({ id: r.id, fields: r.fields } as AirtableRecord))
}

/**
 * GET /api/methods/:id
 * Returns a single method with its media details
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const id = req.params.id
    if (!id || typeof id !== "string") {
      return sendError(res, "Method ID is required", 400)
    }

    const method = await getMethodById(id)
    if (!method) {
      return sendError(res, "Method not found", 404)
    }

    // Fetch media from Airtable (media stays Airtable-only)
    const mediaDetails = await fetchMediaDetails((method.media as string[]) || [])

    return sendSuccess(res, { ...method, mediaDetails })
  } catch (error) {
    return handleApiError(res, error)
  }
}
