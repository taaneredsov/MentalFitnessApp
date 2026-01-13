import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
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
 * GET /api/programs/[id]
 * Returns a single program with expanded relations (goals, methods, days)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
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
