-- Migration: Add PII Exclusions for Manual False Positive Management
-- This allows users to manually mark columns as "Not PII" and prevent them from being re-detected

-- Table to store excluded column patterns per PII rule
CREATE TABLE IF NOT EXISTS pii_exclusions (
  id SERIAL PRIMARY KEY,
  pii_rule_id INTEGER NOT NULL REFERENCES pii_rule_definitions(id) ON DELETE CASCADE,

  -- Exclusion pattern matching
  exclusion_type VARCHAR(50) NOT NULL CHECK (exclusion_type IN ('exact_column', 'column_pattern', 'table_column')),

  -- For exact_column: exact column name (e.g., 'CancelledDate')
  column_name VARCHAR(255),

  -- For table_column: specific table + column combination
  table_name VARCHAR(255),
  schema_name VARCHAR(255),
  database_name VARCHAR(255),

  -- For column_pattern: regex pattern (e.g., '.*cancel.*' to exclude all columns with 'cancel')
  pattern VARCHAR(500),

  -- Metadata
  reason TEXT, -- Why this was excluded (e.g., "User marked as false positive")
  excluded_by VARCHAR(255), -- User who marked this
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure at least one identification method is provided
  CONSTRAINT exclusion_pattern_check CHECK (
    (exclusion_type = 'exact_column' AND column_name IS NOT NULL) OR
    (exclusion_type = 'table_column' AND table_name IS NOT NULL AND column_name IS NOT NULL) OR
    (exclusion_type = 'column_pattern' AND pattern IS NOT NULL)
  )
);

-- Index for fast lookups during PII scanning
CREATE INDEX idx_pii_exclusions_rule_type ON pii_exclusions(pii_rule_id, exclusion_type);
CREATE INDEX idx_pii_exclusions_column ON pii_exclusions(column_name) WHERE exclusion_type = 'exact_column';
CREATE INDEX idx_pii_exclusions_table_column ON pii_exclusions(table_name, column_name) WHERE exclusion_type = 'table_column';

-- Add exclusion_count to pii_rule_definitions to track how many exclusions exist
ALTER TABLE pii_rule_definitions
ADD COLUMN IF NOT EXISTS exclusion_count INTEGER DEFAULT 0;

-- Function to update exclusion count when exclusions are added/removed
CREATE OR REPLACE FUNCTION update_pii_rule_exclusion_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE pii_rule_definitions
    SET exclusion_count = exclusion_count + 1
    WHERE id = NEW.pii_rule_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE pii_rule_definitions
    SET exclusion_count = GREATEST(exclusion_count - 1, 0)
    WHERE id = OLD.pii_rule_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update exclusion count
CREATE TRIGGER trg_update_exclusion_count
AFTER INSERT OR DELETE ON pii_exclusions
FOR EACH ROW
EXECUTE FUNCTION update_pii_rule_exclusion_count();

-- Initialize exclusion_count for existing rules
UPDATE pii_rule_definitions prd
SET exclusion_count = (
  SELECT COUNT(*) FROM pii_exclusions WHERE pii_rule_id = prd.id
);

-- Add audit log entry
INSERT INTO audit_log (action, entity_type, entity_id, details, created_at)
VALUES (
  'migration',
  'schema',
  'pii_exclusions',
  'Added pii_exclusions table for manual false positive management',
  CURRENT_TIMESTAMP
);

COMMENT ON TABLE pii_exclusions IS 'Stores excluded column patterns for PII rules to prevent false positive re-detection';
COMMENT ON COLUMN pii_exclusions.exclusion_type IS 'Type of exclusion: exact_column (any table), table_column (specific table+column), column_pattern (regex)';
COMMENT ON COLUMN pii_exclusions.reason IS 'Why this was excluded, e.g., "User marked as false positive - column is datetime not phone"';
