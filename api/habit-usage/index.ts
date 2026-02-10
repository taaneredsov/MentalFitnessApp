import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  HABIT_USAGE_FIELDS,
  FIELD_NAMES,
  USER_FIELDS,
  transformUserRewards,
  escapeFormulaValue,
  isValidRecordId
} from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import {
  createHabitUsage,
  deleteHabitUsage,
  findHabitUsage,
  listHabitMethodIdsForDate
} from "../_lib/repos/habit-usage-repo.js"
import { getUserByIdWithReadThrough } from "../_lib/sync/user-readthrough.js"
import { calculateNextStreak } from "../_lib/repos/streak-utils.js"
import { updateUserStreakFields } from "../_lib/repos/user-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

const HABIT_BACKEND_ENV = "DATA_BACKEND_HABIT_USAGE"

const POINTS = {
  habit: 5,
  habitDayBonus: 5
} as const

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  methodId: z.string().min(1, "Method ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

async function handleGetPostgres(req: Request, res: Response, tokenUserId: string) {
  const { date } = req.query
  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }
  const completed = await listHabitMethodIdsForDate(tokenUserId, date)
  return sendSuccess(res, completed)
}

async function handlePostPostgres(req: Request, res: Response, tokenUserId: string) {
  const body = createUsageSchema.parse(parseBody(req))

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create habit usage for another user", 403)
  }

  const existing = await findHabitUsage(body.userId, body.methodId, body.date)
  if (existing) {
    return sendSuccess(res, { id: existing.id, pointsAwarded: 0 })
  }

  const created = await createHabitUsage({
    userId: body.userId,
    methodId: body.methodId,
    date: body.date
  })

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

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "habit_usage",
    entityId: created.id,
    payload: {
      userId: body.userId,
      methodId: body.methodId,
      date: body.date
    },
    priority: 40
  })

  return sendSuccess(res, { id: created.id, pointsAwarded: POINTS.habit }, 201)
}

async function handleDeletePostgres(req: Request, res: Response, tokenUserId: string) {
  const { userId, methodId, date } = req.query
  if (!userId || typeof userId !== "string") return sendError(res, "userId is required", 400)
  if (!methodId || typeof methodId !== "string") return sendError(res, "methodId is required", 400)
  if (!date || typeof date !== "string") return sendError(res, "date is required", 400)
  if (userId !== tokenUserId) {
    return sendError(res, "Cannot delete habit usage for another user", 403)
  }

  const existing = await findHabitUsage(userId, methodId, date)
  await deleteHabitUsage(userId, methodId, date)

  if (existing) {
    await enqueueSyncEvent({
      eventType: "delete",
      entityType: "habit_usage",
      entityId: existing.id,
      payload: {},
      priority: 40
    })
  }

  return sendSuccess(res, null)
}

async function handleGetAirtable(req: Request, res: Response, tokenUserId: string) {
  const { date } = req.query
  const userId = tokenUserId

  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }

  if (!isValidRecordId(userId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  const records = await base(tables.habitUsage)
    .select({
      filterByFormula: `IS_SAME({${FIELD_NAMES.habitUsage.date}}, "${escapeFormulaValue(date)}", 'day')`,
      returnFieldsByFieldId: true
    })
    .all()

  const completedHabitIds = records
    .filter(r => {
      const fields = r.fields as Record<string, unknown>
      const userField = fields[HABIT_USAGE_FIELDS.user] as string[] | undefined
      return userField?.includes(userId)
    })
    .map(r => {
      const fields = r.fields as Record<string, unknown>
      const methodField = fields[HABIT_USAGE_FIELDS.method] as string[] | undefined
      return methodField?.[0]
    })
    .filter(Boolean)

  return sendSuccess(res, completedHabitIds)
}

async function handlePostAirtable(req: Request, res: Response, tokenUserId: string) {
  const body = createUsageSchema.parse(parseBody(req))

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create habit usage for another user", 403)
  }

  if (!isValidRecordId(body.userId) || !isValidRecordId(body.methodId)) {
    return sendError(res, "Invalid ID format", 400)
  }

  const existingRecords = await base(tables.habitUsage)
    .select({
      filterByFormula: `IS_SAME({${FIELD_NAMES.habitUsage.date}}, "${escapeFormulaValue(body.date)}", 'day')`,
      returnFieldsByFieldId: true
    })
    .all()

  const existing = existingRecords.find(r => {
    const fields = r.fields as Record<string, unknown>
    const userIds = fields[HABIT_USAGE_FIELDS.user] as string[] | undefined
    const methodIds = fields[HABIT_USAGE_FIELDS.method] as string[] | undefined
    return userIds?.includes(body.userId) && methodIds?.includes(body.methodId)
  })

  if (existing) {
    return sendSuccess(res, { id: existing.id, pointsAwarded: 0 })
  }

  const record = await base(tables.habitUsage).create({
    [HABIT_USAGE_FIELDS.user]: [body.userId],
    [HABIT_USAGE_FIELDS.method]: [body.methodId],
    [HABIT_USAGE_FIELDS.date]: body.date
  }, {
    typecast: true
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

  return sendSuccess(res, { id: record.id, pointsAwarded: POINTS.habit }, 201)
}

async function handleDeleteAirtable(req: Request, res: Response, tokenUserId: string) {
  const { userId, methodId, date } = req.query
  if (!userId || typeof userId !== "string") return sendError(res, "userId is required", 400)
  if (!methodId || typeof methodId !== "string") return sendError(res, "methodId is required", 400)
  if (!date || typeof date !== "string") return sendError(res, "date is required", 400)
  if (userId !== tokenUserId) {
    return sendError(res, "Cannot delete habit usage for another user", 403)
  }
  if (!isValidRecordId(userId) || !isValidRecordId(methodId)) {
    return sendError(res, "Invalid ID format", 400)
  }

  const allRecords = await base(tables.habitUsage)
    .select({
      filterByFormula: `IS_SAME({${FIELD_NAMES.habitUsage.date}}, "${escapeFormulaValue(date)}", 'day')`,
      returnFieldsByFieldId: true
    })
    .all()

  const recordToDelete = allRecords.find(r => {
    const fields = r.fields as Record<string, unknown>
    const userIds = fields[HABIT_USAGE_FIELDS.user] as string[] | undefined
    const methodIds = fields[HABIT_USAGE_FIELDS.method] as string[] | undefined
    return userIds?.includes(userId) && methodIds?.includes(methodId)
  })

  if (recordToDelete) {
    await base(tables.habitUsage).destroy(recordToDelete.id)
  }

  return sendSuccess(res, null)
}

export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const mode = getDataBackendMode(HABIT_BACKEND_ENV)
    const usePostgres = mode === "postgres_primary" && isPostgresConfigured()

    switch (req.method) {
      case "GET":
        if (usePostgres) {
          return handleGetPostgres(req, res, auth.userId)
        }
        if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
          void handleGetPostgres(req, res, auth.userId)
            .then(() => undefined)
            .catch((error) => console.warn("[habit-usage] shadow read failed:", error))
        }
        return handleGetAirtable(req, res, auth.userId)
      case "POST":
        return usePostgres
          ? handlePostPostgres(req, res, auth.userId)
          : handlePostAirtable(req, res, auth.userId)
      case "DELETE":
        return usePostgres
          ? handleDeletePostgres(req, res, auth.userId)
          : handleDeleteAirtable(req, res, auth.userId)
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

