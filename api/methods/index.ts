import type { Request, Response } from "express"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformMethod } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import type { AirtableRecord } from "../_lib/types.js"

/**
 * GET /api/methods
 * Returns all methods (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    const methods = await cachedSelect(
      "methods",
      {},
      (records) => records.map(r => transformMethod(r as AirtableRecord))
    )

    return sendSuccess(res, methods)
  } catch (error) {
    return handleApiError(res, error)
  }
}
