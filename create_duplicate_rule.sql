-- Create a duplicate detection rule for Role.Name column
INSERT INTO quality_rules (
  id,
  name,
  description,
  rule_type,
  dimension,
  severity,
  expression,
  data_source_id,
  asset_id,
  table_name,
  column_name,
  enabled,
  tags,
  created_by,
  updated_by,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'TEST: Duplicate Detection - Role.Name',
  'Detects duplicate values in the Name column of the Role table. Duplicates indicate data quality issues that need attention.',
  'sql',
  'uniqueness',
  'high',
  'SELECT Name as duplicate_value, COUNT(*) as occurrence_count, STRING_AGG(CAST(Id AS VARCHAR), '', '') as duplicate_ids FROM [Feya_DB].dbo.Role WHERE Name IS NOT NULL GROUP BY Name HAVING COUNT(*) > 1',
  'af910adf-c7c1-4573-9eec-93f05f0970b7'::uuid, -- Azure Feya data source
  ca.id, -- Role table asset ID
  'dbo.Role',
  'Name',
  true,
  ARRAY['test', 'uniqueness', 'duplicates'],
  'system',
  'system',
  NOW(),
  NOW()
FROM catalog_assets ca
WHERE ca.table_name = 'Role'
  AND ca.schema_name = 'dbo'
  AND ca.database_name = 'Feya_DB'
  AND ca.datasource_id = 'af910adf-c7c1-4573-9eec-93f05f0970b7'::uuid
LIMIT 1;

-- Verify the rule was created
SELECT
  id,
  name,
  description,
  severity,
  dimension,
  enabled,
  table_name,
  column_name
FROM quality_rules
WHERE name LIKE '%TEST: Duplicate%'
ORDER BY created_at DESC
LIMIT 1;
