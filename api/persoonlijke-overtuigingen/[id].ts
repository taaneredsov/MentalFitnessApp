import type { VercelRequest, VercelResponse } from "@vercel/node"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { PERSOONLIJKE_OVERTUIGING_FIELDS, transformPersoonlijkeOvertuiging, isValidRecordId } from "../_lib/field-mappings.js"

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long").optional(),
  status: z.enum(["Actief", "Afgerond"]).optional()
})

/**
 * Fetch a persoonlijke overtuiging and verify ownership
 */
async function fetchAndVerifyOwnership(recordId: string, tokenUserId: string): Promise<{ error?: string; status?: number; record?: any }> {
  if (!isValidRecordId(recordId)) {
    return { error: "Invalid ID format", status: 400 }
  }

  try {
    const record = await base(tables.persoonlijkeOvertuigingen).find(recordId)
    const fields = record.fields as Record<string, unknown>
    const userIds = fields[PERSOONLIJKE_OVERTUIGING_FIELDS.user] as string[] | undefined

    if (!userIds?.includes(tokenUserId)) {
      return { error: "Cannot access another user's persoonlijke overtuiging", status: 403 }
    }

    return { record }
  } catch (error) {
    const err = error as { statusCode?: number }
    if (err.statusCode === 404) {
      return { error: "Persoonlijke overtuiging not found", status: 404 }
    }
    throw error
  }
}

/**
 * PATCH /api/persoonlijke-overtuigingen/[id]
 * Updates a persoonlijke overtuiging
 */
async function handlePatch(req: VercelRequest, res: VercelResponse, recordId: string, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = updateSchema.parse(rawBody)

  const { error, status } = await fetchAndVerifyOwnership(recordId, tokenUserId)
  if (error) {
    return sendError(res, error, status!)
  }

  const updateFields: Record<string, unknown> = {}
  if (body.name !== undefined) {
    updateFields[PERSOONLIJKE_OVERTUIGING_FIELDS.name] = body.name
  }
  if (body.status !== undefined) {
    updateFields[PERSOONLIJKE_OVERTUIGING_FIELDS.status] = body.status
    if (body.status === "Afgerond") {
      updateFields[PERSOONLIJKE_OVERTUIGING_FIELDS.completedDate] = new Date().toISOString().split("T")[0]
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return sendError(res, "No fields to update", 400)
  }

  const updatedRecord = await base(tables.persoonlijkeOvertuigingen).update(recordId, updateFields, {
    typecast: true
  })

  console.log("[persoonlijke-overtuigingen] Updated:", recordId, "fields:", Object.keys(updateFields))

  const result = transformPersoonlijkeOvertuiging(updatedRecord as { id: string; fields: Record<string, unknown> })
  return sendSuccess(res, result)
}

/**
 * DELETE /api/persoonlijke-overtuigingen/[id]
 * Deletes a persoonlijke overtuiging
 */
async function handleDelete(req: VercelRequest, res: VercelResponse, recordId: string, tokenUserId: string) {
  const { error, status } = await fetchAndVerifyOwnership(recordId, tokenUserId)
  if (error) {
    return sendError(res, error, status!)
  }

  await base(tables.persoonlijkeOvertuigingen).destroy(recordId)

  console.log("[persoonlijke-overtuigingen] Deleted:", recordId)

  return sendSuccess(res, null)
}

/**
 * /api/persoonlijke-overtuigingen/[id]
 * PATCH: Update a persoonlijke overtuiging
 * DELETE: Delete a persoonlijke overtuiging
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const auth = await requireAuth(req)

    const { id } = req.query
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
