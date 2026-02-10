-- Migration 003: Add overtuiging_usage table and reward columns to users

-- Overtuiging usage table
CREATE TABLE IF NOT EXISTS overtuiging_usage_pg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users_pg(id),
  overtuiging_id TEXT NOT NULL,
  program_id TEXT,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  airtable_record_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, overtuiging_id)
);

CREATE INDEX IF NOT EXISTS idx_overtuiging_usage_user_id ON overtuiging_usage_pg(user_id);

-- Add reward columns to users_pg
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS bonus_points INTEGER DEFAULT 0;
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS badges TEXT DEFAULT '[]';
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
