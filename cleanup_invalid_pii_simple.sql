-- Simple PII Cleanup Script
-- Removes invalid PII classifications from system/metadata columns

BEGIN;

-- Show what we're cleaning up
SELECT
  'BEFORE CLEANUP - Invalid PII Classifications' as status,
  cc.column_name,
  ca.table_name,
  ca.database_name,
  cc.pii_type
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.pii_type IS NOT NULL
  AND (
    -- System metadata columns
    cc.column_name IN (
      'constraint_name', 'table_name', 'schema_name', 'database_name',
      'column_name', 'object_name', 'fully_qualified_name', 'source_name',
      'search_name', 'snapshot_name', 'instance_name', 'type_name',
      'elastic_pool_name', 'default_database_name', 'default_language_name',
      'datasource_name', 'notification_emails'
    )
    OR
    -- Generic 'name' in system tables
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
    -- System databases
    ca.database_name IN ('master', 'sys', 'information_schema', 'pg_catalog')
    OR
    -- CWIC Platform metadata tables
    (
      ca.database_name = 'cwic_platform'
      AND ca.schema_name = 'public'
    )
  )
ORDER BY ca.database_name, ca.table_name, cc.column_name
LIMIT 100;

-- Clear PII from invalid columns
UPDATE catalog_columns cc
SET
  pii_type = NULL,
  is_sensitive = false
FROM catalog_assets ca
WHERE ca.id = cc.asset_id
  AND cc.pii_type IS NOT NULL
  AND (
    -- System metadata columns
    cc.column_name IN (
      'constraint_name', 'table_name', 'schema_name', 'database_name',
      'column_name', 'object_name', 'fully_qualified_name', 'source_name',
      'search_name', 'snapshot_name', 'instance_name', 'type_name',
      'elastic_pool_name', 'default_database_name', 'default_language_name',
      'datasource_name', 'notification_emails'
    )
    OR
    -- Generic 'name' in system tables
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
    -- System databases
    ca.database_name IN ('master', 'sys', 'information_schema', 'pg_catalog')
    OR
    -- CWIC Platform metadata tables
    (
      ca.database_name = 'cwic_platform'
      AND ca.schema_name = 'public'
    )
  );

-- Show results
SELECT
  'AFTER CLEANUP - Remaining Valid PII' as status,
  cc.column_name,
  ca.table_name,
  ca.database_name,
  cc.pii_type
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id
WHERE cc.pii_type IS NOT NULL
ORDER BY ca.database_name, ca.table_name, cc.column_name;

-- Show summary
SELECT
  'CLEANUP SUMMARY' as status,
  COUNT(*) FILTER (WHERE cc.pii_type IS NULL) as columns_cleaned,
  COUNT(*) FILTER (WHERE cc.pii_type IS NOT NULL) as valid_pii_remaining
FROM catalog_columns cc
JOIN catalog_assets ca ON ca.id = cc.asset_id;

COMMIT;
