import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../_lib/api-utils.js"
import { requireAuth, AuthError } from "../../_lib/auth.js"
import { dbQuery } from "../../_lib/db/client.js"
import {
  getProgramByAnyId,
  listProgramSessions,
  updateProgramById,
  toApiProgram
} from "../../_lib/repos/program-repo.js"
import { loadProgramGenerationData } from "../../_lib/program-generation-data.js"
import { enqueueSyncEvent } from "../../_lib/sync/outbox.js"
import {
  getOpenAI,
  buildSystemPrompt,
  AI_PROGRAM_SCHEMA,
  type AIProgramResponse,
  type TrainingDate,
  type AIMethod
} from "../../_lib/openai.js"

// Day name to JS weekday mapping
const DAY_NAME_TO_WEEKDAY: Record<string, number> = {
  "Zondag": 0, "Maandag": 1, "Dinsdag": 2, "Woensdag": 3,
  "Donderdag": 4, "Vrijdag": 5, "Zaterdag": 6
}
const WEEKDAY_TO_DAY_NAME = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"]

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
 * Calculate training dates from a start date to end date for given days
 */
function calculateTrainingDates(
  startDateStr: string,
  endDateStr: string,
  days: Array<{ id: string; name: string }>
): TrainingDate[] {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  end.setDate(end.getDate() + 1) // Make end date inclusive
  const trainingDates: TrainingDate[] = []

  const dayMap = new Map<number, { id: string; name: string }>()
  for (const day of days) {
    const weekday = DAY_NAME_TO_WEEKDAY[day.name]
    if (weekday !== undefined) {
      dayMap.set(weekday, day)
    }
  }

  const current = new Date(start)
  while (current <= end) {
    const weekday = current.getDay()
    const dayRecord = dayMap.get(weekday)

    if (dayRecord) {
      const dateStr = current.toISOString().split("T")[0]
      trainingDates.push({
        date: dateStr,
        dayOfWeek: WEEKDAY_TO_DAY_NAME[weekday],
        dayId: dayRecord.id
      })
    }

    current.setDate(current.getDate() + 1)
  }

  return trainingDates
}

/**
 * Distribute methods evenly across training dates (for manual programs)
 */
function distributeMethodsEvenly(
  methods: Array<{ id: string; name: string; duration: number }>,
  trainingDates: TrainingDate[]
): ScheduleDay[] {
  if (methods.length === 0 || trainingDates.length === 0) return []

  const schedule: ScheduleDay[] = []
  let methodIndex = 0

  for (const date of trainingDates) {
    // Assign 1-2 methods per session, rotating through available methods
    const sessionMethods: ScheduleMethod[] = []
    const methodsPerSession = Math.max(1, Math.ceil(methods.length / trainingDates.length))

    for (let i = 0; i < methodsPerSession && sessionMethods.length < 3; i++) {
      const method = methods[methodIndex % methods.length]
      sessionMethods.push({
        methodId: method.id,
        methodName: method.name,
        duration: method.duration
      })
      methodIndex++
    }

    schedule.push({
      date: date.date,
      dayOfWeek: date.dayOfWeek,
      dayId: date.dayId,
      methods: sessionMethods
    })
  }

  return schedule
}

