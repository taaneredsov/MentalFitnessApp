import type { VercelRequest, VercelResponse } from "@vercel/node"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { transformMindsetCategory, transformOvertuiging, isValidRecordId } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import { base, tables } from "../_lib/airtable.js"

/**
 * GET /api/overtuigingen/by-goals?goalIds=id1,id2
 * Returns overtuigingen filtered by goal IDs via mindset categories
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    await requireAuth(req)

    const { goalIds } = req.query
    if (!goalIds || typeof goalIds !== "string") {
      return sendError(res, "goalIds query parameter is required", 400)
    }

    const goalIdList = goalIds.split(",").filter(id => id.trim())
    if (goalIdList.length === 0) {
      return sendSuccess(res, [])
    }

    // Validate all goal IDs
    for (const id of goalIdList) {
      if (!isValidRecordId(id.trim())) {
        return sendError(res, "Invalid goal ID format", 400)
      }
    }

    // Fetch all mindset categories (cached)
    const categories = await cachedSelect(
      "mindsetCategories",
      {},
      (records) => records.map(r => transformMindsetCategory(r as any))
    )

    // Filter categories whose goalIds intersect with the query goalIds
    const matchingCategories = categories.filter(cat =>
      cat.goalIds.some((gid: string) => goalIdList.includes(gid))
    )

    // Collect all overtuiging IDs from matching categories
    const overtuigingIds = [...new Set(
      matchingCategories.flatMap(cat => cat.overtuigingIds as string[])
    )]

    if (overtuigingIds.length === 0) {
      return sendSuccess(res, [])
    }

    // Validate overtuiging IDs
    const validIds = overtuigingIds.filter(id => isValidRecordId(id))
    if (validIds.length === 0) {
      return sendSuccess(res, [])
    }

    // Fetch the overtuigingen by IDs
    const formula = `OR(${validIds.map(id => `RECORD_ID() = "${id}"`).join(",")})`
    const records = await base(tables.overtuigingen)
      .select({
        filterByFormula: formula,
        returnFieldsByFieldId: true
      })
      .all()

    const overtuigingen = records
      .map(r => transformOvertuiging(r as any))
      .filter(o => o.levels.includes("Niveau 1"))
      .sort((a, b) => (a.order || 0) - (b.order || 0))

    return sendSuccess(res, overtuigingen)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
