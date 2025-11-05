-- Sync catalog_objects to assets table
-- This script copies discovered catalog objects into the assets table for quality monitoring

-- First, insert tables and views as table-level assets
INSERT INTO assets (
  name,
  type,
  data_source_id,
  schema_name,
  table_name,
  description,
  classification,
  tags,
  metadata,
  created_at,
  updated_at,
  last_scanned_at
)
SELECT DISTINCT
  co.name,
  CASE
    WHEN co.object_type = 'stored_procedure' THEN 'procedure'
    WHEN co.object_type = 'materialized_view' THEN 'view'
    ELSE co.object_type
  END as type,
  co.datasource_id,
  cs.name as schema_name,
  co.name as table_name,
  co.description,
  CASE
    WHEN co.classification = 'Public' THEN 'public'
    WHEN co.classification = 'Internal' THEN 'internal'
    WHEN co.classification = 'Confidential' THEN 'confidential'
    WHEN co.classification = 'Sensitive' THEN 'restricted'
    WHEN co.classification = 'PII' THEN 'restricted'
    ELSE 'public'
  END as classification,
  COALESCE(co.tags, ARRAY[]::text[]) as tags,
  jsonb_build_object(
    'row_count', co.row_count,
    'column_count', co.column_count,
    'quality_score', co.quality_score,
    'fully_qualified_name', co.fully_qualified_name,
    'is_certified', co.is_certified,
    'popularity_score', co.popularity_score
  ) as metadata,
  co.created_at,
  co.updated_at,
  co.discovered_at as last_scanned_at
FROM catalog_objects co
JOIN catalog_schemas cs ON cs.id = co.schema_id
WHERE co.object_type IN ('table', 'view', 'materialized_view', 'stored_procedure', 'function')
ON CONFLICT (name, type, data_source_id, schema_name, table_name)
DO UPDATE SET
  description = EXCLUDED.description,
  classification = EXCLUDED.classification,
  tags = EXCLUDED.tags,
  metadata = EXCLUDED.metadata,
  updated_at = EXCLUDED.updated_at,
  last_scanned_at = EXCLUDED.last_scanned_at;

-- Insert columns from catalog_columns if the table exists and has data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'catalog_columns') THEN
    INSERT INTO assets (
      name,
      type,
      data_source_id,
      schema_name,
      table_name,
      column_name,
      description,
      data_type,
      is_nullable,
      is_primary_key,
      classification,
      tags,
      metadata,
      created_at,
      updated_at,
      last_scanned_at
    )
    SELECT DISTINCT
      cc.name as name,
      'column' as type,
      co.datasource_id,
      cs.name as schema_name,
      co.name as table_name,
      cc.name as column_name,
      cc.description,
      cc.data_type,
      COALESCE(cc.is_nullable, true) as is_nullable,
      COALESCE(cc.is_primary_key, false) as is_primary_key,
      CASE
        WHEN cc.classification = 'Public' THEN 'public'
        WHEN cc.classification = 'Internal' THEN 'internal'
        WHEN cc.classification = 'Confidential' THEN 'confidential'
        WHEN cc.classification = 'Sensitive' THEN 'restricted'
        WHEN cc.classification = 'PII' THEN 'restricted'
        ELSE 'public'
      END as classification,
      COALESCE(cc.tags, ARRAY[]::text[]) as tags,
      jsonb_build_object(
        'sensitivity', cc.sensitivity,
        'contains_pii', cc.contains_pii,
        'sample_values', cc.sample_values,
        'fully_qualified_name', co.fully_qualified_name || '.' || cc.name
      ) as metadata,
      cc.created_at,
      cc.updated_at,
      cc.discovered_at as last_scanned_at
    FROM catalog_columns cc
    JOIN catalog_objects co ON co.id = cc.table_id
    JOIN catalog_schemas cs ON cs.id = co.schema_id
    WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'catalog_columns' AND column_name = 'table_id')
    ON CONFLICT (name, type, data_source_id, schema_name, table_name, column_name)
    DO UPDATE SET
      description = EXCLUDED.description,
      data_type = EXCLUDED.data_type,
      is_nullable = EXCLUDED.is_nullable,
      is_primary_key = EXCLUDED.is_primary_key,
      classification = EXCLUDED.classification,
      tags = EXCLUDED.tags,
      metadata = EXCLUDED.metadata,
      updated_at = EXCLUDED.updated_at,
      last_scanned_at = EXCLUDED.last_scanned_at;
  END IF;
END $$;

-- Display summary
SELECT
  'Sync completed!' as status,
  COUNT(*) as total_assets,
  COUNT(*) FILTER (WHERE type = 'table') as tables,
  COUNT(*) FILTER (WHERE type = 'view') as views,
  COUNT(*) FILTER (WHERE type = 'column') as columns,
  COUNT(*) FILTER (WHERE type = 'procedure') as procedures,
  COUNT(*) FILTER (WHERE type = 'function') as functions
FROM assets;
