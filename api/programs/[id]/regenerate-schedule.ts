import type { Request, Response } from "express"
import { base, tables } from "../../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../_lib/api-utils.js"
import { verifyToken } from "../../_lib/jwt.js"
import { requireAuth, AuthError } from "../../_lib/auth.js"
import { getDataBackendMode } from "../../_lib/data-backend.js"
import { isPostgresConfigured, dbQuery } from "../../_lib/db/client.js"
import {
  getProgramByAnyId,
  listProgramSessions,
  updateProgramById,
  toApiProgram
} from "../../_lib/repos/program-repo.js"
import { loadProgramGenerationData } from "../../_lib/program-generation-data.js"
import { enqueueSyncEvent } from "../../_lib/sync/outbox.js"
import {
  transformProgram,
  transformProgrammaplanning,
  transformGoal,
  transformMethod,
  transformDay,
  transformProgramPrompt,
  transformExperienceLevel,
  PROGRAM_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  isValidRecordId
} from "../../_lib/field-mappings.js"
import {
  getOpenAI,
  buildSystemPrompt,
  AI_PROGRAM_SCHEMA,
  type AIProgramResponse,
  type TrainingDate,
  type AIMethod
} from "../../_lib/openai.js"
import type { AirtableRecord } from "../../_lib/types.js"

const PROGRAMS_BACKEND_ENV = "DATA_BACKEND_PROGRAMS"

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
 * Create Programmaplanning records in batches
 */
async function createProgramplanningRecords(
  programId: string,
  goalIds: string[],
  schedule: ScheduleDay[]
): Promise<void> {
  const records: Array<{ fields: Record<string, unknown> }> = []

  for (const day of schedule) {
    const methodIds = day.methods.map(m => m.methodId)
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

  const BATCH_SIZE = 10
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    await base(tables.programmaplanning).create(batch, { typecast: true })
  }
}

/**
 * Delete Programmaplanning records in batches
 */
async function deleteProgramplanningRecords(ids: string[]): Promise<void> {
  const BATCH_SIZE = 10
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE)
    await base(tables.programmaplanning).destroy(batch)
  }
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

  const mode = getDataBackendMode(PROGRAMS_BACKEND_ENV)
  if (mode === "postgres_primary" && isPostgresConfigured()) {
    return handlePostgres(req, res)
  }

  return handleAirtable(req, res)
}

