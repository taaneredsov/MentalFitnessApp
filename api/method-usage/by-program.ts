import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { isEntityId } from "../_lib/db/id-utils.js"
import { listLatestByProgram, toApiMethodUsage } from "../_lib/repos/method-usage-repo.js"
import { getProgramByAnyId } from "../_lib/repos/program-repo.js"

/**
 * GET /api/method-usage/by-program?programId=xxx&limit=2
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  const { programId, limit = "2" } = req.query

  if (!programId || typeof programId !== "string") {
    return sendError(res, "Program ID is required", 400)
  }

  try {
    await requireAuth(req)

    if (!isEntityId(programId)) {
      return sendError(res, "Invalid Program ID format", 400)
    }
    const program = await getProgramByAnyId(programId)
    if (!program) {
      return sendError(res, "Program not found", 404)
    }
    const limitNum = parseInt(limit as string, 10) || 2
    const usages = await listLatestByProgram(program.id, limitNum)
    return sendSuccess(res, usages.map(toApiMethodUsage))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    console.error("Error fetching method usage:", error)
    return handleApiError(res, error)
  }
}
