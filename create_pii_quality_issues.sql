--
-- Create quality issues for existing PII columns
-- This script creates quality issues for columns that are already marked as PII
-- but don't have corresponding quality issues yet
--

-- Step 1: Get or create quality rules for each PII type
INSERT INTO quality_rules (
  name,
  description,
  dimension,
  severity,
  type,
  dialect,
  expression,
  rule_type,
  rule_config,
  tags,
  enabled,
  auto_generated
)
SELECT
  'PII Detection: ' || pii_type,
  'Automatically detects ' || pii_type || ' PII in data columns',
  'validity',
  CASE sensitivity_level
    WHEN 'critical' THEN 'critical'
    WHEN 'high' THEN 'high'
    WHEN 'medium' THEN 'medium'
    ELSE 'low'
  END,
  'sql',
  'postgres',
  'SELECT 1 WHERE 1=0',
  'validation',
  json_build_object('piiType', pii_type, 'automated', true, 'source', 'pii_backfill'),
  ARRAY['pii', 'privacy', pii_type],
  true,
  true
FROM pii_rule_definitions
WHERE is_enabled = true
ON CONFLICT (name) DO NOTHING;

-- Step 2: Create quality issues for existing PII columns that don't have issues yet
INSERT INTO quality_issues (
  rule_id,
  asset_id,
  data_source_id,
  severity,
  dimension,
  status,
  title,
  description,
  affected_rows,
  created_at,
  updated_at,
  first_seen_at,
  last_seen_at
)
SELECT
  qr.id as rule_id,
  ca.id as asset_id,
  ca.datasource_id as data_source_id,
  CASE prd.sensitivity_level
    WHEN 'critical' THEN 'critical'
    WHEN 'high' THEN 'high'
    WHEN 'medium' THEN 'medium'
    ELSE 'low'
  END as severity,
  'privacy' as dimension,
  'open' as status,
  'PII Detected: ' || cc.pii_type as title,
  'Column "' || ca.schema_name || '.' || ca.table_name || '.' || cc.column_name || '" contains ' || cc.pii_type || ' PII data.

' || CASE WHEN prd.requires_encryption THEN '⚠️ ENCRYPT this column immediately
' ELSE '' END ||
  CASE WHEN prd.requires_masking THEN '🔒 MASK in UI displays
' ELSE '' END ||
  '
Sensitivity: ' || prd.sensitivity_level || '
Requires Encryption: ' || CASE WHEN prd.requires_encryption THEN 'Yes' ELSE 'No' END || '
Requires Masking: ' || CASE WHEN prd.requires_masking THEN 'Yes' ELSE 'No' END as description,
  1 as affected_rows,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
JOIN pii_rule_definitions prd ON prd.pii_type = cc.pii_type AND prd.is_enabled = true
JOIN quality_rules qr ON qr.name = 'PII Detection: ' || cc.pii_type
WHERE cc.pii_type IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM quality_issues qi
    WHERE qi.asset_id = ca.id
      AND qi.title LIKE '%' || cc.pii_type || '%'
      AND qi.status IN ('open', 'acknowledged')
  );

-- Show results
SELECT
  COUNT(*) as issues_created,
  STRING_AGG(DISTINCT cc.pii_type, ', ') as pii_types
FROM catalog_columns cc
WHERE cc.pii_type IS NOT NULL;
