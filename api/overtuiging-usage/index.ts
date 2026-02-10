import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { OVERTUIGING_USAGE_FIELDS, USER_FIELDS, transformUserRewards, isValidRecordId } from "../_lib/field-mappings.js"

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  overtuigingId: z.string().min(1, "Overtuiging ID is required"),
  programId: z.string().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
})

/**
 * GET /api/overtuiging-usage?programId=xxx
 * Returns { [overtuigingId]: { completed: boolean } }
 */
async function handleGet(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const { programId, all } = req.query

  const fetchAll = all === "true"

  if (!fetchAll) {
    if (!programId || typeof programId !== "string") {
      return sendError(res, "programId is required (or use all=true)", 400)
    }
    if (!isValidRecordId(programId)) {
      return sendError(res, "Invalid program ID format", 400)
    }
  }

  // Fetch all usage records
  const allRecords = await base(tables.overtuigingenGebruik)
    .select({
      returnFieldsByFieldId: true
    })
    .all()

  // Filter by user (and optionally program), build completion map
  const progress: Record<string, { completed: boolean }> = {}

  allRecords.forEach(r => {
    const fields = r.fields as Record<string, unknown>
    const userField = fields[OVERTUIGING_USAGE_FIELDS.user] as string[] | undefined
    const programField = fields[OVERTUIGING_USAGE_FIELDS.program] as string[] | undefined

    if (!userField?.includes(tokenUserId)) return

    // If fetching for a specific program, include:
    // 1. Records matching that program
    // 2. Standalone records (no program) - beliefs completed from mindset page
    if (!fetchAll && programId) {
      const belongsToProgram = programField?.includes(programId as string)
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

/**
 * POST /api/overtuiging-usage
 * Creates a single usage record (marks overtuiging as completed)
 * Awards 1 bonus point on completion
 */
async function handlePost(req: VercelRequest, res: VercelResponse, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createUsageSchema.parse(rawBody)

  // Verify the user is creating a record for themselves
  if (body.userId !== tokenUserId) {
    return sendError(res, "Cannot create overtuiging usage for another user", 403)
  }

  // Validate IDs
  if (!isValidRecordId(body.userId) || !isValidRecordId(body.overtuigingId) || (body.programId && !isValidRecordId(body.programId))) {
    return sendError(res, "Invalid ID format", 400)
  }

  // Check for duplicate: can't complete same overtuiging twice in same program
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

  // Create the usage record (no level field)
  const createFields: Record<string, unknown> = {
    [OVERTUIGING_USAGE_FIELDS.user]: [body.userId],
    [OVERTUIGING_USAGE_FIELDS.overtuiging]: [body.overtuigingId],
    [OVERTUIGING_USAGE_FIELDS.date]: body.date
  }
  if (body.programId) {
    createFields[OVERTUIGING_USAGE_FIELDS.program] = [body.programId]
  }

  const record = await base(tables.overtuigingenGebruik).create(createFields, {
    typecast: true
  })

  console.log("[overtuiging-usage] Created record:", record.id, "for user:", body.userId, "overtuiging:", body.overtuigingId)

  // Update user streak fields and award 1 bonus point
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

    // Award 1 bonus point on completion
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

/**
 * /api/overtuiging-usage
 * GET: Returns completion status per overtuiging { [overtuigingId]: { completed: boolean } }
 * POST: Creates a usage record (single-click completion, awards points)
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
