CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users_pg (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT,
  language_code TEXT,
  password_hash TEXT,
  last_login DATE,
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_active_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programs_pg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  airtable_record_id TEXT UNIQUE,
  name TEXT,
  start_date DATE NOT NULL,
  duration TEXT NOT NULL,
  end_date DATE,
  status TEXT,
  creation_type TEXT,
  notes TEXT,
  goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  methods JSONB NOT NULL DEFAULT '[]'::jsonb,
  days_of_week JSONB NOT NULL DEFAULT '[]'::jsonb,
  overtuigingen JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_pg_user_start ON programs_pg(user_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_programs_pg_airtable_record_id ON programs_pg(airtable_record_id);

CREATE TABLE IF NOT EXISTS program_schedule_pg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs_pg(id) ON DELETE CASCADE,
  airtable_record_id TEXT UNIQUE,
  session_date DATE,
  method_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  method_usage_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_program_schedule_pg_program_id ON program_schedule_pg(program_id);

CREATE TABLE IF NOT EXISTS method_usage_pg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  method_id TEXT NOT NULL,
  program_id UUID REFERENCES programs_pg(id) ON DELETE SET NULL,
  program_schedule_id UUID REFERENCES program_schedule_pg(id) ON DELETE SET NULL,
  airtable_record_id TEXT UNIQUE,
  remark TEXT,
  used_at DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_method_usage_pg_program_used_at ON method_usage_pg(program_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_method_usage_pg_schedule_id ON method_usage_pg(program_schedule_id);

CREATE TABLE IF NOT EXISTS habit_usage_pg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  method_id TEXT NOT NULL,
  usage_date DATE NOT NULL,
  airtable_record_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, method_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_habit_usage_pg_user_date ON habit_usage_pg(user_id, usage_date);

CREATE TABLE IF NOT EXISTS personal_goals_pg (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS personal_goal_usage_pg (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  personal_goal_id TEXT NOT NULL REFERENCES personal_goals_pg(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  airtable_record_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_goal_usage_pg_user_date ON personal_goal_usage_pg(user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_personal_goal_usage_pg_goal ON personal_goal_usage_pg(personal_goal_id);

CREATE TABLE IF NOT EXISTS reference_methods_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference_goals_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reference_days_pg (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS airtable_id_map (
  entity_type TEXT NOT NULL,
  postgres_id TEXT NOT NULL,
  airtable_record_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, postgres_id),
  UNIQUE(entity_type, airtable_record_id)
);

CREATE TABLE IF NOT EXISTS sync_outbox (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT UNIQUE NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_pending ON sync_outbox(status, priority, next_attempt_at, id);

CREATE TABLE IF NOT EXISTS sync_dead_letter (
  id BIGSERIAL PRIMARY KEY,
  outbox_id BIGINT,
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT NOT NULL,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_checkpoint (
  checkpoint_key TEXT PRIMARY KEY,
  cursor TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_inbox_events (
  event_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

