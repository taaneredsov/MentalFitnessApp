-- Migration 017: Add app-calculated score columns to users_pg
-- These replace Airtable formula fields when running in postgres_primary mode.

ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS total_points INTEGER DEFAULT 0;
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS mental_fitness_score INTEGER DEFAULT 0;
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS personal_goals_score INTEGER DEFAULT 0;
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS good_habits_score INTEGER DEFAULT 0;
