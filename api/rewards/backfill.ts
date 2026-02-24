import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { isPostgresConfigured, dbQuery } from "../_lib/db/client.js"
import { getUserRewardStats, updateUserRewardFields } from "../_lib/repos/user-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

/**
 * POST /api/rewards/backfill
 * Recalculate and persist all 4 score columns for every user.
 * Protected: requires admin role.
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  if (!isPostgresConfigured()) {
    return sendError(res, "Database not configured", 503)
  }

  try {
    const auth = await requireAuth(req)

    // Only allow admin users
    const userRow = await dbQuery<{ role: string | null }>(
      `SELECT role FROM users_pg WHERE id = $1 LIMIT 1`,
      [auth.userId]
    )
    if (userRow.rows.length === 0 || userRow.rows[0].role !== "admin") {
      return sendError(res, "Forbidden — admin only", 403)
    }

    const allUsers = await dbQuery<{ id: string }>(
      `SELECT id FROM users_pg WHERE status = 'active' ORDER BY id`
    )

    let updated = 0
    let failed = 0

    for (const row of allUsers.rows) {
      try {
        const stats = await getUserRewardStats(row.id)
        if (!stats) continue

        const mentalFitnessScore = stats.methodCount * 10 + stats.user.bonusPoints
        const personalGoalsScore = stats.personalGoalCount * 5
        const goodHabitsScore = stats.habitCount * 5
        const totalPoints = mentalFitnessScore + personalGoalsScore + goodHabitsScore

        let badges: string[] = []
        try {
          badges = JSON.parse(stats.user.badges)
          if (!Array.isArray(badges)) badges = []
        } catch {
          badges = []
        }

        await updateUserRewardFields({
          userId: row.id,
          bonusPoints: stats.user.bonusPoints,
          currentStreak: stats.user.currentStreak,
          longestStreak: stats.user.longestStreak,
          lastActiveDate: stats.user.lastActiveDate,
          badges,
          level: stats.user.level,
          totalPoints,
          mentalFitnessScore,
          personalGoalsScore,
          goodHabitsScore
        })

        await enqueueSyncEvent({
          eventType: "upsert",
          entityType: "user",
          entityId: row.id,
          payload: {
            userId: row.id,
            totalPoints,
            mentalFitnessScore,
            personalGoalsScore,
            goodHabitsScore
          },
          priority: 5
        })

        updated++
      } catch (err) {
        console.error(`[backfill] Failed for user ${row.id}:`, err)
        failed++
      }
    }

    return sendSuccess(res, { updated, failed, total: allUsers.rows.length })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
