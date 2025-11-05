-- ============================================================================
-- RESET ALL PII AND START FRESH
-- ============================================================================
-- This script:
-- 1. Clears ALL PII classifications from ALL columns
-- 2. Resolves all PII-related quality issues
-- 3. Clears PII exclusions
-- 4. Prepares for a fresh PII scan with curated hints
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Show current PII state
-- ============================================================================

SELECT 'BEFORE RESET - PII Summary' as status;

-- Count PII columns by type
SELECT
  pii_type,
  COUNT(*) as column_count,
  COUNT(DISTINCT cc.asset_id) as table_count
FROM catalog_columns cc
WHERE pii_type IS NOT NULL
GROUP BY pii_type
ORDER BY column_count DESC;

-- Total count
SELECT
  'Total PII Columns' as metric,
  COUNT(*) as count
FROM catalog_columns
WHERE pii_type IS NOT NULL;

-- ============================================================================
-- STEP 2: Resolve all PII-related quality issues
-- ============================================================================

SELECT 'Resolving PII-related quality issues...' as status;

-- Mark all PII violation issues as resolved
UPDATE quality_issues
SET
  status = 'resolved',
  resolved_at = NOW(),
  resolution_notes = 'Auto-resolved: Full PII reset and rescan'
WHERE title LIKE '%PII%'
   OR title LIKE '%Unencrypted%'
   OR description LIKE '%PII%'
   OR dimension = 'security'
   AND status IN ('open', 'acknowledged');

-- Show count of resolved issues
SELECT
  'PII Issues Resolved' as metric,
  COUNT(*) as count
FROM quality_issues
WHERE resolution_notes = 'Auto-resolved: Full PII reset and rescan';

-- ============================================================================
-- STEP 3: Clear ALL PII classifications
-- ============================================================================

SELECT 'Clearing ALL PII classifications...' as status;

-- Clear PII from all columns (including user data!)
UPDATE catalog_columns
SET
  pii_type = NULL,
  is_sensitive = false,
  data_classification = NULL
WHERE pii_type IS NOT NULL;

-- Show count of cleared columns
SELECT
  'Columns Cleared' as metric,
  (SELECT COUNT(*) FROM catalog_columns WHERE pii_type IS NULL AND is_sensitive = false) as count;

-- ============================================================================
-- STEP 4: Clear PII exclusions (fresh start)
-- ============================================================================

SELECT 'Clearing PII exclusions...' as status;

-- Delete all PII exclusions
DELETE FROM pii_exclusions;

SELECT
  'Exclusions Cleared' as metric,
  (SELECT COUNT(*) FROM pii_exclusions) as count;

-- ============================================================================
-- STEP 5: Verify clean slate
-- ============================================================================

SELECT 'AFTER RESET - Verification' as status;

-- Should be 0
SELECT
  'Remaining PII Columns' as metric,
  COUNT(*) as count
FROM catalog_columns
WHERE pii_type IS NOT NULL;

-- Should be 0
SELECT
  'Open PII Issues' as metric,
  COUNT(*) as count
FROM quality_issues
WHERE (title LIKE '%PII%' OR description LIKE '%PII%')
  AND status IN ('open', 'acknowledged');

-- Should be 0
SELECT
  'PII Exclusions' as metric,
  COUNT(*) as count
FROM pii_exclusions;

-- ============================================================================
-- STEP 6: Show enabled PII rules ready for scanning
-- ============================================================================

SELECT 'Enabled PII Rules (Ready to Scan)' as status;

SELECT
  pii_type,
  display_name,
  sensitivity_level,
  requires_encryption,
  requires_masking,
  CASE
    WHEN requires_encryption = false AND requires_masking = false THEN 'Monitoring Mode'
    ELSE 'Protection Required'
  END as mode,
  array_length(column_name_hints, 1) as hint_count
FROM pii_rule_definitions
WHERE is_enabled = true
ORDER BY
  CASE sensitivity_level
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  display_name;

-- ============================================================================
-- STEP 7: Show databases that will be scanned
-- ============================================================================

SELECT 'Databases Ready for Scanning' as status;

SELECT
  ds.name as data_source_name,
  ds.type as data_source_type,
  COUNT(DISTINCT ca.database_name) as database_count,
  COUNT(DISTINCT ca.id) as table_count,
  COUNT(DISTINCT cc.id) as column_count
FROM data_sources ds
LEFT JOIN catalog_assets ca ON ca.datasource_id::text = ds.id::text
LEFT JOIN catalog_columns cc ON cc.asset_id = ca.id
WHERE ca.database_name IS NOT NULL
  AND NOT is_system_database(ca.database_name)
GROUP BY ds.id, ds.name, ds.type
ORDER BY ds.name;

COMMIT;

-- ============================================================================
-- SUMMARY
-- ============================================================================
-- After running this script:
-- ✅ All PII classifications cleared (pii_type = NULL)
-- ✅ All PII quality issues resolved
-- ✅ All PII exclusions removed
-- ✅ Ready for fresh scan with System PII rules
-- ✅ Curated hints (220+) ready to use
--
-- Next Steps:
-- 1. Run: POST /api/pii-rules/rescan-all to trigger fresh scan
-- 2. Or run each System rule individually via PII Settings UI
-- 3. Monitor results in Data Quality → Profiling tab
-- ============================================================================
