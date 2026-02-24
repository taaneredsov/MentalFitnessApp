import type { Request, Response } from "express"
import { sendSuccess, handleApiError, sendError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { getUserGoedeGewoontes } from "../_lib/repos/user-repo.js"
import { listAllGoedeGewoontes, lookupGoedeGewoontesByIds } from "../_lib/repos/reference-repo.js"

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const auth = await requireAuth(req)

    // Get user's selected goede gewoontes
    const selectedIds = await getUserGoedeGewoontes(auth.userId)

    let habits: Record<string, unknown>[]
    if (selectedIds.length > 0) {
      // User has selections - resolve from reference table
      habits = await lookupGoedeGewoontesByIds(selectedIds)
    } else {
      // No selections yet - return all (backward compat)
      habits = await listAllGoedeGewoontes()
    }

    return sendSuccess(res, habits)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
