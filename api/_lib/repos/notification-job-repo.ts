import { dbQuery, withDbTransaction } from "../db/client.js"
import type { NotificationJobPayload } from "../notifications/types.js"

export type NotificationJobStatus =
  | "pending"
  | "processing"
  | "sent"
  | "dead_letter"
  | "cancelled"
  | "skipped_quiet_hours"

export interface NotificationJobRow {
  id: number
  userId: string
  programId: string | null
  programScheduleId: string | null
  reminderDate: string
  mode: "session" | "daily_summary"
  fireAt: string
  payload: NotificationJobPayload
  dedupeKey: string
  status: NotificationJobStatus
  attemptCount: number
}

export interface NotificationJobCandidate {
  userId: string
  programId?: string | null
  programScheduleId?: string | null
  reminderDate: string
  mode: "session" | "daily_summary"
  fireAt: Date
  payload: NotificationJobPayload
  dedupeKey: string
  status: "pending" | "skipped_quiet_hours"
}

function mapRow(row: Record<string, unknown>): NotificationJobRow {
  return {
    id: Number(row.id),
    userId: String(row.user_id),
    programId: row.program_id ? String(row.program_id) : null,
    programScheduleId: row.program_schedule_id ? String(row.program_schedule_id) : null,
    reminderDate: String(row.reminder_date),
    mode: String(row.mode) as "session" | "daily_summary",
    fireAt: String(row.fire_at),
    payload: (row.payload as NotificationJobPayload) || {
      title: "",
      body: "",
      targetUrl: "/",
      mode: "session",
      reminderDate: String(row.reminder_date)
    },
    dedupeKey: String(row.dedupe_key),
    status: String(row.status) as NotificationJobStatus,
    attemptCount: Number(row.attempt_count || 0)
  }
}

export async function upsertNotificationJobs(jobs: NotificationJobCandidate[]): Promise<void> {
  for (const job of jobs) {
    const processedAt = job.status === "skipped_quiet_hours" ? new Date().toISOString() : null
    await dbQuery(
      `INSERT INTO notification_jobs_pg (
        user_id,
        program_id,
        program_schedule_id,
        reminder_date,
        mode,
        fire_at,
        payload,
        dedupe_key,
        status,
        next_attempt_at,
        processed_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, NOW()
      )
      ON CONFLICT (dedupe_key)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        program_id = EXCLUDED.program_id,
        program_schedule_id = EXCLUDED.program_schedule_id,
        reminder_date = EXCLUDED.reminder_date,
        mode = EXCLUDED.mode,
        fire_at = EXCLUDED.fire_at,
        payload = EXCLUDED.payload,
        status = CASE
          WHEN notification_jobs_pg.status = 'sent' THEN notification_jobs_pg.status
          ELSE EXCLUDED.status
        END,
        attempt_count = CASE
          WHEN notification_jobs_pg.status = 'sent' THEN notification_jobs_pg.attempt_count
          ELSE 0
        END,
        next_attempt_at = CASE
          WHEN notification_jobs_pg.status = 'sent' THEN notification_jobs_pg.next_attempt_at
          ELSE EXCLUDED.next_attempt_at
        END,
        processed_at = CASE
          WHEN notification_jobs_pg.status = 'sent' THEN notification_jobs_pg.processed_at
          ELSE EXCLUDED.processed_at
        END,
        last_error = NULL,
        updated_at = NOW()`,
      [
        job.userId,
        job.programId || null,
        job.programScheduleId || null,
        job.reminderDate,
        job.mode,
        job.fireAt.toISOString(),
        JSON.stringify(job.payload),
        job.dedupeKey,
        job.status,
        job.fireAt.toISOString(),
        processedAt
      ]
    )
  }
}

export async function cancelNotificationJobsForUser(userId: string): Promise<void> {
  await dbQuery(
    `UPDATE notification_jobs_pg
        SET status = 'cancelled',
            updated_at = NOW()
      WHERE user_id = $1
        AND status IN ('pending', 'processing', 'skipped_quiet_hours')`,
    [userId]
  )
}

export async function cancelNotificationJobsNotInSet(userId: string, dedupeKeys: string[]): Promise<void> {
  if (dedupeKeys.length === 0) {
    await cancelNotificationJobsForUser(userId)
    return
  }

  await dbQuery(
    `UPDATE notification_jobs_pg
        SET status = 'cancelled',
            updated_at = NOW()
      WHERE user_id = $1
        AND status IN ('pending', 'processing', 'skipped_quiet_hours')
        AND NOT (dedupe_key = ANY($2::text[]))`,
    [userId, dedupeKeys]
  )
}

export async function claimDueNotificationJobs(limit: number): Promise<NotificationJobRow[]> {
  return withDbTransaction(async (client) => {
    const select = await client.query<Record<string, unknown>>(
      `SELECT *
         FROM notification_jobs_pg
        WHERE status = 'pending'
          AND next_attempt_at <= NOW()
          AND fire_at <= NOW()
        ORDER BY fire_at ASC, id ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1`,
      [limit]
    )

    if (select.rows.length === 0) return []

    const ids = select.rows.map((row) => Number(row.id))
    await client.query(
      `UPDATE notification_jobs_pg
          SET status = 'processing',
              attempt_count = attempt_count + 1,
              updated_at = NOW()
        WHERE id = ANY($1::bigint[])`,
      [ids]
    )

    return select.rows.map((row) => {
      const mapped = mapRow(row)
      mapped.status = "processing"
      mapped.attemptCount += 1
      return mapped
    })
  })
}

export async function markNotificationJobSent(jobId: number): Promise<void> {
  await dbQuery(
    `UPDATE notification_jobs_pg
        SET status = 'sent',
            processed_at = NOW(),
            updated_at = NOW(),
            last_error = NULL
      WHERE id = $1`,
    [jobId]
  )
}

export async function markNotificationJobSkippedQuietHours(jobId: number): Promise<void> {
  await dbQuery(
    `UPDATE notification_jobs_pg
        SET status = 'skipped_quiet_hours',
            processed_at = NOW(),
            updated_at = NOW(),
            last_error = NULL
      WHERE id = $1`,
    [jobId]
  )
}

export async function markNotificationJobRetry(jobId: number, nextDelaySeconds: number, errorMessage: string): Promise<void> {
  await dbQuery(
    `UPDATE notification_jobs_pg
        SET status = 'pending',
            next_attempt_at = NOW() + ($2 || ' seconds')::interval,
            updated_at = NOW(),
            last_error = $3
      WHERE id = $1`,
    [jobId, String(nextDelaySeconds), errorMessage]
  )
}

export async function markNotificationJobDeadLetter(jobId: number, errorMessage: string): Promise<void> {
  await dbQuery(
    `UPDATE notification_jobs_pg
        SET status = 'dead_letter',
            processed_at = NOW(),
            updated_at = NOW(),
            last_error = $2
      WHERE id = $1`,
    [jobId, errorMessage]
  )
}

export async function insertNotificationDeliveryLog(input: {
  jobId: number
  subscriptionId: number
  success: boolean
  statusCode?: number
  errorMessage?: string
}): Promise<void> {
  await dbQuery(
    `INSERT INTO notification_delivery_log_pg (
      job_id,
      subscription_id,
      success,
      status_code,
      error_message
    ) VALUES ($1, $2, $3, $4, $5)`,
    [
      input.jobId,
      input.subscriptionId,
      input.success,
      input.statusCode || null,
      input.errorMessage || null
    ]
  )
}
