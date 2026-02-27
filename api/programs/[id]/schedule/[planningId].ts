import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../../_lib/api-utils.js"
import { requireAuth, AuthError } from "../../../_lib/auth.js"
import { isEntityId } from "../../../_lib/db/id-utils.js"
import {
  getProgramByAnyId,
  getProgramSessionByAnyId,
  updateProgramSessionById
} from "../../../_lib/repos/program-repo.js"
import { lookupMethodsByIds } from "../../../_lib/repos/reference-repo.js"
import { enqueueSyncEvent } from "../../../_lib/sync/outbox.js"
import { syncNotificationJobsForUser } from "../../../_lib/notifications/planner.js"

function validatePayload(body: Record<string, unknown>) {
  const methods = body.methods
  const goals = body.goals
  const notes = body.notes

  if (!methods || !Array.isArray(methods)) {
    return { error: "methods array is required" }
  }
  if (methods.length === 0) {
    return { error: "methods array must have at least 1 item" }
  }
  for (const methodId of methods) {
    if (typeof methodId !== "string" || !isEntityId(methodId)) {
      return { error: `Invalid method ID format: ${String(methodId)}` }
    }
  }
  if (goals !== undefined) {
    if (!Array.isArray(goals)) {
      return { error: "goals must be an array" }
    }
    for (const goalId of goals) {
      if (typeof goalId !== "string" || !isEntityId(goalId)) {
        return { error: `Invalid goal ID format: ${String(goalId)}` }
      }
    }
  }
  if (notes !== undefined && typeof notes !== "string") {
    return { error: "notes must be a string" }
  }

  return {
    methods: methods as string[],
    goals: goals as string[] | undefined,
    notes: notes as string | undefined
  }
}

async function buildSessionDescription(methodIds: string[]): Promise<string> {
  const methodRecords = await lookupMethodsByIds(methodIds)
  const methodMap = new Map<string, Record<string, unknown>>()
  for (const m of methodRecords) {
    methodMap.set(m.id as string, m)
  }

  return methodIds
    .map(mid => {
      const method = methodMap.get(mid)
      return method ? `${method.name} (${method.duration} min)` : String(mid)
    })
    .join("\n")
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "PATCH") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)
    const { id: programIdRaw, planningId } = req.params

    if (!programIdRaw || typeof programIdRaw !== "string") {
      return sendError(res, "Program ID is required", 400)
    }
    if (!planningId || typeof planningId !== "string") {
      return sendError(res, "Planning ID is required", 400)
    }
    if (!isEntityId(programIdRaw)) {
      return sendError(res, "Invalid program ID format", 400)
    }
    if (!isEntityId(planningId)) {
      return sendError(res, "Invalid planning ID format", 400)
    }

    const parsed = validatePayload(parseBody(req))
    if ("error" in parsed) {
      return sendError(res, parsed.error, 400)
    }

    const program = await getProgramByAnyId(programIdRaw, auth.userId)
    if (!program) {
      return sendError(res, "Program not found", 404)
    }

    const session = await getProgramSessionByAnyId(planningId, program.id)
    if (!session) {
      return sendError(res, "Planning record not found", 404)
    }

    if (!session.date) {
      return sendError(res, "Session has no date set", 400)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sessionDate = new Date(session.date)
    sessionDate.setHours(0, 0, 0, 0)
    if (sessionDate <= today) {
      return sendError(res, "Cannot edit past or current day sessions", 400)
    }

    const sessionDescription = await buildSessionDescription(parsed.methods)

    const updated = await updateProgramSessionById({
      sessionId: session.id,
      programId: program.id,
      methods: parsed.methods,
      goals: parsed.goals,
      notes: parsed.notes,
      sessionDescription
    })

    if (!updated) {
      return sendError(res, "Planning record not found", 404)
    }

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "program_schedule",
      entityId: updated.id,
      payload: {
        programId: program.id,
        date: updated.date,
        methods: updated.methodIds,
        goals: updated.goalIds,
        notes: updated.notes,
        sessionDescription: updated.sessionDescription
      },
      priority: 35
    })

    await syncNotificationJobsForUser(auth.userId)

    return sendSuccess(res, {
      id: updated.id,
      planningId: updated.planningId || undefined,
      programId: updated.programId,
      date: updated.date,
      dayOfWeekId: updated.dayOfWeekId || undefined,
      sessionDescription: updated.sessionDescription || undefined,
      methodIds: updated.methodIds,
      goalIds: updated.goalIds,
      methodUsageIds: updated.methodUsageIds,
      completedMethodIds: [],
      isCompleted: updated.methodUsageIds.length > 0,
      notes: updated.notes || undefined
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
