import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { transformProgram, PROGRAM_FIELDS } from "../_lib/field-mappings.js"

/**
 * GET /api/programs?userId=recXXX - Returns all programs for a user
 * POST /api/programs - Creates a new program
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "POST") {
    return handlePost(req, res)
  }

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

/**
 * POST /api/programs - Create a new program
 * Body: { userId, startDate, duration, goals?, daysOfWeek, methods?, notes? }
 */
async function handlePost(req: VercelRequest, res: VercelResponse) {
  try {
    const body = parseBody(req)

    // Validate required fields
    if (!body?.userId) {
      return sendError(res, "userId is required", 400)
    }
    if (!body.startDate) {
      return sendError(res, "startDate is required", 400)
    }
    if (!body.duration) {
      return sendError(res, "duration is required", 400)
    }

    // Build fields object for Airtable
    const fields: Record<string, unknown> = {
      [PROGRAM_FIELDS.user]: [body.userId],
      [PROGRAM_FIELDS.startDate]: body.startDate,
      [PROGRAM_FIELDS.duration]: body.duration
    }

    // Optional fields
    if (body.daysOfWeek && Array.isArray(body.daysOfWeek) && body.daysOfWeek.length > 0) {
      fields[PROGRAM_FIELDS.daysOfWeek] = body.daysOfWeek
    }
    if (body.goals && Array.isArray(body.goals) && body.goals.length > 0) {
      fields[PROGRAM_FIELDS.goals] = body.goals
    }
    if (body.methods && Array.isArray(body.methods) && body.methods.length > 0) {
      fields[PROGRAM_FIELDS.methods] = body.methods
    }
    if (body.notes) {
      fields[PROGRAM_FIELDS.notes] = body.notes
    }

    // Create the program in Airtable
    const record = await base(tables.programs).create(fields, { typecast: true })

    // Fetch the created record with all computed fields
    const createdRecord = await base(tables.programs).find(record.id)

    const program = transformProgram(createdRecord as any)

    return sendSuccess(res, program, 201)
  } catch (error) {
    return handleApiError(res, error)
  }
}
