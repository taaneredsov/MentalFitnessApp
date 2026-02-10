import type { Request, Response } from "express"
import { base, tables } from "../../../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../../_lib/api-utils.js"
import { requireAuth, AuthError } from "../../../_lib/auth.js"
import { getDataBackendMode } from "../../../_lib/data-backend.js"
import { isPostgresConfigured } from "../../../_lib/db/client.js"
import { isEntityId, isAirtableRecordId } from "../../../_lib/db/id-utils.js"
import {
  transformProgrammaplanning,
  transformMethod,
  PROGRAM_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  isValidRecordId
} from "../../../_lib/field-mappings.js"
import {
  getProgramByAnyId,
  getProgramSessionByAnyId,
  updateProgramSessionById
} from "../../../_lib/repos/program-repo.js"
import { enqueueSyncEvent } from "../../../_lib/sync/outbox.js"
import { syncNotificationJobsForUser } from "../../../_lib/notifications/planner.js"

const PROGRAMS_BACKEND_ENV = "DATA_BACKEND_PROGRAMS"

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
  const airtableMethodIds = methodIds.filter(isAirtableRecordId)
  if (airtableMethodIds.length !== methodIds.length) {
    return methodIds.join("\n")
  }

  const methodFormula = `OR(${methodIds.map(mid => `RECORD_ID() = "${mid}"`).join(",")})`
  const methodRecords = await base(tables.methods)
    .select({
      filterByFormula: methodFormula,
      returnFieldsByFieldId: true
    })
    .all()

  const methodDetailsMap = new Map<string, ReturnType<typeof transformMethod>>()
  for (const record of methodRecords) {
    methodDetailsMap.set(record.id, transformMethod(record as any))
  }

  return methodIds
    .map(mid => {
      const method = methodDetailsMap.get(mid)
      return method ? `${method.name} (${method.duration} min)` : String(mid)
    })
    .join("\n")
}

async function handlePatchPostgres(req: Request, res: Response) {
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

async function handlePatchAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const { id: programId, planningId } = req.params

    if (!programId || typeof programId !== "string") {
      return sendError(res, "Program ID is required", 400)
    }
    if (!planningId || typeof planningId !== "string") {
      return sendError(res, "Planning ID is required", 400)
    }
    if (!isValidRecordId(programId)) {
      return sendError(res, "Invalid program ID format", 400)
    }
    if (!isValidRecordId(planningId)) {
      return sendError(res, "Invalid planning ID format", 400)
    }

    const parsed = validatePayload(parseBody(req))
    if ("error" in parsed) {
      return sendError(res, parsed.error, 400)
    }

    const programRecords = await base(tables.programs)
      .select({
        filterByFormula: `RECORD_ID() = "${programId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (programRecords.length === 0) {
      return sendError(res, "Program not found", 404)
    }

    const programUserId = (programRecords[0].fields[PROGRAM_FIELDS.user] as string[])?.[0]
    if (programUserId !== auth.userId) {
      return sendError(res, "Forbidden: You don't own this program", 403)
    }

    const planningRecords = await base(tables.programmaplanning)
      .select({
        filterByFormula: `RECORD_ID() = "${planningId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (planningRecords.length === 0) {
      return sendError(res, "Planning record not found", 404)
    }

    const planningRecord = planningRecords[0]
    const planningProgramId = (planningRecord.fields[PROGRAMMAPLANNING_FIELDS.program] as string[])?.[0]
    if (planningProgramId !== programId) {
      return sendError(res, "Planning record does not belong to this program", 403)
    }

    const sessionDate = planningRecord.fields[PROGRAMMAPLANNING_FIELDS.date] as string
    if (!sessionDate) {
      return sendError(res, "Session has no date set", 400)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sessionDateObj = new Date(sessionDate)
    sessionDateObj.setHours(0, 0, 0, 0)
    if (sessionDateObj <= today) {
      return sendError(res, "Cannot edit past or current day sessions", 400)
    }

    const sessionDescription = await buildSessionDescription(parsed.methods)

    const updateFields: Record<string, unknown> = {
      [PROGRAMMAPLANNING_FIELDS.methods]: parsed.methods,
      [PROGRAMMAPLANNING_FIELDS.sessionDescription]: sessionDescription
    }

    if (parsed.goals !== undefined) {
      updateFields[PROGRAMMAPLANNING_FIELDS.goals] = parsed.goals
    }
    if (parsed.notes !== undefined) {
      updateFields[PROGRAMMAPLANNING_FIELDS.notes] = parsed.notes
    }

    const updatedRecord = await base(tables.programmaplanning).update(
      planningId,
      updateFields,
      { typecast: true }
    )

    const updatedPlanning = transformProgrammaplanning(updatedRecord as any)
    return sendSuccess(res, updatedPlanning)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "PATCH") {
    return sendError(res, "Method not allowed", 405)
  }

  const mode = getDataBackendMode(PROGRAMS_BACKEND_ENV)
  if (mode === "postgres_primary" && isPostgresConfigured()) {
    return handlePatchPostgres(req, res)
  }

  return handlePatchAirtable(req, res)
}
