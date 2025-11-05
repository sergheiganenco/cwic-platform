-- ============================================================================
-- Fix PII Rules - Remove System Metadata Column Hints
-- ============================================================================
-- This script fixes the "Person Name" PII rule by removing generic hints
-- that incorrectly match system metadata columns (schema_name, table_name, etc.)
-- ============================================================================

BEGIN;

-- Step 1: Update the "Person Name" rule to ONLY include actual person name columns
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    'first_name',
    'last_name',
    'middle_name',
    'full_name',
    'firstname',
    'lastname',
    'middlename',
    'fullname',
    'given_name',
    'family_name',
    'surname',
    'forename',
    'customer_name',
    'employee_name',
    'manager_name',
    'contact_name',
    'person_name',
    'user_full_name',
    'display_name',
    'legal_name'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'NAME' OR display_name = 'Person Name';

-- Step 2: Clear PII markers from system metadata columns
-- These are NOT PII - they are system column names
UPDATE catalog_columns cc
SET
  pii_type = NULL,
  data_classification = NULL,
  is_sensitive = false,
  updated_at = CURRENT_TIMESTAMP
FROM catalog_assets ca
WHERE cc.asset_id = ca.id
  AND (cc.pii_type = 'NAME' OR cc.data_classification = 'NAME')
  AND cc.column_name IN (
    -- System metadata columns (NOT PII)
    'database_name',
    'schema_name',
    'table_name',
    'column_name',
    'object_name',
    'constraint_name',
    'instance_name',
    'type_name',
    'procedure_name',
    'function_name',
    'view_name',
    'index_name',
    'trigger_name',
    'sequence_name',
    'fully_qualified_name',
    -- Generic 'name' fields that need context
    'name',
    'Name',
    'NormalizedName',
    'NormalizedUserName',
    'ProviderDisplayName',
    'UserName',
    -- Description is not a person name
    'description',
    'Description'
  );

-- Step 3: Close quality issues related to false PII detections on metadata columns
UPDATE quality_issues
SET
  status = 'resolved',
  resolved_at = CURRENT_TIMESTAMP,
  remediation_plan = 'False positive - System metadata column incorrectly marked as PII. Fixed by updating PII rule configuration.'
WHERE
  title LIKE '%PII%'
  AND (
    title LIKE '%schema_name%'
    OR title LIKE '%table_name%'
    OR title LIKE '%database_name%'
    OR title LIKE '%column_name%'
    OR title LIKE '%description%'
  )
  AND status IN ('open', 'acknowledged');

-- Step 4: Show summary of changes
SELECT
  '=== PII Rule Updated ===' as status,
  pii_type,
  display_name,
  array_length(column_name_hints, 1) as hint_count,
  column_name_hints
FROM pii_rule_definitions
WHERE pii_type = 'NAME';

SELECT
  '=== Columns Cleaned ===' as status,
  ca.datasource_name,
  ca.schema_name,
  ca.table_name,
  cc.column_name,
  'PII marker removed' as action
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.pii_type IS NULL
  AND cc.data_classification IS NULL
  AND cc.column_name IN (
    'database_name', 'schema_name', 'table_name', 'column_name',
    'name', 'description'
  )
LIMIT 20;

SELECT
  '=== Actual PII Columns (Kept) ===' as status,
  ca.datasource_name,
  ca.schema_name,
  ca.table_name,
  cc.column_name,
  cc.pii_type,
  'Legitimate PII' as note
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.pii_type = 'NAME'
ORDER BY ca.schema_name, ca.table_name, cc.column_name;

COMMIT;

-- ============================================================================
-- Results Summary
-- ============================================================================
-- The "Person Name" rule now ONLY matches actual person name columns:
--   ✅ first_name, last_name, full_name
--   ✅ customer_name, employee_name, manager_name
--   ❌ schema_name, table_name, database_name (excluded)
--   ❌ name, description (excluded - too generic)
--
-- System metadata columns have been cleared of PII markers.
-- Quality issues for false positives have been resolved.
--
-- Next step: Rescan data with updated rules to ensure accuracy.
-- ============================================================================
