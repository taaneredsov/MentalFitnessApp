import type { VercelRequest, VercelResponse } from "@vercel/node"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { verifyToken } from "../../src/lib/jwt"
import { transformUser, type AirtableUser } from "../../src/types/user"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith("Bearer ")) {
      return sendError(res, "No token provided", 401)
    }

    const token = authHeader.substring(7)
    const payload = await verifyToken(token)

    if (!payload) {
      return sendError(res, "Invalid token", 401)
    }

    const record = await base(tables.users).find(payload.userId)
    const user = transformUser(record as unknown as AirtableUser)

    return sendSuccess(res, user)
  } catch (error) {
    return handleApiError(res, error)
  }
}
