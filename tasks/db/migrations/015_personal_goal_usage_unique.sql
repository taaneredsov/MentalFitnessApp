-- Add missing UNIQUE constraint on personal_goal_usage_pg
-- Prevents duplicate completions of the same goal on the same day
-- (Matches the pattern used by goede_gewoontes_usage_pg)
ALTER TABLE personal_goal_usage_pg
  ADD CONSTRAINT unique_user_personal_goal_date
  UNIQUE (user_id, personal_goal_id, usage_date);
