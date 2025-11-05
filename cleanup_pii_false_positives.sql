-- ============================================================================
-- Cleanup PII False Positives - Boolean Fields and Metadata
-- ============================================================================
-- Remove PII classification from columns that are metadata or boolean flags
-- ============================================================================

BEGIN;

-- Step 1: Clear PII from boolean/confirmation columns
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
  (pii_type IS NOT NULL OR data_classification IS NOT NULL)
  AND (
    -- Boolean confirmation fields
    column_name ILIKE '%confirmed' OR
    column_name ILIKE '%verified' OR
    column_name ILIKE '%validation' OR
    column_name ILIKE '%valid' OR

    -- Status/Type fields
    column_name ILIKE '%status' OR
    column_name ILIKE '%type' OR
    column_name ILIKE '%kind' OR
    column_name ILIKE '%category' OR

    -- Metadata fields
    column_name ILIKE '%created%' OR
    column_name ILIKE '%updated%' OR
    column_name ILIKE '%modified%' OR
    column_name ILIKE '%deleted%' OR

    -- ID fields (UUIDs, not actual PII numbers)
    (column_name ILIKE '%_id' AND data_type IN ('uuid', 'uniqueidentifier', 'char', 'varchar')) OR

    -- Counts, flags, booleans
    column_name ILIKE '%count' OR
    column_name ILIKE '%flag' OR
    column_name ILIKE '%enabled' OR
    column_name ILIKE '%disabled' OR

    -- Expiry/validity dates (not birthdates)
    column_name ILIKE '%expiry%' OR
    column_name ILIKE '%expiration%' OR
    column_name ILIKE '%expires%' OR
    column_name ILIKE '%valid_until%' OR

    -- IP-related metadata (not actual IPs)
    column_name ILIKE '%ip_allowed%' OR
    column_name ILIKE '%ip_blocked%' OR
    column_name ILIKE '%ip_whitelist%' OR
    column_name ILIKE '%ip_blacklist%' OR

    -- Card-related metadata (not card numbers)
    column_name ILIKE 'cardinality%' OR
    column_name ILIKE '%card_type%' OR
    column_name ILIKE '%card_status%' OR
    column_name ILIKE '%card_id%' OR

    -- Phone-related metadata (not phone numbers)
    column_name ILIKE '%phone_type%' OR
    column_name ILIKE '%phone_verified%'
  );

-- Step 2: Show what was cleaned
SELECT
  '=== Cleaned False Positive Columns ===' as section,
  COUNT(*) as columns_cleaned
FROM catalog_columns
WHERE
  pii_type IS NULL
  AND data_classification IS NULL
  AND (
    column_name ILIKE '%confirmed' OR
    column_name ILIKE '%verified' OR
    column_name ILIKE '%status' OR
    column_name ILIKE '%type'
  );

-- Step 3: Show current PII column summary
SELECT '=== Current PII Columns by Type ===' as section;
SELECT
  COALESCE(pii_type, data_classification) as pii_type,
  COUNT(*) as column_count
FROM catalog_columns
WHERE pii_type IS NOT NULL OR data_classification IS NOT NULL
GROUP BY COALESCE(pii_type, data_classification)
ORDER BY column_count DESC;

COMMIT;
