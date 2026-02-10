import type { PoolClient } from "pg"
import { dbQuery, withDbTransaction } from "../db/client.js"

interface OvertuigingUsageRow {
  id: string
  userId: string
  overtuigingId: string
  programId: string | null
  usageDate: string
}

function mapRow(row: Record<string, unknown>): OvertuigingUsageRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    overtuigingId: String(row.overtuiging_id),
    programId: row.program_id ? String(row.program_id) : null,
    usageDate: String(row.usage_date)
  }
}

export async function createOvertuigingUsage(input: {
  userId: string
  overtuigingId: string
  programId?: string | null
  date: string
}, client?: PoolClient): Promise<OvertuigingUsageRow> {
  const run = async (dbClient: PoolClient): Promise<OvertuigingUsageRow> => {
    const result = await dbClient.query<Record<string, unknown>>(
      `INSERT INTO overtuiging_usage_pg (user_id, overtuiging_id, program_id, usage_date, updated_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id, overtuiging_id)
       DO NOTHING
       RETURNING *`,
      [input.userId, input.overtuigingId, input.programId || null, input.date]
    )
    if (result.rowCount === 0) {
      throw new Error("Overtuiging already completed")
    }
    return mapRow(result.rows[0])
  }

  if (client) return run(client)
  return withDbTransaction(run)
}

export async function findOvertuigingUsage(userId: string, overtuigingId: string): Promise<OvertuigingUsageRow | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM overtuiging_usage_pg
     WHERE user_id = $1 AND overtuiging_id = $2
     LIMIT 1`,
    [userId, overtuigingId]
  )
  if (result.rows.length === 0) return null
  return mapRow(result.rows[0])
}

export async function listOvertuigingUsageByUser(userId: string): Promise<Record<string, { completed: true }>> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT overtuiging_id
     FROM overtuiging_usage_pg
     WHERE user_id = $1`,
    [userId]
  )
  const map: Record<string, { completed: true }> = {}
  for (const row of result.rows) {
    map[String(row.overtuiging_id)] = { completed: true }
  }
  return map
}

export async function listOvertuigingUsageByUserAndProgram(
  userId: string,
  programId: string
): Promise<Record<string, { completed: true }>> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT overtuiging_id
     FROM overtuiging_usage_pg
     WHERE user_id = $1 AND (program_id = $2 OR program_id IS NULL)`,
    [userId, programId]
  )
  const map: Record<string, { completed: true }> = {}
  for (const row of result.rows) {
    map[String(row.overtuiging_id)] = { completed: true }
  }
  return map
}
