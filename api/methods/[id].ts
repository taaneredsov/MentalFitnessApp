import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { transformMethod, transformMedia } from "../_lib/field-mappings.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getMethodById } from "../_lib/repos/reference-repo.js"
import type { AirtableRecord } from "../_lib/types.js"

const METHODS_BACKEND_ENV = "DATA_BACKEND_METHODS"

async function handleGetPostgres(req: Request, res: Response) {
  const id = req.params.id
  if (!id || typeof id !== "string") {
    return sendError(res, "Method ID is required", 400)
  }

  const method = await getMethodById(id)
  if (!method) {
    return sendError(res, "Method not found", 404)
  }

  return sendSuccess(res, method)
}

async function handleGetAirtable(req: Request, res: Response) {
  const id = req.params.id
  if (!id || typeof id !== "string") {
    return sendError(res, "Method ID is required", 400)
  }

  const records = await base(tables.methods)
    .select({
      filterByFormula: `RECORD_ID() = '${id}'`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (!records || records.length === 0) {
    return sendError(res, "Method not found", 404)
  }

  const record = records[0]
  const method = transformMethod({ id: record.id, fields: record.fields } as AirtableRecord)

  let mediaDetails: Record<string, unknown>[] = []
  const mediaIds = method.media
  if (mediaIds && mediaIds.length > 0) {
    const mediaRecords = await base(tables.media)
      .select({
        filterByFormula: `OR(${mediaIds.map((mid: string) => `RECORD_ID() = '${mid}'`).join(',')})`,
        returnFieldsByFieldId: true
      })
      .all()

    mediaDetails = mediaRecords.map(r => transformMedia({ id: r.id, fields: r.fields } as AirtableRecord))
  }

  return sendSuccess(res, {
    ...method,
    mediaDetails
  })
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
        .catch((error) => console.warn("[methods/id] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    return handleApiError(res, error)
  }
}
