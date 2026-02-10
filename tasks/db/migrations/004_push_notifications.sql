-- Migration 004: Push notifications (subscriptions, preferences, jobs, delivery logs)

CREATE TABLE IF NOT EXISTS push_subscriptions_pg (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  user_agent TEXT,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('active', 'revoked', 'expired'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_pg_user_status
  ON push_subscriptions_pg(user_id, status);

CREATE TABLE IF NOT EXISTS notification_preferences_pg (
  user_id TEXT PRIMARY KEY REFERENCES users_pg(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_mode TEXT NOT NULL DEFAULT 'both',
  lead_minutes INTEGER NOT NULL DEFAULT 60,
  preferred_time_local TIME NOT NULL DEFAULT '19:00',
  timezone TEXT,
  quiet_hours_start TIME NOT NULL DEFAULT '22:00',
  quiet_hours_end TIME NOT NULL DEFAULT '07:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reminder_mode IN ('session', 'daily_summary', 'both')),
  CHECK (lead_minutes >= 0 AND lead_minutes <= 1440)
);

CREATE TABLE IF NOT EXISTS notification_jobs_pg (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users_pg(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs_pg(id) ON DELETE CASCADE,
  program_schedule_id UUID REFERENCES program_schedule_pg(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,
  mode TEXT NOT NULL,
  fire_at TIMESTAMPTZ NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (mode IN ('session', 'daily_summary')),
  CHECK (status IN ('pending', 'processing', 'sent', 'dead_letter', 'cancelled', 'skipped_quiet_hours'))
);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_pg_due
  ON notification_jobs_pg(status, next_attempt_at, fire_at, id);

CREATE INDEX IF NOT EXISTS idx_notification_jobs_pg_user_date
  ON notification_jobs_pg(user_id, status, reminder_date);

CREATE TABLE IF NOT EXISTS notification_delivery_log_pg (
  id BIGSERIAL PRIMARY KEY,
  job_id BIGINT REFERENCES notification_jobs_pg(id) ON DELETE SET NULL,
  subscription_id BIGINT REFERENCES push_subscriptions_pg(id) ON DELETE SET NULL,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL,
  status_code INTEGER,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_pg_job
  ON notification_delivery_log_pg(job_id);
