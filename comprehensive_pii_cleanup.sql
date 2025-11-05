-- ============================================================================
-- Comprehensive PII Cleanup - Remove All False Positives
-- ============================================================================
-- This script removes PII classifications from columns that are NOT actually PII
-- ============================================================================

BEGIN;

-- Step 1: Clear "address" classification from non-address columns
UPDATE catalog_columns
SET
  pii_type = NULL,
  data_classification = NULL,
  is_sensitive = false,
  profile_json = CASE
    WHEN profile_json IS NOT NULL THEN profile_json - 'quality_issues'
    ELSE profile_json
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE
  data_classification = 'address'
  AND column_name IN (
    'address_id',      -- This is an ID, not an address
    'address_type',    -- This is a type (e.g., "billing", "shipping"), not an address
    'city',            -- City alone is not PII (too broad)
    'capacity'         -- This is warehouse capacity, not an address!
  );

-- Step 2: Sync pii_type with data_classification for valid PII columns
UPDATE catalog_columns
SET
  pii_type = data_classification,
  updated_at = CURRENT_TIMESTAMP
WHERE
  data_classification IS NOT NULL
  AND pii_type IS NULL
  AND data_classification IN ('phone', 'date_of_birth', 'address');

-- Step 3: Clear cardinality and other false positives
UPDATE catalog_columns
SET
  pii_type = NULL,
  data_classification = NULL,
  is_sensitive = false,
  profile_json = CASE
    WHEN profile_json IS NOT NULL THEN profile_json - 'quality_issues'
    ELSE profile_json
  END,
  updated_at = CURRENT_TIMESTAMP
WHERE
  column_name IN (
    'cardinality',
    'card_id',
    'card_type',
    'card_status',
    'id_card',
    'business_card'
  )
  AND (pii_type IS NOT NULL OR data_classification IS NOT NULL);

-- Step 4: Show summary of remaining PII columns
SELECT '=== PII Summary by Type ===' as section;
SELECT
  COALESCE(pii_type, data_classification) as pii_classification,
  COUNT(*) as column_count
FROM catalog_columns
WHERE pii_type IS NOT NULL OR data_classification IS NOT NULL
GROUP BY COALESCE(pii_type, data_classification)
ORDER BY column_count DESC;

SELECT '=== All PII Columns (Should Be Valid) ===' as section;
SELECT
  ca.schema_name,
  ca.table_name,
  cc.column_name,
  cc.pii_type,
  cc.data_classification,
  cc.is_sensitive
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.pii_type IS NOT NULL OR cc.data_classification IS NOT NULL
ORDER BY ca.schema_name, ca.table_name, cc.column_name;

COMMIT;

-- ============================================================================
-- Expected Results:
-- ============================================================================
-- ✅ NAME: ~10 columns (first_name, last_name, etc.)
-- ✅ phone: ~6 columns (actual phone number columns)
-- ✅ date_of_birth: ~1 column
-- ✅ address: ~1 column (street_address only)
-- ❌ cardinality: 0 (removed)
-- ❌ address_id, address_type, city, capacity: 0 (removed)
-- ============================================================================
