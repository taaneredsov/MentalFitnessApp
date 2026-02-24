import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { transformProgram, parseEuropeanDate, PROGRAM_FIELDS, PROGRAMMAPLANNING_FIELDS } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured, dbQuery } from "../_lib/db/client.js"
import { createProgram, toApiProgram } from "../_lib/repos/program-repo.js"
import { updateUserGoedeGewoontes } from "../_lib/repos/user-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import type { AirtableRecord } from "../_lib/types.js"

const PROGRAMS_BACKEND_ENV = "DATA_BACKEND_PROGRAMS"

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
 * Create schedule records in Postgres and enqueue sync events
 */
async function createScheduleInPostgres(
  programId: string,
  goalIds: string[],
  schedule: ScheduleDay[]
): Promise<void> {
  for (const day of schedule) {
    const methodIds = day.methods.map(m => m.methodId)
    const sessionDescription = day.methods
      .map(m => `${m.methodName} (${m.duration} min)`)
      .join("\n")

    const result = await dbQuery<{ id: string }>(
      `INSERT INTO program_schedule_pg (
        program_id,
        session_date,
        day_of_week_id,
        session_description,
        method_ids,
        goal_ids,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, NOW())
      RETURNING id`,
      [
        programId,
        day.date,
        day.dayId,
        sessionDescription,
        JSON.stringify(methodIds),
        JSON.stringify(goalIds)
      ]
    )

    const scheduleId = result.rows[0].id

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program_schedule",
      entityId: scheduleId,
      payload: {
        programId,
        date: day.date,
        dayOfWeekId: day.dayId,
        sessionDescription,
        methods: methodIds,
        goals: goalIds
      },
      priority: 40
    })
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
 * POST /api/programs/confirm - Save user-confirmed/edited program to Airtable
 * Body: { userId, goals[], startDate, duration, daysOfWeek[], editedSchedule[], programSummary? }
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  const mode = getDataBackendMode(PROGRAMS_BACKEND_ENV)

  if (mode === "postgres_primary" && isPostgresConfigured()) {
    return handleConfirmPostgres(req, res)
  }

  return handleConfirmAirtable(req, res)
}

