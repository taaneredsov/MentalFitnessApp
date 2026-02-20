-- Migration 008: Persoonlijke Overtuigingen (Personal Convictions)
-- Postgres table for user-created personal convictions, synced with Airtable

CREATE TABLE IF NOT EXISTS persoonlijke_overtuigingen_pg (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  program_id TEXT,
  status TEXT NOT NULL DEFAULT 'Actief',
  completed_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_user_status ON persoonlijke_overtuigingen_pg(user_id, status);