/**
 * Create schedule records in Postgres and enqueue sync events.
 * Follows the same pattern as createScheduleInPostgres in confirm.ts.
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

async function handlePostgres(req: Request, res: Response) {
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
      await createScheduleInPostgres(program.id, goalIds, newSchedule)
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

async function handleAirtable(req: Request, res: Response) {
  try {
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

    const { id } = req.params
    if (!id || typeof id !== "string" || !isValidRecordId(id)) {
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

    // Fetch the program
    const programRecords = await base(tables.programs)
      .select({
        filterByFormula: `RECORD_ID() = "${id}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (programRecords.length === 0) {
      return sendError(res, "Program not found", 404)
    }

    const program = transformProgram(programRecords[0] as AirtableRecord)

    // Verify ownership
    const programUserId = (programRecords[0].fields[PROGRAM_FIELDS.user] as string[])?.[0]
    if (programUserId !== payload.userId) {
      return sendError(res, "Forbidden: You don't own this program", 403)
    }

    // Calculate today's date for cutoff
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = today.toISOString().split("T")[0]

    // Fetch all Programmaplanning for this program
    const scheduleRecords = await base(tables.programmaplanning)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const allSessions = scheduleRecords
      .map(r => transformProgrammaplanning(r as AirtableRecord))
      .filter(s => s.programId === id)

    // Separate past and future sessions
    const pastSessions = allSessions.filter(s => s.date <= todayStr)
    const futureSessions = allSessions.filter(s => s.date > todayStr)

    // Check for sessions with completion records
    const sessionsWithUsage = futureSessions.filter(s => s.methodUsageIds.length > 0)
    if (sessionsWithUsage.length > 0 && !body.force) {
      return sendError(res, `${sessionsWithUsage.length} future session(s) have completed activities. Pass force=true to delete them.`, 409)
    }

    // Before deleting sessions with completions, preserve the method_usage records by linking them to the program directly
    // This prevents progress from being lost when we delete the programmaplanning sessions
    const methodUsageIdsToPreserve = sessionsWithUsage.flatMap(s => s.methodUsageIds)
    if (methodUsageIdsToPreserve.length > 0) {
      console.log(`[regenerate-schedule] Preserving ${methodUsageIdsToPreserve.length} method_usage records by linking to program`)

      // Update method_usage records to link to the program (fallback for deleted sessions)
      // Note: We need METHOD_USAGE_FIELDS.program for this
      const { METHOD_USAGE_FIELDS } = await import("../../_lib/field-mappings.js")

      const BATCH_SIZE = 10
      for (let i = 0; i < methodUsageIdsToPreserve.length; i += BATCH_SIZE) {
        const batch = methodUsageIdsToPreserve.slice(i, i + BATCH_SIZE)
        const updates = batch.map(usageId => ({
          id: usageId,
          fields: {
            [METHOD_USAGE_FIELDS.program]: [id]  // Link to program as fallback
          }
        }))
        await base(tables.methodUsage).update(updates)
      }
    }

    // Delete future Programmaplanning records
    if (futureSessions.length > 0) {
      await deleteProgramplanningRecords(futureSessions.map(s => s.id))
    }

    // Fetch the new days
    const dayRecords = await base(tables.daysOfWeek)
      .select({
        filterByFormula: `OR(${body.daysOfWeek.map((did: string) => `RECORD_ID() = "${did}"`).join(",")})`,
        returnFieldsByFieldId: true
      })
      .all()
    const days = dayRecords.map(r => transformDay(r as AirtableRecord))

    // Determine goals to use
    const goalIds = body.goals || program.goals

    // Calculate the start date for new schedule:
    // - For planned programs (start date in future), use the original start date
    // - For active programs (start date in past), use tomorrow
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = tomorrow.toISOString().split("T")[0]

    const startDateForSchedule = program.startDate > todayStr
      ? program.startDate
      : tomorrowStr

    // Calculate new training dates from start to program end
    const trainingDates = calculateTrainingDates(startDateForSchedule, program.endDate, days)

    let newSchedule: ScheduleDay[] = []

    if (regenerateMethod === "ai" && program.creationType === "AI") {
      // Regenerate using AI
      // Fetch goal details
      const goalRecords = await base(tables.goals)
        .select({
          filterByFormula: `OR(${goalIds.map((gid: string) => `RECORD_ID() = "${gid}"`).join(",")})`,
          returnFieldsByFieldId: true
        })
        .all()
      const goals = goalRecords.map(r => transformGoal(r as AirtableRecord))

      // Fetch prompts
      const promptRecords = await base(tables.programPrompts)
        .select({ returnFieldsByFieldId: true })
        .all()
      const allPrompts = promptRecords.map(r => transformProgramPrompt(r as AirtableRecord))
      const systemPromptRecords = allPrompts.filter(p => p.promptType === "Systeem")
      const systemPrompts = new Map<string, string>()
      for (const sp of systemPromptRecords) {
        if (sp.name && sp.prompt) systemPrompts.set(sp.name, sp.prompt)
      }
      const programPrompts = allPrompts
        .filter(p => p.promptType === "Programmaopbouw" || !p.promptType)
        .filter(prompt => prompt.goals.some((gid: string) => goalIds.includes(gid)))
        .map(prompt => ({ goalIds: prompt.goals.filter((gid: string) => goalIds.includes(gid)), prompt: prompt.prompt }))

      // Fetch experience levels
      const expRecords = await base(tables.experienceLevels).select({ returnFieldsByFieldId: true }).all()
      const experienceLevelMap = new Map(expRecords.map(r => {
        const el = transformExperienceLevel(r as AirtableRecord)
        return [el.id, el.name]
      }))

      // Fetch methods
      const methodRecords = await base(tables.methods).select({ returnFieldsByFieldId: true }).all()
      const rawMethods = methodRecords.map(r => transformMethod(r as AirtableRecord))

      const methods: AIMethod[] = rawMethods.map(m => ({
        id: m.id,
        name: m.name,
        duration: m.duration,
        description: m.description,
        optimalFrequency: m.optimalFrequency || [],
        experienceLevel: m.experienceLevelIds?.[0] ? experienceLevelMap.get(m.experienceLevelIds[0]) : undefined,
        isRecommendedForGoals: m.linkedGoalIds?.some((gid: string) => goalIds.includes(gid)) || false
      }))

      // Build prompt with edit context
      const completedMethodIds = pastSessions.flatMap(s => s.methodIds || [])
      const systemPrompt = buildSystemPrompt({
        goals,
        programPrompts,
        systemPrompts,
        methods,
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
      // Simple method distribution
      // Fetch methods linked to the program
      let methodsToUse: Array<{ id: string; name: string; duration: number }> = []

      if (program.methods.length > 0) {
        const methodRecords = await base(tables.methods)
          .select({
            filterByFormula: `OR(${program.methods.map((mid: string) => `RECORD_ID() = "${mid}"`).join(",")})`,
            returnFieldsByFieldId: true
          })
          .all()
        methodsToUse = methodRecords.map(r => {
          const m = transformMethod(r as AirtableRecord)
          return { id: m.id, name: m.name, duration: m.duration }
        })
      }

      newSchedule = distributeMethodsEvenly(methodsToUse, trainingDates)
    }

    // Update program record with new daysOfWeek and goals
    const updateFields: Record<string, unknown> = {
      [PROGRAM_FIELDS.daysOfWeek]: body.daysOfWeek
    }
    if (body.goals) {
      updateFields[PROGRAM_FIELDS.goals] = body.goals
    }
    await base(tables.programs).update(id, updateFields, { typecast: true })

    // Create new Programmaplanning records
    if (newSchedule.length > 0) {
      await createProgramplanningRecords(id, goalIds, newSchedule)
    }

    // Fetch updated program
    const updatedRecord = await base(tables.programs).find(id)
    const updatedProgram = transformProgram(updatedRecord as AirtableRecord)

    return sendSuccess(res, {
      program: updatedProgram,
      preservedSessions: pastSessions.length,
      regeneratedSessions: newSchedule.length,
      deletedSessions: futureSessions.length,
      newSchedule
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}
