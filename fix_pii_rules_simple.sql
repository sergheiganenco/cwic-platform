-- ============================================================================
-- Fix PII Rules - Remove System Metadata Column Hints
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
    'legal_name'
  ],
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'NAME' OR display_name = 'Person Name';

-- Step 2: Clear PII markers from system metadata columns
UPDATE catalog_columns
SET
  pii_type = NULL,
  data_classification = NULL,
  is_sensitive = false,
  updated_at = CURRENT_TIMESTAMP
WHERE (pii_type = 'NAME' OR data_classification = 'NAME')
  AND column_name IN (
    'database_name',
    'schema_name',
    'table_name',
    'column_name',
    'object_name',
    'constraint_name',
    'instance_name',
    'type_name',
    'name',
    'Name',
    'NormalizedName',
    'NormalizedUserName',
    'ProviderDisplayName',
    'UserName',
    'description',
    'Description'
  );

-- Step 3: Close quality issues for false PII detections
UPDATE quality_issues
SET
  status = 'resolved',
  resolved_at = CURRENT_TIMESTAMP
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

COMMIT;

-- Show summary
SELECT 'PII Rule updated successfully' as status, pii_type, display_name, array_length(column_name_hints, 1) as hint_count
FROM pii_rule_definitions WHERE pii_type = 'NAME';

SELECT 'Cleaned ' || COUNT(*) || ' columns' as summary FROM catalog_columns WHERE pii_type IS NULL AND column_name IN ('schema_name', 'table_name', 'database_name', 'description');

SELECT 'Remaining PII columns: ' || COUNT(*) as summary FROM catalog_columns WHERE pii_type = 'NAME';
