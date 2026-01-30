import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../../../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../../../_lib/api-utils.js"
import { verifyToken } from "../../../_lib/jwt.js"
import {
  transformProgrammaplanning,
  transformMethod,
  PROGRAM_FIELDS,
  PROGRAMMAPLANNING_FIELDS,
  isValidRecordId
} from "../../../_lib/field-mappings.js"

/**
 * PATCH /api/programs/[id]/schedule/[planningId]
 * Update a session's methods, goals, and notes
 *
 * Body: { methods: string[], goals?: string[], notes?: string }
 * Returns: Updated Programmaplanning object
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "PATCH") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
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

    // Extract and validate path parameters
    const { id: programId, planningId } = req.query

    if (!programId || typeof programId !== "string") {
      return sendError(res, "Program ID is required", 400)
    }
    if (!planningId || typeof planningId !== "string") {
      return sendError(res, "Planning ID is required", 400)
    }

    // Validate record ID formats to prevent injection
    if (!isValidRecordId(programId)) {
      return sendError(res, "Invalid program ID format", 400)
    }
    if (!isValidRecordId(planningId)) {
      return sendError(res, "Invalid planning ID format", 400)
    }

    // Parse and validate request body
    const body = parseBody(req)
    const { methods, goals, notes } = body

    // Validate methods array is present and has at least 1 item
    if (!methods || !Array.isArray(methods)) {
      return sendError(res, "methods array is required", 400)
    }
    if (methods.length === 0) {
      return sendError(res, "methods array must have at least 1 item", 400)
    }

    // Validate all method IDs are valid record IDs
    for (const methodId of methods) {
      if (!isValidRecordId(methodId)) {
        return sendError(res, `Invalid method ID format: ${methodId}`, 400)
      }
    }

    // Validate goal IDs if provided
    if (goals !== undefined) {
      if (!Array.isArray(goals)) {
        return sendError(res, "goals must be an array", 400)
      }
      for (const goalId of goals) {
        if (!isValidRecordId(goalId)) {
          return sendError(res, `Invalid goal ID format: ${goalId}`, 400)
        }
      }
    }

    // Validate notes if provided
    if (notes !== undefined && typeof notes !== "string") {
      return sendError(res, "notes must be a string", 400)
    }

    // Fetch the program to verify ownership
    const programRecords = await base(tables.programs)
      .select({
        filterByFormula: `RECORD_ID() = "${programId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (programRecords.length === 0) {
      return sendError(res, "Program not found", 404)
    }

    // Verify the authenticated user owns this program
    const programUserId = (programRecords[0].fields[PROGRAM_FIELDS.user] as string[])?.[0]
    if (programUserId !== payload.userId) {
      return sendError(res, "Forbidden: You don't own this program", 403)
    }

    // Fetch the planning record
    const planningRecords = await base(tables.programmaplanning)
      .select({
        filterByFormula: `RECORD_ID() = "${planningId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (planningRecords.length === 0) {
      return sendError(res, "Planning record not found", 404)
    }

    const planningRecord = planningRecords[0]

    // Verify the planning record belongs to this program
    const planningProgramId = (planningRecord.fields[PROGRAMMAPLANNING_FIELDS.program] as string[])?.[0]
    if (planningProgramId !== programId) {
      return sendError(res, "Planning record does not belong to this program", 403)
    }

    // Check that the session date is in the future (cannot edit past sessions)
    const sessionDate = planningRecord.fields[PROGRAMMAPLANNING_FIELDS.date] as string
    if (!sessionDate) {
      return sendError(res, "Session has no date set", 400)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sessionDateObj = new Date(sessionDate)
    sessionDateObj.setHours(0, 0, 0, 0)

    if (sessionDateObj <= today) {
      return sendError(res, "Cannot edit past or current day sessions", 400)
    }

    // Fetch method details to generate session description
    const methodFormula = `OR(${methods.map(mid => `RECORD_ID() = "${mid}"`).join(",")})`
    const methodRecords = await base(tables.methods)
      .select({
        filterByFormula: methodFormula,
        returnFieldsByFieldId: true
      })
      .all()

    if (methodRecords.length !== methods.length) {
      return sendError(res, "One or more method IDs are invalid", 400)
    }

    // Transform method records and preserve order from input
    const methodDetailsMap = new Map<string, ReturnType<typeof transformMethod>>()
    for (const record of methodRecords) {
      methodDetailsMap.set(record.id, transformMethod(record as any))
    }

    // Generate session description in the order methods were provided
    const sessionDescription = methods
      .map(mid => {
        const method = methodDetailsMap.get(mid)
        return method ? `${method.name} (${method.duration} min)` : null
      })
      .filter(Boolean)
      .join("\n")

    // Build the update fields
    const updateFields: Record<string, unknown> = {
      [PROGRAMMAPLANNING_FIELDS.methods]: methods,
      [PROGRAMMAPLANNING_FIELDS.sessionDescription]: sessionDescription
    }

    // Add optional fields if provided
    if (goals !== undefined) {
      updateFields[PROGRAMMAPLANNING_FIELDS.goals] = goals
    }
    if (notes !== undefined) {
      updateFields[PROGRAMMAPLANNING_FIELDS.notes] = notes
    }

    // Update the Airtable record
    const updatedRecord = await base(tables.programmaplanning).update(
      planningId,
      updateFields,
      { typecast: true }
    )

    // Transform and return the updated planning record
    const updatedPlanning = transformProgrammaplanning(updatedRecord as any)

    return sendSuccess(res, updatedPlanning)
  } catch (error) {
    return handleApiError(res, error)
  }
}
