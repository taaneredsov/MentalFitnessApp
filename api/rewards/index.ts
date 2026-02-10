import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { transformUserRewards } from "../_lib/field-mappings.js"

/**
 * GET /api/rewards
 * Returns the current user's reward data (points, streak, badges, level)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "No token provided", 401)
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)

    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    // Fetch user record with reward fields
    const records = await base(tables.users)
      .select({
        filterByFormula: `RECORD_ID() = "${payload.userId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    const rewards = transformUserRewards(records[0] as { id: string; fields: Record<string, unknown> })

    // If last activity was more than 1 day ago, streak is broken — show 0
    if (rewards.lastActiveDate && rewards.currentStreak > 0) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const lastActive = new Date(rewards.lastActiveDate)
      lastActive.setHours(0, 0, 0, 0)
      const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays > 1) {
        rewards.currentStreak = 0
      }
    }

    return sendSuccess(res, rewards)
  } catch (error) {
    return handleApiError(res, error)
  }
}
