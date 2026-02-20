-- Add schedule_days column (nullable JSONB array of day names)
ALTER TABLE personal_goals_pg
  ADD COLUMN IF NOT EXISTS schedule_days JSONB;

-- Add status column to replace active boolean
ALTER TABLE personal_goals_pg
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Actief';

-- Backfill status from active flag
UPDATE personal_goals_pg SET status = 'Gearchiveerd' WHERE active = false AND status = 'Actief';

-- Add constraint (includes legacy 'Gearchiveerd' for backward compat)
ALTER TABLE personal_goals_pg
  ADD CONSTRAINT chk_personal_goal_status
  CHECK (status IN ('Actief', 'Voltooid', 'Verwijderd', 'Gearchiveerd'));

-- Index for user+status queries
CREATE INDEX IF NOT EXISTS idx_personal_goals_pg_user_status
  ON personal_goals_pg(user_id, status);

-- Extend notification_jobs_pg: add personal_goal_id + expand mode constraint
ALTER TABLE notification_jobs_pg
  ADD COLUMN IF NOT EXISTS personal_goal_id TEXT REFERENCES personal_goals_pg(id) ON DELETE CASCADE;

ALTER TABLE notification_jobs_pg
  DROP CONSTRAINT IF EXISTS notification_jobs_pg_mode_check;
ALTER TABLE notification_jobs_pg
  ADD CONSTRAINT notification_jobs_pg_mode_check
  CHECK (mode IN ('session', 'daily_summary', 'personal_goal'));
