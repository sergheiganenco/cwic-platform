ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS connection_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_by TEXT,
  ADD COLUMN IF NOT EXISTS updated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_data_sources_connection_config
  ON data_sources USING GIN (connection_config);
CREATE INDEX IF NOT EXISTS idx_data_sources_created_by ON data_sources(created_by);
CREATE INDEX IF NOT EXISTS idx_data_sources_updated_by ON data_sources(updated_by);
