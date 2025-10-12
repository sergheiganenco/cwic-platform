-- Enhanced Catalog Schema Migration
-- Supports hierarchical discovery: Source → Database → Schema → Object

-- ============================================
-- 1. CATALOG DATABASES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_databases (
  id BIGSERIAL PRIMARY KEY,
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'discovered' CHECK (status IN ('discovered', 'scanning', 'scanned', 'error', 'archived')),

  -- Metadata
  size_bytes BIGINT,
  object_count INTEGER DEFAULT 0,
  schema_count INTEGER DEFAULT 0,

  -- Scanning
  last_scanned_at TIMESTAMPTZ,
  scan_duration_seconds INTEGER,
  scan_error TEXT,

  -- Discovery
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Uniqueness
  UNIQUE(datasource_id, name)
);

CREATE INDEX idx_catalog_databases_datasource ON catalog_databases(datasource_id);
CREATE INDEX idx_catalog_databases_status ON catalog_databases(status);

-- ============================================
-- 2. CATALOG SCHEMAS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_schemas (
  id BIGSERIAL PRIMARY KEY,
  database_id BIGINT NOT NULL REFERENCES catalog_databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,

  -- Metadata
  object_count INTEGER DEFAULT 0,
  is_system BOOLEAN DEFAULT FALSE,

  -- Discovery
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Uniqueness
  UNIQUE(database_id, name)
);

CREATE INDEX idx_catalog_schemas_database ON catalog_schemas(database_id);
CREATE INDEX idx_catalog_schemas_system ON catalog_schemas(is_system);

-- ============================================
-- 3. ENHANCED CATALOG OBJECTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_objects (
  id BIGSERIAL PRIMARY KEY,
  schema_id BIGINT NOT NULL REFERENCES catalog_schemas(id) ON DELETE CASCADE,
  database_id BIGINT NOT NULL REFERENCES catalog_databases(id) ON DELETE CASCADE,
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  object_type VARCHAR(50) NOT NULL CHECK (object_type IN (
    'table', 'view', 'materialized_view', 'stored_procedure',
    'function', 'trigger', 'index', 'sequence'
  )),
  fully_qualified_name TEXT NOT NULL, -- source.database.schema.object

  -- Metadata
  description TEXT,
  owner VARCHAR(255),
  row_count BIGINT,
  size_bytes BIGINT,
  column_count INTEGER DEFAULT 0,
  index_count INTEGER DEFAULT 0,
  partition_count INTEGER DEFAULT 0,

  -- Quality & Classification
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  classification VARCHAR(50) CHECK (classification IN ('Public', 'Internal', 'Confidential', 'Sensitive', 'PII')),
  compliance_tags TEXT[], -- GDPR, HIPAA, PCI-DSS, etc.

  -- Governance
  is_certified BOOLEAN DEFAULT FALSE,
  certified_by VARCHAR(255),
  certified_at TIMESTAMPTZ,
  steward VARCHAR(255),

  -- Usage & Access
  last_accessed_at TIMESTAMPTZ,
  access_count BIGINT DEFAULT 0,
  popularity_score INTEGER DEFAULT 0,

  -- Discovery & Tracking
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_profiled_at TIMESTAMPTZ,
  last_classified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Search optimization
  search_vector TSVECTOR,
  tags TEXT[] DEFAULT '{}',

  -- Uniqueness
  UNIQUE(schema_id, name, object_type)
);

CREATE INDEX idx_catalog_objects_schema ON catalog_objects(schema_id);
CREATE INDEX idx_catalog_objects_database ON catalog_objects(database_id);
CREATE INDEX idx_catalog_objects_datasource ON catalog_objects(datasource_id);
CREATE INDEX idx_catalog_objects_type ON catalog_objects(object_type);
CREATE INDEX idx_catalog_objects_quality ON catalog_objects(quality_score);
CREATE INDEX idx_catalog_objects_classification ON catalog_objects(classification);
CREATE INDEX idx_catalog_objects_search ON catalog_objects USING GIN(search_vector);
CREATE INDEX idx_catalog_objects_tags ON catalog_objects USING GIN(tags);
CREATE INDEX idx_catalog_objects_fqn ON catalog_objects(fully_qualified_name);

-- Full-text search trigger
CREATE OR REPLACE FUNCTION update_catalog_objects_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.fully_qualified_name, '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER catalog_objects_search_vector_update
BEFORE INSERT OR UPDATE ON catalog_objects
FOR EACH ROW EXECUTE FUNCTION update_catalog_objects_search_vector();

