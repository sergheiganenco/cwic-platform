-- backend/data-service/migrations/022_add_postgres_system_db.sql
-- Update system database filter to include PostgreSQL system databases

-- Update function to include PostgreSQL system databases
CREATE OR REPLACE FUNCTION is_system_database(db_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Filter out SQL Server, PostgreSQL, and MySQL system databases
  RETURN LOWER(db_name) IN (
    'postgres',         -- PostgreSQL default system db
    'template0',        -- PostgreSQL template (read-only)
    'template1',        -- PostgreSQL template
    'master',           -- SQL Server system db
    'tempdb',           -- SQL Server temp db
    'model',            -- SQL Server template db
    'msdb',             -- SQL Server agent db
    'sys',              -- System schema
    'information_schema', -- ANSI standard schema
    'performance_schema', -- MySQL performance db
    'mysql',            -- MySQL system db
    'pg_catalog',       -- PostgreSQL system catalog
    'pg_toast'          -- PostgreSQL TOAST storage
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update comment
COMMENT ON FUNCTION is_system_database(TEXT) IS 'Returns true if the database name is a system database (SQL Server, PostgreSQL, or MySQL) including postgres, template0, and template1';