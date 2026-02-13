import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { transformUser } from "../_lib/field-mappings.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getUserByIdWithReadThrough, toApiUserPayload } from "../_lib/sync/user-readthrough.js"
import type { AirtableRecord } from "../_lib/types.js"

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "No token provided", 401)
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)

    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    if (isPostgresConfigured()) {
      const user = await getUserByIdWithReadThrough(String(payload.userId))
      if (user) {
        return sendSuccess(res, toApiUserPayload(user))
      }
    }

    const records = await base(tables.users)
      .select({
        filterByFormula: `RECORD_ID() = "${payload.userId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    return sendSuccess(res, transformUser(records[0] as AirtableRecord))
  } catch (error) {
    return handleApiError(res, error)
  }
}

