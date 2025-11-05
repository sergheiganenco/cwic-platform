-- Migration: Add PII Training Data Table
-- Purpose: Store manual PII classifications and ML training data

-- Create PII training data table
CREATE TABLE IF NOT EXISTS pii_training_data (
  id BIGSERIAL PRIMARY KEY,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  database_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  column_name TEXT NOT NULL,
  data_type TEXT,

  -- Classification
  is_pii BOOLEAN NOT NULL,
  pii_type VARCHAR(50), -- EMAIL, PHONE, SSN, CREDIT_CARD, NAME, ADDRESS, etc.
  confidence INTEGER DEFAULT 100, -- 0-100
  reason TEXT,

  -- Training metadata
  training_source VARCHAR(20) NOT NULL, -- 'manual', 'pattern', 'ml'
  trained_by VARCHAR(255), -- User ID who made manual classification

  -- Sample data for validation (encrypted/hashed)
  sample_values_hash JSONB, -- Hashed sample values for pattern validation

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Unique constraint: one training record per column per source
  CONSTRAINT unique_pii_training UNIQUE (database_name, schema_name, table_name, column_name, training_source)
);

-- Create indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_pii_training_column ON pii_training_data(column_name, data_type);
CREATE INDEX IF NOT EXISTS idx_pii_training_source ON pii_training_data(training_source);
CREATE INDEX IF NOT EXISTS idx_pii_training_is_pii ON pii_training_data(is_pii) WHERE is_pii = TRUE;
CREATE INDEX IF NOT EXISTS idx_pii_training_pii_type ON pii_training_data(pii_type) WHERE pii_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pii_training_data_source ON pii_training_data(data_source_id);
CREATE INDEX IF NOT EXISTS idx_pii_training_table ON pii_training_data(schema_name, table_name);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_pii_training_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update timestamp
CREATE TRIGGER trigger_update_pii_training_timestamp
  BEFORE UPDATE ON pii_training_data
  FOR EACH ROW
  EXECUTE FUNCTION update_pii_training_timestamp();

-- Add comments for documentation
COMMENT ON TABLE pii_training_data IS 'Stores PII classifications for machine learning and manual overrides';
COMMENT ON COLUMN pii_training_data.is_pii IS 'Whether this column contains PII';
COMMENT ON COLUMN pii_training_data.pii_type IS 'Type of PII: EMAIL, PHONE, SSN, CREDIT_CARD, NAME, ADDRESS, DOB, IP_ADDRESS, etc.';
COMMENT ON COLUMN pii_training_data.confidence IS 'Confidence score 0-100';
COMMENT ON COLUMN pii_training_data.training_source IS 'Source of classification: manual (user override), pattern (rule-based), ml (machine learning)';
COMMENT ON COLUMN pii_training_data.trained_by IS 'User ID who made manual classification';
COMMENT ON COLUMN pii_training_data.sample_values_hash IS 'Hashed sample values for pattern validation without storing actual PII';

-- Create view for PII detection statistics
CREATE OR REPLACE VIEW vw_pii_detection_stats AS
SELECT
  data_source_id,
  COUNT(DISTINCT CONCAT(schema_name, '.', table_name, '.', column_name)) as total_columns,
  COUNT(DISTINCT CASE WHEN is_pii THEN CONCAT(schema_name, '.', table_name, '.', column_name) END) as pii_columns,
  COUNT(DISTINCT CASE WHEN training_source = 'manual' THEN CONCAT(schema_name, '.', table_name, '.', column_name) END) as manual_overrides,
  COUNT(DISTINCT CASE WHEN training_source = 'ml' THEN CONCAT(schema_name, '.', table_name, '.', column_name) END) as ml_classifications,
  AVG(CASE WHEN is_pii THEN confidence END) as avg_pii_confidence
FROM pii_training_data
GROUP BY data_source_id;

COMMENT ON VIEW vw_pii_detection_stats IS 'Statistics on PII detection and training data per data source';

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON pii_training_data TO PUBLIC;
GRANT SELECT ON vw_pii_detection_stats TO PUBLIC;
