-- Migration: Add Quality Tags to Assets and Columns
-- Purpose: Store quality scan results for display in Data Catalog

-- Add quality-related columns to assets table
ALTER TABLE IF EXISTS assets
  ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pii_fields JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quality_last_scanned_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compliance_status JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quality_tags JSONB DEFAULT '[]'::jsonb;

-- Create index for quality filtering on assets
CREATE INDEX IF NOT EXISTS idx_assets_pii_detected ON assets(pii_detected) WHERE pii_detected = TRUE;
CREATE INDEX IF NOT EXISTS idx_assets_quality_score ON assets(quality_score);
CREATE INDEX IF NOT EXISTS idx_assets_risk_level ON assets(risk_level);

-- Add quality-related columns to catalog_assets table
ALTER TABLE IF EXISTS catalog_assets
  ADD COLUMN IF NOT EXISTS pii_detected BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS pii_fields JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS quality_last_scanned_at TIMESTAMP DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS compliance_status JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level VARCHAR(20) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS quality_tags JSONB DEFAULT '[]'::jsonb;

-- Create indexes for quality filtering on catalog_assets
CREATE INDEX IF NOT EXISTS idx_catalog_assets_pii_detected ON catalog_assets(pii_detected) WHERE pii_detected = TRUE;
CREATE INDEX IF NOT EXISTS idx_catalog_assets_quality_score ON catalog_assets(quality_score);
CREATE INDEX IF NOT EXISTS idx_catalog_assets_risk_level ON catalog_assets(risk_level);

-- Add quality-related columns to catalog_columns table (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_columns') THEN
    ALTER TABLE catalog_columns
      ADD COLUMN IF NOT EXISTS pii_type VARCHAR(50) DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS is_sensitive BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS quality_issues JSONB DEFAULT '[]'::jsonb,
      ADD COLUMN IF NOT EXISTS encryption_status VARCHAR(50) DEFAULT 'plain_text';

    CREATE INDEX IF NOT EXISTS idx_columns_pii_type ON catalog_columns(pii_type) WHERE pii_type IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_columns_is_sensitive ON catalog_columns(is_sensitive) WHERE is_sensitive = TRUE;
  END IF;
END $$;

-- Add comments for documentation on assets table
COMMENT ON COLUMN assets.pii_detected IS 'Whether PII (Personally Identifiable Information) was detected in this asset';
COMMENT ON COLUMN assets.pii_fields IS 'Array of PII field details: [{columnName, piiType, recordCount}]';
COMMENT ON COLUMN assets.quality_score IS 'Overall data quality score (0-100)';
COMMENT ON COLUMN assets.quality_last_scanned_at IS 'Timestamp of last quality scan';
COMMENT ON COLUMN assets.compliance_status IS 'Compliance framework statuses: {GDPR: "compliant", HIPAA: "non_compliant"}';
COMMENT ON COLUMN assets.risk_level IS 'Overall risk level: low, medium, high, critical';
COMMENT ON COLUMN assets.quality_tags IS 'Array of quality-related tags for filtering/display';

-- Add comments for documentation on catalog_assets table
COMMENT ON COLUMN catalog_assets.pii_detected IS 'Whether PII (Personally Identifiable Information) was detected in this asset';
COMMENT ON COLUMN catalog_assets.pii_fields IS 'Array of PII field details: [{columnName, piiType, recordCount}]';
COMMENT ON COLUMN catalog_assets.quality_last_scanned_at IS 'Timestamp of last quality scan';
COMMENT ON COLUMN catalog_assets.compliance_status IS 'Compliance framework statuses: {GDPR: "compliant", HIPAA: "non_compliant"}';
COMMENT ON COLUMN catalog_assets.risk_level IS 'Overall risk level: low, medium, high, critical';
COMMENT ON COLUMN catalog_assets.quality_tags IS 'Array of quality-related tags for filtering/display';

-- Create function to update quality tags from quality_issues table
CREATE OR REPLACE FUNCTION update_asset_quality_tags()
RETURNS TRIGGER AS $$
BEGIN
  -- When quality issues are created/updated, update the corresponding asset in catalog_assets
  UPDATE catalog_assets
  SET
    quality_last_scanned_at = NOW(),
    quality_tags = (
      SELECT COALESCE(json_agg(DISTINCT tag), '[]'::json)::jsonb
      FROM (
        SELECT CASE
          WHEN severity = 'critical' THEN 'Critical Issues'
          WHEN severity = 'high' THEN 'High Risk'
          WHEN dimension = 'completeness' THEN 'Incomplete Data'
          WHEN dimension = 'uniqueness' THEN 'Duplicates'
          WHEN dimension = 'freshness' THEN 'Stale Data'
          ELSE dimension
        END as tag
        FROM quality_issues
        WHERE asset_id = NEW.asset_id
          AND status != 'resolved'
      ) tags
    )
  WHERE id = NEW.asset_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update quality tags
DROP TRIGGER IF EXISTS trigger_update_quality_tags ON quality_issues;
CREATE TRIGGER trigger_update_quality_tags
  AFTER INSERT OR UPDATE ON quality_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_quality_tags();

-- Create view for Data Catalog with quality information
CREATE OR REPLACE VIEW vw_catalog_with_quality AS
SELECT
  a.id,
  a.table_name as name,
  a.asset_type as type,
  a.schema_name,
  a.database_name,
  a.datasource_id as data_source_id,
  a.row_count,
  a.column_count,
  a.description,
  a.created_at,
  a.updated_at,

  -- Quality metrics
  a.quality_score,
  a.quality_last_scanned_at,
  a.pii_detected,
  a.pii_fields,
  a.risk_level,
  a.quality_tags,
  a.compliance_status,

  -- Aggregated quality issues
  (SELECT COUNT(*) FROM quality_issues WHERE asset_id = a.id AND status != 'resolved') as open_quality_issues,
  (SELECT COUNT(*) FROM quality_issues WHERE asset_id = a.id AND severity = 'critical') as critical_issues,

  -- Data source info
  ds.name as data_source_name,
  ds.type as data_source_type

FROM catalog_assets a
LEFT JOIN data_sources ds ON a.datasource_id = ds.id;

-- Grant permissions
GRANT SELECT ON vw_catalog_with_quality TO PUBLIC;

COMMENT ON VIEW vw_catalog_with_quality IS 'Data Catalog with integrated quality metrics, PII detection, and compliance status';
