import type { VercelRequest, VercelResponse } from "@vercel/node"
import { parse } from "cookie"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { verifyToken, signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser } from "../_lib/field-mappings.js"

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
    const records = await base(tables.users)
      .select({
        filterByFormula: `RECORD_ID() = "${payload.userId}"`,
        maxRecords: 1,
        returnFieldsByFieldId: true
      })
      .firstPage()

    if (records.length === 0) {
      return sendError(res, "User not found", 404)
    }

    const user = transformUser(records[0] as any)

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
