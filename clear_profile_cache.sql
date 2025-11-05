-- ============================================================================
-- Clear Profile Cache for Columns That Are No Longer PII
-- ============================================================================
-- This clears the profile_json cache which might contain stale PII flags
-- ============================================================================

BEGIN;

-- Update profile_json to remove PII flags from non-PII columns
UPDATE catalog_columns
SET
  profile_json = CASE
    WHEN profile_json IS NOT NULL THEN
      profile_json - 'pii_type' - 'data_classification' - 'is_sensitive'
    ELSE NULL
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE
  (pii_type IS NULL OR pii_type = '')
  AND (data_classification IS NULL OR data_classification = '')
  AND is_sensitive = false
  AND profile_json IS NOT NULL
  AND (
    profile_json ? 'pii_type'
    OR profile_json ? 'data_classification'
    OR profile_json ? 'is_sensitive'
  );

-- Show summary
SELECT
  'Profile cache cleared for ' || COUNT(*) || ' columns' as summary
FROM catalog_columns
WHERE
  pii_type IS NULL
  AND column_name IN ('schema_name', 'table_name', 'database_name', 'description');

SELECT
  'Columns with PII cleared:' as info,
  ca.table_name,
  cc.column_name,
  cc.pii_type,
  cc.is_sensitive
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.column_name = 'schema_name'
LIMIT 5;

COMMIT;
