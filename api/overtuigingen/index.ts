import type { VercelRequest, VercelResponse } from "@vercel/node"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformOvertuiging } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"

/**
 * GET /api/overtuigingen
 * Returns all overtuigingen (cached for 30 minutes)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
