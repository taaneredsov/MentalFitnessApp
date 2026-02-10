import { dbQuery } from "../db/client.js"

export async function replayDeadLetter(id: number): Promise<boolean> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT * FROM sync_dead_letter WHERE id = $1 LIMIT 1`,
    [id]
  )
  if (result.rows.length === 0) return false

  const row = result.rows[0]
  const payload = row.payload || {}
  const idempotencyKey = `replay:${id}:${Date.now()}`

  await dbQuery(
    `INSERT INTO sync_outbox (
      event_type,
      entity_type,
      entity_id,
      payload,
      idempotency_key,
      priority,
      status,
      attempt_count,
      next_attempt_at
    ) VALUES ($1, $2, $3, $4::jsonb, $5, 50, 'pending', 0, NOW())`,
    [
      String(row.event_type),
      String(row.entity_type),
      String(row.entity_id),
      JSON.stringify(payload),
      idempotencyKey
    ]
  )

  return true
}

