-- Safe extensions (either is fine; keep both)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Main table used by DataSourceService.ts
CREATE TABLE IF NOT EXISTS data_sources (
  id               UUID PRIMARY KEY DEFAULT COALESCE(uuid_generate_v4(), gen_random_uuid()),
  name             TEXT NOT NULL,
  description      TEXT,
  type             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  connection_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by       TEXT,
  updated_by       TEXT,
  last_test_at     TIMESTAMPTZ,
  last_sync_at     TIMESTAMPTZ,
  last_error       TEXT,
  public_id        TEXT UNIQUE,
  deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_sources_created_at ON data_sources (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_sources_status     ON data_sources (status);
CREATE INDEX IF NOT EXISTS idx_data_sources_type       ON data_sources (type);