-- ============================================
-- 4. CATALOG COLUMNS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_columns (
  id BIGSERIAL PRIMARY KEY,
  object_id BIGINT NOT NULL REFERENCES catalog_objects(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  ordinal_position INTEGER NOT NULL,

  -- Properties
  is_nullable BOOLEAN DEFAULT TRUE,
  is_primary_key BOOLEAN DEFAULT FALSE,
  is_foreign_key BOOLEAN DEFAULT FALSE,
  is_unique BOOLEAN DEFAULT FALSE,
  is_indexed BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  max_length INTEGER,
  numeric_precision INTEGER,
  numeric_scale INTEGER,

  -- Classification & Compliance
  classification VARCHAR(50) CHECK (classification IN ('Public', 'Internal', 'Confidential', 'Sensitive', 'PII')),
  data_category VARCHAR(100), -- Email, Phone, SSN, Credit Card, etc.
  compliance_tags TEXT[], -- GDPR, HIPAA, PCI-DSS

  -- Statistics
  distinct_count BIGINT,
  null_count BIGINT,
  null_percentage NUMERIC(5,2),
  min_value TEXT,
  max_value TEXT,
  avg_value NUMERIC,
  std_dev NUMERIC,

  -- Metadata
  description TEXT,
  business_term TEXT,
  examples TEXT[],

  -- Discovery
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_profiled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(object_id, name)
);

CREATE INDEX idx_catalog_columns_object ON catalog_columns(object_id);
CREATE INDEX idx_catalog_columns_classification ON catalog_columns(classification);
CREATE INDEX idx_catalog_columns_category ON catalog_columns(data_category);

-- ============================================
-- 5. SCAN HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_scan_history (
  id BIGSERIAL PRIMARY KEY,
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),

  -- Configuration
  scan_type VARCHAR(50) DEFAULT 'full' CHECK (scan_type IN ('full', 'incremental', 'targeted')),
  databases_scanned TEXT[], -- Array of database names
  options JSONB DEFAULT '{}',

  -- Status
  status VARCHAR(50) DEFAULT 'queued' CHECK (status IN (
    'queued', 'connecting', 'discovering', 'profiling',
    'classifying', 'completing', 'completed', 'failed', 'cancelled'
  )),
  current_phase VARCHAR(50),
  current_database TEXT,
  current_schema TEXT,
  current_object TEXT,

  -- Progress
  objects_scanned INTEGER DEFAULT 0,
  total_objects INTEGER DEFAULT 0,
  databases_discovered INTEGER DEFAULT 0,
  schemas_discovered INTEGER DEFAULT 0,
  objects_discovered INTEGER DEFAULT 0,
  columns_profiled INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  estimated_completion TIMESTAMPTZ,

  -- Results
  error_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  summary JSONB DEFAULT '{}',

  -- Audit
  triggered_by VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scan_history_datasource ON catalog_scan_history(datasource_id);
CREATE INDEX idx_scan_history_status ON catalog_scan_history(status);
CREATE INDEX idx_scan_history_started ON catalog_scan_history(started_at);

-- ============================================
-- 6. SCAN ERRORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_scan_errors (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES catalog_scan_history(scan_id) ON DELETE CASCADE,

  -- Error Details
  severity VARCHAR(20) CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  location TEXT, -- database.schema.object
  error_code VARCHAR(50),
  error_message TEXT NOT NULL,
  stack_trace TEXT,

  -- Context
  phase VARCHAR(50),
  retry_count INTEGER DEFAULT 0,
  is_resolved BOOLEAN DEFAULT FALSE,

  -- Timing
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scan_errors_scan ON catalog_scan_errors(scan_id);
CREATE INDEX idx_scan_errors_severity ON catalog_scan_errors(severity);

-- ============================================
-- 7. DATA LINEAGE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_lineage (
  id BIGSERIAL PRIMARY KEY,
  from_object_id BIGINT NOT NULL REFERENCES catalog_objects(id) ON DELETE CASCADE,
  to_object_id BIGINT NOT NULL REFERENCES catalog_objects(id) ON DELETE CASCADE,

  -- Relationship
  lineage_type VARCHAR(50) CHECK (lineage_type IN ('read', 'write', 'transform', 'join', 'aggregate', 'filter')),
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),

  -- Discovery
  discovered_by VARCHAR(50), -- 'manual', 'query_log', 'etl_metadata', 'ai'
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,

  -- Metadata
  transformation_logic TEXT,
  sample_queries TEXT[],

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(from_object_id, to_object_id, lineage_type)
);

CREATE INDEX idx_lineage_from ON catalog_lineage(from_object_id);
CREATE INDEX idx_lineage_to ON catalog_lineage(to_object_id);
CREATE INDEX idx_lineage_type ON catalog_lineage(lineage_type);

-- ============================================
-- 8. OBJECT BOOKMARKS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  object_id BIGINT NOT NULL REFERENCES catalog_objects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,

  -- Bookmark Details
  name TEXT,
  notes TEXT,
  folder TEXT,
  color VARCHAR(20),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(object_id, user_id)
);

