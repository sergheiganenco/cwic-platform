-- 105_catalog_enhancements.sql
BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure missing columns on catalog_assets
ALTER TABLE catalog_assets
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS owner text,
  ADD COLUMN IF NOT EXISTS quality text CHECK (quality IN ('low','medium','high') OR quality IS NULL),
  ADD COLUMN IF NOT EXISTS classification text CHECK (classification IN ('public','internal','confidential','restricted') OR classification IS NULL),
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Glossary
CREATE TABLE IF NOT EXISTS catalog_glossary_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  synonyms text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalog_asset_terms (
  asset_id uuid NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES catalog_glossary_terms(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (asset_id, term_id)
);

-- Profiling
CREATE TABLE IF NOT EXISTS catalog_profile_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued','running','completed','failed')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  stats jsonb DEFAULT '{}'::jsonb,
  error text
);

CREATE TABLE IF NOT EXISTS catalog_column_profiles (
  asset_id uuid NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  column_name text NOT NULL,
  null_frac real,
  distinct_frac real,
  min_value text,
  max_value text,
  avg_length real,
  sample_values jsonb,
  inferred_type text,
  pii_type text,         -- 'email','ssn','credit_card', etc
  pattern text,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (asset_id, column_name)
);

-- Searching (FTS + trigram)
ALTER TABLE catalog_assets
  ADD COLUMN IF NOT EXISTS search tsvector;

CREATE OR REPLACE FUNCTION catalog_assets_fts_update() RETURNS trigger AS $$
BEGIN
  NEW.search :=
    setweight(to_tsvector('simple', coalesce(NEW.display_name,'')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.schema_name,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.table_name,'')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description,'')), 'C') ||
    setweight(to_tsvector('simple', array_to_string(coalesce(NEW.tags,'{}'::text[]),' ')), 'C') ||
    setweight(to_tsvector('simple', coalesce(NEW.owner,'')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_catalog_assets_fts ON catalog_assets;
CREATE TRIGGER trg_catalog_assets_fts
BEFORE INSERT OR UPDATE OF display_name, schema_name, table_name, description, tags, owner
ON catalog_assets FOR EACH ROW EXECUTE FUNCTION catalog_assets_fts_update();

CREATE INDEX IF NOT EXISTS idx_catalog_assets_fts ON catalog_assets USING GIN (search);
CREATE INDEX IF NOT EXISTS idx_catalog_assets_name_trgm ON catalog_assets USING GIN (table_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_catalog_assets_disp_trgm ON catalog_assets USING GIN (display_name gin_trgm_ops);

-- Light lineage table if not already
CREATE TABLE IF NOT EXISTS catalog_edges (
  upstream_asset_id uuid REFERENCES catalog_assets(id) ON DELETE CASCADE,
  downstream_asset_id uuid REFERENCES catalog_assets(id) ON DELETE CASCADE,
  edge_type text, -- 'fk','view_dep','log_inferred'
  confidence real DEFAULT 0.8,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (upstream_asset_id, downstream_asset_id, edge_type)
);

COMMIT;
