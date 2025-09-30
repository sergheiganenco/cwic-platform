-- 001_catalog_schema.sql
CREATE TABLE IF NOT EXISTS catalog_assets (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  datasource_id BIGINT NOT NULL,
  asset_type TEXT NOT NULL,          -- 'table' | 'view'
  schema_name TEXT NOT NULL,
  table_name  TEXT NOT NULL,
  row_count BIGINT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, datasource_id, asset_type, schema_name, table_name)
);

CREATE TABLE IF NOT EXISTS catalog_columns (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  column_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  is_nullable BOOLEAN,
  ordinal INT,
  description TEXT,
  profile_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (asset_id, column_name)
);

CREATE TABLE IF NOT EXISTS catalog_lineage (
  id BIGSERIAL PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  from_asset_id BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  to_asset_id   BIGINT NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  edge_type TEXT NOT NULL DEFAULT 'derived',
  created_at TIMESTAMPTZ DEFAULT now()
);
