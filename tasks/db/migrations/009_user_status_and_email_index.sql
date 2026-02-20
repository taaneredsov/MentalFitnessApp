-- Case-insensitive email uniqueness (queries already use LOWER(email))
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_canonical
  ON users_pg (LOWER(email));

-- User status for soft-delete support
ALTER TABLE users_pg ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_users_status ON users_pg (status);