CREATE INDEX idx_bookmarks_object ON catalog_bookmarks(object_id);
CREATE INDEX idx_bookmarks_user ON catalog_bookmarks(user_id);

-- ============================================
-- 9. OBJECT COMMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_comments (
  id BIGSERIAL PRIMARY KEY,
  object_id BIGINT NOT NULL REFERENCES catalog_objects(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL,

  -- Comment
  content TEXT NOT NULL,
  parent_id BIGINT REFERENCES catalog_comments(id) ON DELETE CASCADE,

  -- Reactions
  reactions JSONB DEFAULT '{}', -- {thumbsUp: 5, heart: 2, etc}

  -- Status
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_object ON catalog_comments(object_id);
CREATE INDEX idx_comments_user ON catalog_comments(user_id);
CREATE INDEX idx_comments_parent ON catalog_comments(parent_id);

-- ============================================
-- 10. SAVED FILTERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS catalog_saved_filters (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,

  -- Filter Details
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,

  -- Usage
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_filters_user ON catalog_saved_filters(user_id);

-- ============================================
-- 11. UPDATE TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_catalog_databases_updated_at BEFORE UPDATE ON catalog_databases FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_catalog_schemas_updated_at BEFORE UPDATE ON catalog_schemas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_catalog_objects_updated_at BEFORE UPDATE ON catalog_objects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_catalog_columns_updated_at BEFORE UPDATE ON catalog_columns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_scan_history_updated_at BEFORE UPDATE ON catalog_scan_history FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 12. HELPER VIEWS
-- ============================================

-- Hierarchical catalog view
CREATE OR REPLACE VIEW v_catalog_hierarchy AS
SELECT
  ds.id as source_id,
  ds.name as source_name,
  ds.type as source_type,
  db.id as database_id,
  db.name as database_name,
  sch.id as schema_id,
  sch.name as schema_name,
  obj.id as object_id,
  obj.name as object_name,
  obj.object_type,
  obj.fully_qualified_name,
  obj.quality_score,
  obj.classification,
  obj.row_count,
  obj.column_count
FROM data_sources ds
LEFT JOIN catalog_databases db ON db.datasource_id = ds.id
LEFT JOIN catalog_schemas sch ON sch.database_id = db.id
LEFT JOIN catalog_objects obj ON obj.schema_id = sch.id;

-- Popular objects view
CREATE OR REPLACE VIEW v_popular_objects AS
SELECT
  obj.*,
  ds.name as source_name,
  db.name as database_name,
  sch.name as schema_name,
  COUNT(DISTINCT bm.user_id) as bookmark_count,
  COUNT(DISTINCT cm.user_id) as comment_count
FROM catalog_objects obj
JOIN catalog_schemas sch ON sch.id = obj.schema_id
JOIN catalog_databases db ON db.id = obj.database_id
JOIN data_sources ds ON ds.id = obj.datasource_id
LEFT JOIN catalog_bookmarks bm ON bm.object_id = obj.id
LEFT JOIN catalog_comments cm ON cm.object_id = obj.id
GROUP BY obj.id, ds.name, db.name, sch.name
ORDER BY bookmark_count DESC, comment_count DESC, obj.access_count DESC
LIMIT 100;

COMMENT ON TABLE catalog_databases IS 'Discovered databases from data sources';
COMMENT ON TABLE catalog_schemas IS 'Discovered schemas within databases';
COMMENT ON TABLE catalog_objects IS 'Discovered data objects (tables, views, procedures, etc.)';
COMMENT ON TABLE catalog_columns IS 'Column-level metadata with profiling and classification';
COMMENT ON TABLE catalog_scan_history IS 'Audit trail of all catalog scans';
COMMENT ON TABLE catalog_lineage IS 'Data flow relationships between objects';
