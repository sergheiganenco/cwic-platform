-- ============================================================================
-- CLEAN ALL TEST/DEMO QUALITY DATA
-- This removes ALL quality rules, results, and issues to start fresh with REAL data
-- ============================================================================

BEGIN;

-- 1. Delete all quality scan results (these reference quality_results, so delete first)
DELETE FROM quality_scan_results WHERE id IS NOT NULL;
RAISE NOTICE 'Deleted quality_scan_results';

-- 2. Delete all quality results (all are linked to fake rules)
DELETE FROM quality_results WHERE id IS NOT NULL;
RAISE NOTICE 'Deleted quality_results';

-- 3. Delete all quality issues (test data)
DELETE FROM quality_issues WHERE id IS NOT NULL;
RAISE NOTICE 'Deleted quality_issues';

-- 4. Delete all quality rules (ALL have asset_id = NULL, so they're all fake)
DELETE FROM quality_rules WHERE id IS NOT NULL;
RAISE NOTICE 'Deleted quality_rules';

-- Verify cleanup
SELECT
  (SELECT COUNT(*) FROM quality_rules) as rules_remaining,
  (SELECT COUNT(*) FROM quality_results) as results_remaining,
  (SELECT COUNT(*) FROM quality_issues) as issues_remaining,
  (SELECT COUNT(*) FROM quality_scan_results) as scan_results_remaining;

COMMIT;

-- Display what we have to work with
SELECT
  'Real Assets Available:' as status,
  COUNT(*) as count,
  COUNT(DISTINCT database_name) as databases,
  COUNT(DISTINCT table_name) as tables
FROM catalog_assets;

SELECT
  database_name,
  COUNT(*) as table_count
FROM catalog_assets
GROUP BY database_name
ORDER BY database_name;
