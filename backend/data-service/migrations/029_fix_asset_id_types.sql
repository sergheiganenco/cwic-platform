-- Migration: Fix asset_id type mismatch in quality tables
-- Issue: quality_results and quality_issues use UUID for asset_id,
--        but catalog_assets and quality_rules use bigint
-- Solution: Change quality_results and quality_issues to use bigint

-- Step 1: Drop foreign key constraints
ALTER TABLE quality_results DROP CONSTRAINT IF EXISTS quality_results_asset_id_fkey;
ALTER TABLE quality_issues DROP CONSTRAINT IF EXISTS quality_issues_asset_id_fkey;

-- Step 2: Change column types to bigint
-- Use CASE to handle NULL values safely
ALTER TABLE quality_results
  ALTER COLUMN asset_id TYPE bigint
  USING CASE
    WHEN asset_id IS NULL THEN NULL
    WHEN asset_id::text ~ '^\d+$' THEN asset_id::text::bigint
    ELSE NULL
  END;

ALTER TABLE quality_issues
  ALTER COLUMN asset_id TYPE bigint
  USING CASE
    WHEN asset_id IS NULL THEN NULL
    WHEN asset_id::text ~ '^\d+$' THEN asset_id::text::bigint
    ELSE NULL
  END;

-- Step 3: Re-add foreign key constraints with CASCADE
ALTER TABLE quality_results
  ADD CONSTRAINT quality_results_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

ALTER TABLE quality_issues
  ADD CONSTRAINT quality_issues_asset_id_fkey
  FOREIGN KEY (asset_id) REFERENCES catalog_assets(id) ON DELETE CASCADE;

-- Step 4: Add indexes for performance (if not exist)
CREATE INDEX IF NOT EXISTS idx_quality_results_asset_id ON quality_results(asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_issues_asset_id ON quality_issues(asset_id);

-- Step 5: Update quality_rules to populate missing data_source_id
-- Many rules have NULL data_source_id which causes "Data source ID required" errors
UPDATE quality_rules qr
SET data_source_id = ca.datasource_id
FROM catalog_assets ca
WHERE qr.asset_id = ca.id
AND qr.data_source_id IS NULL
AND qr.rule_type IN ('sql', 'threshold', 'pattern');

-- Verification queries
DO $$
DECLARE
  results_type text;
  issues_type text;
  rules_updated integer;
BEGIN
  -- Check column types
  SELECT data_type INTO results_type
  FROM information_schema.columns
  WHERE table_name = 'quality_results' AND column_name = 'asset_id';

  SELECT data_type INTO issues_type
  FROM information_schema.columns
  WHERE table_name = 'quality_issues' AND column_name = 'asset_id';

  -- Check how many rules were updated
  SELECT COUNT(*) INTO rules_updated
  FROM quality_rules
  WHERE data_source_id IS NOT NULL;

  RAISE NOTICE 'Migration complete!';
  RAISE NOTICE '  quality_results.asset_id type: %', results_type;
  RAISE NOTICE '  quality_issues.asset_id type: %', issues_type;
  RAISE NOTICE '  Rules with data_source_id: %', rules_updated;
END $$;
