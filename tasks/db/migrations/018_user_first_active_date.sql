-- Migration 018: Add first_active_date for time-based badges
-- Used by monthsActive badge checks (drie_maanden, zes_maanden, jaar_actief)

ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS first_active_date TIMESTAMPTZ;

-- Backfill from earliest method usage
UPDATE users_pg u
SET first_active_date = sub.earliest
FROM (
  SELECT user_id, MIN(used_at) as earliest
  FROM method_usage_pg
  GROUP BY user_id
) sub
WHERE u.id = sub.user_id AND u.first_active_date IS NULL;
