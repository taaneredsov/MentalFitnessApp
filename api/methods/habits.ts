import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { METHOD_FIELDS, GOAL_FIELDS } from "../_lib/field-mappings.js"

/**
 * GET /api/methods/habits
 * Returns methods linked to the "Goede gewoontes" goal
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // First, find the "Goede gewoontes" goal ID
    const goalRecords = await base(tables.goals)
      .select({
        filterByFormula: `{Doelstelling Naam} = "Goede gewoontes"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (goalRecords.length === 0) {
      return sendSuccess(res, [])
    }

    const goodHabitsGoalId = goalRecords[0].id

    // Fetch all methods and filter by linked goal
    // (Airtable linked record filters are unreliable with formulas)
    const methodRecords = await base(tables.methods)
      .select({ returnFieldsByFieldId: true })
      .all()

    const habits = methodRecords
      .filter(record => {
        const linkedGoals = record.fields[METHOD_FIELDS.linkedGoals] as string[] | undefined
        return linkedGoals?.includes(goodHabitsGoalId)
      })
      .map(record => ({
        id: record.id,
        name: record.fields[METHOD_FIELDS.name] as string,
        description: record.fields[METHOD_FIELDS.description] as string | undefined
      }))

    return sendSuccess(res, habits)
  } catch (error) {
    return handleApiError(res, error)
  }
}
