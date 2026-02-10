import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import {
  transformProgram,
  transformProgrammaplanning,
  parseEuropeanDate,
  PROGRAM_FIELDS,
  METHOD_USAGE_FIELDS
} from "../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import {
  computeProgramProgress,
  createProgram,
  listProgramsByUser,
  toApiProgram
} from "../_lib/repos/program-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { getUserByIdWithReadThrough } from "../_lib/sync/user-readthrough.js"

const PROGRAMS_BACKEND_ENV = "DATA_BACKEND_PROGRAMS"

/**
 * GET /api/programs - Returns all programs for the authenticated user
 * POST /api/programs - Creates a new program
 */
export default async function handler(req: Request, res: Response) {
  const mode = getDataBackendMode(PROGRAMS_BACKEND_ENV)

  if (req.method === "POST") {
    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handlePostPostgres(req, res)
    }
    return handlePostAirtable(req, res)
  }

  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  if (mode === "postgres_primary" && isPostgresConfigured()) {
    return handleGetPostgres(req, res)
  }

  if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
    void (async () => {
      try {
        const auth = await requireAuth(req)
        const programs = await listProgramsByUser(auth.userId)
        await computeProgramProgress(programs)
        console.log("[programs] shadow read OK: %d programs", programs.length)
      } catch (error) {
        console.warn("[programs] shadow read failed:", error instanceof Error ? error.message : error)
      }
    })()
  }

  return handleGetAirtable(req, res)
}

async function handleGetPostgres(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const programs = await listProgramsByUser(auth.userId)
    const progressByProgram = await computeProgramProgress(programs)

    const data = programs.map((program) => {
      const baseData = toApiProgram(program)
      const progress = progressByProgram.get(program.id)
      return {
        ...baseData,
        totalMethods: progress?.totalMethods || 0,
        completedMethods: progress?.completedMethods || 0,
        methodUsageCount: progress?.completedMethods || 0,
        frequency: Array.isArray(baseData.daysOfWeek) ? (baseData.daysOfWeek as string[]).length : 0
      }
    })

    return sendSuccess(res, data)
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
    const body = parseBody(req)

    body.userId = auth.userId
    if (!body.startDate) {
      return sendError(res, "startDate is required", 400)
    }
    if (!body.duration) {
      return sendError(res, "duration is required", 400)
    }

    const user = await getUserByIdWithReadThrough(auth.userId)
    if (!user) {
      return sendError(res, "User not found", 404)
    }

    let program
    try {
      program = await createProgram({
        userId: auth.userId,
        startDate: body.startDate,
        duration: body.duration,
        goals: Array.isArray(body.goals) ? body.goals : [],
        methods: Array.isArray(body.methods) ? body.methods : [],
        daysOfWeek: Array.isArray(body.daysOfWeek) ? body.daysOfWeek : [],
        notes: body.notes,
        overtuigingen: Array.isArray(body.overtuigingen) ? body.overtuigingen : [],
        creationType: "Manueel"
      })
    } catch (error) {
      if (error instanceof Error && error.message === "PROGRAM_OVERLAP") {
        return sendError(res, "Dit programma overlapt met een bestaand programma. Kies andere datums.", 409)
      }
      throw error
    }

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program",
      entityId: program.id,
      payload: {
        userId: program.userId,
        startDate: program.startDate,
        duration: program.duration,
        status: program.status,
        creationType: program.creationType || "Manueel",
        notes: program.notes,
        goals: program.goals,
        methods: program.methods,
        daysOfWeek: program.daysOfWeek,
        overtuigingen: program.overtuigingen
      },
      priority: 30
    })

    return sendSuccess(res, toApiProgram(program), 201)
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
    const userId = auth.userId

    const records = await base(tables.programs)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const userPrograms = records.filter(record => {
      const userIds = record.fields[PROGRAM_FIELDS.user] as string[] | undefined
      return userIds?.includes(userId)
    })

    const programs = userPrograms.map(record => transformProgram(record as any))

    if (programs.length === 0) {
      return sendSuccess(res, programs)
    }

    const allScheduleRecords = await base(tables.programmaplanning)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const allSchedule = allScheduleRecords.map(r => transformProgrammaplanning(r as any))
    const allMethodUsageIds = allSchedule.flatMap(s => s.methodUsageIds || [])

    const allMethodUsageRecords = await base(tables.methodUsage)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const programPreservedUsageIds = new Map<string, string[]>()
    for (const record of allMethodUsageRecords) {
      const programIds = record.fields[METHOD_USAGE_FIELDS.program] as string[] | undefined
      if (programIds?.[0] && !allMethodUsageIds.includes(record.id)) {
        const existing = programPreservedUsageIds.get(programIds[0]) || []
        existing.push(record.id)
        programPreservedUsageIds.set(programIds[0], existing)
      }
    }

    const methodUsageToMethodMap = new Map<string, string>()
    for (const record of allMethodUsageRecords) {
      const methodIds = record.fields[METHOD_USAGE_FIELDS.method] as string[] | undefined
      if (methodIds?.[0]) {
        methodUsageToMethodMap.set(record.id, methodIds[0])
      }
    }

    const programsWithProgress = programs.map(program => {
      const programSchedule = allSchedule.filter(s => s.programId === program.id)
      const totalMethods = programSchedule.reduce((sum, s) => sum + (s.methodIds?.length || 0), 0)
      const sessionCompletedMethods = programSchedule.reduce((sum, s) => {
        const completedCount = (s.methodUsageIds || [])
          .filter(usageId => methodUsageToMethodMap.has(usageId))
          .length
        return sum + completedCount
      }, 0)
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

function calculateEndDate(startDate: string, duration: string): string {
  const weeks = parseInt(duration.match(/(\d+)/)?.[1] || "4", 10)
  const start = new Date(startDate)
  const end = new Date(start)
  end.setDate(end.getDate() + (weeks * 7) - 1)
  return end.toISOString().split("T")[0]
}

function dateRangesOverlap(start1: string, end1: string, start2: string, end2: string): boolean {
  return start1 <= end2 && end1 >= start2
}

function getInitialProgramStatus(startDate: string): "Actief" | "Gepland" {
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  return startDate <= todayStr ? "Actief" : "Gepland"
}

async function handlePostAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const body = parseBody(req)

    body.userId = auth.userId
    if (!body.startDate) {
      return sendError(res, "startDate is required", 400)
    }
    if (!body.duration) {
      return sendError(res, "duration is required", 400)
    }

    const newEndDate = calculateEndDate(body.startDate, body.duration)
    const existingRecords = await base(tables.programs)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

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
        return sendError(res, `Dit programma overlapt met een bestaand programma (${program.name || "Naamloos"}). Kies andere datums.`, 409)
      }
    }

    const fields: Record<string, unknown> = {
      [PROGRAM_FIELDS.user]: [body.userId],
      [PROGRAM_FIELDS.startDate]: body.startDate,
      [PROGRAM_FIELDS.duration]: body.duration,
      [PROGRAM_FIELDS.status]: getInitialProgramStatus(body.startDate),
      [PROGRAM_FIELDS.creationType]: "Manueel"
    }

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

    const record = await base(tables.programs).create(fields, { typecast: true })
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

