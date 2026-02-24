-- Add direct airtable_record_id column to personal_goals_pg
-- Eliminates reliance on airtable_id_map for deduplication during sync
ALTER TABLE personal_goals_pg
  ADD COLUMN IF NOT EXISTS airtable_record_id VARCHAR(20) UNIQUE;

-- Backfill from airtable_id_map where available
UPDATE personal_goals_pg
SET airtable_record_id = m.airtable_record_id
FROM airtable_id_map m
WHERE m.entity_type = 'personal_goal'
  AND m.postgres_id = personal_goals_pg.id
  AND personal_goals_pg.airtable_record_id IS NULL;
