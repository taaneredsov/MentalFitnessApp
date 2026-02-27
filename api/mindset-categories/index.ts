import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { listAllMindsetCategories } from "../_lib/repos/reference-repo.js"

/**
 * GET /api/mindset-categories
 * Returns all mindset categories from Postgres
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const categories = await listAllMindsetCategories()
    return sendSuccess(res, categories)
  } catch (error) {
    return handleApiError(res, error)
  }
}
