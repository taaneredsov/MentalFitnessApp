import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { METHOD_USAGE_FIELDS, transformMethodUsage, isValidRecordId } from "../_lib/field-mappings.js"

const updateRemarkSchema = z.object({
  remark: z.string().min(1, "Remark is required")
})

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  methodId: z.string().min(1, "Method ID is required"),
  programId: z.string().optional(),  // Used when method is practiced outside a scheduled session
  programmaplanningId: z.string().optional(),  // Link to specific scheduled session
  remark: z.string().optional()
})

/**
 * POST /api/method-usage - Creates a new method usage record
 * PATCH /api/method-usage/:id - Updates the remark on an existing record
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "PATCH") {
    return handlePatch(req, res)
  }

  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const auth = await requireAuth(req)

    const rawBody = parseBody(req)
    const body = createUsageSchema.parse(rawBody)

    // Verify the user is creating a record for themselves
    if (body.userId !== auth.userId) {
      return sendError(res, "Cannot create method usage for another user", 403)
    }

    // Build fields object using field IDs
    const fields: Record<string, unknown> = {
      [METHOD_USAGE_FIELDS.user]: [body.userId],
      [METHOD_USAGE_FIELDS.method]: [body.methodId],
      [METHOD_USAGE_FIELDS.usedAt]: new Date().toISOString().split("T")[0]
    }

    // Prefer programmaplanningId over programId
    // programId is used for unscheduled practice (no session context)
    if (body.programmaplanningId) {
      fields[METHOD_USAGE_FIELDS.programmaplanning] = [body.programmaplanningId]
    } else if (body.programId) {
      fields[METHOD_USAGE_FIELDS.program] = [body.programId]
    }

    if (body.remark) {
      fields[METHOD_USAGE_FIELDS.remark] = body.remark
    }

    const record = await base(tables.methodUsage).create(fields, {
      typecast: true
    })

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

/**
 * PATCH /api/method-usage/:id
 * Updates the remark on an existing method usage record
 */
async function handlePatch(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await requireAuth(req)

    const { id } = req.query
    if (!id || typeof id !== "string") {
      return sendError(res, "Method usage ID is required", 400)
    }

    if (!isValidRecordId(id)) {
      return sendError(res, "Invalid method usage ID format", 400)
    }

    const rawBody = parseBody(req)
    const body = updateRemarkSchema.parse(rawBody)

    // Fetch the record to verify ownership
    const record = await base(tables.methodUsage).find(id)
    const userId = (record.fields[METHOD_USAGE_FIELDS.user] as string[])?.[0]

    if (userId !== auth.userId) {
      return sendError(res, "Cannot update another user's method usage", 403)
    }

    // Update the remark
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
