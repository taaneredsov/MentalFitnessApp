import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { listAllMethods } from "../_lib/repos/reference-repo.js"

/**
 * GET /api/methods
 * Returns all methods from Postgres
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const methods = await listAllMethods()
    return sendSuccess(res, methods)
  } catch (error) {
    return handleApiError(res, error)
  }
}
