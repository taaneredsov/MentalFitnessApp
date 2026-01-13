import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import {
  transformProgram,
  transformGoal,
  transformMethod,
  transformDay,
  PROGRAM_FIELDS,
  GOAL_FIELDS,
  METHOD_FIELDS,
  DAY_FIELDS
} from "../_lib/field-mappings.js"

/**
 * GET /api/programs/[id] - Returns a single program with expanded relations
 * PATCH /api/programs/[id] - Updates a program
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "PATCH") {
    return handlePatch(req, res)
  }

  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { id } = req.query
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    // Fetch the program
    const records = await base(tables.programs)
      .select({
        filterByFormula: `RECORD_ID() = "${id}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "Program not found", 404)
    }

    const program = transformProgram(records[0] as any)

    // Fetch related goals
    let goalDetails: any[] = []
    if (program.goals.length > 0) {
      const goalFormula = `OR(${program.goals.map(gid => `RECORD_ID() = "${gid}"`).join(",")})`
      const goalRecords = await base(tables.goals)
        .select({
          filterByFormula: goalFormula,
          returnFieldsByFieldId: true
        })
        .all()
      goalDetails = goalRecords.map(r => transformGoal(r as any))
    }

    // Fetch related methods
    let methodDetails: any[] = []
    if (program.methods.length > 0) {
      const methodFormula = `OR(${program.methods.map(mid => `RECORD_ID() = "${mid}"`).join(",")})`
      const methodRecords = await base(tables.methods)
        .select({
          filterByFormula: methodFormula,
          returnFieldsByFieldId: true
        })
        .all()
      methodDetails = methodRecords.map(r => transformMethod(r as any))
    }

    // Fetch related days of week
    let dayNames: string[] = []
    if (program.daysOfWeek.length > 0) {
      const dayFormula = `OR(${program.daysOfWeek.map(did => `RECORD_ID() = "${did}"`).join(",")})`
      const dayRecords = await base(tables.daysOfWeek)
        .select({
          filterByFormula: dayFormula,
          returnFieldsByFieldId: true
        })
        .all()
      dayNames = dayRecords.map(r => transformDay(r as any).name)
    }

    return sendSuccess(res, {
      ...program,
      goalDetails,
      methodDetails,
      dayNames
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}

/**
 * PATCH /api/programs/[id] - Update a program
 * Body: { methods?, notes? }
 */
async function handlePatch(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query
    if (!id || typeof id !== "string") {
      return sendError(res, "Program ID is required", 400)
    }

    const body = parseBody(req)
    const fields: Record<string, unknown> = {}

    // Allow updating goals, daysOfWeek, methods, and notes
    if (body.goals !== undefined) {
      fields[PROGRAM_FIELDS.goals] = body.goals
    }
    if (body.daysOfWeek !== undefined) {
      fields[PROGRAM_FIELDS.daysOfWeek] = body.daysOfWeek
    }
    if (body.methods !== undefined) {
      fields[PROGRAM_FIELDS.methods] = body.methods
    }
    if (body.notes !== undefined) {
      fields[PROGRAM_FIELDS.notes] = body.notes
    }

    if (Object.keys(fields).length === 0) {
      return sendError(res, "No valid fields to update", 400)
    }

    // Update the program
    const record = await base(tables.programs).update(id, fields, { typecast: true })

    const program = transformProgram(record as any)

    return sendSuccess(res, program)
  } catch (error) {
    return handleApiError(res, error)
  }
}
