import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import {
  transformProgram,
  transformGoal,
  transformMethod,
  transformDay,
  transformProgrammaplanning,
  transformOvertuiging,
  PROGRAM_FIELDS,
  METHOD_USAGE_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  isValidRecordId
} from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { isEntityId, isAirtableRecordId } from "../_lib/db/id-utils.js"
import {
  getMethodUsageByProgram,
  getProgramByAnyId,
  listProgramSessions,
  toApiProgram,
  updateProgramById
} from "../_lib/repos/program-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import type { AirtableRecord } from "../_lib/types.js"

const PROGRAMS_BACKEND_ENV = "DATA_BACKEND_PROGRAMS"

/**
 * GET /api/programs/[id] - Returns a single program with expanded relations
 * PATCH /api/programs/[id] - Updates a program
 */
export default async function handler(req: Request, res: Response) {
  const mode = getDataBackendMode(PROGRAMS_BACKEND_ENV)

  if (req.method === "PATCH") {
    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handlePatchPostgres(req, res)
    }
    return handlePatchAirtable(req, res)
  }

  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  if (mode === "postgres_primary" && isPostgresConfigured()) {
    return handleGetPostgres(req, res)
  }

  return handleGetAirtable(req, res)
}

async function fetchAirtableDetails(input: {
  goalIds: string[]
  methodIds: string[]
  dayIds: string[]
  overtuigingIds: string[]
}) {
  let goalDetails: Record<string, unknown>[] = []
  let methodDetails: Record<string, unknown>[] = []
  let dayNames: string[] = []
  let overtuigingDetails: Record<string, unknown>[] = []

  const validGoals = input.goalIds.filter(isAirtableRecordId)
  if (validGoals.length > 0) {
    const formula = `OR(${validGoals.map((id) => `RECORD_ID() = "${id}"`).join(",")})`
    const records = await base(tables.goals).select({ filterByFormula: formula, returnFieldsByFieldId: true }).all()
    goalDetails = records.map((r) => transformGoal(r as AirtableRecord))
  }

  const validMethods = input.methodIds.filter(isAirtableRecordId)
  if (validMethods.length > 0) {
    const formula = `OR(${validMethods.map((id) => `RECORD_ID() = "${id}"`).join(",")})`
    const records = await base(tables.methods).select({ filterByFormula: formula, returnFieldsByFieldId: true }).all()
    methodDetails = records.map((r) => transformMethod(r as AirtableRecord))
  }

  const validDays = input.dayIds.filter(isAirtableRecordId)
  if (validDays.length > 0) {
    const formula = `OR(${validDays.map((id) => `RECORD_ID() = "${id}"`).join(",")})`
    const records = await base(tables.daysOfWeek).select({ filterByFormula: formula, returnFieldsByFieldId: true }).all()
    dayNames = records.map((r) => transformDay(r as AirtableRecord).name)
  }

  const validOvertuigingen = input.overtuigingIds.filter(isAirtableRecordId)
  if (validOvertuigingen.length > 0) {
    const formula = `OR(${validOvertuigingen.map((id) => `RECORD_ID() = "${id}"`).join(",")})`
    const records = await base(tables.overtuigingen).select({ filterByFormula: formula, returnFieldsByFieldId: true }).all()
    overtuigingDetails = records.map((r) => transformOvertuiging(r as AirtableRecord))
  }

  return {
    goalDetails,
    methodDetails,
    dayNames,
    overtuigingDetails
  }
}

