import type { PoolClient } from "pg"
import { dbQuery, withDbTransaction } from "../db/client.js"

interface GoalUsageCount {
  today: number
  total: number
}

export async function listPersonalGoalCountsByUserDate(
  userId: string,
  date: string
): Promise<Record<string, GoalUsageCount>> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT
       personal_goal_id,
       COUNT(*)::int AS total_count,
       COUNT(*) FILTER (WHERE usage_date = $2)::int AS today_count
     FROM personal_goal_usage_pg
     WHERE user_id = $1
     GROUP BY personal_goal_id`,
    [userId, date]
  )

  const counts: Record<string, GoalUsageCount> = {}
  for (const row of result.rows) {
    const goalId = String(row.personal_goal_id)
    counts[goalId] = {
      today: Number(row.today_count || 0),
      total: Number(row.total_count || 0)
    }
  }
  return counts
}

export async function personalGoalBelongsToUser(goalId: string, userId: string): Promise<boolean> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id
     FROM personal_goals_pg
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [goalId, userId]
  )
  return result.rows.length > 0
}

export async function upsertPersonalGoal(input: {
  id: string
  userId: string
  name: string
  description?: string | null
  active?: boolean
}): Promise<void> {
  await dbQuery(
    `INSERT INTO personal_goals_pg (id, user_id, name, description, active, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (id)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       name = EXCLUDED.name,
       description = EXCLUDED.description,
       active = EXCLUDED.active,
       updated_at = NOW()`,
    [input.id, input.userId, input.name, input.description || null, input.active ?? true]
  )
}

export async function createPersonalGoalUsage(input: {
  userId: string
  personalGoalId: string
  date: string
}, client?: PoolClient): Promise<{ id: string }> {
  const run = async (dbClient: PoolClient): Promise<{ id: string }> => {
    const result = await dbClient.query<Record<string, unknown>>(
      `INSERT INTO personal_goal_usage_pg (user_id, personal_goal_id, usage_date, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING id`,
      [input.userId, input.personalGoalId, input.date]
    )
    return { id: String(result.rows[0].id) }
  }

  if (client) return run(client)
  return withDbTransaction(run)
}

export async function countGoalUsageForUserGoalDate(
  userId: string,
  personalGoalId: string,
  date: string
): Promise<{ todayCount: number; totalCount: number }> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT
       COUNT(*)::int AS total_count,
       COUNT(*) FILTER (WHERE usage_date = $3)::int AS today_count
     FROM personal_goal_usage_pg
     WHERE user_id = $1 AND personal_goal_id = $2`,
    [userId, personalGoalId, date]
  )

  const row = result.rows[0] || {}
  return {
    todayCount: Number(row.today_count || 0),
    totalCount: Number(row.total_count || 0)
  }
}
