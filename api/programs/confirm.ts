import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { transformProgram, PROGRAM_FIELDS, PROGRAMMAPLANNING_FIELDS } from "../_lib/field-mappings.js"

interface ScheduleMethod {
  methodId: string
  methodName: string
  duration: number
}

interface ScheduleDay {
  date: string
  dayOfWeek: string
  dayId: string
  methods: ScheduleMethod[]
}

/**
 * Create Programmaplanning records in Airtable in batches
 * Airtable allows max 10 records per batch
 */
async function createProgramplanningRecords(
  programId: string,
  goalIds: string[],
  schedule: ScheduleDay[]
): Promise<void> {
  const records: Array<{ fields: Record<string, unknown> }> = []

  for (const day of schedule) {
    // Extract method IDs for this day
    const methodIds = day.methods.map(m => m.methodId)

    // Build session description
    const sessionDescription = day.methods
      .map(m => `${m.methodName} (${m.duration} min)`)
      .join("\n")

    records.push({
      fields: {
        [PROGRAMMAPLANNING_FIELDS.program]: [programId],
        [PROGRAMMAPLANNING_FIELDS.date]: day.date,
        [PROGRAMMAPLANNING_FIELDS.dayOfWeek]: [day.dayId],
        [PROGRAMMAPLANNING_FIELDS.methods]: methodIds,
        [PROGRAMMAPLANNING_FIELDS.goals]: goalIds,
        [PROGRAMMAPLANNING_FIELDS.sessionDescription]: sessionDescription
      }
    })
  }

  // Create in batches of 10
  const BATCH_SIZE = 10
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    await base(tables.programmaplanning).create(batch, { typecast: true })
  }
}

/**
 * POST /api/programs/confirm - Save user-confirmed/edited program to Airtable
 * Body: { userId, goals[], startDate, duration, daysOfWeek[], editedSchedule[], programSummary? }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    // Verify JWT token
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "No token provided", 401)
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)

    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    // Parse and validate request body
    const body = parseBody(req)

    if (!body?.userId) {
      return sendError(res, "userId is required", 400)
    }
    if (!body.goals || !Array.isArray(body.goals) || body.goals.length === 0) {
      return sendError(res, "goals array is required", 400)
    }
    if (!body.startDate) {
      return sendError(res, "startDate is required", 400)
    }
    if (!body.duration) {
      return sendError(res, "duration is required", 400)
    }
    if (!body.daysOfWeek || !Array.isArray(body.daysOfWeek) || body.daysOfWeek.length === 0) {
      return sendError(res, "daysOfWeek array is required", 400)
    }
    if (!body.editedSchedule || !Array.isArray(body.editedSchedule) || body.editedSchedule.length === 0) {
      return sendError(res, "editedSchedule array is required", 400)
    }

    // Validate schedule structure
    for (const day of body.editedSchedule) {
      if (!day.date || !day.dayId || !Array.isArray(day.methods)) {
        return sendError(res, "Invalid schedule day format", 400)
      }
    }

    // Extract unique method IDs from edited schedule
    const methodIds = new Set<string>()
    for (const day of body.editedSchedule) {
      for (const method of day.methods) {
        methodIds.add(method.methodId)
      }
    }

    // Calculate weekly session time from edited schedule
    const totalDuration = body.editedSchedule.reduce((sum: number, day: ScheduleDay) => {
      return sum + day.methods.reduce((daySum: number, m: ScheduleMethod) => daySum + m.duration, 0)
    }, 0)
    const weeks = parseInt(body.duration.match(/(\d+)/)?.[1] || "1", 10)
    const weeklySessionTime = Math.round(totalDuration / weeks)

    // Create program in Airtable
    const programFields: Record<string, unknown> = {
      [PROGRAM_FIELDS.user]: [body.userId],
      [PROGRAM_FIELDS.startDate]: body.startDate,
      [PROGRAM_FIELDS.duration]: body.duration,
      [PROGRAM_FIELDS.daysOfWeek]: body.daysOfWeek,
      [PROGRAM_FIELDS.goals]: body.goals,
      [PROGRAM_FIELDS.methods]: Array.from(methodIds)
    }

    // Add AI program summary as notes
    if (body.programSummary) {
      programFields[PROGRAM_FIELDS.notes] = body.programSummary
    }

    const programRecord = await base(tables.programs).create(programFields, { typecast: true })

    // Create Programmaplanning records for each training date
    await createProgramplanningRecords(programRecord.id, body.goals, body.editedSchedule)

    // Fetch created program with computed fields
    const createdRecord = await base(tables.programs).find(programRecord.id)
    const program = transformProgram(createdRecord as any)

    // Return response (same format as generate endpoint)
    return sendSuccess(res, {
      program,
      aiSchedule: body.editedSchedule,
      weeklySessionTime,
      recommendations: [],
      programSummary: body.programSummary
    }, 201)
  } catch (error) {
    return handleApiError(res, error)
  }
}
