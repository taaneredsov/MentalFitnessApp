import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { METHOD_USAGE_FIELDS, transformMethodUsage, isValidRecordId } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { isEntityId } from "../_lib/db/id-utils.js"
import {
  createMethodUsage,
  getMethodUsageByAnyId,
  toApiMethodUsage,
  updateMethodUsageRemark
} from "../_lib/repos/method-usage-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { getProgramByAnyId, getProgramSessionByAnyId } from "../_lib/repos/program-repo.js"
import { syncNotificationJobsForUser } from "../_lib/notifications/planner.js"

const METHOD_USAGE_BACKEND_ENV = "DATA_BACKEND_METHOD_USAGE"

const updateRemarkSchema = z.object({
  remark: z.string().min(1, "Remark is required")
})

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  methodId: z.string().min(1, "Method ID is required"),
  programId: z.string().optional(),
  programmaplanningId: z.string().optional(),
  remark: z.string().optional()
})

/**
 * POST /api/method-usage - Creates a new method usage record
 * PATCH /api/method-usage/:id - Updates the remark on an existing record
 */
export default async function handler(req: Request, res: Response) {
  if (req.method === "PATCH") {
    if (getDataBackendMode(METHOD_USAGE_BACKEND_ENV) === "postgres_primary" && isPostgresConfigured()) {
      return handlePatchPostgres(req, res)
    }
    return handlePatchAirtable(req, res)
  }

  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  if (getDataBackendMode(METHOD_USAGE_BACKEND_ENV) === "postgres_primary" && isPostgresConfigured()) {
    return handlePostPostgres(req, res)
  }

  return handlePostAirtable(req, res)
}

async function handlePostPostgres(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const body = createUsageSchema.parse(parseBody(req))

    if (body.userId !== auth.userId) {
      return sendError(res, "Cannot create method usage for another user", 403)
    }

    if (body.programId && !isEntityId(body.programId)) {
      return sendError(res, "Invalid program ID format", 400)
    }
    if (body.programmaplanningId && !isEntityId(body.programmaplanningId)) {
      return sendError(res, "Invalid program schedule ID format", 400)
    }

    let resolvedProgramId: string | undefined
    let resolvedScheduleId: string | undefined

    if (body.programId) {
      const program = await getProgramByAnyId(body.programId, auth.userId)
      if (!program) {
        return sendError(res, "Program not found", 404)
      }
      resolvedProgramId = program.id
    }

    if (body.programmaplanningId) {
      const session = await getProgramSessionByAnyId(body.programmaplanningId, resolvedProgramId)
      if (!session) {
        return sendError(res, "Program session not found", 404)
      }
      resolvedScheduleId = session.id
      resolvedProgramId = session.programId
    }

    const usage = await createMethodUsage({
      userId: body.userId,
      methodId: body.methodId,
      programId: resolvedProgramId,
      programScheduleId: resolvedScheduleId,
      remark: body.remark
    })

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "method_usage",
      entityId: usage.id,
      payload: {
        userId: usage.userId,
        methodId: usage.methodId,
        programId: usage.programId,
        programScheduleId: usage.programScheduleId,
        remark: usage.remark,
        usedAt: usage.usedAt
      },
      priority: 40
    })

    await syncNotificationJobsForUser(auth.userId)

    return sendSuccess(res, toApiMethodUsage(usage), 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}

async function handlePatchPostgres(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Method usage ID is required", 400)
    }
    if (!isEntityId(id)) {
      return sendError(res, "Invalid method usage ID format", 400)
    }

    const body = updateRemarkSchema.parse(parseBody(req))
    const existing = await getMethodUsageByAnyId(id)
    if (!existing) {
      return sendError(res, "Method usage not found", 404)
    }
    if (existing.userId !== auth.userId) {
      return sendError(res, "Cannot update another user's method usage", 403)
    }

    const updated = await updateMethodUsageRemark(id, body.remark)
    if (!updated) {
      return sendError(res, "Method usage not found", 404)
    }

    await enqueueSyncEvent({
      eventType: "upsert",
      entityType: "method_usage",
      entityId: updated.id,
      payload: {
        userId: updated.userId,
        methodId: updated.methodId,
        programId: updated.programId,
        programScheduleId: updated.programScheduleId,
        remark: updated.remark,
        usedAt: updated.usedAt
      },
      priority: 40
    })

    await syncNotificationJobsForUser(auth.userId)

    return sendSuccess(res, toApiMethodUsage(updated))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}

async function handlePostAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)
    const rawBody = parseBody(req)
    const body = createUsageSchema.parse(rawBody)

    if (body.userId !== auth.userId) {
      return sendError(res, "Cannot create method usage for another user", 403)
    }

    const fields: Record<string, unknown> = {
      [METHOD_USAGE_FIELDS.user]: [body.userId],
      [METHOD_USAGE_FIELDS.method]: [body.methodId],
      [METHOD_USAGE_FIELDS.usedAt]: new Date().toISOString().split("T")[0]
    }

    if (body.programmaplanningId) {
      fields[METHOD_USAGE_FIELDS.programmaplanning] = [body.programmaplanningId]
    } else if (body.programId) {
      fields[METHOD_USAGE_FIELDS.program] = [body.programId]
    }

    if (body.remark) {
      fields[METHOD_USAGE_FIELDS.remark] = body.remark
    }

    const record = await base(tables.methodUsage).create(fields, { typecast: true })
    const usage = transformMethodUsage(record as any)
    return sendSuccess(res, usage, 201)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}

async function handlePatchAirtable(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "Method usage ID is required", 400)
    }

    if (!isValidRecordId(id)) {
      return sendError(res, "Invalid method usage ID format", 400)
    }

    const body = updateRemarkSchema.parse(parseBody(req))

    const record = await base(tables.methodUsage).find(id)
    const userId = (record.fields[METHOD_USAGE_FIELDS.user] as string[])?.[0]

    if (userId !== auth.userId) {
      return sendError(res, "Cannot update another user's method usage", 403)
    }

    const updated = await base(tables.methodUsage).update(id, {
      [METHOD_USAGE_FIELDS.remark]: body.remark
    })

    const usage = transformMethodUsage(updated as any)
    return sendSuccess(res, usage)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
