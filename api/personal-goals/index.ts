import type { Request, Response } from "express"
import { z } from "zod"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { listPersonalGoalsByUser, createPersonalGoalInPostgres } from "../_lib/repos/reference-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

const MAX_GOALS_PER_USER = 10

const VALID_DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"] as const

const createGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(200, "Goal name too long"),
  description: z.string().max(1000, "Description too long").optional(),
  scheduleDays: z.array(z.string()).max(7).optional()
})

async function handleGet(req: Request, res: Response, tokenUserId: string) {
  const { include } = req.query

  const includeCompleted = include === "voltooid"
  const goals = await listPersonalGoalsByUser(tokenUserId, { includeCompleted })
  return sendSuccess(res, goals)
}

async function handlePost(req: Request, res: Response, tokenUserId: string) {
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
