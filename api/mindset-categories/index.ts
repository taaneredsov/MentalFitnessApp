import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformMindsetCategory } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { listAllMindsetCategories } from "../_lib/repos/reference-repo.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import type { AirtableRecord } from "../_lib/types.js"

const MINDSET_CATEGORIES_BACKEND_ENV = "DATA_BACKEND_MINDSET_CATEGORIES"

async function handleGetPostgres(_req: Request, res: Response) {
  const categories = await listAllMindsetCategories()
  return sendSuccess(res, categories)
}

async function handleGetAirtable(_req: Request, res: Response) {
  const categories = await cachedSelect(
    "mindsetCategories",
    {},
    (records) => records.map(r => transformMindsetCategory(r as AirtableRecord))
  )
  return sendSuccess(res, categories)
}

/**
 * GET /api/mindset-categories
 * Returns all mindset categories (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const mode = getDataBackendMode(MINDSET_CATEGORIES_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[mindset-categories] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    return handleApiError(res, error)
  }
}
