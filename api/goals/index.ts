import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { listAllGoals } from "../_lib/repos/reference-repo.js"

/**
 * GET /api/goals
 * Returns all goals from Postgres
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const goals = await listAllGoals()
    return sendSuccess(res, goals)
  } catch (error) {
    return handleApiError(res, error)
  }
}
