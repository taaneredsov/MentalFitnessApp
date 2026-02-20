import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { PERSONAL_GOAL_FIELDS, FIELD_NAMES, transformPersonalGoal, isValidRecordId } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { listPersonalGoalsByUser, createPersonalGoalInPostgres } from "../_lib/repos/reference-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

const PERSONAL_GOALS_BACKEND_ENV = "DATA_BACKEND_PERSONAL_GOALS"
const MAX_GOALS_PER_USER = 10

const VALID_DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"] as const

const createGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(200, "Goal name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  scheduleDays: z.array(z.string()).max(7).optional()
})

async function handleGetPostgres(req: Request, res: Response, tokenUserId: string) {
  const { userId, include } = req.query
  const targetUserId = (typeof userId === "string" && userId) ? userId : tokenUserId

  if (targetUserId !== tokenUserId) {
    return sendError(res, "Cannot view another user's personal goals", 403)
  }

  const includeCompleted = include === "voltooid"
  const goals = await listPersonalGoalsByUser(targetUserId, { includeCompleted })
  return sendSuccess(res, goals)
}

async function handlePostPostgres(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createGoalSchema.parse(rawBody)

  // Validate day names if provided
  if (body.scheduleDays) {
    const invalid = body.scheduleDays.filter((d) => !VALID_DAYS.includes(d as typeof VALID_DAYS[number]))
    if (invalid.length > 0) {
      return sendError(res, `Invalid schedule days: ${invalid.join(", ")}`, 400)
    }
  }

  // Check existing goal count
  const existing = await listPersonalGoalsByUser(tokenUserId)
  if (existing.length >= MAX_GOALS_PER_USER) {
    return sendError(res, `Maximum ${MAX_GOALS_PER_USER} personal goals allowed`, 400)
  }

  const goal = await createPersonalGoalInPostgres({
    userId: tokenUserId,
    name: body.name,
    description: body.description,
    scheduleDays: body.scheduleDays
  })

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "personal_goal",
    entityId: goal.id as string,
    payload: {
      userId: tokenUserId,
      name: body.name,
      description: body.description || "",
      scheduleDays: body.scheduleDays || null
    },
    priority: 40
  })

  console.log("[personal-goals] Created goal (postgres):", goal.id, "for user:", tokenUserId, "name:", body.name)
  return sendSuccess(res, goal, 201)
}

async function handleGetAirtable(req: Request, res: Response, tokenUserId: string) {
  const { userId } = req.query
  const targetUserId = (typeof userId === "string" && userId) ? userId : tokenUserId

  if (targetUserId !== tokenUserId) {
    return sendError(res, "Cannot view another user's personal goals", 403)
  }

  if (!isValidRecordId(targetUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  const records = await base(tables.personalGoals)
    .select({
      filterByFormula: `AND({${FIELD_NAMES.personalGoal.status}} = "Actief", RECORD_ID() != "")`,
      returnFieldsByFieldId: true
    })
    .all()

  const userGoals = records
    .filter(r => {
      const fields = r.fields as Record<string, unknown>
      const userIds = fields[PERSONAL_GOAL_FIELDS.user] as string[] | undefined
      return userIds?.includes(targetUserId)
    })
    .map(r => transformPersonalGoal(r as { id: string; fields: Record<string, unknown> }))

  return sendSuccess(res, userGoals)
}

async function handlePostAirtable(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createGoalSchema.parse(rawBody)

  if (!isValidRecordId(tokenUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  const existingRecords = await base(tables.personalGoals)
    .select({
      filterByFormula: `{${FIELD_NAMES.personalGoal.status}} = "Actief"`,
      returnFieldsByFieldId: true
    })
    .all()

  const userGoalCount = existingRecords.filter(r => {
    const fields = r.fields as Record<string, unknown>
    const userIds = fields[PERSONAL_GOAL_FIELDS.user] as string[] | undefined
    return userIds?.includes(tokenUserId)
  }).length

  if (userGoalCount >= MAX_GOALS_PER_USER) {
    return sendError(res, `Maximum ${MAX_GOALS_PER_USER} personal goals allowed`, 400)
  }

  const record = await base(tables.personalGoals).create({
    [PERSONAL_GOAL_FIELDS.name]: body.name,
    [PERSONAL_GOAL_FIELDS.description]: body.description || "",
    [PERSONAL_GOAL_FIELDS.user]: [tokenUserId],
    [PERSONAL_GOAL_FIELDS.status]: "Actief"
  }, {
    typecast: true
  })

  console.log("[personal-goals] Created goal:", record.id, "for user:", tokenUserId, "name:", body.name)

  const goal = transformPersonalGoal(record as { id: string; fields: Record<string, unknown> })
  return sendSuccess(res, goal, 201)
}

export default async function handler(req: Request, res: Response) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return sendError(res, "Unauthorized", 401)
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)
  if (!payload) {
    return sendError(res, "Invalid token", 401)
  }

  try {
    const userId = payload.userId as string
    const mode = getDataBackendMode(PERSONAL_GOALS_BACKEND_ENV)
    const usePostgres = mode === "postgres_primary" && isPostgresConfigured()

    switch (req.method) {
      case "GET":
        if (usePostgres) {
          return handleGetPostgres(req, res, userId)
        }
        if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
          void handleGetPostgres(req, res, userId)
            .then(() => undefined)
            .catch((error) => console.warn("[personal-goals] shadow read failed:", error))
        }
        return handleGetAirtable(req, res, userId)
      case "POST":
        return usePostgres
          ? handlePostPostgres(req, res, userId)
          : handlePostAirtable(req, res, userId)
      default:
        return sendError(res, "Method not allowed", 405)
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
