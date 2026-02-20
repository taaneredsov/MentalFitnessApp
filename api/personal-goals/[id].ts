import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { PERSONAL_GOAL_FIELDS, transformPersonalGoal, isValidRecordId } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { updatePersonalGoalInPostgres, deletePersonalGoalInPostgres } from "../_lib/repos/reference-repo.js"
import { personalGoalBelongsToUser } from "../_lib/repos/personal-goal-usage-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

const PERSONAL_GOALS_BACKEND_ENV = "DATA_BACKEND_PERSONAL_GOALS"

const VALID_DAYS = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"] as const

const updateGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(200, "Goal name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  status: z.enum(["Actief", "Voltooid", "Verwijderd"]).optional(),
  scheduleDays: z.array(z.string()).max(7).optional()
})

// ---------- Airtable handlers ----------

/**
 * Fetch a personal goal and verify ownership (Airtable)
 */
async function fetchAndVerifyOwnership(goalId: string, tokenUserId: string): Promise<{ error?: string; status?: number; record?: ReturnType<typeof transformPersonalGoal> & { rawRecord: unknown } }> {
  if (!isValidRecordId(goalId)) {
    return { error: "Invalid goal ID format", status: 400 }
  }

  try {
    const record = await base(tables.personalGoals).find(goalId)
    const fields = record.fields as Record<string, unknown>
    const userIds = fields[PERSONAL_GOAL_FIELDS.user] as string[] | undefined

    if (!userIds?.includes(tokenUserId)) {
      return { error: "Cannot access another user's personal goal", status: 403 }
    }

    return {
      record: {
        ...transformPersonalGoal(record as { id: string; fields: Record<string, unknown> }),
        rawRecord: record
      }
    }
  } catch (error) {
    const err = error as { statusCode?: number }
    if (err.statusCode === 404) {
      return { error: "Personal goal not found", status: 404 }
    }
    throw error
  }
}

/**
 * PATCH /api/personal-goals/[id] (Airtable)
 */
async function handlePatchAirtable(req: Request, res: Response, goalId: string, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = updateGoalSchema.parse(rawBody)

  const { error, status, record: _record } = await fetchAndVerifyOwnership(goalId, tokenUserId)
  if (error) {
    return sendError(res, error, status!)
  }

  const updateFields: Record<string, unknown> = {}
  if (body.name !== undefined) {
    updateFields[PERSONAL_GOAL_FIELDS.name] = body.name
  }
  if (body.description !== undefined) {
    updateFields[PERSONAL_GOAL_FIELDS.description] = body.description
  }
  if (body.status !== undefined) {
    updateFields[PERSONAL_GOAL_FIELDS.status] = body.status
  }

  if (Object.keys(updateFields).length === 0) {
    return sendError(res, "No fields to update", 400)
  }

  const updatedRecord = await base(tables.personalGoals).update(goalId, updateFields, {
    typecast: true
  })

  console.log("[personal-goals] Updated goal:", goalId, "fields:", Object.keys(updateFields))

  const goal = transformPersonalGoal(updatedRecord as { id: string; fields: Record<string, unknown> })
  return sendSuccess(res, goal)
}

/**
 * DELETE /api/personal-goals/[id] (Airtable)
 */
async function handleDeleteAirtable(req: Request, res: Response, goalId: string, tokenUserId: string) {
  const { error, status } = await fetchAndVerifyOwnership(goalId, tokenUserId)
  if (error) {
    return sendError(res, error, status!)
  }

  await base(tables.personalGoals).update(goalId, {
    [PERSONAL_GOAL_FIELDS.status]: "Gearchiveerd"
  }, {
    typecast: true
  })

  console.log("[personal-goals] Archived (soft deleted) goal:", goalId)

  return sendSuccess(res, null)
}

// ---------- Postgres handlers ----------

/**
 * PATCH /api/personal-goals/[id] (Postgres)
 */
async function handlePatchPostgres(req: Request, res: Response, goalId: string, userId: string) {
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
async function handleDeletePostgres(req: Request, res: Response, goalId: string, userId: string) {
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

// ---------- Main handler ----------

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
    const mode = getDataBackendMode(PERSONAL_GOALS_BACKEND_ENV)
    const usePostgres = mode === "postgres_primary" && isPostgresConfigured()

    if (usePostgres) {
      const auth = await requireAuth(req)
      const userId = auth.userId

      switch (req.method) {
        case "PATCH":
          return handlePatchPostgres(req, res, id, userId)
        case "DELETE":
          return handleDeletePostgres(req, res, id, userId)
        default:
          return sendError(res, "Method not allowed", 405)
      }
    }

    // Airtable path - uses verifyToken
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "Unauthorized", 401)
    }

    const token = authHeader.slice(7)
    const payload = await verifyToken(token)
    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    const userId = payload.userId as string
    switch (req.method) {
      case "PATCH":
        return handlePatchAirtable(req, res, id, userId)
      case "DELETE":
        return handleDeleteAirtable(req, res, id, userId)
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
