import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { OVERTUIGING_USAGE_FIELDS, USER_FIELDS, transformUserRewards, isValidRecordId } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import {
  createOvertuigingUsage,
  findOvertuigingUsage,
  listOvertuigingUsageByUser,
  listOvertuigingUsageByUserAndProgram
} from "../_lib/repos/overtuiging-usage-repo.js"
import { getProgramByAnyId } from "../_lib/repos/program-repo.js"
import { getUserByIdWithReadThrough } from "../_lib/sync/user-readthrough.js"
import { calculateNextStreak } from "../_lib/repos/streak-utils.js"
import { updateUserStreakFields, incrementUserBonusPoints } from "../_lib/repos/user-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { isEntityId } from "../_lib/db/id-utils.js"

const OVERTUIGING_BACKEND_ENV = "DATA_BACKEND_OVERTUIGING_USAGE"

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  overtuigingId: z.string().min(1, "Overtuiging ID is required"),
  programId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

async function resolveProgramAirtableId(programId: string, tokenUserId: string): Promise<string | null> {
  if (isValidRecordId(programId)) {
    return programId
  }

  if (!isPostgresConfigured() || !isEntityId(programId)) {
    return null
  }

  try {
    const program = await getProgramByAnyId(programId, tokenUserId)
    if (program?.airtableRecordId && isValidRecordId(program.airtableRecordId)) {
      return program.airtableRecordId
    }
  } catch (error) {
    console.warn("[overtuiging-usage] Failed to resolve program Airtable ID:", error)
  }

  return null
}

async function handleGetPostgres(req: Request, res: Response, tokenUserId: string) {
  const { programId, all } = req.query
  const fetchAll = all === "true"

  let progress: Record<string, { completed: true }>
  if (fetchAll || !programId || typeof programId !== "string") {
    progress = await listOvertuigingUsageByUser(tokenUserId)
  } else {
    progress = await listOvertuigingUsageByUserAndProgram(tokenUserId, programId)
  }

  console.log("[overtuiging-usage] GET postgres", fetchAll ? "all" : `program:${programId}`, "user:", tokenUserId, "completed:", Object.keys(progress).length)
  return sendSuccess(res, progress)
}

async function handlePostPostgres(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createUsageSchema.parse(rawBody)

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create overtuiging usage for another user", 403)
  }

  const existing = await findOvertuigingUsage(body.userId, body.overtuigingId)
  if (existing) {
    return sendError(res, "Overtuiging already completed", 400)
  }

  const created = await createOvertuigingUsage({
    userId: body.userId,
    overtuigingId: body.overtuigingId,
    programId: body.programId || null,
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

    await incrementUserBonusPoints(body.userId, 1)

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "user",
      entityId: body.userId,
      payload: {
        userId: body.userId,
        currentStreak: next.currentStreak,
        longestStreak: next.longestStreak,
        lastActiveDate: body.date,
        bonusPoints: (user.bonusPoints || 0) + 1
      },
      priority: 10
    })
  }

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

  return sendSuccess(res, { id: created.id, pointsAwarded: 1 }, 201)
}

async function handleGetAirtable(req: Request, res: Response, tokenUserId: string) {
  const { programId, all } = req.query

  const fetchAll = all === "true"
  let resolvedProgramId: string | null = null

  if (!fetchAll) {
    if (!programId || typeof programId !== "string") {
      return sendError(res, "programId is required (or use all=true)", 400)
    }
    resolvedProgramId = await resolveProgramAirtableId(programId, tokenUserId)
  }

  const allRecords = await base(tables.overtuigingenGebruik)
    .select({
      returnFieldsByFieldId: true
    })
    .all()

  const progress: Record<string, { completed: boolean }> = {}

  allRecords.forEach(r => {
    const fields = r.fields as Record<string, unknown>
    const userField = fields[OVERTUIGING_USAGE_FIELDS.user] as string[] | undefined
    const programField = fields[OVERTUIGING_USAGE_FIELDS.program] as string[] | undefined

    if (!userField?.includes(tokenUserId)) return

    if (!fetchAll && resolvedProgramId) {
      const belongsToProgram = programField?.includes(resolvedProgramId)
      const isStandalone = !programField || programField.length === 0
      if (!belongsToProgram && !isStandalone) return
    }

    const overtuigingField = fields[OVERTUIGING_USAGE_FIELDS.overtuiging] as string[] | undefined
    const overtuigingId = overtuigingField?.[0]

    if (!overtuigingId) return

    progress[overtuigingId] = { completed: true }
  })

  console.log("[overtuiging-usage] GET", fetchAll ? "all" : `program:${programId}`, "user:", tokenUserId, "completed:", Object.keys(progress).length)

  return sendSuccess(res, progress)
}

