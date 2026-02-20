import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformOvertuiging } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { listAllOvertuigingen } from "../_lib/repos/reference-repo.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import type { AirtableRecord } from "../_lib/types.js"

const OVERTUIGINGEN_BACKEND_ENV = "DATA_BACKEND_OVERTUIGINGEN"

async function handleGetPostgres(_req: Request, res: Response) {
  const overtuigingen = await listAllOvertuigingen()
  return sendSuccess(res, overtuigingen)
}

async function handleGetAirtable(_req: Request, res: Response) {
  const overtuigingen = await cachedSelect(
    "overtuigingen",
    {},
    (records) => records.map(r => transformOvertuiging(r as AirtableRecord))
  )
  return sendSuccess(res, overtuigingen)
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const mode = getDataBackendMode(OVERTUIGINGEN_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[overtuigingen] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    return handleApiError(res, error)
  }
}
