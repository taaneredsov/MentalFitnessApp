import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { transformProgram, transformProgrammaplanning, parseEuropeanDate, PROGRAM_FIELDS, PROGRAMMAPLANNING_FIELDS, METHOD_USAGE_FIELDS } from "../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../_lib/auth.js"

/**
 * GET /api/programs - Returns all programs for the authenticated user
 * POST /api/programs - Creates a new program
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    return handlePost(req, res)
  }

  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)
    const userId = auth.userId

    // Fetch all programs and filter by user ID
    // (Airtable linked field filtering by record ID requires client-side filtering)
    const records = await base(tables.programs)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    // Filter programs where the user is linked
    const userPrograms = records.filter(record => {
      const userIds = record.fields[PROGRAM_FIELDS.user] as string[] | undefined
      return userIds?.includes(userId)
    })

    const programs = userPrograms.map(record => transformProgram(record as any))

    // If no programs, return early
    if (programs.length === 0) {
      return sendSuccess(res, programs)
    }

    // Fetch all programmaplanning records to calculate accurate progress
    const allScheduleRecords = await base(tables.programmaplanning)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const allSchedule = allScheduleRecords.map(r => transformProgrammaplanning(r as any))

    // Collect all methodUsageIds to fetch completed method mappings
    const allMethodUsageIds = allSchedule.flatMap(s => s.methodUsageIds || [])

    // Also fetch ALL method_usage records to find those linked directly to programs
    // (preserved completions from regenerated schedules)
    const allMethodUsageRecords = await base(tables.methodUsage)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    // Build a map of program ID -> preserved method usage IDs (linked to program but not to any session)
    const programPreservedUsageIds = new Map<string, string[]>()
    for (const record of allMethodUsageRecords) {
      const programIds = record.fields[METHOD_USAGE_FIELDS.program] as string[] | undefined
      if (programIds?.[0] && !allMethodUsageIds.includes(record.id)) {
        const existing = programPreservedUsageIds.get(programIds[0]) || []
        existing.push(record.id)
        programPreservedUsageIds.set(programIds[0], existing)
      }
    }

    // Fetch Method Usage records to map usage -> method
    let methodUsageToMethodMap = new Map<string, string>()
    // Build map from all usage records we already fetched
    for (const record of allMethodUsageRecords) {
      const methodIds = record.fields[METHOD_USAGE_FIELDS.method] as string[] | undefined
      if (methodIds?.[0]) {
        methodUsageToMethodMap.set(record.id, methodIds[0])
      }
    }

    // Calculate progress for each program
    const programsWithProgress = programs.map(program => {
      // Filter schedule for this program
      const programSchedule = allSchedule.filter(s => s.programId === program.id)

      // Calculate totalMethods and completedMethods
      const totalMethods = programSchedule.reduce((sum, s) => sum + (s.methodIds?.length || 0), 0)
      const sessionCompletedMethods = programSchedule.reduce((sum, s) => {
        const completedCount = (s.methodUsageIds || [])
          .filter(usageId => methodUsageToMethodMap.has(usageId))
          .length
        return sum + completedCount
      }, 0)

      // Add preserved completions (linked directly to program)
      const preservedUsageIds = programPreservedUsageIds.get(program.id) || []
      const preservedCompletedMethods = preservedUsageIds.filter(uid => methodUsageToMethodMap.has(uid)).length
      const completedMethods = sessionCompletedMethods + preservedCompletedMethods

      return {
        ...program,
        totalMethods,
        completedMethods
      }
    })

    return sendSuccess(res, programsWithProgress)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

/**
 * Calculate end date based on start date and duration string (e.g., "4 weken")
 */
function calculateEndDate(startDate: string, duration: string): string {
  const weeks = parseInt(duration.match(/(\d+)/)?.[1] || "4", 10)
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + (weeks * 7) - 1)
  return end.toISOString().split("T")[0]
}

/**
 * Check if two date ranges overlap
 */
function dateRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 <= end2 && end1 >= start2
}

/**
 * Determine program status based on start date
 * - "Actief" if startDate is today or in the past
 * - "Gepland" if startDate is in the future
 */
function getInitialProgramStatus(startDate: string): "Actief" | "Gepland" {
  // Use local date formatting to avoid UTC timezone issues
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  return startDate <= todayStr ? "Actief" : "Gepland"
}

/**
 * POST /api/programs - Create a new program
 * Body: { userId, startDate, duration, goals?, daysOfWeek, methods?, notes? }
 */
async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await requireAuth(req)
    const body = parseBody(req)

    // Override userId with authenticated user
    body.userId = auth.userId
    if (!body.startDate) {
      return sendError(res, "startDate is required", 400)
    }
    if (!body.duration) {
      return sendError(res, "duration is required", 400)
    }

    // Check for overlapping programs (active or planned)
    const newEndDate = calculateEndDate(body.startDate, body.duration)
    const existingRecords = await base(tables.programs)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    // Filter to this user's active/planned programs and check for overlap
    for (const record of existingRecords) {
      const userIds = record.fields[PROGRAM_FIELDS.user] as string[] | undefined
      if (!userIds?.includes(body.userId)) continue

      const status = record.fields[PROGRAM_FIELDS.status] as string | undefined
      if (status !== "Actief" && status !== "Gepland") continue

      const existingStart = record.fields[PROGRAM_FIELDS.startDate] as string
      const existingEndRaw = record.fields[PROGRAM_FIELDS.endDate] as string
      const existingEnd = parseEuropeanDate(existingEndRaw)

      if (existingStart && existingEnd && dateRangesOverlap(body.startDate, newEndDate, existingStart, existingEnd)) {
        const program = transformProgram(record as any)
        return sendError(res, `Dit programma overlapt met een bestaand programma (${program.name || 'Naamloos'}). Kies andere datums.`, 409)
      }
    }

    // Build fields object for Airtable
    const fields: Record<string, unknown> = {
      [PROGRAM_FIELDS.user]: [body.userId],
      [PROGRAM_FIELDS.startDate]: body.startDate,
      [PROGRAM_FIELDS.duration]: body.duration,
      [PROGRAM_FIELDS.status]: getInitialProgramStatus(body.startDate),
      [PROGRAM_FIELDS.creationType]: "Manueel"  // Manual program creation
    }

    // Optional fields
    if (body.daysOfWeek && Array.isArray(body.daysOfWeek) && body.daysOfWeek.length > 0) {
      fields[PROGRAM_FIELDS.daysOfWeek] = body.daysOfWeek
    }
    if (body.goals && Array.isArray(body.goals) && body.goals.length > 0) {
      fields[PROGRAM_FIELDS.goals] = body.goals
    }
    if (body.methods && Array.isArray(body.methods) && body.methods.length > 0) {
      fields[PROGRAM_FIELDS.methods] = body.methods
    }
    if (body.notes) {
      fields[PROGRAM_FIELDS.notes] = body.notes
    }

    // Create the program in Airtable
    const record = await base(tables.programs).create(fields, { typecast: true })

    // Fetch the created record with all computed fields
    const createdRecord = await base(tables.programs).find(record.id)

    const program = transformProgram(createdRecord as any)

    return sendSuccess(res, program, 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
