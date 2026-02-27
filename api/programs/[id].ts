import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { isEntityId } from "../_lib/db/id-utils.js"
import {
  deleteProgramById,
  getMethodUsageByProgram,
  getProgramByAnyId,
  listProgramSessions,
  toApiProgram,
  updateProgramById
} from "../_lib/repos/program-repo.js"
import {
  lookupGoalsByIds,
  lookupMethodsByIds,
  lookupDayNamesByIds,
  lookupOvertuigingenByIds
} from "../_lib/repos/reference-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

/**
 * GET /api/programs/[id] - Returns a single program with expanded relations
 * PATCH /api/programs/[id] - Updates a program
 * DELETE /api/programs/[id] - Deletes a program
 */
export default async function handler(req: Request, res: Response) {
  if (req.method === "PATCH") {
    return handlePatch(req, res)
  }

  if (req.method === "DELETE") {
    return handleDelete(req, res)
  }

  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  return handleGet(req, res)
}

async function handleGet(req: Request, res: Response) {
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

    const details = {
      goalDetails: await lookupGoalsByIds((programApi.goals as string[]) || []),
      methodDetails: await lookupMethodsByIds((programApi.methods as string[]) || []),
      dayNames: await lookupDayNamesByIds((programApi.daysOfWeek as string[]) || []),
      overtuigingDetails: await lookupOvertuigingenByIds((programApi.overtuigingen as string[]) || [])
    }

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

async function handlePatch(req: Request, res: Response) {
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

async function handleDelete(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }
    if (!isEntityId(id)) {
      return sendError(res, "Invalid program ID format", 400)
    }

    const result = await deleteProgramById(id, auth.userId)
    if (!result) {
      return sendError(res, "Program not found", 404)
    }

    // Enqueue Airtable delete events for method usages
    for (const muId of result.methodUsageIds) {
      await enqueueSyncEvent({
        eventType: "delete",
        entityType: "method_usage",
        entityId: muId,
        payload: {},
        priority: 20
      })
    }

    // Enqueue Airtable delete events for schedules
    for (const schedId of result.scheduleIds) {
      await enqueueSyncEvent({
        eventType: "delete",
        entityType: "program_schedule",
        entityId: schedId,
        payload: {},
        priority: 20
      })
    }

    // Enqueue Airtable delete event for the program itself
    await enqueueSyncEvent({
      eventType: "delete",
      entityType: "program",
      entityId: id,
      payload: {},
      priority: 20
    })

    return sendSuccess(res, null)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
