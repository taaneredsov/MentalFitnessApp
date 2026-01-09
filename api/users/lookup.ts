import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { transformUser, AIRTABLE_FIELDS, type AirtableUser } from "../../src/types/user"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  const { email } = req.query

  if (!email || typeof email !== "string") {
    return sendError(res, "Email is required", 400)
  }

  try {
    const records = await base(tables.users)
      .select({
        filterByFormula: `{${AIRTABLE_FIELDS.email}} = "${email}"`,
        maxRecords: 1
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    const user = transformUser(records[0] as unknown as AirtableUser)
    return sendSuccess(res, user)
  } catch (error) {
    return handleApiError(res, error)
  }
}
