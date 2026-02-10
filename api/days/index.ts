import type { Request, Response } from "express"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformDay } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"

/**
 * GET /api/days
 * Returns all days of the week from Dagen van de week table (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    const days = await cachedSelect(
      "daysOfWeek",
      {},
      (records) => records.map(r => transformDay(r as any))
    )

    return sendSuccess(res, days)
  } catch (error) {
    return handleApiError(res, error)
  }
}
