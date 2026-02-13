import type { Request, Response } from "express"
import { base, tables } from "../../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../_lib/api-utils.js"
import { requireAuth, AuthError } from "../../_lib/auth.js"
import { getDataBackendMode } from "../../_lib/data-backend.js"
import { isPostgresConfigured, withDbTransaction } from "../../_lib/db/client.js"
import { isEntityId, isAirtableRecordId } from "../../_lib/db/id-utils.js"
import {
  transformProgram,
  transformMethod,
  transformDay,
  PROGRAM_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  isValidRecordId
} from "../../_lib/field-mappings.js"
import { getProgramByAnyId, toApiProgram } from "../../_lib/repos/program-repo.js"
import { enqueueSyncEvent } from "../../_lib/sync/outbox.js"
import { syncNotificationJobsForUser } from "../../_lib/notifications/planner.js"

const PROGRAMS_BACKEND_ENV = "DATA_BACKEND_PROGRAMS"
const DAY_NAME_TO_WEEKDAY: Record<string, number> = {
  Zondag: 0,
  Maandag: 1,
  Dinsdag: 2,
  Woensdag: 3,
  Donderdag: 4,
  Vrijdag: 5,
  Zaterdag: 6
}
const WEEKDAY_TO_DAY_NAME = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"]

interface TrainingDate {
  date: string
  dayOfWeek: string
  dayId: string
}

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

function getLocalDateStr(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return getLocalDateStr(date)
}

function maxDate(a: string, b: string): string {
  return a >= b ? a : b
}

function calculateTotalWeeksFromStart(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diffMs = end.getTime() - start.getTime()
  if (diffMs < 0) return 1

  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1
  return Math.max(1, Math.ceil(diffDays / 7))
}

function getProgramStatusByDates(startDate: string, endDate: string, today: string): "Actief" | "Gepland" | "Afgewerkt" {
  if (today < startDate) return "Gepland"
  if (today > endDate) return "Afgewerkt"
  return "Actief"
}

function calculateTrainingDates(
  startDateStr: string,
  endDateStr: string,
  days: Array<{ id: string; name: string }>
): TrainingDate[] {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const dayMap = new Map<number, { id: string; name: string }>()
  for (const day of days) {
    const weekday = DAY_NAME_TO_WEEKDAY[day.name]
    if (weekday !== undefined) dayMap.set(weekday, day)
  }

  const trainingDates: TrainingDate[] = []
  const current = new Date(start)
  while (current <= end) {
    const weekday = current.getDay()
    const dayRecord = dayMap.get(weekday)
    if (dayRecord) {
      trainingDates.push({
        date: getLocalDateStr(current),
        dayOfWeek: WEEKDAY_TO_DAY_NAME[weekday],
        dayId: dayRecord.id
      })
    }
    current.setDate(current.getDate() + 1)
  }

  return trainingDates
}

