-- backend/data-service/migrations/017_add_system_database_filter.sql
-- Add function to identify system databases globally

-- Function to check if a database is a system database
CREATE OR REPLACE FUNCTION is_system_database(db_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Filter out SQL Server, PostgreSQL, and MySQL system databases
  RETURN LOWER(db_name) IN (
    'master',           -- SQL Server system db
    'tempdb',           -- SQL Server temp db
    'model',            -- SQL Server template db
    'msdb',             -- SQL Server agent db
    'sys',              -- System schema
    'information_schema', -- ANSI standard schema
    'performance_schema', -- MySQL performance db
    'mysql'             -- MySQL system db
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add index to catalog_assets for database_name filtering
CREATE INDEX IF NOT EXISTS idx_catalog_assets_database_name
ON catalog_assets(database_name)
WHERE database_name IS NOT NULL;

-- Add comment
COMMENT ON FUNCTION is_system_database(TEXT) IS 'Returns true if the database name is a system database (SQL Server, PostgreSQL, or MySQL)';
