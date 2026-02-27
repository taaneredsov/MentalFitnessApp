import type { Request, Response } from "express"
import { z } from "zod"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { updatePersonalGoalInPostgres, deletePersonalGoalInPostgres } from "../_lib/repos/reference-repo.js"
import { personalGoalBelongsToUser } from "../_lib/repos/personal-goal-usage-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

const VALID_DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"] as const

const updateGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(200, "Goal name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  status: z.enum(["Actief", "Voltooid", "Verwijderd"]).optional(),
  scheduleDays: z.array(z.string()).max(7).optional()
})

/**
 * PATCH /api/personal-goals/[id] (Postgres)
 */
async function handlePatch(req: Request, res: Response, goalId: string, userId: string) {
  const rawBody = parseBody(req)
  const body = updateGoalSchema.parse(rawBody)

  // Validate day names if provided
  if (body.scheduleDays) {
    const invalid = body.scheduleDays.filter((d) => !VALID_DAYS.includes(d as typeof VALID_DAYS[number]))
    if (invalid.length > 0) {
      return sendError(res, `Invalid schedule days: ${invalid.join(", ")}`, 400)
    }
  }

  // Check if any fields were provided
  if (body.name === undefined && body.description === undefined && body.status === undefined && body.scheduleDays === undefined) {
    return sendError(res, "No fields to update", 400)
  }

  // Verify ownership
  const belongs = await personalGoalBelongsToUser(goalId, userId)
  if (!belongs) {
    return sendError(res, "Personal goal not found", 404)
  }

  const updated = await updatePersonalGoalInPostgres(goalId, userId, {
    name: body.name,
    description: body.description,
    scheduleDays: body.scheduleDays,
    status: body.status
  })

  if (!updated) {
    return sendError(res, "Failed to update personal goal", 500)
  }

  // Build sync payload with only provided fields
  const syncPayload: Record<string, unknown> = { userId }
  if (body.name !== undefined) syncPayload.name = body.name
  if (body.description !== undefined) syncPayload.description = body.description
  if (body.status !== undefined) syncPayload.status = body.status
  if (body.scheduleDays !== undefined) syncPayload.scheduleDays = body.scheduleDays

  await enqueueSyncEvent({
    eventType: "upsert",
    entityType: "personal_goal",
    entityId: goalId,
    payload: syncPayload,
    priority: 40
  })

  console.log("[personal-goals] Updated goal (postgres):", goalId, "fields:", Object.keys(syncPayload).filter((k) => k !== "userId"))
  return sendSuccess(res, updated)
}

/**
 * DELETE /api/personal-goals/[id] (Postgres)
 */
async function handleDelete(_req: Request, res: Response, goalId: string, userId: string) {
  // Verify ownership
  const belongs = await personalGoalBelongsToUser(goalId, userId)
  if (!belongs) {
    return sendError(res, "Personal goal not found", 404)
  }

  const success = await deletePersonalGoalInPostgres(goalId, userId)
  if (!success) {
    return sendError(res, "Failed to delete personal goal", 500)
  }

  await enqueueSyncEvent({
    eventType: "delete",
    entityType: "personal_goal",
    entityId: goalId,
    payload: { userId },
    priority: 40
  })

  console.log("[personal-goals] Soft deleted goal (postgres):", goalId)
  return sendSuccess(res, null)
}

/**
 * /api/personal-goals/[id]
 * PATCH: Update a personal goal
 * DELETE: Archive/delete a personal goal
 */
export default async function handler(req: Request, res: Response) {
  // Get goal ID from URL
  const { id } = req.params
  if (!id || typeof id !== "string") {
    return sendError(res, "Goal ID is required", 400)
  }

  try {
    const auth = await requireAuth(req)

    switch (req.method) {
      case "PATCH":
        return handlePatch(req, res, id, auth.userId)
      case "DELETE":
        return handleDelete(req, res, id, auth.userId)
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
