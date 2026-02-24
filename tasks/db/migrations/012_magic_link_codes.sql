CREATE TABLE IF NOT EXISTS magic_link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  hashed_token TEXT,
  hashed_code TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_codes_email ON magic_link_codes (email);
CREATE INDEX IF NOT EXISTS idx_magic_link_codes_user_id ON magic_link_codes (user_id);
