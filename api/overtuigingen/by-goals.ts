import type { Request, Response } from "express"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { transformMindsetCategory, transformOvertuiging, isValidRecordId } from "../_lib/field-mappings.js"
import { cachedSelect } from "../_lib/cached-airtable.js"
import { getDataBackendMode } from "../_lib/data-backend.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getOvertuigingenByGoalIds } from "../_lib/repos/reference-repo.js"

const OVERTUIGINGEN_BACKEND_ENV = "DATA_BACKEND_OVERTUIGINGEN"

async function handleGetPostgres(req: Request, res: Response) {
  const { goalIds } = req.query
  if (!goalIds || typeof goalIds !== "string") {
    return sendError(res, "goalIds query parameter is required", 400)
  }

  const goalIdList = goalIds.split(",").filter(id => id.trim())
  if (goalIdList.length === 0) {
    return sendSuccess(res, [])
  }

  const overtuigingen = await getOvertuigingenByGoalIds(goalIdList)
  return sendSuccess(res, overtuigingen)
}

async function handleGetAirtable(req: Request, res: Response) {
  const { goalIds } = req.query
  if (!goalIds || typeof goalIds !== "string") {
    return sendError(res, "goalIds query parameter is required", 400)
  }

  const goalIdList = goalIds.split(",").filter(id => id.trim())
  if (goalIdList.length === 0) {
    return sendSuccess(res, [])
  }

  for (const id of goalIdList) {
    if (!isValidRecordId(id.trim())) {
      return sendError(res, "Invalid goal ID format", 400)
    }
  }

  const [categories, allOvertuigingen] = await Promise.all([
    cachedSelect(
      "mindsetCategories",
      {},
      (records) => records.map(r => transformMindsetCategory(r as any))
    ),
    cachedSelect(
      "overtuigingen",
      {},
      (records) => records.map(r => transformOvertuiging(r as any))
    )
  ])

  const matchingCategoryIds = new Set(
    categories
      .filter(cat => cat.goalIds.some((gid: string) => goalIdList.includes(gid)))
      .map(cat => cat.id)
  )

  const overtuigingen = allOvertuigingen
    .filter(o => {
      const directGoalIds = Array.isArray(o.goalIds) ? o.goalIds : []
      const categoryIds = Array.isArray(o.categoryIds) ? o.categoryIds : []
      const matchesDirectGoal = directGoalIds.some((gid: string) => goalIdList.includes(gid))
      const matchesCategoryGoal = categoryIds.some((cid: string) => matchingCategoryIds.has(cid))
      return matchesDirectGoal || matchesCategoryGoal
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0))

  return sendSuccess(res, overtuigingen)
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, error: "Method not allowed" })
  }

  try {
    await requireAuth(req)

    const mode = getDataBackendMode(OVERTUIGINGEN_BACKEND_ENV)

    if (mode === "postgres_primary" && isPostgresConfigured()) {
      return handleGetPostgres(req, res)
    }

    if (mode === "postgres_shadow_read" && isPostgresConfigured()) {
      void handleGetPostgres(req, res)
        .then(() => undefined)
        .catch((error) => console.warn("[overtuigingen/by-goals] shadow read failed:", error))
    }

    return handleGetAirtable(req, res)
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    return handleApiError(res, error)
  }
}
