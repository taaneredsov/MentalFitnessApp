import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { isValidRecordId } from "../_lib/field-mappings.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { lookupCompanyNames } from "../_lib/repos/reference-repo.js"

/**
 * GET /api/companies/lookup?ids=rec123,rec456
 * Returns a map of company IDs to names
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    await requireAuth(req)

    const idsParam = req.query.ids
    if (!idsParam || typeof idsParam !== "string") {
      return sendError(res, "Missing ids parameter", 400)
    }

    const ids = idsParam.split(",").filter(Boolean)
    if (ids.length === 0) {
      return sendSuccess(res, {})
    }

    const validIds = ids.filter(id => isValidRecordId(id))
    if (validIds.length === 0) {
      return sendSuccess(res, {})
    }

    const companyMap = await lookupCompanyNames(validIds)
    return sendSuccess(res, companyMap)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
