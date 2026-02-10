import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { PERSONAL_GOAL_USAGE_FIELDS, USER_FIELDS, transformUserRewards, isValidRecordId } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import {
  countGoalUsageForUserGoalDate,
  createPersonalGoalUsage,
  listPersonalGoalCountsByUserDate,
  personalGoalBelongsToUser,
  upsertPersonalGoal
} from "../_lib/repos/personal-goal-usage-repo.js"
import { calculateNextStreak } from "../_lib/repos/streak-utils.js"
import { getUserByIdWithReadThrough } from "../_lib/sync/user-readthrough.js"
import { updateUserStreakFields } from "../_lib/repos/user-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

const PERSONAL_GOAL_BACKEND_ENV = "DATA_BACKEND_PERSONAL_GOAL_USAGE"

const POINTS = {
  personalGoal: 10
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

async function handleGetPostgres(req: Request, res: Response, tokenUserId: string) {
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

async function handlePostPostgres(req: Request, res: Response, tokenUserId: string) {
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

  const user = await getUserByIdWithReadThrough(body.userId)
  if (user) {
    const next = calculateNextStreak({
      lastActiveDate: user.lastActiveDate,
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      today: body.date
    })

    await updateUserStreakFields({
      userId: body.userId,
      currentStreak: next.currentStreak,
      longestStreak: next.longestStreak,
      lastActiveDate: body.date
    })

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "user",
      entityId: body.userId,
      payload: {
        userId: body.userId,
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        lastActiveDate: body.date
      },
      priority: 10
    })
  }

  return sendSuccess(res, {
    id: usage.id,
    pointsAwarded: POINTS.personalGoal,
    todayCount: counts.todayCount,
    totalCount: counts.totalCount
  }, 201)
}

async function handleGetAirtable(req: Request, res: Response, tokenUserId: string) {
  const { userId, date } = req.query
  const targetUserId = (typeof userId === "string" && userId) ? userId : tokenUserId

  if (targetUserId !== tokenUserId) {
    return sendError(res, "Cannot view another user's personal goal usage", 403)
  }

  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }

  if (!isValidRecordId(targetUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  const allRecords = await base(tables.personalGoalUsage)
    .select({
      returnFieldsByFieldId: true
    })
    .all()

  const counts: Record<string, { today: number; total: number }> = {}
  allRecords.forEach(r => {
    const fields = r.fields as Record<string, unknown>
    const userField = fields[PERSONAL_GOAL_USAGE_FIELDS.user] as string[] | undefined
    if (!userField?.includes(targetUserId)) return

    const goalField = fields[PERSONAL_GOAL_USAGE_FIELDS.personalGoal] as string[] | undefined
    const recordDate = fields[PERSONAL_GOAL_USAGE_FIELDS.date] as string | undefined
    const goalId = goalField?.[0]
    if (!goalId) return
    if (!counts[goalId]) counts[goalId] = { today: 0, total: 0 }
    counts[goalId].total += 1
    if (recordDate === date) counts[goalId].today += 1
  })

  return sendSuccess(res, counts)
}

async function handlePostAirtable(req: Request, res: Response, tokenUserId: string) {
  const body = createUsageSchema.parse(parseBody(req))

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create personal goal usage for another user", 403)
  }
  if (!isValidRecordId(body.userId) || !isValidRecordId(body.personalGoalId)) {
    return sendError(res, "Invalid ID format", 400)
  }

  try {
    const goalRecord = await base(tables.personalGoals).find(body.personalGoalId)
    const goalFields = goalRecord.fields as Record<string, unknown>
    const goalUserIds = goalFields["Gebruikers"] as string[] | undefined
    if (!goalUserIds?.includes(tokenUserId)) {
      return sendError(res, "Cannot complete another user's personal goal", 403)
    }
  } catch {
    return sendError(res, "Personal goal not found", 404)
  }

  const record = await base(tables.personalGoalUsage).create({
    [PERSONAL_GOAL_USAGE_FIELDS.user]: [body.userId],
    [PERSONAL_GOAL_USAGE_FIELDS.personalGoal]: [body.personalGoalId],
    [PERSONAL_GOAL_USAGE_FIELDS.date]: body.date
  }, {
    typecast: true
  })

  const allRecords = await base(tables.personalGoalUsage)
    .select({
      returnFieldsByFieldId: true
    })
    .all()

  let todayCount = 0
  let totalCount = 0
  allRecords.forEach(r => {
    const fields = r.fields as Record<string, unknown>
    const userField = fields[PERSONAL_GOAL_USAGE_FIELDS.user] as string[] | undefined
    const goalField = fields[PERSONAL_GOAL_USAGE_FIELDS.personalGoal] as string[] | undefined
    const recordDate = fields[PERSONAL_GOAL_USAGE_FIELDS.date] as string | undefined
    if (!userField?.includes(body.userId)) return
    if (goalField?.[0] !== body.personalGoalId) return
    totalCount += 1
    if (recordDate === body.date) todayCount += 1
  })

  const userRecords = await base(tables.users)
    .select({
      filterByFormula: `RECORD_ID() = "${body.userId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (userRecords.length > 0) {
    const currentRewards = transformUserRewards(userRecords[0] as { id: string; fields: Record<string, unknown> })
    const next = calculateNextStreak({
      lastActiveDate: currentRewards.lastActiveDate || null,
      currentStreak: currentRewards.currentStreak,
      longestStreak: currentRewards.longestStreak,
      today: body.date
    })
    await base(tables.users).update(body.userId, {
      [USER_FIELDS.currentStreak]: next.currentStreak,
      [USER_FIELDS.longestStreak]: next.longestStreak,
      [USER_FIELDS.lastActiveDate]: body.date
    })
  }

  return sendSuccess(res, {
    id: record.id,
    pointsAwarded: POINTS.personalGoal,
    todayCount,
    totalCount
  }, 201)
}

export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const mode = getDataBackendMode(PERSONAL_GOAL_BACKEND_ENV)
    const usePostgres = mode === "postgres_primary" && isPostgresConfigured()

    switch (req.method) {
      case "GET":
        if (usePostgres) {
          return handleGetPostgres(req, res, auth.userId)
        }
        if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
          void handleGetPostgres(req, res, auth.userId)
            .then(() => undefined)
            .catch((error) => console.warn("[personal-goal-usage] shadow read failed:", error))
        }
        return handleGetAirtable(req, res, auth.userId)
      case "POST":
        return usePostgres
          ? handlePostPostgres(req, res, auth.userId)
          : handlePostAirtable(req, res, auth.userId)
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