function distributeMethodsEvenly(
  methods: Array<{ id: string; name: string; duration: number }>,
  trainingDates: TrainingDate[]
): ScheduleDay[] {
  if (methods.length === 0 || trainingDates.length === 0) return []

  const schedule: ScheduleDay[] = []
  let methodIndex = 0

  for (const date of trainingDates) {
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

async function fetchDays(dayIds: string[]): Promise<Array<{ id: string; name: string }>> {
  const airtableDayIds = dayIds.filter(isAirtableRecordId)
  if (airtableDayIds.length === 0) return []
  const formula = `OR(${airtableDayIds.map((id) => `RECORD_ID() = "${id}"`).join(",")})`
  const records = await base(tables.daysOfWeek)
    .select({
      filterByFormula: formula,
      returnFieldsByFieldId: true
    })
    .all()
  return records.map((record) => transformDay(record as any))
}

async function fetchMethods(methodIds: string[]): Promise<Array<{ id: string; name: string; duration: number }>> {
  const airtableMethodIds = methodIds.filter(isAirtableRecordId)
  if (airtableMethodIds.length === 0) {
    return methodIds.map((id) => ({ id, name: id, duration: 0 }))
  }

  const formula = `OR(${airtableMethodIds.map((id) => `RECORD_ID() = "${id}"`).join(",")})`
  const records = await base(tables.methods)
    .select({
      filterByFormula: formula,
      returnFieldsByFieldId: true
    })
    .all()

  const detailsById = new Map<string, ReturnType<typeof transformMethod>>()
  for (const record of records) {
    detailsById.set(record.id, transformMethod(record as any))
  }

  return methodIds.map((id) => {
    const details = detailsById.get(id)
    if (!details) return { id, name: id, duration: 0 }
    return {
      id,
      name: details.name,
      duration: details.duration
    }
  })
}

async function createProgramplanningRecords(
  programId: string,
  goalIds: string[],
  schedule: ScheduleDay[]
): Promise<number> {
  if (schedule.length === 0) return 0

  const records: Array<{ fields: Record<string, unknown> }> = schedule.map((day) => {
    const methodIds = day.methods.map((m) => m.methodId)
    const sessionDescription = day.methods
      .map((m) => `${m.methodName} (${m.duration} min)`)
      .join("\n")

    return {
      fields: {
        [PROGRAMMAPLANNING_FIELDS.program]: [programId],
        [PROGRAMMAPLANNING_FIELDS.date]: day.date,
        [PROGRAMMAPLANNING_FIELDS.dayOfWeek]: [day.dayId],
        [PROGRAMMAPLANNING_FIELDS.methods]: methodIds,
        [PROGRAMMAPLANNING_FIELDS.goals]: goalIds,
        [PROGRAMMAPLANNING_FIELDS.sessionDescription]: sessionDescription
      }
    }
  })

  const BATCH_SIZE = 10
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    await base(tables.programmaplanning).create(batch, { typecast: true })
  }

  return records.length
}

function parseExtendRequest(body: Record<string, unknown>) {
  const weeksRaw = body.weeks
  if (weeksRaw === undefined) return { weeks: 4 }
  if (typeof weeksRaw !== "number" || !Number.isInteger(weeksRaw) || weeksRaw < 1 || weeksRaw > 52) {
    return { error: "weeks must be an integer between 1 and 52" as const }
  }
  return { weeks: weeksRaw }
}

async function handlePostAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const { id } = req.params
    if (!id || typeof id !== "string" || !isValidRecordId(id)) {
      return sendError(res, "Invalid program ID", 400)
    }

    const parsed = parseExtendRequest(parseBody(req))
    if ("error" in parsed) return sendError(res, parsed.error, 400)

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

    const ownerId = (programRecords[0].fields[PROGRAM_FIELDS.user] as string[] | undefined)?.[0]
    if (ownerId !== auth.userId) {
      return sendError(res, "Forbidden: You don't own this program", 403)
    }

    const program = transformProgram(programRecords[0] as any)
    if (!Array.isArray(program.daysOfWeek) || program.daysOfWeek.length === 0) {
      return sendError(res, "Program has no training days configured", 400)
    }
    if (!Array.isArray(program.methods) || program.methods.length === 0) {
      return sendError(res, "Program has no methods configured", 400)
    }
    if (!program.endDate) {
      return sendError(res, "Program has no end date", 400)
    }

    const today = getLocalDateStr(new Date())
    const extensionStart = maxDate(addDays(program.endDate, 1), today)
    const newEndDate = addDays(extensionStart, (parsed.weeks * 7) - 1)
    const newDurationWeeks = calculateTotalWeeksFromStart(program.startDate, newEndDate)
    const newDuration = `${newDurationWeeks} weken`
    const newStatus = getProgramStatusByDates(program.startDate, newEndDate, today)

    await base(tables.programs).update(
      id,
      {
        [PROGRAM_FIELDS.duration]: newDuration,
        [PROGRAM_FIELDS.status]: newStatus
      },
      { typecast: true }
    )

    const days = await fetchDays(program.daysOfWeek)
    const methods = await fetchMethods(program.methods)
    const trainingDates = calculateTrainingDates(extensionStart, newEndDate, days)
    const newSchedule = distributeMethodsEvenly(methods, trainingDates)
    const createdSessions = await createProgramplanningRecords(id, program.goals || [], newSchedule)

    const refreshed = await base(tables.programs).find(id)
    const updatedProgram = transformProgram(refreshed as any)
    return sendSuccess(res, {
      program: updatedProgram,
      createdSessions,
      extensionStart,
      newEndDate
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

async function handlePostPostgres(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const { id } = req.params
    if (!id || typeof id !== "string" || !isEntityId(id)) {
      return sendError(res, "Invalid program ID", 400)
    }

    const parsed = parseExtendRequest(parseBody(req))
    if ("error" in parsed) return sendError(res, parsed.error, 400)

    const program = await getProgramByAnyId(id, auth.userId)
    if (!program) {
      return sendError(res, "Program not found", 404)
    }

    if (!Array.isArray(program.daysOfWeek) || program.daysOfWeek.length === 0) {
      return sendError(res, "Program has no training days configured", 400)
    }
    if (!Array.isArray(program.methods) || program.methods.length === 0) {
      return sendError(res, "Program has no methods configured", 400)
    }
    if (!program.endDate) {
      return sendError(res, "Program has no end date", 400)
    }

    const today = getLocalDateStr(new Date())
    const extensionStart = maxDate(addDays(program.endDate, 1), today)
    const newEndDate = addDays(extensionStart, (parsed.weeks * 7) - 1)
    const newDurationWeeks = calculateTotalWeeksFromStart(program.startDate, newEndDate)
    const newDuration = `${newDurationWeeks} weken`
    const newStatus = getProgramStatusByDates(program.startDate, newEndDate, today)

    const days = await fetchDays(program.daysOfWeek)
    const methods = await fetchMethods(program.methods)
    const trainingDates = calculateTrainingDates(extensionStart, newEndDate, days)
    const newSchedule = distributeMethodsEvenly(methods, trainingDates)

    const createdRows = await withDbTransaction(async (client) => {
      await client.query(
        `UPDATE programs_pg
         SET duration = $1, end_date = $2::date, status = $3, updated_at = NOW()
         WHERE id = $4::uuid AND user_id = $5`,
        [newDuration, newEndDate, newStatus, program.id, auth.userId]
      )

      const inserted: Array<{
        id: string
        program_id: string
        session_date: string
        day_of_week_id: string
        session_description: string
        method_ids: string[]
        goal_ids: string[]
      }> = []

      for (const day of newSchedule) {
        const methodIds = day.methods.map((m) => m.methodId)
        const sessionDescription = day.methods
          .map((m) => `${m.methodName} (${m.duration} min)`)
          .join("\n")

        const result = await client.query<{
          id: string
          program_id: string
          session_date: string
          day_of_week_id: string
          session_description: string
          method_ids: string[]
          goal_ids: string[]
        }>(
          `INSERT INTO program_schedule_pg (
             program_id,
             session_date,
             day_of_week_id,
             session_description,
             method_ids,
             goal_ids,
             updated_at
           ) VALUES ($1::uuid, $2::date, $3, $4, $5::jsonb, $6::jsonb, NOW())
           RETURNING id, program_id, session_date::text, day_of_week_id, session_description, method_ids, goal_ids`,
          [
            program.id,
            day.date,
            day.dayId,
            sessionDescription || null,
            JSON.stringify(methodIds),
            JSON.stringify(program.goals || [])
          ]
        )
        inserted.push(result.rows[0])
      }

      return inserted
    })

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program",
      entityId: program.id,
      payload: {
        userId: auth.userId,
        startDate: program.startDate,
        duration: newDuration,
        status: newStatus,
        creationType: program.creationType || "Manueel",
        notes: program.notes,
        goals: program.goals,
        methods: program.methods,
        daysOfWeek: program.daysOfWeek,
        overtuigingen: program.overtuigingen
      },
      priority: 30
    })

    for (const row of createdRows) {
      await enqueueSyncEvent({
        eventType: "upsert",
        entityType: "program_schedule",
        entityId: row.id,
        payload: {
          programId: row.program_id,
          date: row.session_date,
          methods: row.method_ids,
          goals: row.goal_ids,
          notes: null,
          sessionDescription: row.session_description
        },
        priority: 35
      })
    }

    await syncNotificationJobsForUser(auth.userId)

    return sendSuccess(res, {
      program: toApiProgram({
        ...program,
        duration: newDuration,
        endDate: newEndDate,
        status: newStatus
      }),
      createdSessions: createdRows.length,
      extensionStart,
      newEndDate
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  const mode = getDataBackendMode(PROGRAMS_BACKEND_ENV)
  if (mode === "postgres_primary" && isPostgresConfigured()) {
    return handlePostPostgres(req, res)
  }
  return handlePostAirtable(req, res)
}
