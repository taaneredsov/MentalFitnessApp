import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { PERSONAL_GOAL_FIELDS, FIELD_NAMES, transformPersonalGoal, isValidRecordId } from "../_lib/field-mappings.js"

// Maximum number of personal goals per user
const MAX_GOALS_PER_USER = 10

const createGoalSchema = z.object({
  name: z.string().min(1, "Goal name is required").max(200, "Goal name too long"),
  description: z.string().max(1000, "Description too long").optional()
})

/**
 * GET /api/personal-goals?userId=xxx
 * Returns all active personal goals for a user
 */
async function handleGet(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const { userId } = req.query

  // Default to authenticated user if no userId provided
  const targetUserId = (typeof userId === "string" && userId) ? userId : tokenUserId

  // Users can only view their own goals
  if (targetUserId !== tokenUserId) {
    return sendError(res, "Cannot view another user's personal goals", 403)
  }

  // Validate userId format
  if (!isValidRecordId(targetUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  // Fetch all personal goals for this user with Active status
  const records = await base(tables.personalGoals)
    .select({
      filterByFormula: `AND({${FIELD_NAMES.personalGoal.status}} = "Actief", RECORD_ID() != "")`,
      returnFieldsByFieldId: true
    })
    .all()

  // Filter by user in JavaScript (linked record filtering in Airtable can be unreliable)
  const userGoals = records
    .filter(r => {
      const fields = r.fields as Record<string, unknown>
      const userIds = fields[PERSONAL_GOAL_FIELDS.user] as string[] | undefined
      return userIds?.includes(targetUserId)
    })
    .map(r => transformPersonalGoal(r as { id: string; fields: Record<string, unknown> }))

  return sendSuccess(res, userGoals)
}

/**
 * POST /api/personal-goals
 * Creates a new personal goal for the authenticated user
 */
async function handlePost(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createGoalSchema.parse(rawBody)

  // Validate userId format
  if (!isValidRecordId(tokenUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  // Check if user already has max goals
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

  // Create the personal goal
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

/**
 * /api/personal-goals
 * GET: Returns all active personal goals for the user
 * POST: Creates a new personal goal
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  try {
    const userId = payload.userId as string
    switch (req.method) {
      case "GET":
        return handleGet(req, res, userId)
      case "POST":
        return handlePost(req, res, userId)
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
