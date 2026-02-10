ALTER TABLE program_schedule_pg
  ADD COLUMN IF NOT EXISTS planning_id TEXT,
  ADD COLUMN IF NOT EXISTS day_of_week_id TEXT,
  ADD COLUMN IF NOT EXISTS session_description TEXT,
  ADD COLUMN IF NOT EXISTS goal_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes TEXT;

