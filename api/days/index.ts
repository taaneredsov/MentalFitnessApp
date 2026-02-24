import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformDay } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { listAllDays } from "../_lib/repos/reference-repo.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import type { AirtableRecord } from "../_lib/types.js"

const DAYS_BACKEND_ENV = "DATA_BACKEND_DAYS"

async function handleGetPostgres(_req: Request, res: Response) {
  const days = await listAllDays()
  return sendSuccess(res, days)
}

async function handleGetAirtable(_req: Request, res: Response) {
  const days = await cachedSelect(
    "daysOfWeek",
    {},
    (records) => records.map(r => transformDay(r as AirtableRecord))
  )
  return sendSuccess(res, days)
}

/**
 * GET /api/days
 * Returns all days of the week from Dagen van de week table (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const mode = getDataBackendMode(DAYS_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[days] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    return handleApiError(res, error)
  }
}
