CREATE TABLE IF NOT EXISTS translations_pg (
  key TEXT PRIMARY KEY,
  nl TEXT NOT NULL,
  fr TEXT,
  en TEXT,
  context TEXT,
  airtable_record_id TEXT UNIQUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_translations_pg_airtable_record_id ON translations_pg(airtable_record_id);
