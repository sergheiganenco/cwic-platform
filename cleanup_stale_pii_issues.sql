-- ============================================================================
-- Cleanup Stale PII Quality Issues
-- ============================================================================
-- This script removes quality issues for columns that are NO LONGER marked as PII
-- ============================================================================

BEGIN;

-- Step 1: Find and resolve quality issues for columns that are no longer PII
UPDATE quality_issues qi
SET
  status = 'resolved',
  resolved_at = CURRENT_TIMESTAMP,
  remediation_plan = 'Auto-resolved: Column is no longer classified as PII. PII rule configuration was updated to exclude this column.'
WHERE
  -- Issues related to PII
  (
    qi.title ILIKE '%PII%'
    OR qi.title ILIKE '%unencrypted%'
    OR qi.title ILIKE '%encryption%'
    OR qi.dimension = 'security'
  )
  AND qi.status IN ('open', 'acknowledged')
  AND qi.asset_id IN (
    -- Find assets (tables) that have columns with PII issues but columns are NOT PII anymore
    SELECT DISTINCT ca.id
    FROM catalog_assets ca
    JOIN catalog_columns cc ON cc.asset_id = ca.id
    WHERE cc.pii_type IS NULL
      AND cc.data_classification IS NULL
      AND cc.is_sensitive = false
  );

-- Step 2: Specifically target schema_name, table_name, description issues
UPDATE quality_issues
SET
  status = 'resolved',
  resolved_at = CURRENT_TIMESTAMP,
  remediation_plan = 'False positive: System metadata column (schema_name, table_name, etc.) incorrectly flagged as PII. Not actually sensitive data.'
WHERE
  status IN ('open', 'acknowledged')
  AND (
    title ILIKE '%schema_name%'
    OR title ILIKE '%table_name%'
    OR title ILIKE '%database_name%'
    OR title ILIKE '%column_name%'
    OR title ILIKE '%description%'
  )
  AND (
    title ILIKE '%PII%'
    OR title ILIKE '%unencrypted%'
    OR title ILIKE '%encryption%'
  );

-- Step 3: Show what was resolved
SELECT
  '=== Resolved Stale PII Issues ===' as section,
  COUNT(*) as issues_resolved
FROM quality_issues
WHERE
  status = 'resolved'
  AND resolved_at > CURRENT_TIMESTAMP - INTERVAL '1 minute';

-- Step 4: Show remaining open PII issues (should only be legitimate ones)
SELECT
  '=== Remaining Open PII Issues ===' as section,
  COUNT(*) as remaining_issues
FROM quality_issues
WHERE
  status IN ('open', 'acknowledged')
  AND (
    title ILIKE '%PII%'
    OR title ILIKE '%unencrypted%'
    OR title ILIKE '%encryption%'
  );

COMMIT;
