import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { transformProgram, transformProgrammaplanning, PROGRAM_FIELDS, PROGRAMMAPLANNING_FIELDS, METHOD_USAGE_FIELDS } from "../_lib/field-mappings.js"

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

    // If no programs, return early
    if (programs.length === 0) {
      return sendSuccess(res, programs)
    }

    // Fetch all programmaplanning records to calculate accurate progress
    const allScheduleRecords = await base(tables.programmaplanning)
      .select({
        returnFieldsByFieldId: true
      })
      .all()

    const allSchedule = allScheduleRecords.map(r => transformProgrammaplanning(r as any))

    // Collect all methodUsageIds to fetch completed method mappings
    const allMethodUsageIds = allSchedule.flatMap(s => s.methodUsageIds || [])

    // Fetch Method Usage records to map usage -> method
    let methodUsageToMethodMap = new Map<string, string>()
    if (allMethodUsageIds.length > 0) {
      // Batch into chunks of 100 to avoid formula length limits
      const chunks = []
      for (let i = 0; i < allMethodUsageIds.length; i += 100) {
        chunks.push(allMethodUsageIds.slice(i, i + 100))
      }

      for (const chunk of chunks) {
        const usageFormula = `OR(${chunk.map(uid => `RECORD_ID() = "${uid}"`).join(",")})`
        const usageRecords = await base(tables.methodUsage)
          .select({
            filterByFormula: usageFormula,
            returnFieldsByFieldId: true
          })
          .all()

        for (const record of usageRecords) {
          const methodIds = record.fields[METHOD_USAGE_FIELDS.method] as string[] | undefined
          if (methodIds?.[0]) {
            methodUsageToMethodMap.set(record.id, methodIds[0])
          }
        }
      }
    }

    // Calculate progress for each program
    const programsWithProgress = programs.map(program => {
      // Filter schedule for this program
      const programSchedule = allSchedule.filter(s => s.programId === program.id)

      // Calculate totalMethods and completedMethods
      const totalMethods = programSchedule.reduce((sum, s) => sum + (s.methodIds?.length || 0), 0)
      const completedMethods = programSchedule.reduce((sum, s) => {
        const completedCount = (s.methodUsageIds || [])
          .filter(usageId => methodUsageToMethodMap.has(usageId))
          .length
        return sum + completedCount
      }, 0)

      return {
        ...program,
        totalMethods,
        completedMethods
      }
    })

    return sendSuccess(res, programsWithProgress)
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
