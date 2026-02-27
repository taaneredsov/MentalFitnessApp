import type { Request, Response } from "express"
import { z } from "zod"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  createGoedeGewoonteUsage,
  deleteGoedeGewoonteUsage,
  findGoedeGewoonteUsage,
  listGoedeGewoonteIdsForDate
} from "../_lib/repos/goede-gewoonte-usage-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { awardRewardActivity } from "../_lib/rewards/engine.js"

const POINTS = {
  habit: 5,
  habitDayBonus: 5
} as const

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  goedeGewoonteId: z.string().min(1, "Goede gewoonte ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

async function handleGet(req: Request, res: Response, tokenUserId: string) {
  const { date } = req.query
  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }
  const completed = await listGoedeGewoonteIdsForDate(tokenUserId, date)
  return sendSuccess(res, completed)
}

async function handlePost(req: Request, res: Response, tokenUserId: string) {
  const body = createUsageSchema.parse(parseBody(req))

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create habit usage for another user", 403)
  }

  const existing = await findGoedeGewoonteUsage(body.userId, body.goedeGewoonteId, body.date)
  if (existing) {
    return sendSuccess(res, { id: existing.id, pointsAwarded: 0 })
  }

  const created = await createGoedeGewoonteUsage({
    userId: body.userId,
    goedeGewoonteId: body.goedeGewoonteId,
    date: body.date
  })

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "goede_gewoonte_usage",
    entityId: created.id,
    payload: {
      userId: body.userId,
      goedeGewoonteId: body.goedeGewoonteId,
      date: body.date
    },
    priority: 40
  })

  await awardRewardActivity({
    userId: body.userId,
    activityType: "habit",
    activityDate: body.date
  })

  return sendSuccess(res, { id: created.id, pointsAwarded: POINTS.habit }, 201)
}

async function handleDelete(req: Request, res: Response, tokenUserId: string) {
  const { userId, goedeGewoonteId, date } = req.query
  if (!userId || typeof userId !== "string") return sendError(res, "userId is required", 400)
  if (!goedeGewoonteId || typeof goedeGewoonteId !== "string") return sendError(res, "goedeGewoonteId is required", 400)
  if (!date || typeof date !== "string") return sendError(res, "date is required", 400)
  if (userId !== tokenUserId) {
    return sendError(res, "Cannot delete habit usage for another user", 403)
  }

  const existing = await findGoedeGewoonteUsage(userId, goedeGewoonteId, date)
  await deleteGoedeGewoonteUsage(userId, goedeGewoonteId, date)

  if (existing) {
    await enqueueSyncEvent({
      eventType: "delete",
      entityType: "goede_gewoonte_usage",
      entityId: existing.id,
      payload: {},
      priority: 40
    })
  }

  return sendSuccess(res, null)
}

export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    switch (req.method) {
      case "GET":
        return handleGet(req, res, auth.userId)
      case "POST":
        return handlePost(req, res, auth.userId)
      case "DELETE":
        return handleDelete(req, res, auth.userId)
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
