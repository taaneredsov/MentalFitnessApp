import type { PoolClient } from "pg"
import { dbQuery, withDbTransaction } from "../db/client.js"
import { isAirtableRecordId } from "../db/id-utils.js"

export interface PgMethodUsage {
  id: string
  userId: string
  methodId: string
  programId: string | null
  programScheduleId: string | null
  remark: string | null
  usedAt: string
}

function mapRow(row: Record<string, unknown>): PgMethodUsage {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    methodId: String(row.method_id),
    programId: row.program_id ? String(row.program_id) : null,
    programScheduleId: row.program_schedule_id ? String(row.program_schedule_id) : null,
    remark: row.remark ? String(row.remark) : null,
    usedAt: String(row.used_at)
  }
}

export function toApiMethodUsage(row: PgMethodUsage): Record<string, unknown> {
  return {
    id: row.id,
    userId: row.userId,
    methodId: row.methodId,
    programId: row.programId || undefined,
    programmaplanningId: row.programScheduleId || undefined,
    usedAt: row.usedAt,
    remark: row.remark || undefined
  }
}

export async function createMethodUsage(input: {
  userId: string
  methodId: string
  programId?: string
  programScheduleId?: string
  remark?: string
}, client?: PoolClient): Promise<PgMethodUsage> {
  const run = async (dbClient: PoolClient): Promise<PgMethodUsage> => {
    const result = await dbClient.query<Record<string, unknown>>(
      `INSERT INTO method_usage_pg (
        user_id, method_id, program_id, program_schedule_id, remark, used_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, CURRENT_DATE, NOW())
      RETURNING *`,
      [
        input.userId,
        input.methodId,
        input.programId || null,
        input.programScheduleId || null,
        input.remark || null
      ]
    )

    return mapRow(result.rows[0])
  }

  if (client) return run(client)
  return withDbTransaction(run)
}

export async function getMethodUsageById(id: string): Promise<PgMethodUsage | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT * FROM method_usage_pg WHERE id = $1 LIMIT 1`,
    [id]
  )
  if (result.rows.length === 0) return null
  return mapRow(result.rows[0])
}

export async function getMethodUsageByAnyId(id: string): Promise<PgMethodUsage | null> {
  const byId = await getMethodUsageById(id)
  if (byId) return byId

  if (!isAirtableRecordId(id)) {
    return null
  }

  const result = await dbQuery<Record<string, unknown>>(
    `SELECT * FROM method_usage_pg WHERE airtable_record_id = $1 LIMIT 1`,
    [id]
  )
  if (result.rows.length === 0) return null
  return mapRow(result.rows[0])
}

export async function updateMethodUsageRemark(id: string, remark: string): Promise<PgMethodUsage | null> {
  if (isAirtableRecordId(id)) {
    const byAirtable = await dbQuery<Record<string, unknown>>(
      `UPDATE method_usage_pg
       SET remark = $2, updated_at = NOW()
       WHERE airtable_record_id = $1
       RETURNING *`,
      [id, remark]
    )
    if (byAirtable.rows.length === 0) return null
    return mapRow(byAirtable.rows[0])
  }

  const byId = await dbQuery<Record<string, unknown>>(
    `UPDATE method_usage_pg
     SET remark = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, remark]
  )
  if (byId.rows.length === 0) return null
  return mapRow(byId.rows[0])
}

export async function listLatestByProgram(programId: string, limit = 2): Promise<PgMethodUsage[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT *
     FROM method_usage_pg
     WHERE program_id = $1
     ORDER BY used_at DESC, created_at DESC
     LIMIT $2`,
    [programId, limit]
  )
  return result.rows.map(mapRow)
}
