-- Cleanup Invalid PII Classifications
-- This script removes incorrect PII classifications that were added due to overly broad wildcard matching

BEGIN;

-- ============================================================================
-- STEP 1: Identify columns that should NOT be PII
-- ============================================================================

-- Create temporary table of columns to clean up
CREATE TEMP TABLE columns_to_clean AS
SELECT
  cc.id as column_id,
  cc.column_name,
  ca.table_name,
  ca.schema_name,
  ca.database_name,
  cc.pii_type
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.pii_type IS NOT NULL
  AND (
    -- System metadata columns (not actual PII)
    cc.column_name IN (
      'constraint_name', 'table_name', 'schema_name', 'database_name',
      'column_name', 'object_name', 'fully_qualified_name', 'source_name',
      'search_name', 'snapshot_name', 'instance_name', 'type_name',
      'elastic_pool_name', 'default_database_name', 'default_language_name',
      'datasource_name'
    )
    OR
    -- Generic 'name' fields in system/metadata tables
    (
      cc.column_name = 'name'
      AND ca.table_name IN (
        'migrations', 'pipelines', 'quality_rules', 'quality_slas',
        'quality_anomaly_models', 'quality_scan_schedules',
        'catalog_bookmarks', 'catalog_databases', 'catalog_objects',
        'catalog_saved_filters', 'catalog_schemas', 'governance_policies',
        'sql_logins', 'firewall_rules', 'database_firewall_rules',
        'vw_catalog_with_quality', 'v_popular_objects', 'assets',
        'data_sources'
      )
    )
    OR
    -- System database tables
    ca.database_name IN ('master', 'sys', 'information_schema', 'pg_catalog')
    OR
    -- CWIC Platform internal tables (metadata, not user data)
    (
      ca.database_name = 'cwic_platform'
      AND ca.table_name IN (
        'assets', 'catalog_columns', 'catalog_bookmarks', 'catalog_databases',
        'catalog_objects', 'catalog_saved_filters', 'catalog_schemas',
        'catalog_scan_errors', 'data_sources', 'governance_policies',
        'lineage_snapshots', 'migrations', 'pipelines', 'pii_training_data',
        'quality_anomalies', 'quality_anomaly_models', 'quality_dashboard_metrics',
        'quality_rules', 'quality_scan_schedules', 'quality_slas',
        'saved_searches', 'asset_relationships', 'catalog_assets',
        'v_asset_overview', 'v_catalog_hierarchy', 'v_popular_objects',
        'v_trending_assets', 'vw_catalog_with_quality'
      )
    )
  );

-- Show what will be cleaned up
SELECT
  'INVALID PII CLASSIFICATIONS TO REMOVE' as action,
  COUNT(*) as total_columns,
  COUNT(DISTINCT table_name) as affected_tables
FROM columns_to_clean;

-- Show breakdown by PII type
SELECT
  pii_type,
  COUNT(*) as count
FROM columns_to_clean
GROUP BY pii_type
ORDER BY count DESC;

-- Show sample of columns to clean
SELECT
  column_name,
  table_name,
  database_name,
  pii_type
FROM columns_to_clean
ORDER BY database_name, table_name, column_name
LIMIT 50;

-- ============================================================================
-- STEP 2: Remove quality issues for these invalid PII classifications
-- ============================================================================

-- Find quality issues linked to these columns
WITH issues_to_resolve AS (
  SELECT qi.id
  FROM quality_issues qi
  WHERE qi.column_id IN (SELECT column_id FROM columns_to_clean)
    AND qi.issue_type = 'pii_violation'
    AND qi.status = 'open'
)
SELECT
  'QUALITY ISSUES TO RESOLVE' as action,
  COUNT(*) as total_issues
FROM issues_to_resolve;

-- Mark these quality issues as resolved (false positives)
UPDATE quality_issues
SET
  status = 'resolved',
  resolution_notes = 'Auto-resolved: Column is metadata, not actual PII',
  resolved_at = NOW()
WHERE column_id IN (SELECT column_id FROM columns_to_clean)
  AND issue_type = 'pii_violation'
  AND status = 'open';

-- ============================================================================
-- STEP 3: Clear PII classification from these columns
-- ============================================================================

UPDATE catalog_columns
SET
  pii_type = NULL,
  is_sensitive = false
WHERE id IN (SELECT column_id FROM columns_to_clean);

-- Show cleanup results
SELECT
  'CLEANUP COMPLETE' as status,
  (SELECT COUNT(*) FROM columns_to_clean) as columns_cleaned,
  (SELECT COUNT(*) FROM quality_issues WHERE resolution_notes LIKE 'Auto-resolved: Column is metadata%') as issues_resolved;

-- ============================================================================
-- STEP 4: Verify remaining valid PII classifications
-- ============================================================================

-- Show remaining PII columns (should be actual user data)
SELECT
  'REMAINING VALID PII COLUMNS' as status,
  cc.column_name,
  ca.table_name,
  ca.schema_name,
  ca.database_name,
  cc.pii_type,
  cc.is_sensitive
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.pii_type IS NOT NULL
ORDER BY ca.database_name, ca.table_name, cc.column_name;

COMMIT;

-- ============================================================================
-- EXPECTED RESULTS
-- ============================================================================
-- After cleanup, only these columns should remain as PII:
--
-- Database: adventureworks
--   - customers: first_name, last_name (PII type: name)
--   - employees: first_name, last_name (PII type: name)
--   - suppliers: contact_name (PII type: name)
--
-- Database: Feya_DB
--   - User: Lastname, Middlename, UserName (PII type: name)
--   - User: Email (PII type: email) - if exists
--   - User: Phone (PII type: phone) - if exists
--   - User: SSN (PII type: ssn) - if exists
--
-- All system/metadata columns should be removed
