import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformMethod, transformMedia } from "../_lib/field-mappings.js"

/**
 * GET /api/methods/:id
 * Returns a single method with linked media details
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const id = req.query.id
    if (!id || typeof id !== "string") {
      return sendError(res, "Method ID is required", 400)
    }

    // Fetch method using select with filterByFormula to get returnFieldsByFieldId
    const records = await base(tables.methods)
      .select({
        filterByFormula: `RECORD_ID() = '${id}'`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (!records || records.length === 0) {
      return sendError(res, "Method not found", 404)
    }

    const record = records[0]
    const method = transformMethod({ id: record.id, fields: record.fields } as any)

    // Fetch media details from linked Media table
    let mediaDetails: any[] = []
    const mediaIds = method.media
    if (mediaIds && mediaIds.length > 0) {
      // Fetch each media record
      const mediaRecords = await base(tables.media)
        .select({
          filterByFormula: `OR(${mediaIds.map((mid: string) => `RECORD_ID() = '${mid}'`).join(',')})`,
          returnFieldsByFieldId: true
        })
        .all()

      mediaDetails = mediaRecords.map(r => transformMedia({ id: r.id, fields: r.fields } as any))
    }

    return sendSuccess(res, {
      ...method,
      mediaDetails
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}