async function handleConfirmPostgres(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    // Parse and validate request body
    const body = parseBody(req)

    // Override userId with authenticated user
    body.userId = auth.userId
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

    // Create program in Postgres (overlap check is built into createProgram)
    let program
    try {
      program = await createProgram({
        userId: body.userId,
        startDate: body.startDate,
        duration: body.duration,
        goals: body.goals,
        methods: Array.from(methodIds),
        daysOfWeek: body.daysOfWeek,
        notes: body.programSummary || undefined,
        overtuigingen: Array.isArray(body.overtuigingen) ? body.overtuigingen : [],
        creationType: "AI"
      })
    } catch (error) {
      if (error instanceof Error && error.message === "PROGRAM_OVERLAP") {
        return sendError(res, "Dit programma overlapt met een bestaand programma. Kies andere datums.", 409)
      }
      throw error
    }

    // Update name if provided (createProgram doesn't accept name directly)
    if (body.programName) {
      await dbQuery(
        `UPDATE programs_pg SET name = $1, updated_at = NOW() WHERE id = $2`,
        [body.programName, program.id]
      )
      program.name = body.programName
    }

    // Enqueue program sync to Airtable
    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program",
      entityId: program.id,
      payload: {
        userId: program.userId,
        name: program.name,
        startDate: program.startDate,
        duration: program.duration,
        status: program.status,
        creationType: "AI",
        notes: program.notes,
        goals: program.goals,
        methods: program.methods,
        daysOfWeek: program.daysOfWeek,
        overtuigingen: program.overtuigingen
      },
      priority: 30
    })

    // Create schedule records in Postgres
    await createScheduleInPostgres(program.id, body.goals, body.editedSchedule)

    // Save AI-selected goede gewoontes to user record
    if (body.selectedGoedeGewoontes && Array.isArray(body.selectedGoedeGewoontes) && body.selectedGoedeGewoontes.length > 0) {
      const goedeGewoonteIds = body.selectedGoedeGewoontes.map((g: { goedeGewoonteId: string }) => g.goedeGewoonteId)
      await updateUserGoedeGewoontes(body.userId, goedeGewoonteIds)
    }

    // Return response (same format as generate endpoint)
    return sendSuccess(res, {
      program: toApiProgram(program),
      aiSchedule: body.editedSchedule,
      weeklySessionTime,
      recommendations: [],
      programSummary: body.programSummary
    }, 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

async function handleConfirmAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    // Parse and validate request body
    const body = parseBody(req)

    // Override userId with authenticated user
    body.userId = auth.userId
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

    // Check for overlapping programs
    const newEndDate = calculateEndDate(body.startDate, body.duration)
    const existingPrograms = await base(tables.programs)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    // Filter to user's active/planned programs and check for overlap
    for (const record of existingPrograms) {
      const userIds = record.fields[PROGRAM_FIELDS.user] as string[] | undefined
      if (!userIds?.includes(body.userId)) continue

      const status = record.fields[PROGRAM_FIELDS.status] as string | undefined
      if (status !== "Actief" && status !== "Gepland") continue

      const existingStart = record.fields[PROGRAM_FIELDS.startDate] as string
      const existingEndRaw = record.fields[PROGRAM_FIELDS.endDate] as string
      const existingEnd = parseEuropeanDate(existingEndRaw)

      if (existingStart && existingEnd && dateRangesOverlap(body.startDate, newEndDate, existingStart, existingEnd)) {
        const program = transformProgram(record as AirtableRecord)
        return sendError(res, `Dit programma overlapt met een bestaand programma (${program.name || 'Naamloos'}). Kies andere datums.`, 409)
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

    // Determine initial program status based on start date
    // Use local date formatting to avoid UTC timezone issues
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`
    const initialStatus = body.startDate <= todayStr ? "Actief" : "Gepland"

    // Create program in Airtable
    const programFields: Record<string, unknown> = {
      [PROGRAM_FIELDS.user]: [body.userId],
      [PROGRAM_FIELDS.startDate]: body.startDate,
      [PROGRAM_FIELDS.duration]: body.duration,
      [PROGRAM_FIELDS.daysOfWeek]: body.daysOfWeek,
      [PROGRAM_FIELDS.goals]: body.goals,
      [PROGRAM_FIELDS.methods]: Array.from(methodIds),
      [PROGRAM_FIELDS.status]: initialStatus,
      [PROGRAM_FIELDS.creationType]: "AI"  // AI wizard creates AI programs
    }

    // Add overtuigingen if provided
    if (body.overtuigingen && Array.isArray(body.overtuigingen) && body.overtuigingen.length > 0) {
      programFields[PROGRAM_FIELDS.overtuigingen] = body.overtuigingen
    }

    // Store name in dedicated field, summary in notes
    if (body.programName) {
      programFields[PROGRAM_FIELDS.name] = body.programName
    }
    if (body.programSummary) {
      programFields[PROGRAM_FIELDS.notes] = body.programSummary
    }

    const programRecord = await base(tables.programs).create(programFields, { typecast: true })

    // Create Programmaplanning records for each training date
    await createProgramplanningRecords(programRecord.id, body.goals, body.editedSchedule)

    // Fetch created program with computed fields
    const createdRecord = await base(tables.programs).find(programRecord.id)
    const program = transformProgram(createdRecord as AirtableRecord)

    // Save AI-selected goede gewoontes to user record (always in Postgres)
    if (body.selectedGoedeGewoontes && Array.isArray(body.selectedGoedeGewoontes) && body.selectedGoedeGewoontes.length > 0) {
      if (isPostgresConfigured()) {
        const { updateUserGoedeGewoontes: updateGG } = await import("../_lib/repos/user-repo.js")
        const goedeGewoonteIds = body.selectedGoedeGewoontes.map((g: { goedeGewoonteId: string }) => g.goedeGewoonteId)
        await updateGG(body.userId, goedeGewoonteIds)
      }
    }

    // Return response (same format as generate endpoint)
    return sendSuccess(res, {
      program,
      aiSchedule: body.editedSchedule,
      weeklySessionTime,
      recommendations: [],
      programSummary: body.programSummary
    }, 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