async function handleGetPostgres(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }
    if (!isEntityId(id)) {
      return sendError(res, "Invalid program ID format", 400)
    }

    const program = await getProgramByAnyId(id, auth.userId)
    if (!program) {
      return sendError(res, "Program not found", 404)
    }

    const programApi = toApiProgram(program)
    const sessions = await listProgramSessions(program.id)
    const usage = await getMethodUsageByProgram(program.id)

    const completedMethodBySession = new Map<string, string[]>()
    let directCompletions = 0

    for (const row of usage) {
      const methodId = String(row.method_id)
      if (row.program_schedule_id) {
        const scheduleId = String(row.program_schedule_id)
        const existing = completedMethodBySession.get(scheduleId) || []
        existing.push(methodId)
        completedMethodBySession.set(scheduleId, existing)
      } else {
        directCompletions += 1
      }
    }

    const schedule = sessions.map((session) => ({
      id: session.id,
      planningId: session.planningId || undefined,
      programId: session.programId,
      date: session.date || "",
      dayOfWeekId: session.dayOfWeekId || undefined,
      sessionDescription: session.sessionDescription || undefined,
      methodIds: session.methodIds,
      goalIds: session.goalIds,
      methodUsageIds: session.methodUsageIds,
      completedMethodIds: completedMethodBySession.get(session.id) || [],
      isCompleted: (completedMethodBySession.get(session.id) || []).length >= session.methodIds.length,
      notes: session.notes || undefined
    }))

    const totalSessions = schedule.length
    const completedSessions = schedule.filter((s) => s.isCompleted).length
    const totalMethods = schedule.reduce((sum, s) => sum + s.methodIds.length, 0)
    const completedMethods = schedule.reduce((sum, s) => sum + s.completedMethodIds.length, 0) + directCompletions

    const details = await fetchAirtableDetails({
      goalIds: (programApi.goals as string[]) || [],
      methodIds: (programApi.methods as string[]) || [],
      dayIds: (programApi.daysOfWeek as string[]) || [],
      overtuigingIds: (programApi.overtuigingen as string[]) || []
    })

    return sendSuccess(res, {
      ...programApi,
      ...details,
      schedule,
      totalSessions,
      completedSessions,
      totalMethods,
      completedMethods,
      preservedCompletions: directCompletions
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

async function handlePatchPostgres(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }
    if (!isEntityId(id)) {
      return sendError(res, "Invalid program ID format", 400)
    }

    const existing = await getProgramByAnyId(id, auth.userId)
    if (!existing) {
      return sendError(res, "Program not found", 404)
    }

    const body = parseBody(req)
    const updated = await updateProgramById(existing.id, auth.userId, {
      goals: body.goals,
      methods: body.methods,
      daysOfWeek: body.daysOfWeek,
      notes: body.notes,
      overtuigingen: body.overtuigingen
    })

    if (!updated) {
      return sendError(res, "Program not found", 404)
    }

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program",
      entityId: updated.id,
      payload: {
        userId: updated.userId,
        startDate: updated.startDate,
        duration: updated.duration,
        status: updated.status,
        creationType: updated.creationType,
        notes: updated.notes,
        goals: updated.goals,
        methods: updated.methods,
        daysOfWeek: updated.daysOfWeek,
        overtuigingen: updated.overtuigingen
      },
      priority: 30
    })

    return sendSuccess(res, toApiProgram(updated))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

