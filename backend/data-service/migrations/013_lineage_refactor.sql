BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Canonical lineage nodes with URN uniqueness
CREATE TABLE IF NOT EXISTS lineage_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  urn text NOT NULL,
  label text NOT NULL,
  type text NOT NULL CHECK (type IN ('source','bronze','silver','gold','transformation','sink','database','schema','object','column','process','semantic')),
  layer smallint NOT NULL DEFAULT 0,
  data_source_id uuid,
  schema_name text,
  object_name text,
  column_name text,
  aliases text[] NOT NULL DEFAULT '{}',
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  version_signature text,
  source_connector text,
  confidence real,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lineage_nodes_urn ON lineage_nodes (urn);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_layer ON lineage_nodes (layer);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_aliases_gin ON lineage_nodes USING gin (aliases);
CREATE INDEX IF NOT EXISTS idx_lineage_nodes_metadata_gin ON lineage_nodes USING gin (metadata jsonb_path_ops);
ALTER TABLE lineage_nodes
  ADD COLUMN IF NOT EXISTS urn text,
  ADD COLUMN IF NOT EXISTS layer smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS version_signature text,
  ADD COLUMN IF NOT EXISTS source_connector text,
  ADD COLUMN IF NOT EXISTS confidence real,
  ADD COLUMN IF NOT EXISTS object_name text,
  ADD COLUMN IF NOT EXISTS column_name text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Deterministic edges (URN based)
CREATE TABLE IF NOT EXISTS lineage_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edge_id text NOT NULL,
  from_urn text NOT NULL,
  to_urn text NOT NULL,
  relationship_type text NOT NULL CHECK (relationship_type IN ('derives_from','transforms_to','copies_from','aggregates_from','depends_on','feeds','consumes')),
  operation_kind text,
  transformation_logic text,
  confidence real,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_lineage_edges_edge_id ON lineage_edges (edge_id);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_from ON lineage_edges (from_urn);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_to ON lineage_edges (to_urn);
CREATE INDEX IF NOT EXISTS idx_lineage_edges_type ON lineage_edges (relationship_type);
ALTER TABLE lineage_edges
  ADD COLUMN IF NOT EXISTS edge_id text,
  ADD COLUMN IF NOT EXISTS from_urn text,
  ADD COLUMN IF NOT EXISTS to_urn text,
  ADD COLUMN IF NOT EXISTS operation_kind text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Backfill helper view to assist migrations from legacy tables (if present)
COMMIT;
