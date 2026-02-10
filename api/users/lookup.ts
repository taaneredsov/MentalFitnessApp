import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformUser, FIELD_NAMES, escapeFormulaValue } from "../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getUserByEmailWithReadThrough, toApiUserPayload } from "../_lib/sync/user-readthrough.js"

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    await requireAuth(req)

    const { email } = req.query

    if (!email || typeof email !== "string") {
      return sendError(res, "Email is required", 400)
    }

    if (isPostgresConfigured()) {
      const user = await getUserByEmailWithReadThrough(email)
      if (user) {
        return sendSuccess(res, toApiUserPayload(user))
      }
    }

    const records = await base(tables.users)
      .select({
        filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(email)}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    return sendSuccess(res, transformUser(records[0] as any))
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}

