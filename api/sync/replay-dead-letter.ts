import type { Request, Response } from "express"
import { parseBody, sendError, sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { replayDeadLetter } from "../_lib/sync/replay.js"

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
    const id = Number(body.id)

    if (!Number.isFinite(id) || id <= 0) {
      return sendError(res, "id is required", 400)
    }

    const enqueued = await replayDeadLetter(id)
    if (!enqueued) {
      return sendError(res, "Dead-letter item not found", 404)
    }

    return sendSuccess(res, { replayed: true, id })
  } catch (error) {
    return handleApiError(res, error)
  }
}

