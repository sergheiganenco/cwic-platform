-- backend/data-service/migrations/019_comprehensive_uuid_migration.sql
-- Complete UUID migration with dependency handling
-- BACKUP YOUR DATABASE BEFORE RUNNING THIS!

BEGIN;

-- Step 1: Drop dependent views temporarily
DROP VIEW IF EXISTS v_asset_overview CASCADE;
DROP VIEW IF EXISTS v_trending_assets CASCADE;
DROP VIEW IF EXISTS quality_dashboard_metrics CASCADE;

-- Step 2: Create backup tables
CREATE TABLE catalog_assets_backup AS SELECT * FROM catalog_assets;
CREATE TABLE data_profiles_backup AS SELECT * FROM data_profiles;
CREATE TABLE quality_issues_backup AS SELECT * FROM quality_issues;
CREATE TABLE quality_rules_backup AS SELECT * FROM quality_rules;

-- Step 3: Add UUID columns
ALTER TABLE catalog_assets
  ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS old_id BIGINT;

ALTER TABLE data_profiles
  ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS asset_id_uuid UUID,
  ADD COLUMN IF NOT EXISTS old_id BIGINT,
  ADD COLUMN IF NOT EXISTS old_asset_id BIGINT;

ALTER TABLE quality_issues
  ADD COLUMN IF NOT EXISTS id_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS asset_id_uuid UUID,
  ADD COLUMN IF NOT EXISTS old_id BIGINT,
  ADD COLUMN IF NOT EXISTS old_asset_id BIGINT;

ALTER TABLE quality_rules
  ADD COLUMN IF NOT EXISTS asset_id_uuid UUID,
  ADD COLUMN IF NOT EXISTS old_asset_id BIGINT;

-- Step 4: Preserve old IDs
UPDATE catalog_assets SET old_id = id WHERE old_id IS NULL;
UPDATE data_profiles SET old_id = id, old_asset_id = asset_id WHERE old_id IS NULL;
UPDATE quality_issues SET old_id = id, old_asset_id = asset_id WHERE old_id IS NULL;
UPDATE quality_rules SET old_asset_id = asset_id WHERE old_asset_id IS NULL;

-- Step 5: Update foreign key references
UPDATE data_profiles dp
SET asset_id_uuid = ca.id_uuid
FROM catalog_assets ca
WHERE dp.asset_id = ca.id;

UPDATE quality_issues qi
SET asset_id_uuid = ca.id_uuid
FROM catalog_assets ca
WHERE qi.asset_id = ca.id;

UPDATE quality_rules qr
SET asset_id_uuid = ca.id_uuid
FROM catalog_assets ca
WHERE qr.asset_id = ca.id;

-- Step 6: Handle all dependent foreign keys
-- catalog_columns
ALTER TABLE catalog_columns
  ADD COLUMN IF NOT EXISTS asset_id_uuid UUID;

UPDATE catalog_columns cc
SET asset_id_uuid = ca.id_uuid
FROM catalog_assets ca
WHERE cc.asset_id = ca.id;

-- catalog_lineage
ALTER TABLE catalog_lineage
  ADD COLUMN IF NOT EXISTS from_asset_id_uuid UUID,
  ADD COLUMN IF NOT EXISTS to_asset_id_uuid UUID;

UPDATE catalog_lineage cl
SET from_asset_id_uuid = ca.id_uuid
FROM catalog_assets ca
WHERE cl.from_asset_id = ca.id;

UPDATE catalog_lineage cl
SET to_asset_id_uuid = ca.id_uuid
FROM catalog_assets ca
WHERE cl.to_asset_id = ca.id;

-- Drop all foreign key constraints first
ALTER TABLE data_profiles DROP CONSTRAINT IF EXISTS data_profiles_asset_id_fkey;
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_asset_id_fkey;
ALTER TABLE quality_rules DROP CONSTRAINT IF EXISTS quality_rules_asset_id_fkey;
ALTER TABLE catalog_columns DROP CONSTRAINT IF EXISTS catalog_columns_asset_id_fkey;
ALTER TABLE catalog_lineage DROP CONSTRAINT IF EXISTS catalog_lineage_from_asset_id_fkey;
ALTER TABLE catalog_lineage DROP CONSTRAINT IF EXISTS catalog_lineage_to_asset_id_fkey;

-- Step 7: Replace BIGINT with UUID columns
-- catalog_assets
ALTER TABLE catalog_assets DROP CONSTRAINT IF EXISTS catalog_assets_pkey CASCADE;
ALTER TABLE catalog_assets DROP COLUMN id;
ALTER TABLE catalog_assets RENAME COLUMN id_uuid TO id;
ALTER TABLE catalog_assets ADD PRIMARY KEY (id);

-- data_profiles
ALTER TABLE data_profiles DROP CONSTRAINT IF EXISTS data_profiles_pkey CASCADE;
ALTER TABLE data_profiles DROP COLUMN id;
ALTER TABLE data_profiles DROP COLUMN asset_id;
ALTER TABLE data_profiles RENAME COLUMN id_uuid TO id;
ALTER TABLE data_profiles RENAME COLUMN asset_id_uuid TO asset_id;
ALTER TABLE data_profiles ADD PRIMARY KEY (id);

