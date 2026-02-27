import type { Request, Response } from "express"
import { z } from "zod"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { requireAuth, AuthError } from "../_lib/auth.js"
import { listByUser, create as createPO } from "../_lib/repos/persoonlijke-overtuigingen-repo.js"

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name too long"),
  programId: z.string().optional()
})

async function handleGet(_req: Request, res: Response, tokenUserId: string) {
  const records = await listByUser(tokenUserId)
  return sendSuccess(res, records)
}

async function handlePost(req: Request, res: Response, tokenUserId: string) {
  const rawBody = parseBody(req)
  const body = createSchema.parse(rawBody)

  const record = await createPO({
    userId: tokenUserId,
    name: body.name,
    programId: body.programId
  })

  console.log("[persoonlijke-overtuigingen] Created (postgres):", record.id, "for user:", tokenUserId, "name:", body.name)
  return sendSuccess(res, record, 201)
}

/**
 * /api/persoonlijke-overtuigingen
 * GET: Returns all active persoonlijke overtuigingen for the user
 * POST: Creates a new persoonlijke overtuiging
 */
export default async function handler(req: Request, res: Response) {
  try {
    const auth = await requireAuth(req)

    switch (req.method) {
      case "GET":
        return handleGet(req, res, auth.userId)
      case "POST":
        return handlePost(req, res, auth.userId)
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
