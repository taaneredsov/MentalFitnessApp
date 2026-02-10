import { dbQuery, closeDbPool, isPostgresConfigured, withDbTransaction } from "../_lib/db/client.js"
import { writeOutboxEventToAirtable, RetryableSyncError } from "../_lib/sync/airtable-writers.js"
import { readBooleanFlag } from "../_lib/data-backend.js"
import { syncAllUsersFromAirtable } from "../_lib/sync/user-fast-lane.js"
import { runFullAirtableToPostgresSync } from "../_lib/sync/full-sync.js"
import { processNotificationBatch, runNotificationReconcile } from "../_lib/notifications/worker.js"

interface OutboxRow {
  id: number
  event_type: string
  entity_type: string
  entity_id: string
  payload: Record<string, unknown>
  attempt_count: number
}

const BATCH_SIZE = Number(process.env.SYNC_BATCH_SIZE || 20)
const MAX_RETRIES = Number(process.env.SYNC_MAX_RETRIES || 6)
const POLL_INTERVAL_MS = Number(process.env.SYNC_POLL_INTERVAL_MS || 2000)
const RETRY_BASE_SECONDS = Number(process.env.SYNC_RETRY_BASE_SECONDS || 5)
const USER_FAST_LANE_ENABLED = readBooleanFlag("USER_FAST_LANE_ENABLED", true)
const USER_FALLBACK_POLL_SECONDS = Number(process.env.SYNC_USER_FALLBACK_POLL_SECONDS || 60)
const FULL_AIRTABLE_POLL_SYNC_ENABLED = readBooleanFlag("FULL_AIRTABLE_POLL_SYNC_ENABLED", true)
const FULL_AIRTABLE_POLL_SECONDS = Number(process.env.SYNC_FULL_POLL_SECONDS || 120)
const PUSH_NOTIFICATIONS_ENABLED = readBooleanFlag("PUSH_NOTIFICATIONS_ENABLED", true)
const NOTIFICATION_RECONCILE_SECONDS = Number(process.env.NOTIFICATION_RECONCILE_SECONDS || 120)

async function claimOutboxBatch(limit: number): Promise<OutboxRow[]> {
  return withDbTransaction(async (client) => {
    const select = await client.query<OutboxRow>(
      `SELECT id, event_type, entity_type, entity_id, payload, attempt_count
       FROM sync_outbox
       WHERE status = 'pending'
         AND next_attempt_at <= NOW()
       ORDER BY priority ASC, id ASC
       FOR UPDATE SKIP LOCKED
       LIMIT $1`,
      [limit]
    )

    if (select.rows.length === 0) {
      return []
    }

    const ids = select.rows.map((row) => row.id)
    await client.query(
      `UPDATE sync_outbox
       SET status = 'processing',
           attempt_count = attempt_count + 1,
           updated_at = NOW()
       WHERE id = ANY($1::bigint[])`,
      [ids]
    )

    return select.rows
  })
}

function computeRetryDelaySeconds(attemptCount: number): number {
  const multiplier = Math.max(1, attemptCount)
  return RETRY_BASE_SECONDS * multiplier * multiplier
}

async function markProcessed(id: number): Promise<void> {
  await dbQuery(
    `UPDATE sync_outbox
     SET status = 'processed',
         processed_at = NOW(),
         updated_at = NOW(),
         last_error = NULL
     WHERE id = $1`,
    [id]
  )
}

async function markRetry(id: number, attemptCount: number, errorMessage: string): Promise<void> {
  const delaySeconds = computeRetryDelaySeconds(attemptCount)
  await dbQuery(
    `UPDATE sync_outbox
     SET status = 'pending',
         next_attempt_at = NOW() + ($2 || ' seconds')::interval,
         updated_at = NOW(),
         last_error = $3
     WHERE id = $1`,
    [id, String(delaySeconds), errorMessage]
  )
}

