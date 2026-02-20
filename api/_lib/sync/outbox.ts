import type { PoolClient } from "pg"
import { dbQuery } from "../db/client.js"

export type SyncEntityType =
  | "program"
  | "program_schedule"
  | "method_usage"
  | "habit_usage"
  | "personal_goal"
  | "personal_goal_usage"
  | "overtuiging_usage"
  | "persoonlijke_overtuiging"
  | "user"

export type SyncEventType =
  | "upsert"
  | "delete"

interface EnqueueOptions {
  eventType: SyncEventType
  entityType: SyncEntityType
  entityId: string
  payload?: Record<string, unknown>
  priority?: number
  idempotencyKey?: string
}

function generateIdempotencyKey(options: EnqueueOptions): string {
  const payloadHash = JSON.stringify(options.payload || {})
  const raw = `${options.eventType}:${options.entityType}:${options.entityId}:${payloadHash}`
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i)
    hash |= 0
  }
  return `${options.eventType}:${options.entityType}:${options.entityId}:${Math.abs(hash)}`
}

async function enqueueWithClient(client: PoolClient, options: EnqueueOptions): Promise<void> {
  const idempotencyKey = options.idempotencyKey || generateIdempotencyKey(options)
  await client.query(
    `INSERT INTO sync_outbox (
      event_type,
      entity_type,
      entity_id,
      payload,
      priority,
      idempotency_key
    ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      options.eventType,
      options.entityType,
      options.entityId,
      JSON.stringify(options.payload || {}),
      options.priority ?? 100,
      idempotencyKey
    ]
  )
}

export async function enqueueSyncEvent(options: EnqueueOptions, client?: PoolClient): Promise<void> {
  if (client) {
    await enqueueWithClient(client, options)
    return
  }

  const idempotencyKey = options.idempotencyKey || generateIdempotencyKey(options)
  await dbQuery(
    `INSERT INTO sync_outbox (
      event_type,
      entity_type,
      entity_id,
      payload,
      priority,
      idempotency_key
    ) VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    ON CONFLICT (idempotency_key) DO NOTHING`,
    [
      options.eventType,
      options.entityType,
      options.entityId,
      JSON.stringify(options.payload || {}),
      options.priority ?? 100,
      idempotencyKey
    ]
  )
}
