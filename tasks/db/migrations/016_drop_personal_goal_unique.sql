-- Drop incorrect UNIQUE constraint on personal_goal_usage_pg
-- Personal goals allow MULTIPLE completions per day (UI shows "Xx vandaag")
-- This differs from goede_gewoontes_usage_pg which is once-per-day
-- The constraint was incorrectly added in migration 015
ALTER TABLE personal_goal_usage_pg
  DROP CONSTRAINT IF EXISTS unique_user_personal_goal_date;