-- quality_issues
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_pkey CASCADE;
ALTER TABLE quality_issues DROP COLUMN id;
ALTER TABLE quality_issues DROP COLUMN asset_id;
ALTER TABLE quality_issues RENAME COLUMN id_uuid TO id;
ALTER TABLE quality_issues RENAME COLUMN asset_id_uuid TO asset_id;
ALTER TABLE quality_issues ADD PRIMARY KEY (id);

-- quality_rules (already has UUID id)
ALTER TABLE quality_rules DROP COLUMN asset_id;
ALTER TABLE quality_rules RENAME COLUMN asset_id_uuid TO asset_id;

-- catalog_columns
ALTER TABLE catalog_columns DROP COLUMN asset_id;
ALTER TABLE catalog_columns RENAME COLUMN asset_id_uuid TO asset_id;

-- catalog_lineage
ALTER TABLE catalog_lineage DROP COLUMN from_asset_id;
ALTER TABLE catalog_lineage DROP COLUMN to_asset_id;
ALTER TABLE catalog_lineage RENAME COLUMN from_asset_id_uuid TO from_asset_id;
ALTER TABLE catalog_lineage RENAME COLUMN to_asset_id_uuid TO to_asset_id;

-- Step 8: Recreate foreign keys with UUID types
ALTER TABLE data_profiles
  ADD CONSTRAINT data_profiles_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE quality_issues
  ADD CONSTRAINT quality_issues_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE quality_rules
  ADD CONSTRAINT quality_rules_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE catalog_columns
  ADD CONSTRAINT catalog_columns_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE catalog_lineage
  ADD CONSTRAINT catalog_lineage_from_asset_id_fkey
  FOREIGN KEY (from_asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE,
  ADD CONSTRAINT catalog_lineage_to_asset_id_fkey
  FOREIGN KEY (to_asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

-- Fix quality_results foreign key
ALTER TABLE quality_results
  DROP CONSTRAINT IF EXISTS quality_results_asset_id_fkey;

ALTER TABLE quality_results
  ADD CONSTRAINT quality_results_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

-- Step 9: Recreate views with UUID columns
CREATE OR REPLACE VIEW v_asset_overview AS
SELECT
  ca.id::text as id,  -- Cast UUID to text for compatibility
  ca.asset_name,
  ca.asset_type,
  ca.database_name,
  ca.schema_name,
  ca.table_name,
  ca.datasource_id,
  ca.created_at,
  ca.updated_at,
  COUNT(DISTINCT cc.id) as column_count,
  COUNT(DISTINCT dp.id) as profile_count
FROM catalog_assets ca
LEFT JOIN catalog_columns cc ON ca.id = cc.asset_id
LEFT JOIN data_profiles dp ON ca.id = dp.asset_id
GROUP BY ca.id, ca.asset_name, ca.asset_type, ca.database_name,
         ca.schema_name, ca.table_name, ca.datasource_id,
         ca.created_at, ca.updated_at;

CREATE OR REPLACE VIEW v_trending_assets AS
SELECT
  ca.id::text as id,
  ca.asset_name,
  ca.asset_type,
  COUNT(dp.id) as profile_count,
  MAX(dp.profile_date) as last_profiled
FROM catalog_assets ca
LEFT JOIN data_profiles dp ON ca.id = dp.asset_id
GROUP BY ca.id, ca.asset_name, ca.asset_type
ORDER BY profile_count DESC, last_profiled DESC;

CREATE OR REPLACE VIEW quality_dashboard_metrics AS
SELECT
  ca.id::text as asset_id,
  ca.asset_name,
  ca.database_name,
  ca.schema_name,
  ca.table_name,
  AVG(dp.quality_score) as avg_quality_score,
  AVG(dp.completeness_score) as avg_completeness,
  AVG(dp.accuracy_score) as avg_accuracy,
  AVG(dp.consistency_score) as avg_consistency,
  AVG(dp.validity_score) as avg_validity,
  AVG(dp.freshness_score) as avg_freshness,
  AVG(dp.uniqueness_score) as avg_uniqueness
FROM catalog_assets ca
LEFT JOIN data_profiles dp ON ca.id = dp.asset_id
WHERE NOT is_system_database(ca.database_name)
GROUP BY ca.id, ca.asset_name, ca.database_name, ca.schema_name, ca.table_name;

-- Step 10: Update indexes
DROP INDEX IF EXISTS idx_data_profiles_asset;
CREATE INDEX idx_data_profiles_asset ON data_profiles(asset_id);

DROP INDEX IF EXISTS idx_quality_rules_asset;
CREATE INDEX idx_quality_rules_asset ON quality_rules(asset_id);

DROP INDEX IF EXISTS idx_quality_issues_asset;
CREATE INDEX idx_quality_issues_asset ON quality_issues(asset_id);

DROP INDEX IF EXISTS idx_catalog_columns_asset;
CREATE INDEX idx_catalog_columns_asset ON catalog_columns(asset_id);

-- Step 11: Create mapping table for reference
CREATE TABLE IF NOT EXISTS uuid_migration_log (
  table_name VARCHAR(100),
  old_bigint_id BIGINT,
  new_uuid_id UUID,
  migrated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO uuid_migration_log (table_name, old_bigint_id, new_uuid_id)
SELECT 'catalog_assets', old_id, id FROM catalog_assets WHERE old_id IS NOT NULL;

COMMIT;

-- Verification
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name IN ('catalog_assets', 'data_profiles', 'quality_issues', 'quality_rules')
AND column_name IN ('id', 'asset_id')
ORDER BY table_name, column_name;