import type { Request, Response } from "express"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError } from "../_lib/api-utils.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser, USER_FIELDS, FIELD_NAMES } from "../_lib/field-mappings.js"
import { findMagicLinkByToken, markMagicLinkUsed } from "../_lib/repos/magic-link-repo.js"
import { hashToken, constantTimeCompare, randomDelay } from "../_lib/security.js"
import { getUserByIdWithReadThrough, toApiUserPayload } from "../_lib/sync/user-readthrough.js"
import { updateUserLastLogin } from "../_lib/repos/user-repo.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"

/**
 * GET /api/auth/verify?token=xxx
 * Verify a magic link token and create a session
 */
export default async function handler(req: Request, res: Response) {
  if (req.method !== "GET") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { token } = req.query

    if (!token || typeof token !== "string") {
      return sendError(res, "Token is required", 400)
    }

    // Validate token format (should be 64 hex chars for 32 bytes)
    if (!/^[a-f0-9]{64}$/i.test(token)) {
      console.log("[verify] Invalid token format")
      await randomDelay(100, 300)
      return sendError(res, "Ongeldige of verlopen link", 401)
    }

    // Hash the token to compare with stored hash
    const hashedToken = hashToken(token)

    // Postgres-primary path
    if (isPostgresConfigured()) {
      const magicLink = await findMagicLinkByToken(hashedToken)

      if (!magicLink) {
        console.log("[verify] Invalid token - not found in Postgres")
        await randomDelay(100, 300)
        return sendError(res, "Ongeldige of verlopen link", 401)
      }

      // Check expiry
      if (new Date(magicLink.expiresAt) < new Date()) {
        console.log("[verify] Token expired")
        await markMagicLinkUsed(magicLink.id)
        await randomDelay(100, 300)
        return sendError(res, "Link is verlopen. Vraag een nieuwe aan.", 401)
      }

      // Constant-time compare (already matched at DB level, but verify for safety)
      const tokenMatches = magicLink.hashedToken
        ? constantTimeCompare(hashedToken, magicLink.hashedToken)
        : false

      if (!tokenMatches) {
        console.log("[verify] Token mismatch after DB lookup")
        await randomDelay(100, 300)
        return sendError(res, "Ongeldige of verlopen link", 401)
      }

      // Success
      await markMagicLinkUsed(magicLink.id)

      const user = await getUserByIdWithReadThrough(magicLink.userId)
      if (!user) {
        return sendError(res, "User not found", 404)
      }

      const lastLogin = new Date().toISOString().split("T")[0]
      await updateUserLastLogin(user.id, lastLogin)
      await enqueueSyncEvent({
        eventType: "upsert",
        entityType: "user",
        entityId: user.id,
        payload: {
          userId: user.id,
          lastLogin
        },
        priority: 10
      })

      const accessToken = await signAccessToken({
        userId: user.id,
        email: user.email
      })
      const refreshToken = await signRefreshToken({
        userId: user.id,
        email: user.email
      })

      res.setHeader("Set-Cookie", [
        `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
      ])

      console.log(`[verify] User logged in via magic link: ${user.email}`)
      return sendSuccess(res, {
        user: toApiUserPayload(user),
        accessToken
      })
    }

    // Airtable fallback path
    // Find users with active magic link tokens
    // We fetch by token hash match, then verify with constant-time comparison
    // This prevents database-level timing attacks
    const records = await base(tables.users)
      .select({
        filterByFormula: `AND({${FIELD_NAMES.user.magicLinkToken}} != "", {${FIELD_NAMES.user.magicLinkExpiry}} != "")`,
        maxRecords: 100, // Limit to prevent DoS
        returnFieldsByFieldId: true
      })
      .firstPage()

    // Find matching user with constant-time comparison
    let matchedUser: (typeof records)[0] | null = null
    for (const record of records) {
      const storedToken = record.fields[USER_FIELDS.magicLinkToken] as string
      if (storedToken && constantTimeCompare(hashedToken, storedToken)) {
        matchedUser = record
        break
      }
    }

    if (!matchedUser) {
      console.log("[verify] Invalid token - not found")
      await randomDelay(100, 300)
      return sendError(res, "Ongeldige of verlopen link", 401)
    }

    // Use type assertion for cleaner code
    const user = matchedUser as Record<string, unknown> & { id: string; fields: Record<string, unknown> }

    const expiry = user.fields[USER_FIELDS.magicLinkExpiry] as string | undefined

    // Check expiry
    if (!expiry || new Date(expiry) < new Date()) {
      console.log("[verify] Token expired")
      // Clear expired token
      await base(tables.users).update(user.id, {
        [USER_FIELDS.magicLinkToken]: null,
        [USER_FIELDS.magicLinkCode]: null,
        [USER_FIELDS.magicLinkExpiry]: null
      })
      return sendError(res, "Link is verlopen. Vraag een nieuwe aan.", 401)
    }

    // Clear magic link fields (one-time use) and update last login
    await base(tables.users).update(user.id, {
      [USER_FIELDS.magicLinkToken]: null,
      [USER_FIELDS.magicLinkCode]: null,
      [USER_FIELDS.magicLinkExpiry]: null,
      [USER_FIELDS.lastLogin]: new Date().toISOString().split("T")[0]
    })

    // Generate session tokens
    const accessToken = await signAccessToken({
      userId: user.id,
      email: user.fields[USER_FIELDS.email] as string
    })

    const refreshToken = await signRefreshToken({
      userId: user.id,
      email: user.fields[USER_FIELDS.email] as string
    })

    // Set refresh token cookie
    res.setHeader("Set-Cookie", [
      `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
    ])

    console.log(`[verify] User logged in via magic link: ${user.fields[USER_FIELDS.email]}`)

    return sendSuccess(res, {
      user: transformUser(user),
      accessToken
    })
  } catch (error) {
    return handleApiError(res, error)
  }
}
