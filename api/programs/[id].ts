import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import {
  transformProgram,
  transformGoal,
  transformMethod,
  transformDay,
  transformProgrammaplanning,
  PROGRAM_FIELDS,
  GOAL_FIELDS,
  METHOD_FIELDS,
  DAY_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  METHOD_USAGE_FIELDS,
  FIELD_NAMES
} from "../_lib/field-mappings.js"

/**
 * GET /api/programs/[id] - Returns a single program with expanded relations
 * PATCH /api/programs/[id] - Updates a program
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "PATCH") {
    return handlePatch(req, res)
  }

  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { id } = req.query
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    // Fetch the program
    const records = await base(tables.programs)
      .select({
        filterByFormula: `RECORD_ID() = "${id}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "Program not found", 404)
    }

    const program = transformProgram(records[0] as any)

    // Fetch related goals
    let goalDetails: any[] = []
    if (program.goals.length > 0) {
      const goalFormula = `OR(${program.goals.map(gid => `RECORD_ID() = "${gid}"`).join(",")})`
      const goalRecords = await base(tables.goals)
        .select({
          filterByFormula: goalFormula,
          returnFieldsByFieldId: true
        })
        .all()
      goalDetails = goalRecords.map(r => transformGoal(r as any))
    }

    // Fetch related methods
    let methodDetails: any[] = []
    if (program.methods.length > 0) {
      const methodFormula = `OR(${program.methods.map(mid => `RECORD_ID() = "${mid}"`).join(",")})`
      const methodRecords = await base(tables.methods)
        .select({
          filterByFormula: methodFormula,
          returnFieldsByFieldId: true
        })
        .all()
      methodDetails = methodRecords.map(r => transformMethod(r as any))
    }

    // Fetch related days of week
    let dayNames: string[] = []
    if (program.daysOfWeek.length > 0) {
      const dayFormula = `OR(${program.daysOfWeek.map(did => `RECORD_ID() = "${did}"`).join(",")})`
      const dayRecords = await base(tables.daysOfWeek)
        .select({
          filterByFormula: dayFormula,
          returnFieldsByFieldId: true
        })
        .all()
      dayNames = dayRecords.map(r => transformDay(r as any).name)
    }

    // Fetch Programmaplanning records for this program
    // We fetch all and filter by programId because Airtable linked record formulas
    // compare by display value which can be unreliable
    const allScheduleRecords = await base(tables.programmaplanning)
      .select({
        returnFieldsByFieldId: true,
        sort: [{ field: PROGRAMMAPLANNING_FIELDS.date, direction: "asc" }]
      })
      .all()

    // Filter by programId (the linked record ID stored in the field)
    const rawSchedule = allScheduleRecords
      .map(r => transformProgrammaplanning(r as any))
      .filter(s => s.programId === id)

    // Collect all methodUsageIds from the schedule to fetch completed method IDs
    const allMethodUsageIds = rawSchedule.flatMap(s => s.methodUsageIds || [])

    // Fetch Method Usage records to get the completed method IDs
    let methodUsageToMethodMap = new Map<string, string>()
    if (allMethodUsageIds.length > 0) {
      const usageFormula = `OR(${allMethodUsageIds.map(uid => `RECORD_ID() = "${uid}"`).join(",")})`
      const usageRecords = await base(tables.methodUsage)
        .select({
          filterByFormula: usageFormula,
          returnFieldsByFieldId: true
        })
        .all()

      // Map Method Usage ID -> Method ID
      for (const record of usageRecords) {
        const methodIds = record.fields[METHOD_USAGE_FIELDS.method] as string[] | undefined
        if (methodIds?.[0]) {
          methodUsageToMethodMap.set(record.id, methodIds[0])
        }
      }
    }

    // Add completedMethodIds to each session
    const schedule = rawSchedule.map(session => ({
      ...session,
      completedMethodIds: (session.methodUsageIds || [])
        .map(usageId => methodUsageToMethodMap.get(usageId))
        .filter((id): id is string => !!id)
    }))

    // Calculate session counts for progress tracking
    const totalSessions = schedule.length
    const completedSessions = schedule.filter(s => s.isCompleted).length

    return sendSuccess(res, {
      ...program,
      goalDetails,
      methodDetails,
      dayNames,
      schedule,
      totalSessions,
      completedSessions
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}

/**
 * PATCH /api/programs/[id] - Update a program
 * Body: { methods?, notes? }
 */
async function handlePatch(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    const body = parseBody(req)
    const fields: Record<string, unknown> = {}

    // Allow updating goals, daysOfWeek, methods, and notes
    if (body.goals !== undefined) {
      fields[PROGRAM_FIELDS.goals] = body.goals
    }
    if (body.daysOfWeek !== undefined) {
      fields[PROGRAM_FIELDS.daysOfWeek] = body.daysOfWeek
    }
    if (body.methods !== undefined) {
      fields[PROGRAM_FIELDS.methods] = body.methods
    }
    if (body.notes !== undefined) {
      fields[PROGRAM_FIELDS.notes] = body.notes
    }

    if (Object.keys(fields).length === 0) {
      return sendError(res, "No valid fields to update", 400)
    }

    // Update the program
    const record = await base(tables.programs).update(id, fields, { typecast: true })

    const program = transformProgram(record as any)

    return sendSuccess(res, program)
  } catch (error) {
    return handleApiError(res, error)
  }
}
