import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { verifyToken } from "../_lib/jwt.js"
import { transformUser } from "../_lib/field-mappings.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

    const user = transformUser(records[0] as any)

    return sendSuccess(res, user)
  } catch (error) {
    return handleApiError(res, error)
  }
}
