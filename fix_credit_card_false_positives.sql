-- ============================================================================
-- Fix Credit Card False Positives
-- ============================================================================
-- The "cardinality" column is being marked as credit_card PII because
-- it contains the substring "card". This is wrong - cardinality is a
-- database relationship term (one-to-one, one-to-many, etc.)
-- ============================================================================

BEGIN;

-- Step 1: Update credit_card rule to use EXACT, SPECIFIC hints
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'credit_card',
    'credit_card_number',
    'creditcard',
    'creditcardnumber',
    'card_number',
    'cardnumber',
    'cc_number',
    'ccnumber',
    'cc_num',
    'payment_card',
    'payment_card_number',
    'paymentcard',
    'debit_card',
    'debit_card_number'
  ],
  -- Add regex pattern to validate it's actually a credit card number
  regex_pattern = '^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$',
  description = 'Credit card number (16 digits). Does NOT include database cardinality or other non-payment fields.',
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'credit_card';

-- Step 2: Clear credit_card classification from cardinality column
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
WHERE column_name = 'cardinality'
  AND (pii_type = 'credit_card' OR data_classification = 'credit_card');

-- Step 3: Clear any other false positives (columns with "card" but not actual credit cards)
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
  (pii_type = 'credit_card' OR data_classification = 'credit_card')
  AND column_name IN (
    'cardinality',
    'card_id',           -- This is an ID, not a card number
    'id_card',           -- This is an ID card, not credit card
    'business_card',     -- Business card, not credit card
    'card_type',         -- Type of card, not the number
    'card_status',       -- Status of card, not the number
    'discount_card'      -- Discount/loyalty card, not credit card
  );

-- Step 4: Resolve quality issues for false positives
UPDATE quality_issues
SET
  status = 'resolved',
  resolved_at = CURRENT_TIMESTAMP,
  remediation_plan = 'False positive: Column name contains "card" but is not a credit card number (e.g., cardinality, card_id, card_type).'
WHERE
  status IN ('open', 'acknowledged')
  AND (title ILIKE '%credit%card%' OR title ILIKE '%cardinality%');

-- Step 5: Show summary
SELECT '=== Credit Card Rule Updated ===' as section;
SELECT pii_type, display_name, array_length(column_name_hints, 1) as hint_count, regex_pattern
FROM pii_rule_definitions WHERE pii_type = 'credit_card';

SELECT '=== Cardinality Column Cleaned ===' as section;
SELECT ca.table_name, cc.column_name, cc.pii_type, cc.data_classification, cc.is_sensitive
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.column_name = 'cardinality';

SELECT '=== Remaining Credit Card Columns ===' as section;
SELECT ca.schema_name, ca.table_name, cc.column_name
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.pii_type = 'credit_card' OR cc.data_classification = 'credit_card'
ORDER BY ca.schema_name, ca.table_name;

COMMIT;
