-- Migration 013: Reference tables for program prompts and experience levels
-- These tables cache Airtable reference data in Postgres for resilience

CREATE TABLE IF NOT EXISTS reference_program_prompts_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference_experience_levels_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
