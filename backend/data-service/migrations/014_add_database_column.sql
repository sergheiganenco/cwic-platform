-- Migration: Add database_name column to catalog_assets
-- Purpose: Support database-level filtering for server-level connections
-- Date: 2025-10-18

-- Add database_name column to catalog_assets
ALTER TABLE catalog_assets
ADD COLUMN IF NOT EXISTS database_name TEXT;

-- Create index for faster filtering by database
CREATE INDEX IF NOT EXISTS idx_catalog_assets_database
ON catalog_assets(database_name);

-- Create index for combined datasource + database filtering
CREATE INDEX IF NOT EXISTS idx_catalog_assets_ds_db
ON catalog_assets(datasource_id, database_name);

-- For PostgreSQL assets, extract database from connection or default to 'postgres'
-- For SQL Server, we'll populate this during sync
UPDATE catalog_assets ca
SET database_name = COALESCE(
  (SELECT (connection_config->>'database')::text
   FROM data_sources ds
   WHERE ds.id = ca.datasource_id
   LIMIT 1),
  'postgres'
)
WHERE database_name IS NULL;

-- Add comment
COMMENT ON COLUMN catalog_assets.database_name IS 'Database name for the asset (important for server-level connections with multiple databases)';
