-- Migration 005: Reference tables for overtuigingen and mindset categories
-- These mirror Airtable tables as JSONB payloads for Postgres-backed reads

CREATE TABLE IF NOT EXISTS reference_overtuigingen_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference_mindset_categories_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
