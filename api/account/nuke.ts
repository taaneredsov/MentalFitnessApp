import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { nukeUser } from "../_lib/repos/user-nuke-repo.js"

/**
 * POST /api/account/nuke
 * Permanently delete the authenticated user and all associated data.
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  if (!isPostgresConfigured()) {
    return sendError(res, "Database not configured — cannot delete user data", 503)
  }

  try {
    const auth = await requireAuth(req)
    const { userId } = auth

    console.log(`[user-nuke] Starting nuke for user ${userId} (${auth.email})`)

    const result = await nukeUser(userId)

    if (!result.postgres.userDeleted) {
      return sendError(res, "User not found", 404)
    }

    console.log(`[user-nuke] Completed nuke for user ${userId}:`, JSON.stringify(result))

    return sendSuccess(res, {
      deleted: {
        postgres: result.postgres,
        airtableEventsQueued: result.airtableEventsQueued,
      },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