async function moveToDeadLetter(row: OutboxRow, errorMessage: string): Promise<void> {
  await withDbTransaction(async (client) => {
    await client.query(
      `INSERT INTO sync_dead_letter (
        outbox_id,
        event_type,
        entity_type,
        entity_id,
        payload,
        error_message
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [row.id, row.event_type, row.entity_type, row.entity_id, JSON.stringify(row.payload || {}), errorMessage]
    )

    await client.query(
      `UPDATE sync_outbox
       SET status = 'dead_letter',
           updated_at = NOW(),
           last_error = $2
       WHERE id = $1`,
      [row.id, errorMessage]
    )
  })
}

async function processOutboxRow(row: OutboxRow): Promise<void> {
  try {
    await writeOutboxEventToAirtable({
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      payload: row.payload || {}
    })

    await markProcessed(row.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const retryable = error instanceof RetryableSyncError
    const attempts = row.attempt_count + 1

    if (retryable && attempts < MAX_RETRIES) {
      await markRetry(row.id, attempts, message)
      return
    }

    if (!retryable && attempts < MAX_RETRIES) {
      await markRetry(row.id, attempts, message)
      return
    }

    await moveToDeadLetter(row, message)
  }
}

export async function processSyncBatch(limit = BATCH_SIZE): Promise<number> {
  const rows = await claimOutboxBatch(limit)
  if (rows.length === 0) return 0

  for (const row of rows) {
    await processOutboxRow(row)
  }

  return rows.length
}

let lastUserFallbackPoll = 0
let lastFullPollSync = 0
let lastNotificationReconcile = 0

async function maybeRunUserFallbackPoll(): Promise<void> {
  if (!USER_FAST_LANE_ENABLED) return

  const now = Date.now()
  if ((now - lastUserFallbackPoll) < USER_FALLBACK_POLL_SECONDS * 1000) {
    return
  }

  lastUserFallbackPoll = now

  try {
    const count = await syncAllUsersFromAirtable()
    console.log("[sync-worker] user fallback poll synced records:", count)
  } catch (error) {
    console.error("[sync-worker] user fallback poll failed:", error)
  }
}

async function maybeRunFullPollSync(): Promise<void> {
  if (!FULL_AIRTABLE_POLL_SYNC_ENABLED) return

  const now = Date.now()
  if ((now - lastFullPollSync) < FULL_AIRTABLE_POLL_SECONDS * 1000) {
    return
  }

  lastFullPollSync = now

  try {
    const counts = await runFullAirtableToPostgresSync()
    console.log("[sync-worker] full Airtable->Postgres poll sync:", counts)
  } catch (error) {
    console.error("[sync-worker] full poll sync failed:", error)
  }
}

async function maybeRunNotificationReconcile(): Promise<void> {
  if (!PUSH_NOTIFICATIONS_ENABLED) return

  const now = Date.now()
  if ((now - lastNotificationReconcile) < NOTIFICATION_RECONCILE_SECONDS * 1000) {
    return
  }

  lastNotificationReconcile = now

  try {
    const processedUsers = await runNotificationReconcile()
    console.log("[sync-worker] notification reconcile users:", processedUsers)
  } catch (error) {
    console.error("[sync-worker] notification reconcile failed:", error)
  }
}

async function loop(): Promise<void> {
  if (!isPostgresConfigured()) {
    throw new Error("DATABASE_URL is required for sync worker")
  }

  console.log("[sync-worker] started", {
    batchSize: BATCH_SIZE,
    maxRetries: MAX_RETRIES,
    pollMs: POLL_INTERVAL_MS,
    pushNotificationsEnabled: PUSH_NOTIFICATIONS_ENABLED
  })

  let shuttingDown = false
  const shutdown = async (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[sync-worker] received ${signal}, shutting down`)
    await closeDbPool()
    process.exit(0)
  }

  process.on("SIGINT", () => void shutdown("SIGINT"))
  process.on("SIGTERM", () => void shutdown("SIGTERM"))

  while (!shuttingDown) {
    try {
      const outboxCount = await processSyncBatch()
      const notificationCount = PUSH_NOTIFICATIONS_ENABLED ? await processNotificationBatch() : 0
      await maybeRunUserFallbackPoll()
      await maybeRunFullPollSync()
      await maybeRunNotificationReconcile()
      if (outboxCount === 0 && notificationCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }
    } catch (error) {
      console.error("[sync-worker] batch failure:", error)
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  loop().catch(async (error) => {
    console.error("[sync-worker] fatal:", error)
    await closeDbPool()
    process.exit(1)
  })
}
