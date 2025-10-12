-- Migration 012: Alter existing quality tables to support 6 dimensions

-- ============================================================================
-- 1. ALTER quality_rules to add dimension support
-- ============================================================================

-- Add dimension column
ALTER TABLE quality_rules
ADD COLUMN IF NOT EXISTS dimension VARCHAR(50) DEFAULT 'validity';

-- Update constraint to include all 6 dimensions
ALTER TABLE quality_rules DROP CONSTRAINT IF EXISTS chk_quality_rules_dimension;
ALTER TABLE quality_rules
ADD CONSTRAINT chk_quality_rules_dimension CHECK (dimension IN (
  'completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'
));

-- Add asset and column references
ALTER TABLE quality_rules
ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES catalog_assets(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS column_name VARCHAR(255);

-- Add rule configuration fields
ALTER TABLE quality_rules
ADD COLUMN IF NOT EXISTS rule_type VARCHAR(50) DEFAULT 'sql',
ADD COLUMN IF NOT EXISTS rule_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS threshold_config JSONB,
ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ml_model_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS schedule_cron VARCHAR(100),
ADD COLUMN IF NOT EXISTS avg_execution_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS run_count INTEGER DEFAULT 0;

-- Update rule_type constraint
ALTER TABLE quality_rules DROP CONSTRAINT IF EXISTS chk_quality_rules_rule_type;
ALTER TABLE quality_rules
ADD CONSTRAINT chk_quality_rules_rule_type CHECK (rule_type IN (
  'threshold', 'sql', 'ai_anomaly', 'pattern', 'comparison', 'freshness_check'
));

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_quality_rules_asset_enabled ON quality_rules(asset_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_quality_rules_datasource_enabled ON quality_rules(data_source_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_quality_rules_dimension ON quality_rules(dimension);

-- ============================================================================
-- 2. Create data_profiles table
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES data_sources(id),

  -- Basic stats
  profile_date TIMESTAMP DEFAULT now(),
  row_count BIGINT,
  column_count INTEGER,
  size_bytes BIGINT,

  -- Column-level profiles (JSONB)
  profile_data JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Computed quality score (0-100)
  quality_score DECIMAL(5,2),

  -- Dimension scores
  completeness_score DECIMAL(5,2),
  accuracy_score DECIMAL(5,2),
  consistency_score DECIMAL(5,2),
  validity_score DECIMAL(5,2),
  freshness_score DECIMAL(5,2),
  uniqueness_score DECIMAL(5,2),

  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_profiles_asset ON data_profiles(asset_id);
CREATE INDEX IF NOT EXISTS idx_data_profiles_date ON data_profiles(profile_date DESC);
CREATE INDEX IF NOT EXISTS idx_data_profiles_score ON data_profiles(quality_score);

-- ============================================================================
-- 3. ALTER quality_results to add detailed metrics
-- ============================================================================

ALTER TABLE quality_results
ADD COLUMN IF NOT EXISTS metric_value DECIMAL(15,4),
ADD COLUMN IF NOT EXISTS threshold_value DECIMAL(15,4),
ADD COLUMN IF NOT EXISTS rows_checked BIGINT,
ADD COLUMN IF NOT EXISTS rows_failed BIGINT,
ADD COLUMN IF NOT EXISTS sample_failures JSONB,
ADD COLUMN IF NOT EXISTS anomaly_score DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS context JSONB,
ADD COLUMN IF NOT EXISTS error_stack TEXT;

-- Add asset reference if missing
ALTER TABLE quality_results
ADD COLUMN IF NOT EXISTS asset_id UUID REFERENCES catalog_assets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quality_results_asset_id ON quality_results(asset_id);

-- ============================================================================
-- 4. Create/Update quality_issues table
-- ============================================================================

-- Drop old table if it exists with different schema
DROP TABLE IF EXISTS data_quality_issues CASCADE;

CREATE TABLE IF NOT EXISTS quality_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID REFERENCES quality_results(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES quality_rules(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES catalog_assets(id) ON DELETE SET NULL,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,

  -- Classification
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  dimension VARCHAR(50) NOT NULL CHECK (dimension IN (
    'completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'
  )),

  -- Status tracking
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN (
    'open', 'acknowledged', 'in_progress', 'resolved', 'false_positive', 'wont_fix'
  )),

  -- Description
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Impact assessment
  impact_score INTEGER CHECK (impact_score >= 0 AND impact_score <= 100),
  affected_rows BIGINT,
  affected_columns TEXT[],

  -- Debugging data
  sample_data JSONB,

  -- AI-generated insights
  root_cause TEXT,
  remediation_plan TEXT,
  similar_issues UUID[],

  -- Workflow
  assigned_to VARCHAR(255),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,

  -- Timestamps
  first_seen_at TIMESTAMP DEFAULT now(),
  last_seen_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),

  -- Recurrence tracking
  occurrence_count INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_quality_issues_rule ON quality_issues(rule_id);
CREATE INDEX IF NOT EXISTS idx_quality_issues_asset ON quality_issues(asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_issues_status ON quality_issues(status);
CREATE INDEX IF NOT EXISTS idx_quality_issues_severity ON quality_issues(severity);
CREATE INDEX IF NOT EXISTS idx_quality_issues_first_seen ON quality_issues(first_seen_at DESC);

-- ============================================================================
-- 5. Create scan schedules table
-- ============================================================================

CREATE TABLE IF NOT EXISTS quality_scan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Scope
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  asset_ids UUID[],
  rule_ids UUID[],

  -- Schedule
  cron_expression VARCHAR(100) NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  enabled BOOLEAN DEFAULT true,

  -- Tracking
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  last_status VARCHAR(50),
  last_duration_ms INTEGER,

  -- Configuration
  config JSONB DEFAULT '{}'::jsonb,

  -- Notifications
  notify_on_failure BOOLEAN DEFAULT true,
  notification_channels JSONB,

  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_schedules_datasource ON quality_scan_schedules(data_source_id);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_enabled ON quality_scan_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_next_run ON quality_scan_schedules(next_run_at) WHERE enabled = true;

-- ============================================================================
-- 6. Create views for reporting
-- ============================================================================

-- Asset quality summary view
CREATE OR REPLACE VIEW v_asset_quality_summary AS
SELECT
  a.id AS asset_id,
  a.name AS asset_name,
  a.type AS asset_type,
  a.schema_name,
  a.data_source_id,
  COUNT(DISTINCT qr.id) AS rule_count,
  COUNT(DISTINCT CASE WHEN qr.enabled THEN qr.id END) AS active_rule_count,
  COUNT(DISTINCT res.id) FILTER (WHERE res.run_at >= now() - interval '7 days') AS recent_checks,
  COUNT(DISTINCT res.id) FILTER (WHERE res.status = 'passed' AND res.run_at >= now() - interval '7 days') AS passed_checks,
  COUNT(DISTINCT res.id) FILTER (WHERE res.status = 'failed' AND res.run_at >= now() - interval '7 days') AS failed_checks,
  ROUND(
    CASE
      WHEN COUNT(DISTINCT res.id) FILTER (WHERE res.run_at >= now() - interval '7 days') > 0
      THEN (COUNT(DISTINCT res.id) FILTER (WHERE res.status = 'passed' AND res.run_at >= now() - interval '7 days')::DECIMAL /
            COUNT(DISTINCT res.id) FILTER (WHERE res.run_at >= now() - interval '7 days')) * 100
      ELSE NULL
    END, 2
  ) AS pass_rate,
  COUNT(DISTINCT qi.id) FILTER (WHERE qi.status = 'open') AS open_issues,
  MAX(res.run_at) AS last_check_at,
  p.quality_score AS latest_quality_score,
  p.completeness_score,
  p.accuracy_score,
  p.consistency_score,
  p.validity_score,
  p.freshness_score,
  p.uniqueness_score
FROM catalog_assets a
LEFT JOIN quality_rules qr ON qr.asset_id = a.id
LEFT JOIN quality_results res ON res.rule_id = qr.id
LEFT JOIN quality_issues qi ON qi.asset_id = a.id
LEFT JOIN LATERAL (
  SELECT
    quality_score,
    completeness_score,
    accuracy_score,
    consistency_score,
    validity_score,
    freshness_score,
    uniqueness_score
  FROM data_profiles
  WHERE asset_id = a.id
  ORDER BY profile_date DESC
  LIMIT 1
) p ON TRUE
GROUP BY a.id, a.name, a.type, a.schema_name, a.data_source_id,
  p.quality_score, p.completeness_score, p.accuracy_score, p.consistency_score,
  p.validity_score, p.freshness_score, p.uniqueness_score;

-- Quality trends by dimension
CREATE OR REPLACE VIEW v_quality_dimension_trends AS
SELECT
  DATE_TRUNC('hour', res.run_at) AS time_bucket,
  qr.dimension,
  res.data_source_id,
  COUNT(*) AS total_checks,
  COUNT(*) FILTER (WHERE res.status = 'passed') AS passed,
  COUNT(*) FILTER (WHERE res.status = 'failed') AS failed,
  ROUND(AVG(CASE WHEN res.status = 'passed' THEN 100 ELSE 0 END), 2) AS pass_rate,
  ROUND(AVG(res.execution_time_ms), 2) AS avg_execution_ms
FROM quality_results res
JOIN quality_rules qr ON qr.id = res.rule_id
WHERE res.run_at >= now() - interval '30 days'
GROUP BY time_bucket, qr.dimension, res.data_source_id
ORDER BY time_bucket DESC;

-- ============================================================================
-- 7. Function to calculate asset quality score
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_asset_quality_score(p_asset_id UUID)
RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_score DECIMAL(5,2);
BEGIN
  SELECT
    ROUND(
      COALESCE(AVG(
        CASE
          WHEN status = 'passed' THEN 100
          WHEN status = 'warning' THEN 75
          WHEN status = 'failed' THEN 0
          ELSE 50
        END
      ), 50), 2
    )
  INTO v_score
  FROM quality_results
  WHERE asset_id = p_asset_id
    AND run_at >= now() - interval '7 days';

  RETURN COALESCE(v_score, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. Seed some sample rules for demonstration
-- ============================================================================

-- Insert sample completeness rule
INSERT INTO quality_rules (name, description, dimension, severity, rule_type, rule_config, enabled, auto_generated)
VALUES
('Null Rate Threshold', 'Checks if null rate is below 5%', 'completeness', 'high', 'threshold',
 '{"metric": "null_rate", "operator": "<", "value": 0.05}'::jsonb, true, true)
ON CONFLICT DO NOTHING;

-- Insert sample uniqueness rule
INSERT INTO quality_rules (name, description, dimension, severity, rule_type, rule_config, enabled, auto_generated)
VALUES
('Duplicate Detection', 'Detects duplicate primary key values', 'uniqueness', 'critical', 'threshold',
 '{"metric": "duplicate_rate", "operator": "=", "value": 0}'::jsonb, true, true)
ON CONFLICT DO NOTHING;

-- Insert sample freshness rule
INSERT INTO quality_rules (name, description, dimension, severity, rule_type, rule_config, enabled, auto_generated)
VALUES
('Data Freshness Check', 'Alerts if data is older than 24 hours', 'freshness', 'medium', 'freshness_check',
 '{"max_age_hours": 24, "timestamp_column": "updated_at"}'::jsonb, true, true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Display summary
DO $$
BEGIN
  RAISE NOTICE 'Migration 012 completed successfully';
  RAISE NOTICE 'Enhanced quality_rules table with 6 dimensions support';
  RAISE NOTICE 'Created data_profiles table for auto-profiling';
  RAISE NOTICE 'Created quality_issues table for issue tracking';
  RAISE NOTICE 'Created quality_scan_schedules for automation';
  RAISE NOTICE 'Created views: v_asset_quality_summary, v_quality_dimension_trends';
END $$;
