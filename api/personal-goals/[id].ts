import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { PERSONAL_GOAL_FIELDS, transformPersonalGoal, isValidRecordId } from "../_lib/field-mappings.js"

const updateGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(200, "Goal name too long").optional(),
  description: z.string().max(1000, "Description too long").optional(),
  status: z.enum(["Actief", "Gearchiveerd"]).optional()
})

/**
 * Fetch a personal goal and verify ownership
 */
async function fetchAndVerifyOwnership(goalId: string, tokenUserId: string): Promise<{ error?: string; status?: number; record?: ReturnType<typeof transformPersonalGoal> & { rawRecord: unknown } }> {
  // Validate ID format
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
 * PATCH /api/personal-goals/[id]
 * Updates a personal goal
 */
async function handlePatch(req: Request, res: Response, goalId: string, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = updateGoalSchema.parse(rawBody)

  // Verify ownership
  const { error, status, record } = await fetchAndVerifyOwnership(goalId, tokenUserId)
  if (error) {
    return sendError(res, error, status!)
  }

  // Build update object with only provided fields
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
 * DELETE /api/personal-goals/[id]
 * Archives a personal goal (soft delete by setting status to Gearchiveerd)
 */
async function handleDelete(req: Request, res: Response, goalId: string, tokenUserId: string) {
  // Verify ownership
  const { error, status } = await fetchAndVerifyOwnership(goalId, tokenUserId)
  if (error) {
    return sendError(res, error, status!)
  }

  // Soft delete by archiving
  await base(tables.personalGoals).update(goalId, {
    [PERSONAL_GOAL_FIELDS.status]: "Gearchiveerd"
  }, {
    typecast: true
  })

  console.log("[personal-goals] Archived (soft deleted) goal:", goalId)

  return sendSuccess(res, null)
}

/**
 * /api/personal-goals/[id]
 * PATCH: Update a personal goal
 * DELETE: Archive a personal goal
 */
export default async function handler(req: Request, res: Response) {
  // Verify authentication
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    return sendError(res, "Unauthorized", 401)
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)
  if (!payload) {
    return sendError(res, "Invalid token", 401)
  }

  // Get goal ID from URL
  const { id } = req.params
  if (!id || typeof id !== "string") {
    return sendError(res, "Goal ID is required", 400)
  }

  try {
    const userId = payload.userId as string
    switch (req.method) {
      case "PATCH":
        return handlePatch(req, res, id, userId)
      case "DELETE":
        return handleDelete(req, res, id, userId)
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
