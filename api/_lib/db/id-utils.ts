const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const AIRTABLE_ID_RE = /^rec[A-Za-z0-9]{14}$/

export function isUuid(value: string): boolean {
  return UUID_RE.test(value)
}

export function isAirtableRecordId(value: string): boolean {
  return AIRTABLE_ID_RE.test(value)
}

export function isEntityId(value: string): boolean {
  return isUuid(value) || isAirtableRecordId(value)
}

