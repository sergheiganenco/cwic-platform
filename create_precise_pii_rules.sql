-- ============================================================================
-- Create Precise PII Rules - Best-in-Market Accuracy
-- ============================================================================
-- This creates the most precise PII detection rules that only match
-- actual person names, not product names, department names, or metadata
-- ============================================================================

BEGIN;

-- Step 1: Update Person Name rule to be ULTRA-SPECIFIC
UPDATE pii_rule_definitions
SET
  column_name_hints = ARRAY[
    -- Only match columns that clearly contain PERSON names
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
    -- Only when explicitly about people
    'customer_name',    -- ONLY if it's actually customer's name, not customer company
    'employee_name',
    'manager_name',     -- ONLY if it's manager's name, not manager role
    'contact_name',     -- ONLY if it's a person contact, not company contact
    'person_name',
    'user_full_name',
    'legal_name',
    'owner_name',
    'driver_name',
    'passenger_name',
    'patient_name',
    'student_name',
    'teacher_name',
    'author_name',
    'creator_name'
  ],
  -- Add regex pattern to VALIDATE it's actually a person name
  regex_pattern = '^[A-Z][a-z]+(\\s+[A-Z][a-z]+)*$',
  description = 'Person''s name (first, last, or full name). Does NOT include product names, company names, or system object names.',
  updated_at = CURRENT_TIMESTAMP
WHERE pii_type = 'NAME' OR display_name = 'Person Name';

-- Step 2: Clear PII from ALL non-person name columns
UPDATE catalog_columns
SET
  pii_type = NULL,
  data_classification = NULL,
  is_sensitive = false,
  updated_at = CURRENT_TIMESTAMP
WHERE (pii_type = 'NAME' OR data_classification = 'NAME')
  AND (
    -- System metadata (definitely NOT person names)
    column_name ILIKE '%database%name%'
    OR column_name ILIKE '%schema%name%'
    OR column_name ILIKE '%table%name%'
    OR column_name ILIKE '%column%name%'
    OR column_name ILIKE '%object%name%'
    OR column_name ILIKE '%constraint%name%'
    OR column_name ILIKE '%index%name%'
    OR column_name ILIKE '%view%name%'
    OR column_name ILIKE '%procedure%name%'
    OR column_name ILIKE '%function%name%'
    OR column_name ILIKE '%qualified%name%'
    OR column_name ILIKE '%source%name%'
    OR column_name ILIKE '%datasource%name%'

    -- Business entities (NOT person names)
    OR column_name IN (
      'product_name',
      'category_name',
      'department_name',
      'warehouse_name',
      'territory_name',
      'method_name',
      'promotion_name',
      'search_name',
      'snapshot_name',
      'company_name',
      'country_name',
      'elastic_pool_name',
      'default_database_name',
      'default_language_name',
      'username',
      'UserName',
      'NormalizedUserName',
      'NormalizedName',
      'ProviderDisplayName',
      'column_names',
      'name',
      'Name',
      'description',
      'Description'
    )
  );

COMMIT;

-- Verify the fix
SELECT '=== Updated PII Rule ===' as section;
SELECT pii_type, display_name, array_length(column_name_hints, 1) as hint_count, regex_pattern
FROM pii_rule_definitions WHERE pii_type = 'NAME';

SELECT '=== Legitimate Person Name Columns (Should Only Be These) ===' as section;
SELECT ca.schema_name, ca.table_name, cc.column_name, 'Person Name PII' as classification
FROM catalog_columns cc
JOIN catalog_assets ca ON cc.asset_id = ca.id
WHERE cc.pii_type = 'NAME'
ORDER BY ca.schema_name, ca.table_name, cc.column_name;

SELECT '=== Summary ===' as section;
SELECT
  COUNT(*) FILTER (WHERE pii_type = 'NAME') as person_name_columns,
  COUNT(*) FILTER (WHERE pii_type IS NOT NULL) as total_pii_columns,
  COUNT(*) as total_columns
FROM catalog_columns;
