import { dbQuery } from "../db/client.js"
import { enqueueSyncEvent } from "../sync/outbox.js"

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(row.id),
    name: String(row.name || ""),
    userId: String(row.user_id),
    programId: row.program_id ? String(row.program_id) : undefined,
    status: String(row.status || "Actief"),
    completedDate: row.completed_date ? String(row.completed_date) : undefined,
    createdAt: row.created_at ? String(row.created_at) : undefined
  }
}

export async function listByUser(userId: string): Promise<Record<string, unknown>[]> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id, user_id, name, program_id, status, completed_date, created_at
     FROM persoonlijke_overtuigingen_pg
     WHERE user_id = $1 AND status = 'Actief'
     ORDER BY created_at ASC`,
    [userId]
  )
  return result.rows.map(mapRow)
}

export async function create(input: {
  userId: string
  name: string
  programId?: string
  status?: string
}): Promise<Record<string, unknown>> {
  const result = await dbQuery<Record<string, unknown>>(
    `INSERT INTO persoonlijke_overtuigingen_pg (id, user_id, name, program_id, status, updated_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
     RETURNING *`,
    [
      input.userId,
      input.name,
      input.programId || null,
      input.status || "Actief"
    ]
  )

  const row = mapRow(result.rows[0])

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "persoonlijke_overtuiging",
    entityId: row.id as string,
    payload: {
      userId: input.userId,
      name: input.name,
      programId: input.programId || null,
      status: input.status || "Actief"
    },
    priority: 40
  })

  return row
}

export async function update(
  id: string,
  userId: string,
  updates: {
    name?: string
    status?: string
    completedDate?: string | null
  }
): Promise<Record<string, unknown> | null> {
  const setClauses: string[] = []
  const params: unknown[] = [id, userId]
  let paramIndex = 3

  if (updates.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`)
    params.push(updates.name)
  }
  if (updates.status !== undefined) {
    setClauses.push(`status = $${paramIndex++}`)
    params.push(updates.status)
  }
  if (updates.completedDate !== undefined) {
    setClauses.push(`completed_date = $${paramIndex++}`)
    params.push(updates.completedDate)
  }

  if (setClauses.length === 0) return null

  setClauses.push("updated_at = NOW()")

  const result = await dbQuery<Record<string, unknown>>(
    `UPDATE persoonlijke_overtuigingen_pg
     SET ${setClauses.join(", ")}
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    params
  )

  if (result.rows.length === 0) return null

  const row = mapRow(result.rows[0])

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "persoonlijke_overtuiging",
    entityId: id,
    payload: {
      userId,
      name: updates.name ?? (row.name as string),
      status: updates.status ?? (row.status as string),
      completedDate: updates.completedDate !== undefined ? updates.completedDate : (row.completedDate as string | undefined) || null,
      programId: (row.programId as string | undefined) || null
    },
    priority: 40
  })

  return row
}
