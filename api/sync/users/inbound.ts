import type { Request, Response } from "express"
import { z } from "zod"
import { sendSuccess, sendError, handleApiError } from "../../_lib/api-utils.js"
import { verifyHmacSignature } from "../../_lib/sync/webhook-auth.js"
import {
  ensureInboundEventNotDuplicate,
  syncUserRecords,
  type AirtableUserSyncRecord
} from "../../_lib/sync/user-fast-lane.js"
import { dbQuery } from "../../_lib/db/client.js"

const webhookPayloadSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.enum(["user.created", "user.updated", "user.deleted"]),
  occurredAt: z.string(),
  user: z.object({
    id: z.string().min(1),
    email: z.string().email(),
    name: z.string(),
    role: z.string().optional(),
    languageCode: z.string().optional(),
    passwordHash: z.string().optional()
  })
})

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
    const secret = process.env.AIRTABLE_USER_SYNC_SECRET
    if (!secret) {
      console.error("[user-webhook] AIRTABLE_USER_SYNC_SECRET is not configured")
      return sendError(res, "Webhook not configured", 500)
    }

    // HMAC signature validation
    const signature = req.headers["x-signature"]
    if (!signature || typeof signature !== "string") {
      return sendError(res, "Missing signature", 401)
    }

    // Use raw body preserved by express.json verify callback for accurate HMAC verification
    const rawBody = (req as unknown as Record<string, unknown>).rawBody as string | undefined
    if (!rawBody) {
      return sendError(res, "Unable to verify signature", 500)
    }
    if (!verifyHmacSignature(rawBody, signature, secret)) {
      return sendError(res, "Invalid signature", 401)
    }

    // Validate payload
    const payload = webhookPayloadSchema.parse(req.body)

    // Idempotency check
    const isNew = await ensureInboundEventNotDuplicate(payload.eventId, "user_webhook")
    if (!isNew) {
      console.log(`[user-webhook] Deduplicated event ${payload.eventId}`)
      return sendSuccess(res, { eventId: payload.eventId, deduplicated: true })
    }

    const { eventType, user } = payload
    console.log(`[user-webhook] Processing ${eventType} for user ${user.id} (${user.email})`)

    if (eventType === "user.deleted") {
      await dbQuery(
        `UPDATE users_pg SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
        [user.id]
      )
      console.log(`[user-webhook] Marked user ${user.id} as deleted`)
      return sendSuccess(res, { eventId: payload.eventId, status: "processed" })
    }

    // user.created or user.updated
    const syncRecord: AirtableUserSyncRecord = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || null,
      languageCode: user.languageCode || null,
      passwordHash: user.passwordHash || null
    }

    await syncUserRecords([syncRecord])
    console.log(`[user-webhook] Synced user ${user.id} via ${eventType}`)

    return sendSuccess(res, { eventId: payload.eventId, status: "processed" })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, `Invalid payload: ${error.issues[0].message}`, 400)
    }
    return handleApiError(res, error)
  }
}
