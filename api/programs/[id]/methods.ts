import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../../_lib/api-utils.js"
import { requireAuth, AuthError } from "../../_lib/auth.js"
import { getProgramByAnyId } from "../../_lib/repos/program-repo.js"

/**
 * GET /api/programs/[id]/methods
 * Returns the method IDs linked to a program.
 * Used for polling after Airtable automation populates suggested methods.
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    const auth = await requireAuth(req)
    const program = await getProgramByAnyId(id, auth.userId)

    if (!program) {
      return sendError(res, "Program not found", 404)
    }

    return sendSuccess(res, program.methods)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
