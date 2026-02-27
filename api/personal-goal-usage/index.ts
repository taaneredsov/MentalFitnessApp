import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  countGoalUsageForUserGoalDate,
  createPersonalGoalUsage,
  listPersonalGoalCountsByUserDate,
  personalGoalBelongsToUser,
  upsertPersonalGoal
} from "../_lib/repos/personal-goal-usage-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { awardRewardActivity } from "../_lib/rewards/engine.js"

const POINTS = {
  personalGoal: 5
} as const

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  personalGoalId: z.string().min(1, "Personal Goal ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

async function ensurePersonalGoalForUser(personalGoalId: string, userId: string): Promise<boolean> {
  if (await personalGoalBelongsToUser(personalGoalId, userId)) {
    return true
  }

  try {
    const goalRecord = await base(tables.personalGoals).find(personalGoalId)
    const goalFields = goalRecord.fields as Record<string, unknown>
    const goalUserIds = goalFields["Gebruikers"] as string[] | undefined
    if (!goalUserIds?.includes(userId)) {
      return false
    }

    await upsertPersonalGoal({
      id: goalRecord.id,
      userId,
      name: String(goalFields["Naam"] || "Persoonlijk doel"),
      description: goalFields["Beschrijving"] ? String(goalFields["Beschrijving"]) : null,
      active: String(goalFields["Status"] || "Actief") !== "Gearchiveerd"
    })

    return true
  } catch {
    return false
  }
}

async function handleGet(req: Request, res: Response, tokenUserId: string) {
  const { userId, date } = req.query
  const targetUserId = (typeof userId === "string" && userId) ? userId : tokenUserId

  if (targetUserId !== tokenUserId) {
    return sendError(res, "Cannot view another user's personal goal usage", 403)
  }
  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }

  const counts = await listPersonalGoalCountsByUserDate(targetUserId, date)
  return sendSuccess(res, counts)
}

async function handlePost(req: Request, res: Response, tokenUserId: string) {
  const body = createUsageSchema.parse(parseBody(req))

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create personal goal usage for another user", 403)
  }

  const goalAllowed = await ensurePersonalGoalForUser(body.personalGoalId, tokenUserId)
  if (!goalAllowed) {
    return sendError(res, "Cannot complete another user's personal goal", 403)
  }

  const usage = await createPersonalGoalUsage({
    userId: body.userId,
    personalGoalId: body.personalGoalId,
    date: body.date
  })

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "personal_goal_usage",
    entityId: usage.id,
    payload: {
      userId: body.userId,
      personalGoalId: body.personalGoalId,
      date: body.date
    },
    priority: 40
  })

  const counts = await countGoalUsageForUserGoalDate(body.userId, body.personalGoalId, body.date)

  let pointsAwarded: number = POINTS.personalGoal
  try {
    await awardRewardActivity({
      userId: body.userId,
      activityType: "personalGoal",
      activityDate: body.date
    })
  } catch (err) {
    console.error("[personal-goal-usage] awardRewardActivity failed:", err)
    pointsAwarded = 0
  }

  return sendSuccess(res, {
    id: usage.id,
    pointsAwarded,
    todayCount: counts.todayCount,
    totalCount: counts.totalCount
  }, 201)
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
