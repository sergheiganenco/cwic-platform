ALTER TABLE data_sources
  ADD COLUMN IF NOT EXISTS connection_config JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_data_sources_connection_config
  ON data_sources USING GIN (connection_config);


ALTER TABLE data_sources DROP CONSTRAINT IF EXISTS data_sources_type_check;

ALTER TABLE data_sources
  ADD CONSTRAINT data_sources_type_check CHECK (
    type::text = ANY (
      ARRAY[
        'postgres','mysql','sqlserver','mongodb',
        's3','api','file',
        'azure_blob','azure_datalake'        -- <— add what you need
      ]::text[]
    )
  );
