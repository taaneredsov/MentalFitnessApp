import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { PERSONAL_GOAL_USAGE_FIELDS, PERSONAL_GOAL_FIELDS, USER_FIELDS, transformUserRewards, isValidRecordId } from "../_lib/field-mappings.js"

// Point values for personal goals
const POINTS = {
  personalGoal: 10
} as const

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  personalGoalId: z.string().min(1, "Personal Goal ID is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

interface GoalCounts {
  today: number
  total: number
}

/**
 * GET /api/personal-goal-usage?userId=xxx&date=YYYY-MM-DD
 * Returns completion counts per goal: { [goalId]: { today: number, total: number } }
 */
async function handleGet(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const { userId, date } = req.query

  // Default to authenticated user if no userId provided
  const targetUserId = (typeof userId === "string" && userId) ? userId : tokenUserId

  // Users can only view their own usage
  if (targetUserId !== tokenUserId) {
    return sendError(res, "Cannot view another user's personal goal usage", 403)
  }

  if (!date || typeof date !== "string") {
    return sendError(res, "date is required", 400)
  }

  // Validate userId format
  if (!isValidRecordId(targetUserId)) {
    return sendError(res, "Invalid user ID format", 400)
  }

  // Fetch ALL usage records for this user (to get total counts)
  const allRecords = await base(tables.personalGoalUsage)
    .select({
      returnFieldsByFieldId: true
    })
    .all()

  // Filter by user and count per goal
  const counts: Record<string, GoalCounts> = {}

  allRecords.forEach(r => {
    const fields = r.fields as Record<string, unknown>
    const userField = fields[PERSONAL_GOAL_USAGE_FIELDS.user] as string[] | undefined

    if (!userField?.includes(targetUserId)) return

    const goalField = fields[PERSONAL_GOAL_USAGE_FIELDS.personalGoal] as string[] | undefined
    const recordDate = fields[PERSONAL_GOAL_USAGE_FIELDS.date] as string | undefined
    const goalId = goalField?.[0]

    if (!goalId) return

    if (!counts[goalId]) {
      counts[goalId] = { today: 0, total: 0 }
    }

    counts[goalId].total += 1

    // Check if this record is from today
    if (recordDate === date) {
      counts[goalId].today += 1
    }
  })

  console.log("[personal-goal-usage] GET for date:", date, "user:", targetUserId, "goals with counts:", Object.keys(counts).length)

  return sendSuccess(res, counts)
}

/**
 * POST /api/personal-goal-usage
 * Creates a new personal goal usage record and awards points
 * Allows multiple completions per day
 */
async function handlePost(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createUsageSchema.parse(rawBody)

  // Verify the user is creating a record for themselves
  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create personal goal usage for another user", 403)
  }

  // Validate IDs
  if (!isValidRecordId(body.userId) || !isValidRecordId(body.personalGoalId)) {
    return sendError(res, "Invalid ID format", 400)
  }

  // Verify the goal belongs to the user
  // Note: .find() returns field names, not IDs, so we use the field name directly
  try {
    const goalRecord = await base(tables.personalGoals).find(body.personalGoalId)
    const goalFields = goalRecord.fields as Record<string, unknown>
    const goalUserIds = goalFields["Gebruikers"] as string[] | undefined

    if (!goalUserIds?.includes(tokenUserId)) {
      return sendError(res, "Cannot complete another user's personal goal", 403)
    }
  } catch (error) {
    return sendError(res, "Personal goal not found", 404)
  }

  // Create the usage record (no duplicate check - allow multiple per day)
  console.log("[personal-goal-usage] Creating record with fields:", {
    user: PERSONAL_GOAL_USAGE_FIELDS.user,
    personalGoal: PERSONAL_GOAL_USAGE_FIELDS.personalGoal,
    date: PERSONAL_GOAL_USAGE_FIELDS.date,
    values: { userId: body.userId, goalId: body.personalGoalId, date: body.date }
  })

  let record
  try {
    record = await base(tables.personalGoalUsage).create({
      [PERSONAL_GOAL_USAGE_FIELDS.user]: [body.userId],
      [PERSONAL_GOAL_USAGE_FIELDS.personalGoal]: [body.personalGoalId],
      [PERSONAL_GOAL_USAGE_FIELDS.date]: body.date
    }, {
      typecast: true
    })
  } catch (createError) {
    console.error("[personal-goal-usage] Airtable create error:", createError)
    throw createError
  }

  console.log("[personal-goal-usage] Created record:", record.id, "for user:", body.userId, "goal:", body.personalGoalId, "date:", body.date)

  // Count total completions for this goal
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
    if (recordDate === body.date) {
      todayCount += 1
    }
  })

  // Points are counted automatically by Airtable formula (Personal Goals Score = usage count × 10)
  // We only need to update streak fields here - do NOT add to bonusPoints (that would double count)
  const pointsAwarded = POINTS.personalGoal

  // Fetch current user rewards to update streak
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

      console.log("[personal-goal-usage] Streak update - lastActive:", lastActive, "today:", today, "newStreak:", newStreak)
    }

    // Update user streak fields only (points are counted by Airtable formula automatically)
    await base(tables.users).update(body.userId, {
      [USER_FIELDS.currentStreak]: newStreak,
      [USER_FIELDS.longestStreak]: newLongestStreak,
      [USER_FIELDS.lastActiveDate]: today
    })

    console.log("[personal-goal-usage] Updated user streak fields")
  }

  return sendSuccess(res, {
    id: record.id,
    pointsAwarded,
    todayCount,
    totalCount
  }, 201)
}

/**
 * /api/personal-goal-usage
 * GET: Returns completion counts per goal { [goalId]: { today, total } }
 * POST: Creates a new usage record (allows multiple per day)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
