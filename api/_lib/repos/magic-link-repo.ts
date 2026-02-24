import { dbQuery } from "../db/client.js"

interface MagicLinkCode {
  id: string
  userId: string
  email: string
  hashedToken: string | null
  hashedCode: string | null
  expiresAt: string
  usedAt: string | null
}

export async function storeMagicLinkCode(input: {
  userId: string
  email: string
  hashedToken: string
  hashedCode: string
  expiresAt: string
}): Promise<void> {
  // Delete any existing unused codes for this email first
  await dbQuery(
    `DELETE FROM magic_link_codes WHERE email = $1 AND used_at IS NULL`,
    [input.email]
  )

  await dbQuery(
    `INSERT INTO magic_link_codes (user_id, email, hashed_token, hashed_code, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [input.userId, input.email, input.hashedToken, input.hashedCode, input.expiresAt]
  )
}

export async function findMagicLinkByToken(hashedToken: string): Promise<MagicLinkCode | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id, user_id, email, hashed_token, hashed_code, expires_at, used_at
     FROM magic_link_codes
     WHERE hashed_token = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [hashedToken]
  )

  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: String(row.email),
    hashedToken: row.hashed_token ? String(row.hashed_token) : null,
    hashedCode: row.hashed_code ? String(row.hashed_code) : null,
    expiresAt: String(row.expires_at),
    usedAt: row.used_at ? String(row.used_at) : null
  }
}

export async function findMagicLinkByEmail(email: string): Promise<MagicLinkCode | null> {
  const result = await dbQuery<Record<string, unknown>>(
    `SELECT id, user_id, email, hashed_token, hashed_code, expires_at, used_at
     FROM magic_link_codes
     WHERE email = $1 AND used_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [email]
  )

  if (result.rows.length === 0) return null
  const row = result.rows[0]
  return {
    id: String(row.id),
    userId: String(row.user_id),
    email: String(row.email),
    hashedToken: row.hashed_token ? String(row.hashed_token) : null,
    hashedCode: row.hashed_code ? String(row.hashed_code) : null,
    expiresAt: String(row.expires_at),
    usedAt: row.used_at ? String(row.used_at) : null
  }
}

export async function markMagicLinkUsed(id: string): Promise<void> {
  await dbQuery(
    `UPDATE magic_link_codes SET used_at = NOW() WHERE id = $1`,
    [id]
  )
}

export async function getMagicLinkExpiry(email: string): Promise<string | null> {
  const result = await dbQuery<{ expires_at: string }>(
    `SELECT expires_at FROM magic_link_codes
     WHERE email = $1 AND used_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [email]
  )
  return result.rows[0]?.expires_at ?? null
}
