import type { PoolClient } from "pg"
import { dbQuery, withDbTransaction } from "../db/client.js"

interface HabitUsageRow {
  id: string
  userId: string
  methodId: string
  usageDate: string
}

function mapRow(row: Record<string, unknown>): HabitUsageRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    methodId: String(row.method_id),
    usageDate: String(row.usage_date)
  }
}

export async function listHabitMethodIdsForDate(userId: string, date: string): Promise<string[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT method_id
     FROM habit_usage_pg
     WHERE user_id = $1 AND usage_date = $2`,
    [userId, date]
  )
  return result.rows.map((row) => String(row.method_id))
}

export async function findHabitUsage(userId: string, methodId: string, date: string): Promise<HabitUsageRow | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM habit_usage_pg
     WHERE user_id = $1 AND method_id = $2 AND usage_date = $3
     LIMIT 1`,
    [userId, methodId, date]
  )
  if (result.rows.length === 0) return null
  return mapRow(result.rows[0])
}

export async function createHabitUsage(input: {
  userId: string
  methodId: string
  date: string
}, client?: PoolClient): Promise<HabitUsageRow> {
  const run = async (dbClient: PoolClient): Promise<HabitUsageRow> => {
    const result = await dbClient.query<Record<string, unknown>>(
      `INSERT INTO habit_usage_pg (user_id, method_id, usage_date, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, method_id, usage_date)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [input.userId, input.methodId, input.date]
    )
    return mapRow(result.rows[0])
  }

  if (client) return run(client)
  return withDbTransaction(run)
}

export async function deleteHabitUsage(userId: string, methodId: string, date: string): Promise<void> {
  await dbQuery(
    `DELETE FROM habit_usage_pg
     WHERE user_id = $1 AND method_id = $2 AND usage_date = $3`,
    [userId, methodId, date]
  )
}

