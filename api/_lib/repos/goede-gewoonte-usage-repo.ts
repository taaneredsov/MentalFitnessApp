import type { PoolClient } from "pg"
import { dbQuery, withDbTransaction } from "../db/client.js"

interface GoedeGewoonteUsageRow {
  id: string
  userId: string
  goedeGewoonteId: string
  usageDate: string
}

function mapRow(row: Record<string, unknown>): GoedeGewoonteUsageRow {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    goedeGewoonteId: String(row.goede_gewoonte_id),
    usageDate: String(row.usage_date)
  }
}

export async function listGoedeGewoonteIdsForDate(userId: string, date: string): Promise<string[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT goede_gewoonte_id
     FROM goede_gewoontes_usage_pg
     WHERE user_id = $1 AND usage_date = $2`,
    [userId, date]
  )
  return result.rows.map((row) => String(row.goede_gewoonte_id))
}

export async function findGoedeGewoonteUsage(userId: string, goedeGewoonteId: string, date: string): Promise<GoedeGewoonteUsageRow | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM goede_gewoontes_usage_pg
     WHERE user_id = $1 AND goede_gewoonte_id = $2 AND usage_date = $3
     LIMIT 1`,
    [userId, goedeGewoonteId, date]
  )
  if (result.rows.length === 0) return null
  return mapRow(result.rows[0])
}

export async function createGoedeGewoonteUsage(input: {
  userId: string
  goedeGewoonteId: string
  date: string
}, client?: PoolClient): Promise<GoedeGewoonteUsageRow> {
  const run = async (dbClient: PoolClient): Promise<GoedeGewoonteUsageRow> => {
    const result = await dbClient.query<Record<string, unknown>>(
      `INSERT INTO goede_gewoontes_usage_pg (user_id, goede_gewoonte_id, usage_date, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, goede_gewoonte_id, usage_date)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [input.userId, input.goedeGewoonteId, input.date]
    )
    return mapRow(result.rows[0])
  }

  if (client) return run(client)
  return withDbTransaction(run)
}

export async function deleteGoedeGewoonteUsage(userId: string, goedeGewoonteId: string, date: string): Promise<void> {
  await dbQuery(
    `DELETE FROM goede_gewoontes_usage_pg
     WHERE user_id = $1 AND goede_gewoonte_id = $2 AND usage_date = $3`,
    [userId, goedeGewoonteId, date]
  )
}
