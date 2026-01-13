import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformProgram, PROGRAM_FIELDS } from "../_lib/field-mappings.js"

/**
 * GET /api/programs?userId=recXXX
 * Returns all programs for a user
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const userId = req.query.userId
    if (!userId || typeof userId !== "string") {
      return sendError(res, "userId is required", 400)
    }

    // Fetch all programs and filter by user ID
    // (Airtable linked field filtering by record ID requires client-side filtering)
    const records = await base(tables.programs)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    // Filter programs where the user is linked
    const userPrograms = records.filter(record => {
      const userIds = record.fields[PROGRAM_FIELDS.user] as string[] | undefined
      return userIds?.includes(userId)
    })

    const programs = userPrograms.map(record => transformProgram(record as any))

    return sendSuccess(res, programs)
  } catch (error) {
    return handleApiError(res, error)
  }
}
