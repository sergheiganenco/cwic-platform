-- Migration: Column-Level Lineage
-- Description: Add column-level lineage tracking for granular data flow analysis
-- Created: 2025-10-12

-- ============================================================================
-- COLUMN LINEAGE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS column_lineage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source column
  from_node_id UUID NOT NULL,
  from_column_name TEXT NOT NULL,
  from_data_type TEXT,

  -- Target column
  to_node_id UUID NOT NULL,
  to_column_name TEXT NOT NULL,
  to_data_type TEXT,

  -- Relationship details
  transformation_type TEXT NOT NULL CHECK (transformation_type IN (
    'direct',           -- Direct copy (SELECT col FROM source)
    'calculated',       -- Calculated field (SELECT col * 2 AS new_col)
    'aggregated',       -- Aggregation (SELECT SUM(col) AS total)
    'filtered',         -- Filtered data (WHERE col > 10)
    'joined',           -- From JOIN operation
    'concatenated',     -- String concatenation
    'casted',           -- Type conversion
    'derived',          -- Complex derivation
    'unknown'           -- Cannot determine
  )),

  -- Transformation logic
  transformation_sql TEXT,
  transformation_description TEXT,

  -- Quality metrics
  confidence_score DECIMAL(3,2) DEFAULT 0.80 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  data_quality_score DECIMAL(3,2),

  -- Discovery metadata
  discovered_by TEXT, -- 'sql_parser', 'manual', 'ai_inference', 'dbt', 'airflow'
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  last_validated_at TIMESTAMPTZ,
  validation_status TEXT CHECK (validation_status IN ('pending', 'validated', 'rejected', 'needs_review')),

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  tags TEXT[],

  -- Audit fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,

  -- Soft delete
  is_active BOOLEAN DEFAULT TRUE,
  deleted_at TIMESTAMPTZ,

  -- Unique constraint: one lineage relationship per column pair
  CONSTRAINT unique_column_lineage UNIQUE (from_node_id, from_column_name, to_node_id, to_column_name)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Query optimization indexes
CREATE INDEX idx_column_lineage_from ON column_lineage(from_node_id, from_column_name) WHERE is_active = TRUE;
CREATE INDEX idx_column_lineage_to ON column_lineage(to_node_id, to_column_name) WHERE is_active = TRUE;
CREATE INDEX idx_column_lineage_type ON column_lineage(transformation_type) WHERE is_active = TRUE;
CREATE INDEX idx_column_lineage_confidence ON column_lineage(confidence_score DESC) WHERE is_active = TRUE;
CREATE INDEX idx_column_lineage_discovered_by ON column_lineage(discovered_by) WHERE is_active = TRUE;

-- Full-text search on transformation SQL
CREATE INDEX idx_column_lineage_sql_search ON column_lineage USING gin(to_tsvector('english', transformation_sql)) WHERE is_active = TRUE;

-- Metadata JSONB index
CREATE INDEX idx_column_lineage_metadata ON column_lineage USING gin(metadata) WHERE is_active = TRUE;

-- Tags array index
CREATE INDEX idx_column_lineage_tags ON column_lineage USING gin(tags) WHERE is_active = TRUE;

-- ============================================================================
-- COLUMN LINEAGE PATHS (Materialized View for Fast Path Queries)
-- ============================================================================

CREATE MATERIALIZED VIEW column_lineage_paths AS
WITH RECURSIVE lineage_cte AS (
  -- Base case: direct lineage
  SELECT
    cl.id,
    cl.from_node_id,
    cl.from_column_name,
    cl.to_node_id,
    cl.to_column_name,
    cl.transformation_type,
    cl.confidence_score,
    1 AS depth,
    ARRAY[cl.from_node_id] AS node_path,
    ARRAY[cl.from_column_name] AS column_path,
    cl.confidence_score AS path_confidence
  FROM column_lineage cl
  WHERE cl.is_active = TRUE

  UNION ALL

  -- Recursive case: follow the lineage chain
  SELECT
    cl.id,
    lc.from_node_id,
    lc.from_column_name,
    cl.to_node_id,
    cl.to_column_name,
    cl.transformation_type,
    cl.confidence_score,
    lc.depth + 1,
    lc.node_path || cl.from_node_id,
    lc.column_path || cl.from_column_name,
    LEAST(lc.path_confidence, cl.confidence_score) AS path_confidence
  FROM column_lineage cl
  INNER JOIN lineage_cte lc ON cl.from_node_id = lc.to_node_id AND cl.from_column_name = lc.to_column_name
  WHERE
    cl.is_active = TRUE
    AND lc.depth < 10 -- Prevent infinite loops
    AND NOT (cl.from_node_id = ANY(lc.node_path)) -- Prevent cycles
)
SELECT
  from_node_id AS source_node_id,
  from_column_name AS source_column,
  to_node_id AS target_node_id,
  to_column_name AS target_column,
  depth AS path_length,
  node_path,
  column_path,
  path_confidence,
  COUNT(*) OVER (PARTITION BY from_node_id, from_column_name, to_node_id, to_column_name) AS path_count
FROM lineage_cte;

CREATE INDEX idx_column_lineage_paths_source ON column_lineage_paths(source_node_id, source_column);
CREATE INDEX idx_column_lineage_paths_target ON column_lineage_paths(target_node_id, target_column);
CREATE INDEX idx_column_lineage_paths_length ON column_lineage_paths(path_length);

-- ============================================================================
-- COLUMN IMPACT ANALYSIS (Materialized View)
-- ============================================================================

