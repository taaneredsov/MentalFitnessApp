import type { Request, Response } from "express"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformGoal } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import type { AirtableRecord } from "../_lib/types.js"

/**
 * GET /api/goals
 * Returns all goals from Doelstellingen table (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    const goals = await cachedSelect(
      "goals",
      {},
      (records) => records.map(r => transformGoal(r as AirtableRecord))
    )

    return sendSuccess(res, goals)
  } catch (error) {
    return handleApiError(res, error)
  }
}
