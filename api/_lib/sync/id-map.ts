import { dbQuery } from "../db/client.js"

export async function upsertAirtableIdMap(
  entityType: string,
  postgresId: string,
  airtableRecordId: string
): Promise<void> {
  await dbQuery(
    `INSERT INTO airtable_id_map (entity_type, postgres_id, airtable_record_id, last_synced_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (entity_type, postgres_id)
     DO UPDATE SET airtable_record_id = EXCLUDED.airtable_record_id, last_synced_at = NOW()`,
    [entityType, postgresId, airtableRecordId]
  )
}

export async function findAirtableId(entityType: string, postgresId: string): Promise<string | null> {
  const result = await dbQuery<{ airtable_record_id: string }>(
    `SELECT airtable_record_id
     FROM airtable_id_map
     WHERE entity_type = $1 AND postgres_id = $2
     LIMIT 1`,
    [entityType, postgresId]
  )

  return result.rows[0]?.airtable_record_id || null
}

export async function findPostgresId(entityType: string, airtableRecordId: string): Promise<string | null> {
  const result = await dbQuery<{ postgres_id: string }>(
    `SELECT postgres_id
     FROM airtable_id_map
     WHERE entity_type = $1 AND airtable_record_id = $2
     LIMIT 1`,
    [entityType, airtableRecordId]
  )

  return result.rows[0]?.postgres_id || null
}

