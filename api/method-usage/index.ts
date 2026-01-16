import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { METHOD_USAGE_FIELDS, transformMethodUsage } from "../_lib/field-mappings.js"

const createUsageSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  methodId: z.string().min(1, "Method ID is required"),
  programId: z.string().optional(),  // DEPRECATED - use programmaplanningId
  programmaplanningId: z.string().optional(),  // Link to specific scheduled session
  remark: z.string().optional()
})

/**
 * POST /api/method-usage
 * Creates a new method usage record
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

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

  try {
    const rawBody = parseBody(req)
    const body = createUsageSchema.parse(rawBody)

    // Build fields object using field IDs
    const fields: Record<string, unknown> = {
      [METHOD_USAGE_FIELDS.user]: [body.userId],
      [METHOD_USAGE_FIELDS.method]: [body.methodId],
      [METHOD_USAGE_FIELDS.usedAt]: new Date().toISOString().split("T")[0]
    }

    // Prefer programmaplanningId over programId (programId is deprecated)
    if (body.programmaplanningId) {
      fields[METHOD_USAGE_FIELDS.programmaplanning] = [body.programmaplanningId]
    } else if (body.programId) {
      // Fallback to program link for backward compatibility
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
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
