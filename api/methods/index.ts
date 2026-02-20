import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformMethod } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { listAllMethods } from "../_lib/repos/reference-repo.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import type { AirtableRecord } from "../_lib/types.js"

const METHODS_BACKEND_ENV = "DATA_BACKEND_METHODS"

async function handleGetPostgres(_req: Request, res: Response) {
  const methods = await listAllMethods()
  return sendSuccess(res, methods)
}

async function handleGetAirtable(_req: Request, res: Response) {
  const methods = await cachedSelect(
    "methods",
    {},
    (records) => records.map(r => transformMethod(r as AirtableRecord))
  )
  return sendSuccess(res, methods)
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const mode = getDataBackendMode(METHODS_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[methods] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    return handleApiError(res, error)
  }
}
