import type { Request, Response } from "express"
import { parse } from "cookie"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { verifyRefreshToken, signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser, escapeFormulaValue, USER_FIELDS } from "../_lib/field-mappings.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getUserByIdWithReadThrough, getUserByEmailWithReadThrough, toApiUserPayload } from "../_lib/sync/user-readthrough.js"
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

    // Try by ID first, then fall back to email (handles re-created Airtable users)
    if (isPostgresConfigured()) {
      const pgUser = await getUserByIdWithReadThrough(String(payload.userId))
        ?? await getUserByEmailWithReadThrough(String(payload.email))
      if (pgUser) {
        userPayload = toApiUserPayload(pgUser)
      }
    }

    if (!userPayload) {
      let records = await base(tables.users)
        .select({
          filterByFormula: `RECORD_ID() = "${payload.userId}"`,
          maxRecords: 1,
          returnFieldsByFieldId: true
        })
        .firstPage()

      // If record ID no longer exists, try by email (user was re-created in Airtable)
      if (records.length === 0 && payload.email) {
        records = await base(tables.users)
          .select({
            filterByFormula: `{${USER_FIELDS.email}} = "${escapeFormulaValue(String(payload.email))}"`,
            maxRecords: 1,
            returnFieldsByFieldId: true
          })
          .firstPage()
      }

      if (records.length === 0) {
        return sendError(res, "User not found", 404)
      }

      userPayload = transformUser(records[0] as AirtableRecord)
    }

    // Use the current user ID from the database/Airtable lookup, not the stale JWT payload.
    // This handles cases where a user was deleted and re-created in Airtable with a new record ID.
    const currentUserId = (userPayload as Record<string, unknown>).id as string
    const currentEmail = (userPayload as Record<string, unknown>).email as string

    const newAccessToken = await signAccessToken({
      userId: currentUserId,
      email: currentEmail
    })

    const newRefreshToken = await signRefreshToken({
      userId: currentUserId,
      email: currentEmail
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

