import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { listAllDays } from "../_lib/repos/reference-repo.js"

/**
 * GET /api/days
 * Returns all days of the week from Postgres
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const days = await listAllDays()
    return sendSuccess(res, days)
  } catch (error) {
    return handleApiError(res, error)
  }
}
