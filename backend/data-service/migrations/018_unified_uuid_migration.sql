-- backend/data-service/migrations/018_unified_uuid_migration.sql
-- CRITICAL: Migrate all BIGINT IDs to UUID for consistency
-- This is a major structural change - backup your database first!

BEGIN;

-- Step 1: Add UUID columns alongside BIGINT columns (temporary)
ALTER TABLE catalog_assets
  ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN old_id BIGINT;

ALTER TABLE data_profiles
  ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN asset_id_uuid UUID,
  ADD COLUMN old_id BIGINT,
  ADD COLUMN old_asset_id BIGINT;

ALTER TABLE quality_issues
  ADD COLUMN id_uuid UUID DEFAULT gen_random_uuid(),
  ADD COLUMN asset_id_uuid UUID,
  ADD COLUMN old_id BIGINT,
  ADD COLUMN old_asset_id BIGINT;

ALTER TABLE quality_rules
  ADD COLUMN asset_id_uuid UUID,
  ADD COLUMN old_asset_id BIGINT;

-- Step 2: Copy existing IDs to old_* columns for preservation
UPDATE catalog_assets SET old_id = id;
UPDATE data_profiles SET old_id = id, old_asset_id = asset_id;
UPDATE quality_issues SET old_id = id, old_asset_id = asset_id;
UPDATE quality_rules SET old_asset_id = asset_id;

-- Step 3: Create mapping table for ID migration
CREATE TABLE IF NOT EXISTS id_migration_map (
  table_name VARCHAR(100),
  old_id BIGINT,
  new_id UUID,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (table_name, old_id)
);

-- Step 4: Generate UUIDs and populate mapping
INSERT INTO id_migration_map (table_name, old_id, new_id)
SELECT 'catalog_assets', id, id_uuid FROM catalog_assets;

-- Step 5: Update foreign key references using the mapping
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

-- Step 6: Drop old foreign key constraints
ALTER TABLE data_profiles
  DROP CONSTRAINT IF EXISTS data_profiles_asset_id_fkey;

ALTER TABLE quality_issues
  DROP CONSTRAINT IF EXISTS quality_issues_asset_id_fkey;

ALTER TABLE quality_rules
  DROP CONSTRAINT IF EXISTS quality_rules_asset_id_fkey;

-- Step 7: Drop old columns and rename new ones
ALTER TABLE catalog_assets
  DROP CONSTRAINT IF EXISTS catalog_assets_pkey CASCADE,
  DROP COLUMN id,
  ALTER COLUMN id_uuid SET NOT NULL,
  ALTER COLUMN id_uuid SET DEFAULT gen_random_uuid();

ALTER TABLE catalog_assets
  RENAME COLUMN id_uuid TO id;

ALTER TABLE catalog_assets
  ADD PRIMARY KEY (id);

-- Update data_profiles
ALTER TABLE data_profiles
  DROP CONSTRAINT IF EXISTS data_profiles_pkey CASCADE,
  DROP COLUMN id,
  DROP COLUMN asset_id,
  ALTER COLUMN id_uuid SET NOT NULL,
  ALTER COLUMN id_uuid SET DEFAULT gen_random_uuid();

ALTER TABLE data_profiles
  RENAME COLUMN id_uuid TO id,
  RENAME COLUMN asset_id_uuid TO asset_id;

ALTER TABLE data_profiles
  ADD PRIMARY KEY (id);

-- Update quality_issues
ALTER TABLE quality_issues
  DROP CONSTRAINT IF EXISTS quality_issues_pkey CASCADE,
  DROP COLUMN id,
  DROP COLUMN asset_id,
  ALTER COLUMN id_uuid SET NOT NULL,
  ALTER COLUMN id_uuid SET DEFAULT gen_random_uuid();

ALTER TABLE quality_issues
  RENAME COLUMN id_uuid TO id,
  RENAME COLUMN asset_id_uuid TO asset_id;

ALTER TABLE quality_issues
  ADD PRIMARY KEY (id);

-- Update quality_rules (already has UUID id, just update asset_id)
ALTER TABLE quality_rules
  DROP COLUMN asset_id;

ALTER TABLE quality_rules
  RENAME COLUMN asset_id_uuid TO asset_id;

-- Step 8: Re-create foreign key constraints with UUID types
ALTER TABLE data_profiles
  ADD CONSTRAINT data_profiles_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE quality_issues
  ADD CONSTRAINT quality_issues_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE quality_rules
  ADD CONSTRAINT quality_rules_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

-- Step 9: Add missing foreign key constraint for quality_results
ALTER TABLE quality_results
  DROP CONSTRAINT IF EXISTS quality_results_asset_id_fkey;

ALTER TABLE quality_results
  ADD CONSTRAINT quality_results_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

-- Step 10: Update indexes
DROP INDEX IF EXISTS idx_data_profiles_asset;
CREATE INDEX idx_data_profiles_asset ON data_profiles(asset_id);

DROP INDEX IF EXISTS idx_quality_rules_asset;
CREATE INDEX idx_quality_rules_asset ON quality_rules(asset_id);

DROP INDEX IF EXISTS idx_quality_issues_asset;
CREATE INDEX idx_quality_issues_asset ON quality_issues(asset_id);

-- Step 11: Add audit columns for better tracking
ALTER TABLE catalog_assets ADD COLUMN IF NOT EXISTS migration_date TIMESTAMP DEFAULT NOW();
ALTER TABLE data_profiles ADD COLUMN IF NOT EXISTS migration_date TIMESTAMP DEFAULT NOW();
ALTER TABLE quality_issues ADD COLUMN IF NOT EXISTS migration_date TIMESTAMP DEFAULT NOW();
ALTER TABLE quality_rules ADD COLUMN IF NOT EXISTS migration_date TIMESTAMP DEFAULT NOW();

-- Step 12: Create rollback procedure (in case needed)
CREATE OR REPLACE FUNCTION rollback_uuid_migration()
RETURNS void AS $$
BEGIN
  -- This function would restore from old_id columns
  -- Implementation depends on backup strategy
  RAISE NOTICE 'Rollback would restore from old_id columns in each table';
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON TABLE id_migration_map IS 'Maps old BIGINT IDs to new UUID IDs for migration tracking';

COMMIT;

-- Verification queries
SELECT 'Migration Complete!' as status;

-- Show new table structures
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('catalog_assets', 'data_profiles', 'quality_issues', 'quality_rules', 'quality_results')
AND column_name IN ('id', 'asset_id')
ORDER BY table_name, column_name;