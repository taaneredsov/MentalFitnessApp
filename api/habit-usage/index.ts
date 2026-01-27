import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { HABIT_USAGE_FIELDS, FIELD_NAMES, USER_FIELDS, transformUserRewards, escapeFormulaValue, isValidRecordId } from "../_lib/field-mappings.js"

// Point values
const POINTS = {
  habit: 5,
  habitDayBonus: 5
} as const

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  methodId: z.string().min(1, "Method ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

/**
 * GET /api/habit-usage?userId=xxx&date=YYYY-MM-DD
 * Returns habit IDs completed on that date
 */
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const { userId, date } = req.query

  if (!userId || typeof userId !== "string") {
    return sendError(res, "userId is required", 400)
  }
  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }

  // Validate userId format to prevent injection
  if (!isValidRecordId(userId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  // Fetch all habit usage for this date, then filter by user in code
  // (Airtable's filterByFormula with linked records can be unreliable)
  // Use IS_SAME for reliable date comparison (handles format differences)
  const records = await base(tables.habitUsage)
    .select({
      filterByFormula: `IS_SAME({${FIELD_NAMES.habitUsage.date}}, "${escapeFormulaValue(date)}", 'day')`,
      returnFieldsByFieldId: true
    })
    .all()

  // Filter by user and extract method IDs
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

  console.log("[habit-usage] GET for date:", date, "user:", userId, "found records:", records.length, "filtered:", completedHabitIds.length)

  return sendSuccess(res, completedHabitIds)
}

/**
 * POST /api/habit-usage
 * Creates a new habit usage record and awards points
 */
async function handlePost(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createUsageSchema.parse(rawBody)

  // Verify the user is creating a record for themselves
  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create habit usage for another user", 403)
  }

  // Validate IDs to prevent injection
  if (!isValidRecordId(body.userId) || !isValidRecordId(body.methodId)) {
    return sendError(res, "Invalid ID format", 400)
  }

  // Check if already exists (idempotent)
  // Fetch all records for this date, then filter in JavaScript
  // (Airtable's ARRAYJOIN returns display values, not record IDs, so we can't filter properly in formula)
  // Use IS_SAME for reliable date comparison
  const existingRecords = await base(tables.habitUsage)
    .select({
      filterByFormula: `IS_SAME({${FIELD_NAMES.habitUsage.date}}, "${escapeFormulaValue(body.date)}", 'day')`,
      returnFieldsByFieldId: true
    })
    .all()

  // Find matching record for this user and method
  const existing = existingRecords.find(r => {
    const fields = r.fields as Record<string, unknown>
    const userIds = fields[HABIT_USAGE_FIELDS.user] as string[] | undefined
    const methodIds = fields[HABIT_USAGE_FIELDS.method] as string[] | undefined
    return userIds?.includes(body.userId) && methodIds?.includes(body.methodId)
  })

  if (existing) {
    // Already exists - return success without creating duplicate
    return sendSuccess(res, { id: existing.id, pointsAwarded: 0 })
  }

  // Create the habit usage record
  const record = await base(tables.habitUsage).create({
    [HABIT_USAGE_FIELDS.user]: [body.userId],
    [HABIT_USAGE_FIELDS.method]: [body.methodId],
    [HABIT_USAGE_FIELDS.date]: body.date
  }, {
    typecast: true
  })

  console.log("[habit-usage] Created record:", record.id, "for user:", body.userId, "method:", body.methodId, "date:", body.date)

  // Award points for completing the habit
  const pointsAwarded = POINTS.habit

  // Fetch current user rewards and update
  const userRecords = await base(tables.users)
    .select({
      filterByFormula: `RECORD_ID() = "${body.userId}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (userRecords.length > 0) {
    const currentRewards = transformUserRewards(userRecords[0] as { id: string; fields: Record<string, unknown> })

    // Calculate streak
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
          // Consecutive day
          newStreak = currentRewards.currentStreak + 1
        } else if (diffDays > 1) {
          // Streak broken
          newStreak = 1
        }
      } else {
        newStreak = 1
      }

      if (newStreak > newLongestStreak) {
        newLongestStreak = newStreak
      }

      console.log("[habit-usage] Streak update - lastActive:", lastActive, "today:", today, "newStreak:", newStreak, "newLongestStreak:", newLongestStreak)
    } else {
      console.log("[habit-usage] Streak unchanged - already active today:", today)
    }

    // Update user rewards (totalPoints is now a formula field in Airtable)
    await base(tables.users).update(body.userId, {
      [USER_FIELDS.currentStreak]: newStreak,
      [USER_FIELDS.longestStreak]: newLongestStreak,
      [USER_FIELDS.lastActiveDate]: today
    })
  }

  return sendSuccess(res, { id: record.id, pointsAwarded }, 201)
}

/**
 * DELETE /api/habit-usage?userId=xxx&methodId=xxx&date=YYYY-MM-DD
 * Deletes a habit usage record (unchecking a habit)
 */
async function handleDelete(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const { userId, methodId, date } = req.query

  if (!userId || typeof userId !== "string") {
    return sendError(res, "userId is required", 400)
  }
  if (!methodId || typeof methodId !== "string") {
    return sendError(res, "methodId is required", 400)
  }
  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }

  // Verify the user is deleting their own record
  if (userId !== tokenUserId) {
    return sendError(res, "Cannot delete habit usage for another user", 403)
  }

  // Validate IDs to prevent injection
  if (!isValidRecordId(userId) || !isValidRecordId(methodId)) {
    return sendError(res, "Invalid ID format", 400)
  }

  // Fetch all records for this date, then filter in JavaScript
  // (Airtable's ARRAYJOIN returns display values, not record IDs)
  // Use IS_SAME for reliable date comparison
  const allRecords = await base(tables.habitUsage)
    .select({
      filterByFormula: `IS_SAME({${FIELD_NAMES.habitUsage.date}}, "${escapeFormulaValue(date)}", 'day')`,
      returnFieldsByFieldId: true
    })
    .all()

  // Find matching record for this user and method
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

/**
 * /api/habit-usage
 * GET: Returns habit IDs completed on a date
 * POST: Creates a new habit usage record
 * DELETE: Removes a habit usage record
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
        return handleGet(req, res)
      case "POST":
        return handlePost(req, res, userId)
      case "DELETE":
        return handleDelete(req, res, userId)
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
