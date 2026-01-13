import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { COMPANY_FIELDS } from "../_lib/field-mappings.js"

/**
 * GET /api/companies/lookup?ids=rec123,rec456
 * Returns a map of company IDs to names
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const idsParam = req.query.ids
    if (!idsParam || typeof idsParam !== "string") {
      return sendError(res, "Missing ids parameter", 400)
    }

    const ids = idsParam.split(",").filter(Boolean)
    if (ids.length === 0) {
      return sendSuccess(res, {})
    }

    // Fetch companies by record IDs
    const companyMap: Record<string, string> = {}

    // Airtable's find() only works one at a time, so we use a formula to get multiple
    const formula = `OR(${ids.map(id => `RECORD_ID() = "${id}"`).join(",")})`

    const records = await base(tables.companies)
      .select({
        filterByFormula: formula,
        fields: [COMPANY_FIELDS.name],
        returnFieldsByFieldId: true
      })
      .all()

    for (const record of records) {
      const name = record.fields[COMPANY_FIELDS.name]
      if (name) {
        companyMap[record.id] = name as string
      }
    }

    return sendSuccess(res, companyMap)
  } catch (error) {
    return handleApiError(res, error)
  }
}
