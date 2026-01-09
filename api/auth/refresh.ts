import type { VercelRequest, VercelResponse } from "@vercel/node"
import { parse } from "cookie"
import { base, tables } from "../../src/lib/airtable"
import { sendSuccess, sendError, handleApiError } from "../../src/lib/api-utils"
import { verifyToken, signAccessToken, signRefreshToken } from "../../src/lib/jwt"
import { transformUser, type AirtableUser } from "../../src/types/user"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const cookies = parse(req.headers.cookie || "")
    const refreshToken = cookies.refreshToken

    if (!refreshToken) {
      return sendError(res, "No refresh token", 401)
    }

    const payload = await verifyToken(refreshToken)
    if (!payload) {
      return sendError(res, "Invalid refresh token", 401)
    }

    // Get fresh user data
    const record = await base(tables.users).find(payload.userId)
    const user = transformUser(record as unknown as AirtableUser)

    // Generate new tokens
    const newAccessToken = await signAccessToken({
      userId: payload.userId,
      email: payload.email
    })

    const newRefreshToken = await signRefreshToken({
      userId: payload.userId,
      email: payload.email
    })

    // Set new refresh token
    res.setHeader("Set-Cookie", [
      `refreshToken=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    return sendSuccess(res, {
      user,
      accessToken: newAccessToken
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}
