import type { Request, Response } from "express"
import { z } from "zod"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  createOvertuigingUsage,
  findOvertuigingUsage,
  listOvertuigingUsageByUser,
  listOvertuigingUsageByUserAndProgram
} from "../_lib/repos/overtuiging-usage-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { awardRewardActivity } from "../_lib/rewards/engine.js"

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  overtuigingId: z.string().min(1, "Overtuiging ID is required"),
  programId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

async function handleGet(req: Request, res: Response, tokenUserId: string) {
  const { programId, all } = req.query
  const fetchAll = all === "true"

  let progress: Record<string, { completed: true }>
  if (fetchAll || !programId || typeof programId !== "string") {
    progress = await listOvertuigingUsageByUser(tokenUserId)
  } else {
    progress = await listOvertuigingUsageByUserAndProgram(tokenUserId, programId)
  }

  console.log("[overtuiging-usage] GET", fetchAll ? "all" : `program:${programId}`, "user:", tokenUserId, "completed:", Object.keys(progress).length)
  return sendSuccess(res, progress)
}

async function handlePost(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createUsageSchema.parse(rawBody)

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create overtuiging usage for another user", 403)
  }

  const existing = await findOvertuigingUsage(body.userId, body.overtuigingId)
  if (existing) {
    // Idempotent — return success so the UI can update correctly
    return sendSuccess(res, { id: existing.id, pointsAwarded: 0 })
  }

  const created = await createOvertuigingUsage({
    userId: body.userId,
    overtuigingId: body.overtuigingId,
    programId: body.programId || null,
    date: body.date
  })

  let pointsAwarded = 1
  try {
    await awardRewardActivity({
      userId: body.userId,
      activityType: "overtuiging",
      activityDate: body.date
    })
  } catch (err) {
    console.error("[overtuiging-usage] awardRewardActivity failed:", err)
    pointsAwarded = 0
  }

  try {
    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "overtuiging_usage",
      entityId: created.id,
      payload: {
        userId: body.userId,
        overtuigingId: body.overtuigingId,
        programId: body.programId || null,
        date: body.date
      },
      priority: 40
    })
  } catch (err) {
    console.warn("[overtuiging-usage] enqueueSyncEvent failed:", err)
  }

  return sendSuccess(res, { id: created.id, pointsAwarded }, 201)
}

export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    switch (req.method) {
      case "GET":
        return handleGet(req, res, auth.userId)
      case "POST":
        return handlePost(req, res, auth.userId)
      default:
        return sendError(res, "Method not allowed", 405)
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
