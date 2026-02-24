-- Goede Gewoontes: separate from Methods into standalone entity
-- Reference table (synced from Airtable "Goede gewoontes" tblg0lHLnqYIkfvPV)
CREATE TABLE IF NOT EXISTS reference_goede_gewoontes_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Usage tracking table
CREATE TABLE IF NOT EXISTS goede_gewoontes_usage_pg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  goede_gewoonte_id TEXT NOT NULL,
  usage_date DATE NOT NULL,
  airtable_record_id TEXT UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, goede_gewoonte_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_goede_gewoontes_usage_user_date
  ON goede_gewoontes_usage_pg(user_id, usage_date);

-- Add user's selected goede gewoontes
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS goede_gewoontes JSONB DEFAULT '[]';
