import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { dbQuery } from "../_lib/db/client.js"
import { createProgram, toApiProgram } from "../_lib/repos/program-repo.js"
import { create as createPersoonlijkeOvertuiging } from "../_lib/repos/persoonlijke-overtuigingen-repo.js"
import { updateUserGoedeGewoontes } from "../_lib/repos/user-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

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
 * POST /api/programs/confirm - Save user-confirmed/edited program to Postgres
 * Body: { userId, goals[], startDate, duration, daysOfWeek[], editedSchedule[], programSummary? }
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)

    const body = parseBody(req)

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

    // Create custom overtuigingen
    if (body.customOvertuigingen && Array.isArray(body.customOvertuigingen)) {
      for (const name of body.customOvertuigingen) {
        if (typeof name === "string" && name.trim().length > 0 && name.length <= 200) {
          await createPersoonlijkeOvertuiging({
            userId: body.userId,
            name: name.trim(),
            programId: program.id
          })
        }
      }
    }

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
