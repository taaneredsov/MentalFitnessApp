import type { Request, Response } from "express"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformOvertuiging } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"

/**
 * GET /api/overtuigingen
 * Returns all overtuigingen (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    const overtuigingen = await cachedSelect(
      "overtuigingen",
      {},
      (records) => records.map(r => transformOvertuiging(r as any))
    )

    return sendSuccess(res, overtuigingen)
  } catch (error) {
    return handleApiError(res, error)
  }
}
