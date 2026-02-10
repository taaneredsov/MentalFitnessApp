import type { Request } from "express"
import { verifyAccessToken } from "./jwt.js"

export class AuthError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "AuthError"
    this.status = status
  }
}

interface AuthPayload {
  userId: string
  email: string
}

/**
 * Extract and verify Bearer token from request.
 * Returns { userId, email } or throws AuthError.
 */
export async function requireAuth(req: Request): Promise<AuthPayload> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Unauthorized", 401)
  }

  const token = authHeader.slice(7)
  const payload = await verifyAccessToken(token)

  if (!payload || !payload.userId) {
    throw new AuthError("Invalid token", 401)
  }

  return {
    userId: payload.userId as string,
    email: payload.email as string
  }
}
