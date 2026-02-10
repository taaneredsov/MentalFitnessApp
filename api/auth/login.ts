import type { Request, Response } from "express"
import { z } from "zod"
import { base, tables } from "../_lib/airtable.js"
import { sendSuccess, sendError, handleApiError, parseBody } from "../_lib/api-utils.js"
import { verifyPassword } from "../_lib/password.js"
import { signAccessToken, signRefreshToken } from "../_lib/jwt.js"
import { transformUser, USER_FIELDS, FIELD_NAMES, escapeFormulaValue } from "../_lib/field-mappings.js"
import { isRateLimited, recordFailedAttempt, clearRateLimit, generateSecureCode, hashCode } from "../_lib/security.js"
import { sendVerificationCodeEmail } from "../_lib/email.js"
import { isPostgresConfigured } from "../_lib/db/client.js"
import { getUserByEmailWithReadThrough, toApiUserPayload } from "../_lib/sync/user-readthrough.js"
import { enqueueSyncEvent } from "../_lib/sync/outbox.js"
import { updateUserLastLogin } from "../_lib/repos/user-repo.js"
import { isAirtableRecordId } from "../_lib/db/id-utils.js"

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).optional()
})

async function sendSetupCodeToAirtableUser(userId: string, email: string): Promise<void> {
  const code = generateSecureCode()
  const hashedCode = hashCode(code)
  const expiry = new Date(Date.now() + 15 * 60 * 1000).toISOString()

  await base(tables.users).update(userId, {
    [USER_FIELDS.magicLinkCode]: hashedCode,
    [USER_FIELDS.magicLinkExpiry]: expiry
  })

  await sendVerificationCodeEmail(email, code)
}

async function loginViaPostgres(req: Request, res: Response, email: string, password?: string) {
  const user = await getUserByEmailWithReadThrough(email)
  if (!user) {
    return sendError(res, "Invalid email or password", 401)
  }

  if (!user.passwordHash) {
    if (!isAirtableRecordId(user.id)) {
      return sendError(res, "Password setup requires Airtable-managed users", 400)
    }

    await sendSetupCodeToAirtableUser(user.id, user.email)
    return sendSuccess(res, {
      needsPasswordSetup: true,
      email: user.email
    })
  }

  if (!password) {
    return sendError(res, "Password is required", 400)
  }

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) {
    recordFailedAttempt(email)
    return sendError(res, "Invalid email or password", 401)
  }

  clearRateLimit(email)

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

  return sendSuccess(res, {
    user: toApiUserPayload(user),
    accessToken
  })
}

async function loginViaAirtable(req: Request, res: Response, email: string, password?: string) {
  const records = await base(tables.users)
    .select({
      filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(email)}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (records.length === 0) {
    return sendError(res, "Invalid email or password", 401)
  }

  const record = records[0] as any
  const passwordHash = record.fields[USER_FIELDS.passwordHash]

  if (!passwordHash) {
    await sendSetupCodeToAirtableUser(record.id, record.fields[USER_FIELDS.email] as string)
    return sendSuccess(res, {
      needsPasswordSetup: true,
      email: record.fields[USER_FIELDS.email]
    })
  }

  if (!password) {
    return sendError(res, "Password is required", 400)
  }

  const isValid = await verifyPassword(password, passwordHash)
  if (!isValid) {
    recordFailedAttempt(email)
    return sendError(res, "Invalid email or password", 401)
  }

  clearRateLimit(email)

  await base(tables.users).update(record.id, {
    [USER_FIELDS.lastLogin]: new Date().toISOString().split("T")[0]
  })

  const accessToken = await signAccessToken({
    userId: record.id,
    email: record.fields[USER_FIELDS.email]
  })

  const refreshToken = await signRefreshToken({
    userId: record.id,
    email: record.fields[USER_FIELDS.email]
  })

  res.setHeader("Set-Cookie", [
    `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${7 * 24 * 60 * 60}`
  ])

  const user = transformUser(record)
  return sendSuccess(res, { user, accessToken })
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return sendError(res, "Method not allowed", 405)
  }

  try {
    const { email, password } = loginSchema.parse(parseBody(req))

    const rateCheck = isRateLimited(email)
    if (rateCheck.isLimited) {
      return sendError(res, "Te veel pogingen. Probeer het later opnieuw.", 429)
    }

    if (isPostgresConfigured()) {
      const result = await loginViaPostgres(req, res, email, password)
      if (result) return result
    }

    return await loginViaAirtable(req, res, email, password)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendError(res, error.issues[0].message, 400)
    }
    return handleApiError(res, error)
  }
}

