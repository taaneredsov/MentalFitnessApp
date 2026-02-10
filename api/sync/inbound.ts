import type { Request, Response } from "express"
import { parseBody, sendError, sendSuccess, handleApiError } from "../_lib/api-utils.js"
import {
  ensureInboundEventNotDuplicate,
  fetchUserFromAirtableById,
  syncUserRecords,
  type AirtableUserSyncRecord
} from "../_lib/sync/user-fast-lane.js"

function normalizeUserRecord(input: any): AirtableUserSyncRecord | null {
  if (!input) return null
  if (typeof input.id !== "string") return null

  if (input.fields && typeof input.fields === "object") {
    return {
      id: input.id,
      name: String(input.fields.name || ""),
      email: String(input.fields.email || ""),
      role: input.fields.role || null,
      languageCode: input.fields.languageCode || null,
      passwordHash: input.fields.passwordHash || null,
      lastLogin: input.fields.lastLogin || null
    }
  }

  return {
    id: input.id,
    name: String(input.name || ""),
    email: String(input.email || ""),
    role: input.role || null,
    languageCode: input.languageCode || null,
    passwordHash: input.passwordHash || null,
    lastLogin: input.lastLogin || null
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const secret = req.headers["x-sync-secret"]
    if (!secret || secret !== process.env.AIRTABLE_INBOUND_SYNC_SECRET) {
      return sendError(res, "Unauthorized", 401)
    }

    const body = parseBody(req)
    const table = body.table

    if (table !== "users") {
      return sendError(res, "Only users fast-lane is supported on this endpoint", 400)
    }

    const eventId = String(
      body.eventId ||
      body.event_id ||
      `${Date.now()}-${body.recordId || body.record_id || "batch"}`
    )

    const accepted = await ensureInboundEventNotDuplicate(eventId)
    if (!accepted) {
      return sendSuccess(res, { deduplicated: true, eventId })
    }

    const records: AirtableUserSyncRecord[] = []
    if (Array.isArray(body.records)) {
      for (const raw of body.records) {
        const normalized = normalizeUserRecord(raw)
        if (normalized?.id && normalized?.email) {
          records.push(normalized)
        }
      }
    } else if (typeof body.recordId === "string" || typeof body.record_id === "string") {
      const recordId = String(body.recordId || body.record_id)
      const loaded = await fetchUserFromAirtableById(recordId)
      if (loaded) {
        records.push(loaded)
      }
    }

    if (records.length === 0) {
      return sendError(res, "No valid user records in payload", 400)
    }

    const synced = await syncUserRecords(records)

    return sendSuccess(res, {
      eventId,
      synced: synced.length
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}

