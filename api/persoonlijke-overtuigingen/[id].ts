import type { Request, Response } from "express"
import { z } from "zod"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { update as updatePO, deleteById as deletePO } from "../_lib/repos/persoonlijke-overtuigingen-repo.js"

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long").optional(),
  status: z.enum(["Actief", "Afgerond"]).optional()
})

async function handlePatch(req: Request, res: Response, id: string, userId: string) {
  const rawBody = parseBody(req)
  const body = updateSchema.parse(rawBody)

  const updates: { name?: string; status?: string; completedDate?: string | null } = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.status !== undefined) {
    updates.status = body.status
    if (body.status === "Afgerond") {
      updates.completedDate = new Date().toISOString().split("T")[0]
    }
  }

  if (Object.keys(updates).length === 0) {
    return sendError(res, "No fields to update", 400)
  }

  const result = await updatePO(id, userId, updates)
  if (!result) {
    return sendError(res, "Persoonlijke overtuiging not found", 404)
  }

  console.log("[persoonlijke-overtuigingen] Updated (postgres):", id, "fields:", Object.keys(updates))
  return sendSuccess(res, result)
}

async function handleDelete(_req: Request, res: Response, id: string, userId: string) {
  const deleted = await deletePO(id, userId)
  if (!deleted) {
    return sendError(res, "Persoonlijke overtuiging not found", 404)
  }

  console.log("[persoonlijke-overtuigingen] Deleted (postgres):", id)
  return sendSuccess(res, null)
}

/**
 * /api/persoonlijke-overtuigingen/[id]
 * PATCH: Update a persoonlijke overtuiging
 * DELETE: Delete a persoonlijke overtuiging
 */
export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    const { id } = req.params
    if (!id || typeof id !== "string") {
      return sendError(res, "ID is required", 400)
    }

    switch (req.method) {
      case "PATCH":
        return handlePatch(req, res, id, auth.userId)
      case "DELETE":
        return handleDelete(req, res, id, auth.userId)
      default:
        return sendError(res, "Method not allowed", 405)
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return sendError(res, error.message, error.status)
    }
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}
