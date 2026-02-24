import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../_lib/api-utils.js"
import {
  ensureInboundEventNotDuplicate,
  fetchUserFromAirtableById,
  syncUserRecords
} from "../../_lib/sync/user-fast-lane.js"
import { dbQuery } from "../../_lib/db/client.js"

function readBooleanFlag(key: string, fallback: boolean): boolean {
  const val = process.env[key]
  if (val === undefined) return fallback
  return val === "true" || val === "1"
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  if (!readBooleanFlag("USER_WEBHOOK_SYNC_ENABLED", false)) {
    return sendError(res, "User webhook sync is disabled", 503)
  }

  try {
    // Simple shared-secret auth (same pattern as /api/sync/inbound)
    const secret = process.env.AIRTABLE_USER_SYNC_SECRET
    if (!secret) {
      console.error("[user-webhook] AIRTABLE_USER_SYNC_SECRET is not configured")
      return sendError(res, "Webhook not configured", 500)
    }

    const providedSecret = req.headers["x-sync-secret"]
    if (!providedSecret || providedSecret !== secret) {
      return sendError(res, "Unauthorized", 401)
    }

    const body = parseBody(req)
    const recordId = body.recordId || body.record_id
    if (!recordId || typeof recordId !== "string") {
      return sendError(res, "Missing recordId", 400)
    }

    // Idempotency: use recordId + timestamp bucket (1s) to deduplicate rapid-fire triggers
    const eventId = String(body.eventId || `user-webhook-${recordId}-${Math.floor(Date.now() / 1000)}`)
    const isNew = await ensureInboundEventNotDuplicate(eventId, "user_webhook")
    if (!isNew) {
      console.log(`[user-webhook] Deduplicated event ${eventId}`)
      return sendSuccess(res, { eventId, deduplicated: true })
    }

    // Fetch fresh user data from Airtable (server-side, no data from the script)
    console.log(`[user-webhook] Fetching user ${recordId} from Airtable`)
    const record = await fetchUserFromAirtableById(recordId)

    if (!record) {
      // User deleted from Airtable — mark as deleted in Postgres
      await dbQuery(
        `UPDATE users_pg SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
        [recordId]
      )
      console.log(`[user-webhook] User ${recordId} not found in Airtable, marked as deleted`)
      return sendSuccess(res, { eventId, status: "deleted" })
    }

    // Sync user to Postgres (status mapping Actief→active, Geen toegang→disabled is handled by toSyncRecord)
    await syncUserRecords([record])
    console.log(`[user-webhook] Synced user ${recordId} (${record.email}, status: ${record.status || "active"})`)

    return sendSuccess(res, { eventId, status: "synced" })
  } catch (error) {
    return handleApiError(res, error)
  }
}
