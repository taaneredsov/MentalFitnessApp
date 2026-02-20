import { base, tables } from "../airtable.js"
import { FIELD_NAMES, USER_FIELDS, escapeFormulaValue } from "../field-mappings.js"
import { upsertUserFromAirtable, type PgUser } from "../repos/user-repo.js"
import { dbQuery } from "../db/client.js"

interface AirtableLikeRecord {
  id: string
  fields: Record<string, unknown>
}

export interface AirtableUserSyncRecord {
  id: string
  name: string
  email: string
  role?: string | null
  languageCode?: string | null
  passwordHash?: string | null
  lastLogin?: string | null
  bonusPoints?: number | null
  badges?: string | null
  level?: number | null
  status?: string | null
}

/** Map Airtable status values to internal Postgres status */
function mapAirtableStatus(airtableStatus: string | null | undefined): string {
  if (!airtableStatus) return "active"
  if (airtableStatus === "Actief") return "active"
  if (airtableStatus === "Geen toegang") return "disabled"
  return "active"
}

function toSyncRecord(record: AirtableLikeRecord): AirtableUserSyncRecord {
  const fields = record.fields || {}
  return {
    id: record.id,
    name: String(fields[USER_FIELDS.name] || ""),
    email: String(fields[USER_FIELDS.email] || ""),
    role: fields[USER_FIELDS.role] ? String(fields[USER_FIELDS.role]) : null,
    languageCode: fields[USER_FIELDS.languageCode] ? String(fields[USER_FIELDS.languageCode]) : null,
    passwordHash: fields[USER_FIELDS.passwordHash] ? String(fields[USER_FIELDS.passwordHash]) : null,
    lastLogin: fields[USER_FIELDS.lastLogin] ? String(fields[USER_FIELDS.lastLogin]) : null,
    bonusPoints: fields[USER_FIELDS.bonusPoints] ? Number(fields[USER_FIELDS.bonusPoints]) : null,
    badges: fields[USER_FIELDS.badges] ? String(fields[USER_FIELDS.badges]) : null,
    level: fields[USER_FIELDS.level] ? Number(fields[USER_FIELDS.level]) : null,
    status: mapAirtableStatus(fields[USER_FIELDS.status] ? String(fields[USER_FIELDS.status]) : null)
  }
}

async function markInboxEvent(eventId: string, source: string): Promise<boolean> {
  const result = await dbQuery<Record<string, unknown>>(
    `INSERT INTO sync_inbox_events (event_id, source)
     VALUES ($1, $2)
     ON CONFLICT (event_id) DO NOTHING
     RETURNING event_id`,
    [eventId, source]
  )
  return result.rows.length > 0
}

export async function ensureInboundEventNotDuplicate(eventId: string, source = "airtable_webhook"): Promise<boolean> {
  return markInboxEvent(eventId, source)
}

export async function syncUserRecords(records: AirtableUserSyncRecord[]): Promise<PgUser[]> {
  const synced: PgUser[] = []
  for (const record of records) {
    if (!record.id || !record.email) continue
    const user = await upsertUserFromAirtable(record)
    synced.push(user)
  }
  return synced
}

export async function fetchUserFromAirtableByEmail(email: string): Promise<AirtableUserSyncRecord | null> {
  const records = await base(tables.users)
    .select({
      filterByFormula: `{${FIELD_NAMES.user.email}} = "${escapeFormulaValue(email)}"`,
      maxRecords: 1,
      returnFieldsByFieldId: true
    })
    .firstPage()

  if (records.length === 0) return null
  return toSyncRecord(records[0] as AirtableLikeRecord)
}

export async function fetchUserFromAirtableById(userId: string): Promise<AirtableUserSyncRecord | null> {
  try {
    const record = await base(tables.users).find(userId)
    return toSyncRecord(record as AirtableLikeRecord)
  } catch {
    return null
  }
}

export async function readThroughSyncUserByEmail(email: string): Promise<PgUser | null> {
  const record = await fetchUserFromAirtableByEmail(email)
  if (!record) return null
  return upsertUserFromAirtable(record)
}

export async function readThroughSyncUserById(userId: string): Promise<PgUser | null> {
  const record = await fetchUserFromAirtableById(userId)
  if (!record) return null
  return upsertUserFromAirtable(record)
}

export async function syncAllUsersFromAirtable(): Promise<number> {
  const records = await base(tables.users)
    .select({
      returnFieldsByFieldId: true
    })
    .all()

  const mapped = records.map((record) => toSyncRecord(record as AirtableLikeRecord))
  const synced = await syncUserRecords(mapped)
  return synced.length
}

