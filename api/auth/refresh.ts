import type { Request, Response } from "express"
import { parse } from "cookie"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser } from "../_lib/field-mappings.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getUserByIdWithReadThrough, toApiUserPayload } from "../_lib/sync/user-readthrough.js"
import type { AirtableRecord } from "../_lib/types.js"

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const cookies = parse(req.headers.cookie || "")
    const refreshToken = cookies.refreshToken

    if (!refreshToken) {
      return sendError(res, "No refresh token", 401)
    }

    const payload = await verifyRefreshToken(refreshToken)
    if (!payload) {
      return sendError(res, "Invalid refresh token", 401)
    }

    let userPayload: Record<string, unknown> | null = null

    if (isPostgresConfigured()) {
      const pgUser = await getUserByIdWithReadThrough(String(payload.userId))
      if (pgUser) {
        userPayload = toApiUserPayload(pgUser)
      }
    }

    if (!userPayload) {
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

      userPayload = transformUser(records[0] as AirtableRecord)
    }

    const newAccessToken = await signAccessToken({
      userId: payload.userId,
      email: payload.email
    })

    const newRefreshToken = await signRefreshToken({
      userId: payload.userId,
      email: payload.email
    })

    res.setHeader("Set-Cookie", [
      `refreshToken=${newRefreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    return sendSuccess(res, {
      user: userPayload,
      accessToken: newAccessToken
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}