async function handlePostAirtable(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createUsageSchema.parse(rawBody)

  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create overtuiging usage for another user", 403)
  }

  if (!isValidRecordId(body.userId) || !isValidRecordId(body.overtuigingId)) {
    return sendError(res, "Invalid ID format", 400)
  }

  const resolvedProgramId = body.programId
    ? await resolveProgramAirtableId(body.programId, tokenUserId)
    : null

  const existingRecords = await base(tables.overtuigingenGebruik)
    .select({
      returnFieldsByFieldId: true
    })
    .all()

  const alreadyCompleted = existingRecords.some(r => {
    const fields = r.fields as Record<string, unknown>
    const userField = fields[OVERTUIGING_USAGE_FIELDS.user] as string[] | undefined
    const overtuigingField = fields[OVERTUIGING_USAGE_FIELDS.overtuiging] as string[] | undefined

    return userField?.includes(body.userId) &&
      overtuigingField?.includes(body.overtuigingId)
  })

  if (alreadyCompleted) {
    return sendError(res, "Overtuiging already completed", 400)
  }

  const createFields: Record<string, unknown> = {
    [OVERTUIGING_USAGE_FIELDS.user]: [body.userId],
    [OVERTUIGING_USAGE_FIELDS.overtuiging]: [body.overtuigingId],
    [OVERTUIGING_USAGE_FIELDS.date]: body.date
  }
  if (resolvedProgramId) {
    createFields[OVERTUIGING_USAGE_FIELDS.program] = [resolvedProgramId]
  }

  const record = await base(tables.overtuigingenGebruik).create(createFields, {
    typecast: true
  })

  console.log("[overtuiging-usage] Created record:", record.id, "for user:", body.userId, "overtuiging:", body.overtuigingId)

  const userRecords = await base(tables.users)
    .select({
      filterByFormula: `RECORD_ID() = "${body.userId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (userRecords.length > 0) {
    const currentRewards = transformUserRewards(userRecords[0] as { id: string; fields: Record<string, unknown> })

    const today = body.date
    const lastActive = currentRewards.lastActiveDate
    let newStreak = currentRewards.currentStreak
    let newLongestStreak = currentRewards.longestStreak

    if (lastActive !== today) {
      const lastActiveDate = lastActive ? new Date(lastActive) : null
      const todayDate = new Date(today)

      if (lastActiveDate) {
        const diffDays = Math.floor((todayDate.getTime() - lastActiveDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays === 1) {
          newStreak = currentRewards.currentStreak + 1
        } else if (diffDays > 1) {
          newStreak = 1
        }
      } else {
        newStreak = 1
      }

      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak
      }

      console.log("[overtuiging-usage] Streak update - lastActive:", lastActive, "today:", today, "newStreak:", newStreak)
    }

    await base(tables.users).update(body.userId, {
      [USER_FIELDS.currentStreak]: newStreak,
      [USER_FIELDS.longestStreak]: newLongestStreak,
      [USER_FIELDS.lastActiveDate]: today,
      [USER_FIELDS.bonusPoints]: (currentRewards.bonusPoints || 0) + 1
    })

    console.log("[overtuiging-usage] Updated user streak fields and awarded 1 bonus point")
  }

  return sendSuccess(res, {
    id: record.id,
    pointsAwarded: 1
  }, 201)
}

export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const mode = getDataBackendMode(OVERTUIGING_BACKEND_ENV)
    const usePostgres = mode === "postgres_primary" && isPostgresConfigured()

    switch (req.method) {
      case "GET":
        if (usePostgres) {
          return handleGetPostgres(req, res, auth.userId)
        }
        if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
          void handleGetPostgres(req, res, auth.userId)
            .then(() => undefined)
            .catch((error) => console.warn("[overtuiging-usage] shadow read failed:", error))
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
