-- ============================================================================
-- Clear Stale Quality Issues from profile_json
-- ============================================================================
-- The profile_json field contains cached quality_issues that show in the UI
-- These need to be cleared for columns that are NO LONGER PII
-- ============================================================================

BEGIN;

-- Step 1: Clear quality_issues from profile_json for ALL non-PII columns
UPDATE catalog_columns
SET
  profile_json = CASE
    WHEN profile_json IS NOT NULL THEN
      profile_json - 'quality_issues'
    ELSE profile_json
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE
  (pii_type IS NULL OR pii_type = '')
  AND (data_classification IS NULL OR data_classification = '')
  AND is_sensitive = false
  AND profile_json IS NOT NULL
  AND profile_json ? 'quality_issues';

-- Step 2: Specifically clear issues for metadata columns (schema_name, table_name, description, etc.)
UPDATE catalog_columns
SET
  profile_json = profile_json - 'quality_issues',
  updated_at = CURRENT_TIMESTAMP
WHERE
  column_name IN (
    'schema_name',
    'table_name',
    'database_name',
    'column_name',
    'description',
    'Description',
    'object_name',
    'fully_qualified_name',
    'source_name',
    'datasource_name',
    'data_source_name',
    'instance_name',
    'type_name',
    'name',
    'Name'
  )
  AND profile_json IS NOT NULL
  AND profile_json ? 'quality_issues';

-- Step 3: Show what was cleared
SELECT
  '=== Cleared profile_json quality_issues ===' as section,
  COUNT(*) as columns_cleaned
FROM catalog_columns
WHERE
  (pii_type IS NULL OR pii_type = '')
  AND column_name IN ('schema_name', 'table_name', 'description', 'database_name');

-- Step 4: Verify description columns are clean
SELECT
  '=== Description columns status ===' as section,
  ca.table_name,
  cc.column_name,
  cc.pii_type,
  cc.data_classification,
  cc.is_sensitive,
  CASE
    WHEN cc.profile_json IS NULL THEN 'NULL'
    WHEN cc.profile_json ? 'quality_issues' THEN 'HAS ISSUES ❌'
    ELSE 'CLEAN ✅'
  END as profile_status
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.column_name = 'description'
LIMIT 10;

COMMIT;
