import type { Request, Response } from "express"
import { isPostgresConfigured, dbQuery } from "./_lib/db/client.js"

export default async function handler(_req: Request, res: Response) {
  const timestamp = new Date().toISOString()
  let pgStatus: "ok" | "unavailable" | "error" = "unavailable"
  let pgDetails: Record<string, unknown> = {}

  if (isPostgresConfigured()) {
    try {
      await dbQuery("SELECT 1")
      pgStatus = "ok"

      // Query sync_outbox stats
      const [pendingResult, oldestResult, deadResult] = await Promise.all([
        dbQuery<{ count: string }>(
          `SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'pending'`
        ),
        dbQuery<{ age_seconds: string | null }>(
          `SELECT EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::integer as age_seconds
           FROM sync_outbox WHERE status = 'pending'`
        ),
        dbQuery<{ count: string }>(
          `SELECT COUNT(*) as count FROM sync_outbox WHERE status = 'dead_letter'`
        )
      ])

      let notificationDetails: Record<string, unknown> = {
        pendingJobs: null,
        oldestPendingSeconds: null,
        deadLetterJobs: null,
        skippedQuietHoursJobs: null
      }

      const notificationsTableCheck = await dbQuery<{ exists: boolean }>(
        `SELECT to_regclass('public.notification_jobs_pg') IS NOT NULL as exists`
      )

      if (notificationsTableCheck.rows[0]?.exists) {
        const [pendingNotifications, oldestPendingNotifications, deadNotifications, skippedQuietHours] = await Promise.all([
          dbQuery<{ count: string }>(
            `SELECT COUNT(*) as count FROM notification_jobs_pg WHERE status = 'pending'`
          ),
          dbQuery<{ age_seconds: string | null }>(
            `SELECT EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))::integer as age_seconds
               FROM notification_jobs_pg WHERE status = 'pending'`
          ),
          dbQuery<{ count: string }>(
            `SELECT COUNT(*) as count FROM notification_jobs_pg WHERE status = 'dead_letter'`
          ),
          dbQuery<{ count: string }>(
            `SELECT COUNT(*) as count FROM notification_jobs_pg WHERE status = 'skipped_quiet_hours'`
          )
        ])

        notificationDetails = {
          pendingJobs: Number(pendingNotifications.rows[0]?.count || 0),
          oldestPendingSeconds: pendingNotifications.rows[0]?.count === "0"
            ? null
            : Number(oldestPendingNotifications.rows[0]?.age_seconds || 0),
          deadLetterJobs: Number(deadNotifications.rows[0]?.count || 0),
          skippedQuietHoursJobs: Number(skippedQuietHours.rows[0]?.count || 0)
        }
      }

      pgDetails = {
        pendingOutbox: Number(pendingResult.rows[0]?.count || 0),
        oldestPendingSeconds: pendingResult.rows[0]?.count === "0" ? null : Number(oldestResult.rows[0]?.age_seconds || 0),
        deadLetterCount: Number(deadResult.rows[0]?.count || 0),
        notifications: notificationDetails
      }
    } catch (err) {
      pgStatus = "error"
      pgDetails = { error: err instanceof Error ? err.message : "Unknown error" }
    }
  }

  const isHealthy = pgStatus !== "error"

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    timestamp,
    postgres: {
      status: pgStatus,
      ...pgDetails
    }
  })
}
