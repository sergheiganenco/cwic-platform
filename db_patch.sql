CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Columns the service expects
ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS connection_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS public_id         text UNIQUE,
  ADD COLUMN IF NOT EXISTS deleted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS created_by        text,
  ADD COLUMN IF NOT EXISTS updated_by        text,
  ADD COLUMN IF NOT EXISTS last_test_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_sync_at      timestamptz,
  ADD COLUMN IF NOT EXISTS last_error        text;

-- Make tags a jsonb array
ALTER TABLE data_sources
  ALTER COLUMN tags TYPE jsonb USING to_jsonb(tags),
  ALTER COLUMN tags SET DEFAULT '[]'::jsonb;

-- Widen type/status checks
ALTER TABLE data_sources DROP CONSTRAINT IF EXISTS data_sources_type_check;
ALTER TABLE data_sources
  ADD CONSTRAINT data_sources_type_check
  CHECK (type::text = ANY (ARRAY['postgres','mysql','sqlserver','mssql','mongodb','s3','api','file']::text[]));

ALTER TABLE data_sources DROP CONSTRAINT IF EXISTS data_sources_status_check;
ALTER TABLE data_sources
  ADD CONSTRAINT data_sources_status_check
  CHECK (status::text = ANY (ARRAY['pending','connected','warning','error','disconnected','active','inactive']::text[]));
