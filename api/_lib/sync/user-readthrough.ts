import { readBooleanFlag } from "../data-backend.js"
import { isPostgresConfigured } from "../db/client.js"
import { findUserByEmail, findUserById, toApiUser, type PgUser } from "../repos/user-repo.js"
import { readThroughSyncUserByEmail, readThroughSyncUserById } from "./user-fast-lane.js"

const FALLBACK_ENABLED = () => readBooleanFlag("USER_READTHROUGH_FALLBACK_ENABLED", true)

export async function getUserByEmailWithReadThrough(email: string): Promise<PgUser | null> {
  if (!isPostgresConfigured()) return null

  const existing = await findUserByEmail(email)
  if (existing) return existing

  if (!FALLBACK_ENABLED()) return null

  try {
    return await readThroughSyncUserByEmail(email)
  } catch (error) {
    console.warn("[user-readthrough] Airtable fallback failed for email lookup:", error instanceof Error ? error.message : error)
    return null
  }
}

export async function getUserByIdWithReadThrough(userId: string): Promise<PgUser | null> {
  if (!isPostgresConfigured()) return null

  const existing = await findUserById(userId)
  if (existing) return existing

  if (!FALLBACK_ENABLED()) return null

  try {
    return await readThroughSyncUserById(userId)
  } catch (error) {
    console.warn("[user-readthrough] Airtable fallback failed for ID lookup:", error instanceof Error ? error.message : error)
    return null
  }
}

export function toApiUserPayload(user: PgUser): Record<string, unknown> {
  return toApiUser(user)
}