async function handleGetAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    if (!isValidRecordId(id)) {
      return sendError(res, "Invalid program ID format", 400)
    }

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

    const programUserId = (records[0].fields[PROGRAM_FIELDS.user] as string[])?.[0]
    if (programUserId !== auth.userId) {
      return sendError(res, "Forbidden: You don't own this program", 403)
    }

    const program = transformProgram(records[0] as AirtableRecord)
    const details = await fetchAirtableDetails({
      goalIds: program.goals || [],
      methodIds: program.methods || [],
      dayIds: program.daysOfWeek || [],
      overtuigingIds: program.overtuigingen || []
    })

    const allScheduleRecords = await base(tables.programmaplanning)
      .select({
        returnFieldsByFieldId: true,
        sort: [{ field: PROGRAMMAPLANNING_FIELDS.date, direction: "asc" }]
      })
      .all()

    const rawSchedule = allScheduleRecords
      .map(r => transformProgrammaplanning(r as AirtableRecord))
      .filter(s => s.programId === id)

    const allMethodUsageIds = rawSchedule.flatMap(s => s.methodUsageIds || [])
    const programMethodUsageIds = (records[0].fields[PROGRAM_FIELDS.methodUsage] as string[]) || []
    const programDirectUsageIds = programMethodUsageIds.filter(uid => !allMethodUsageIds.includes(uid))
    const combinedMethodUsageIds = [...new Set([...allMethodUsageIds, ...programDirectUsageIds])]

    const methodUsageToMethodMap = new Map<string, string>()
    if (combinedMethodUsageIds.length > 0) {
      const usageFormula = `OR(${combinedMethodUsageIds.map(uid => `RECORD_ID() = "${uid}"`).join(",")})`
      const usageRecords = await base(tables.methodUsage)
        .select({
          filterByFormula: usageFormula,
          returnFieldsByFieldId: true
        })
        .all()

      for (const record of usageRecords) {
        const methodIds = record.fields[METHOD_USAGE_FIELDS.method] as string[] | undefined
        if (methodIds?.[0]) {
          methodUsageToMethodMap.set(record.id, methodIds[0])
        }
      }
    }

    const preservedCompletionMethodIds = programDirectUsageIds
      .filter(uid => !allMethodUsageIds.includes(uid))
      .map(uid => methodUsageToMethodMap.get(uid))
      .filter((mid): mid is string => !!mid)

    const schedule = rawSchedule.map(session => ({
      ...session,
      completedMethodIds: (session.methodUsageIds || [])
        .map(usageId => methodUsageToMethodMap.get(usageId))
        .filter((sid): sid is string => !!sid)
    }))

    const totalSessions = schedule.length
    const completedSessions = schedule.filter(s => {
      const methodCount = s.methodIds?.length || 0
      const completedCount = s.completedMethodIds?.length || 0
      return methodCount > 0 && completedCount >= methodCount
    }).length

    const totalMethods = schedule.reduce((sum, s) => sum + (s.methodIds?.length || 0), 0)
    const sessionCompletedMethods = schedule.reduce((sum, s) => sum + (s.completedMethodIds?.length || 0), 0)
    const completedMethods = sessionCompletedMethods + preservedCompletionMethodIds.length

    return sendSuccess(res, {
      ...program,
      ...details,
      schedule,
      totalSessions,
      completedSessions,
      totalMethods,
      completedMethods,
      preservedCompletions: preservedCompletionMethodIds.length
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

async function handlePatchAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    if (!isValidRecordId(id)) {
      return sendError(res, "Invalid program ID format", 400)
    }

    const existingRecords = await base(tables.programs)
      .select({
        filterByFormula: `RECORD_ID() = "${id}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (existingRecords.length === 0) {
      return sendError(res, "Program not found", 404)
    }

    const programUserId = (existingRecords[0].fields[PROGRAM_FIELDS.user] as string[])?.[0]
    if (programUserId !== auth.userId) {
      return sendError(res, "Forbidden: You don't own this program", 403)
    }

    const body = parseBody(req)
    const fields: Record<string, unknown> = {}

    if (body.goals !== undefined) fields[PROGRAM_FIELDS.goals] = body.goals
    if (body.daysOfWeek !== undefined) fields[PROGRAM_FIELDS.daysOfWeek] = body.daysOfWeek
    if (body.methods !== undefined) fields[PROGRAM_FIELDS.methods] = body.methods
    if (body.notes !== undefined) fields[PROGRAM_FIELDS.notes] = body.notes
    if (body.overtuigingen !== undefined) fields[PROGRAM_FIELDS.overtuigingen] = body.overtuigingen

    if (Object.keys(fields).length === 0) {
      return sendError(res, "No valid fields to update", 400)
    }

    const record = await base(tables.programs).update(id, fields, { typecast: true })
    const program = transformProgram(record as AirtableRecord)

    return sendSuccess(res, program)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