/**
 * POST /api/programs/[id]/regenerate-schedule
 * Regenerates future schedule for an existing program
 * Body: { daysOfWeek: string[], goals?: string[], regenerateMethod: "ai" | "simple" }
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)

    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Invalid program ID", 400)
    }

    const body = parseBody(req)
    if (!body.daysOfWeek || !Array.isArray(body.daysOfWeek) || body.daysOfWeek.length === 0) {
      return sendError(res, "daysOfWeek array is required", 400)
    }

    const regenerateMethod = body.regenerateMethod || "simple"
    if (!["ai", "simple"].includes(regenerateMethod)) {
      return sendError(res, "regenerateMethod must be 'ai' or 'simple'", 400)
    }

    // Fetch program (handles both UUID and Airtable record IDs, verifies ownership)
    const program = await getProgramByAnyId(id, auth.userId)
    if (!program) {
      return sendError(res, "Program not found", 404)
    }

    if (!program.endDate) {
      return sendError(res, "Program has no end date", 400)
    }

    // Calculate today's date for cutoff
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

    // Fetch all sessions for this program
    const allSessions = await listProgramSessions(program.id)

    // Separate past and future sessions
    const pastSessions = allSessions.filter(s => s.date && s.date <= todayStr)
    const futureSessions = allSessions.filter(s => s.date && s.date > todayStr)
    const futureSessionIds = futureSessions.map(s => s.id)

    // Check for future sessions that have method_usage records
    let sessionsWithUsageIds: string[] = []
    if (futureSessionIds.length > 0) {
      const usageResult = await dbQuery<{ program_schedule_id: string }>(
        `SELECT DISTINCT program_schedule_id
         FROM method_usage_pg
         WHERE program_schedule_id = ANY($1::uuid[])`,
        [futureSessionIds]
      )
      sessionsWithUsageIds = usageResult.rows.map(r => String(r.program_schedule_id))
    }

    if (sessionsWithUsageIds.length > 0 && !body.force) {
      return sendError(
        res,
        `${sessionsWithUsageIds.length} future session(s) have completed activities. Pass force=true to delete them.`,
        409
      )
    }

    // Preserve method_usage records for sessions with completions by linking them directly to the program
    if (sessionsWithUsageIds.length > 0) {
      console.log(`[regenerate-schedule] Preserving method_usage records for ${sessionsWithUsageIds.length} sessions by linking to program`)

      await dbQuery(
        `UPDATE method_usage_pg
         SET program_id = $1, program_schedule_id = NULL, updated_at = NOW()
         WHERE program_schedule_id = ANY($2::uuid[])`,
        [program.id, sessionsWithUsageIds]
      )
    }

    // Delete future sessions
    if (futureSessionIds.length > 0) {
      // Enqueue delete events before actually deleting
      for (const sessionId of futureSessionIds) {
        await enqueueSyncEvent({
          eventType: "delete",
          entityType: "program_schedule",
          entityId: sessionId,
          payload: { programId: program.id },
          priority: 40
        })
      }

      await dbQuery(
        `DELETE FROM program_schedule_pg
         WHERE id = ANY($1::uuid[]) AND program_id = $2`,
        [futureSessionIds, program.id]
      )
    }

    // Determine goals to use
    const goalIds = body.goals || program.goals

    // Load reference data from Postgres (days, goals, methods, prompts, experience levels)
    const genData = await loadProgramGenerationData({
      goalIds,
      dayIds: body.daysOfWeek
    })

    // Calculate the start date for new schedule
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`

    const startDateForSchedule = program.startDate > todayStr
      ? program.startDate
      : tomorrowStr

    // Calculate new training dates
    const trainingDates = calculateTrainingDates(startDateForSchedule, program.endDate, genData.days)

    let newSchedule: ScheduleDay[] = []

    if (regenerateMethod === "ai" && program.creationType === "AI") {
      // Build prompt with edit context
      const completedMethodIds = pastSessions.flatMap(s => s.methodIds || [])
      const systemPrompt = buildSystemPrompt({
        goals: genData.goals as Array<{ id: string; name: string; description?: string }>,
        programPrompts: genData.programPrompts,
        systemPrompts: genData.systemPrompts,
        methods: genData.methods,
        trainingDates,
        duration: program.duration,
        editContext: {
          isEdit: true,
          completedMethods: completedMethodIds,
          preservedSessionCount: pastSessions.length
        }
      })

      // Call OpenAI
      const openai = getOpenAI()
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Genereer een mentaal fitnessprogramma op basis van de bovenstaande informatie. Dit is een aanpassing van een bestaand programma." }
        ],
        response_format: AI_PROGRAM_SCHEMA,
        temperature: 0.7,
        max_tokens: 4000
      })

      const aiResponseText = completion.choices[0]?.message?.content
      if (!aiResponseText) {
        return sendError(res, "AI failed to generate schedule", 500)
      }

      let aiResponse: AIProgramResponse
      try {
        aiResponse = JSON.parse(aiResponseText)
      } catch {
        return sendError(res, "AI returned invalid JSON", 500)
      }

      if (!aiResponse.schedule || !Array.isArray(aiResponse.schedule)) {
        return sendError(res, "AI response missing schedule", 500)
      }

      newSchedule = aiResponse.schedule
    } else {
      // Simple method distribution using methods linked to the program
      let methodsToUse: Array<{ id: string; name: string; duration: number }> = []

      if (program.methods.length > 0) {
        // Filter genData.rawMethods to only methods linked to this program
        const programMethodIds = new Set(program.methods)
        methodsToUse = genData.rawMethods
          .filter(m => programMethodIds.has(m.id as string))
          .map(m => ({
            id: m.id as string,
            name: m.name as string,
            duration: m.duration as number
          }))
      }

      newSchedule = distributeMethodsEvenly(methodsToUse, trainingDates)
    }

    // Update program record with new daysOfWeek and goals
    const updateInput: { daysOfWeek?: string[]; goals?: string[] } = {
      daysOfWeek: body.daysOfWeek
    }
    if (body.goals) {
      updateInput.goals = body.goals
    }

    const updatedProgram = await updateProgramById(program.id, auth.userId, updateInput)
    if (!updatedProgram) {
      return sendError(res, "Failed to update program", 500)
    }

    // Enqueue program sync event
    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program",
      entityId: updatedProgram.id,
      payload: {
        userId: updatedProgram.userId,
        name: updatedProgram.name,
        startDate: updatedProgram.startDate,
        duration: updatedProgram.duration,
        status: updatedProgram.status,
        creationType: updatedProgram.creationType,
        notes: updatedProgram.notes,
        goals: updatedProgram.goals,
        methods: updatedProgram.methods,
        daysOfWeek: updatedProgram.daysOfWeek,
        overtuigingen: updatedProgram.overtuigingen
      },
      priority: 30
    })

    // Create new schedule records in Postgres
    if (newSchedule.length > 0) {
      for (const day of newSchedule) {
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
            program.id,
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
            programId: program.id,
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

    return sendSuccess(res, {
      program: toApiProgram(updatedProgram),
      preservedSessions: pastSessions.length,
      regeneratedSessions: newSchedule.length,
      deletedSessions: futureSessions.length,
      newSchedule
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
