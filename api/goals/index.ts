import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformGoal } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { listAllGoals } from "../_lib/repos/reference-repo.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import type { AirtableRecord } from "../_lib/types.js"

const GOALS_BACKEND_ENV = "DATA_BACKEND_GOALS"

async function handleGetPostgres(_req: Request, res: Response) {
  const goals = await listAllGoals()
  return sendSuccess(res, goals)
}

async function handleGetAirtable(_req: Request, res: Response) {
  const goals = await cachedSelect(
    "goals",
    {},
    (records) => records.map(r => transformGoal(r as AirtableRecord))
  )
  return sendSuccess(res, goals)
}

/**
 * GET /api/goals
 * Returns all goals from Doelstellingen table (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const mode = getDataBackendMode(GOALS_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[goals] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    return handleApiError(res, error)
  }
}