CREATE MATERIALIZED VIEW column_impact_analysis AS
SELECT
  cl.from_node_id AS node_id,
  cl.from_column_name AS column_name,
  COUNT(DISTINCT cl.to_node_id) AS downstream_node_count,
  COUNT(DISTINCT cl.to_column_name) AS downstream_column_count,
  COUNT(*) AS total_dependencies,
  AVG(cl.confidence_score) AS avg_confidence,
  MIN(cl.confidence_score) AS min_confidence,
  ARRAY_AGG(DISTINCT cl.transformation_type) AS transformation_types_used,
  MAX(cl.updated_at) AS last_lineage_update
FROM column_lineage cl
WHERE cl.is_active = TRUE
GROUP BY cl.from_node_id, cl.from_column_name;

CREATE INDEX idx_column_impact_node ON column_impact_analysis(node_id);
CREATE INDEX idx_column_impact_column ON column_impact_analysis(node_id, column_name);
CREATE INDEX idx_column_impact_count ON column_impact_analysis(total_dependencies DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_column_lineage_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_column_lineage_updated_at
  BEFORE UPDATE ON column_lineage
  FOR EACH ROW
  EXECUTE FUNCTION update_column_lineage_timestamp();

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION refresh_column_lineage_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY column_lineage_paths;
  REFRESH MATERIALIZED VIEW CONCURRENTLY column_impact_analysis;
END;
$$ LANGUAGE plpgsql;

-- Function to trace column lineage upstream
CREATE OR REPLACE FUNCTION trace_column_upstream(
  p_node_id UUID,
  p_column_name TEXT,
  p_max_depth INT DEFAULT 5
)
RETURNS TABLE (
  level INT,
  node_id UUID,
  column_name TEXT,
  transformation_type TEXT,
  transformation_sql TEXT,
  confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE upstream AS (
    -- Base case
    SELECT
      0 AS level,
      p_node_id AS node_id,
      p_column_name AS column_name,
      NULL::TEXT AS transformation_type,
      NULL::TEXT AS transformation_sql,
      NULL::DECIMAL AS confidence

    UNION ALL

    -- Recursive case
    SELECT
      u.level + 1,
      cl.from_node_id,
      cl.from_column_name,
      cl.transformation_type,
      cl.transformation_sql,
      cl.confidence_score
    FROM upstream u
    INNER JOIN column_lineage cl
      ON cl.to_node_id = u.node_id AND cl.to_column_name = u.column_name
    WHERE
      u.level < p_max_depth
      AND cl.is_active = TRUE
  )
  SELECT * FROM upstream ORDER BY level;
END;
$$ LANGUAGE plpgsql;

-- Function to trace column lineage downstream
CREATE OR REPLACE FUNCTION trace_column_downstream(
  p_node_id UUID,
  p_column_name TEXT,
  p_max_depth INT DEFAULT 5
)
RETURNS TABLE (
  level INT,
  node_id UUID,
  column_name TEXT,
  transformation_type TEXT,
  transformation_sql TEXT,
  confidence DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE downstream AS (
    -- Base case
    SELECT
      0 AS level,
      p_node_id AS node_id,
      p_column_name AS column_name,
      NULL::TEXT AS transformation_type,
      NULL::TEXT AS transformation_sql,
      NULL::DECIMAL AS confidence

    UNION ALL

    -- Recursive case
    SELECT
      d.level + 1,
      cl.to_node_id,
      cl.to_column_name,
      cl.transformation_type,
      cl.transformation_sql,
      cl.confidence_score
    FROM downstream d
    INNER JOIN column_lineage cl
      ON cl.from_node_id = d.node_id AND cl.from_column_name = d.column_name
    WHERE
      d.level < p_max_depth
      AND cl.is_active = TRUE
  )
  SELECT * FROM downstream ORDER BY level;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- SAMPLE DATA (for testing)
-- ============================================================================

-- Uncomment to insert sample data
/*
INSERT INTO column_lineage (
  from_node_id, from_column_name, from_data_type,
  to_node_id, to_column_name, to_data_type,
  transformation_type, transformation_sql,
  confidence_score, discovered_by
) VALUES
  (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'email', 'varchar',
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'user_email', 'varchar',
    'calculated', 'LOWER(TRIM(email))',
    0.95, 'sql_parser'
  ),
  (
    'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'user_email', 'varchar',
    'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'customer_email', 'varchar',
    'direct', 'user_email',
    0.98, 'sql_parser'
  );
*/

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions (adjust user as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON column_lineage TO your_app_user;
-- GRANT SELECT ON column_lineage_paths TO your_app_user;
-- GRANT SELECT ON column_impact_analysis TO your_app_user;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE column_lineage IS 'Stores column-level lineage relationships for granular data flow tracking';
COMMENT ON COLUMN column_lineage.transformation_type IS 'Type of transformation: direct, calculated, aggregated, filtered, joined, concatenated, casted, derived, unknown';
COMMENT ON COLUMN column_lineage.confidence_score IS 'Confidence score (0-1) indicating how certain we are about this lineage relationship';
COMMENT ON COLUMN column_lineage.discovered_by IS 'Method of discovery: sql_parser, manual, ai_inference, dbt, airflow';
COMMENT ON MATERIALIZED VIEW column_lineage_paths IS 'Precomputed transitive lineage paths for fast upstream/downstream queries';
COMMENT ON MATERIALIZED VIEW column_impact_analysis IS 'Impact analysis showing downstream dependencies for each column';
