import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { listAllOvertuigingen } from "../_lib/repos/reference-repo.js"

/**
 * GET /api/overtuigingen
 * Returns all overtuigingen from Postgres
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const overtuigingen = await listAllOvertuigingen()
    return sendSuccess(res, overtuigingen)
  } catch (error) {
    return handleApiError(res, error)
  }
}
