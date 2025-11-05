-- Sync pii_detected flags with actual PII column state
-- This fixes tables marked as having PII when they don't (and vice versa)

BEGIN;

-- 1. Set pii_detected = FALSE for tables with NO PII columns
UPDATE catalog_assets ca
SET pii_detected = false, updated_at = CURRENT_TIMESTAMP
WHERE ca.id IN (
  SELECT ca2.id
  FROM catalog_assets ca2
  LEFT JOIN catalog_columns cc ON cc.asset_id = ca2.id
  WHERE ca2.pii_detected = true
  GROUP BY ca2.id
  HAVING COUNT(cc.id) FILTER (WHERE cc.pii_type IS NOT NULL) = 0
);

SELECT 'Step 1: Cleared pii_detected for tables with no PII' as status, ROW_COUNT() as tables_updated;

-- 2. Set pii_detected = TRUE for tables WITH PII columns
UPDATE catalog_assets ca
SET pii_detected = true, updated_at = CURRENT_TIMESTAMP
WHERE ca.id IN (
  SELECT ca2.id
  FROM catalog_assets ca2
  LEFT JOIN catalog_columns cc ON cc.asset_id = ca2.id
  WHERE ca2.pii_detected = false OR ca2.pii_detected IS NULL
  GROUP BY ca2.id
  HAVING COUNT(cc.id) FILTER (WHERE cc.pii_type IS NOT NULL) > 0
);

SELECT 'Step 2: Set pii_detected for tables with PII' as status, ROW_COUNT() as tables_updated;

-- 3. Verification: Show final state
SELECT
  ca.pii_detected,
  COUNT(DISTINCT ca.id) as table_count,
  COUNT(cc.id) FILTER (WHERE cc.pii_type IS NOT NULL) as total_pii_columns
FROM catalog_assets ca
LEFT JOIN catalog_columns cc ON cc.asset_id = ca.id
GROUP BY ca.pii_detected
ORDER BY ca.pii_detected DESC NULLS LAST;

-- 4. Check for any remaining inconsistencies
SELECT COUNT(DISTINCT ca.id) as inconsistent_tables
FROM catalog_assets ca
LEFT JOIN catalog_columns cc ON cc.asset_id = ca.id
GROUP BY ca.id, ca.pii_detected
HAVING
  (ca.pii_detected = true AND COUNT(cc.id) FILTER (WHERE cc.pii_type IS NOT NULL) = 0)
  OR
  (ca.pii_detected = false AND COUNT(cc.id) FILTER (WHERE cc.pii_type IS NOT NULL) > 0);

COMMIT;
