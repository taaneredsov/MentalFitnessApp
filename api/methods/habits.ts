import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { METHOD_FIELDS } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getGoalByName, getMethodsByGoalId } from "../_lib/repos/reference-repo.js"

const METHODS_BACKEND_ENV = "DATA_BACKEND_METHODS"

async function handleGetPostgres(_req: Request, res: Response) {
  const goal = await getGoalByName("Goede gewoontes")
  if (!goal) {
    return sendSuccess(res, [])
  }

  const habits = await getMethodsByGoalId(goal.id)
  return sendSuccess(res, habits)
}

async function handleGetAirtable(_req: Request, res: Response) {
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
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const mode = getDataBackendMode(METHODS_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[methods/habits] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    return handleApiError(res, error)
  }
}
