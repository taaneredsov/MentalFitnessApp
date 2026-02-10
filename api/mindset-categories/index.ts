import type { Request, Response } from "express"
import { sendSuccess, handleApiError } from "../_lib/api-utils.js"
import { transformMindsetCategory } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"

/**
 * GET /api/mindset-categories
 * Returns all mindset categories (cached for 30 minutes)
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    const categories = await cachedSelect(
      "mindsetCategories",
      {},
      (records) => records.map(r => transformMindsetCategory(r as any))
    )

    return sendSuccess(res, categories)
  } catch (error) {
    return handleApiError(res, error)
  }
}
