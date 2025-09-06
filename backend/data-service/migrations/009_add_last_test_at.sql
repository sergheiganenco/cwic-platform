ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ;

UPDATE data_sources
SET last_test_at = COALESCE(last_test_at, last_tested_at);

CREATE INDEX IF NOT EXISTS idx_data_sources_last_test_at
  ON data_sources(last_test_at);
