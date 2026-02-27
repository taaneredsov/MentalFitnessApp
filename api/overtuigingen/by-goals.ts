import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { getOvertuigingenByGoalIds } from "../_lib/repos/reference-repo.js"

/**
 * GET /api/overtuigingen/by-goals?goalIds=id1,id2
 * Returns overtuigingen filtered by goal IDs
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    await requireAuth(req)

    const { goalIds } = req.query
    if (!goalIds || typeof goalIds !== "string") {
      return sendError(res, "goalIds query parameter is required", 400)
    }

    const goalIdList = goalIds.split(",").filter(id => id.trim())
    if (goalIdList.length === 0) {
      return sendSuccess(res, [])
    }

    const overtuigingen = await getOvertuigingenByGoalIds(goalIdList)
    return sendSuccess(res, overtuigingen)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
