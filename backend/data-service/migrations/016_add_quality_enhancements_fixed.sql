-- backend/data-service/migrations/016_add_quality_enhancements.sql
-- Enhanced Data Quality Features (FIXED)

-- Table for healing attempts
CREATE TABLE IF NOT EXISTS quality_healing_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES quality_issues(id) ON DELETE CASCADE,
  action_id VARCHAR(255) NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  rows_affected INTEGER DEFAULT 0,
  dry_run BOOLEAN DEFAULT false,
  backup_id VARCHAR(255),
  duration_ms INTEGER,
  details JSONB DEFAULT '{}'::jsonb,
  rolled_back BOOLEAN DEFAULT false,
  rolled_back_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_healing_issue ON quality_healing_attempts(issue_id);
CREATE INDEX IF NOT EXISTS idx_healing_success ON quality_healing_attempts(success);
CREATE INDEX IF NOT EXISTS idx_healing_created ON quality_healing_attempts(created_at);

-- Table for quality impact analysis cache
CREATE TABLE IF NOT EXISTS quality_impact_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES quality_issues(id) ON DELETE CASCADE,
  impact_score INTEGER NOT NULL,
  total_assets_affected INTEGER DEFAULT 0,
  total_rows_affected BIGINT DEFAULT 0,
  critical_paths JSONB DEFAULT '[]'::jsonb,
  impact_graph JSONB DEFAULT '{}'::jsonb,
  business_impact JSONB DEFAULT '{}'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  analyzed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_impact_issue ON quality_impact_analysis(issue_id);
CREATE INDEX IF NOT EXISTS idx_impact_score ON quality_impact_analysis(impact_score);
CREATE INDEX IF NOT EXISTS idx_impact_analyzed ON quality_impact_analysis(analyzed_at);

-- Table for data quality SLAs
CREATE TABLE IF NOT EXISTS quality_slas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES catalog_assets(id) ON DELETE SET NULL,

  -- SLA Targets
  min_quality_score INTEGER NOT NULL DEFAULT 80,
  max_issue_count INTEGER,
  max_critical_issues INTEGER DEFAULT 0,

  -- Dimension-specific targets
  min_completeness INTEGER DEFAULT 95,
  min_accuracy INTEGER DEFAULT 90,
  min_consistency INTEGER DEFAULT 85,
  min_validity INTEGER DEFAULT 90,
  min_freshness INTEGER DEFAULT 80,
  min_uniqueness INTEGER DEFAULT 95,

  -- SLA Metadata
  severity VARCHAR(50) DEFAULT 'medium',
  breach_notification_enabled BOOLEAN DEFAULT true,
  notification_emails TEXT[],
  auto_remediation_enabled BOOLEAN DEFAULT false,

  -- Status
  status VARCHAR(50) DEFAULT 'active',
  last_check_at TIMESTAMP,
  last_breach_at TIMESTAMP,
  breach_count INTEGER DEFAULT 0,

  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sla_datasource ON quality_slas(datasource_id);
CREATE INDEX IF NOT EXISTS idx_sla_asset ON quality_slas(asset_id);
CREATE INDEX IF NOT EXISTS idx_sla_status ON quality_slas(status);
CREATE INDEX IF NOT EXISTS idx_sla_enabled ON quality_slas(enabled);

-- Table for SLA breach history
CREATE TABLE IF NOT EXISTS quality_sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_id UUID NOT NULL REFERENCES quality_slas(id) ON DELETE CASCADE,
  breach_type VARCHAR(100) NOT NULL,
  expected_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  severity VARCHAR(50),
  breach_details JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  breached_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breach_sla ON quality_sla_breaches(sla_id);
CREATE INDEX IF NOT EXISTS idx_breach_resolved ON quality_sla_breaches(resolved);
CREATE INDEX IF NOT EXISTS idx_breach_date ON quality_sla_breaches(breached_at);

-- Table for quality ROI tracking
CREATE TABLE IF NOT EXISTS quality_roi_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,

  -- Issue Metrics
  total_issues INTEGER DEFAULT 0,
  issues_resolved INTEGER DEFAULT 0,
  issues_prevented INTEGER DEFAULT 0,

  -- Impact Metrics
  rows_affected BIGINT DEFAULT 0,
  rows_fixed BIGINT DEFAULT 0,
  downstream_assets_protected INTEGER DEFAULT 0,

  -- Cost Metrics (in dollars)
  estimated_issue_cost DECIMAL(15,2) DEFAULT 0,
  remediation_cost DECIMAL(15,2) DEFAULT 0,
  prevention_savings DECIMAL(15,2) DEFAULT 0,
  total_roi DECIMAL(15,2) DEFAULT 0,

  -- Time Metrics (in hours)
  time_spent_on_quality DECIMAL(10,2) DEFAULT 0,
  time_saved_by_automation DECIMAL(10,2) DEFAULT 0,

  -- Quality Metrics
  avg_quality_score DECIMAL(5,2),
  quality_improvement DECIMAL(5,2) DEFAULT 0,

  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW(),

  UNIQUE(datasource_id, metric_date)
);

CREATE INDEX IF NOT EXISTS idx_roi_datasource ON quality_roi_metrics(datasource_id);
CREATE INDEX IF NOT EXISTS idx_roi_date ON quality_roi_metrics(metric_date);

-- Table for anomaly detection models
CREATE TABLE IF NOT EXISTS quality_anomaly_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES catalog_assets(id) ON DELETE CASCADE,
  column_name VARCHAR(255),

  -- Model Configuration
  model_type VARCHAR(100) NOT NULL,
  algorithm VARCHAR(100),
  sensitivity DECIMAL(3,2) DEFAULT 0.95,

  -- Training Data
  training_data_rows INTEGER,
  training_start_date TIMESTAMP,
  training_end_date TIMESTAMP,

  -- Model Parameters
  parameters JSONB DEFAULT '{}'::jsonb,
  thresholds JSONB DEFAULT '{}'::jsonb,

  -- Model Performance
  accuracy DECIMAL(5,2),
  false_positive_rate DECIMAL(5,2),
  false_negative_rate DECIMAL(5,2),
  last_trained_at TIMESTAMP,

  -- Status
  status VARCHAR(50) DEFAULT 'training',
  enabled BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_datasource ON quality_anomaly_models(datasource_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_asset_model ON quality_anomaly_models(asset_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_status ON quality_anomaly_models(status);

-- Table for detected anomalies
CREATE TABLE IF NOT EXISTS quality_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES quality_anomaly_models(id) ON DELETE CASCADE,
  asset_id UUID NOT NULL REFERENCES catalog_assets(id) ON DELETE CASCADE,
  column_name VARCHAR(255),

  -- Anomaly Details
  anomaly_type VARCHAR(100),
  anomaly_score DECIMAL(5,2) NOT NULL,
  expected_value TEXT,
  actual_value TEXT,
  deviation DECIMAL(10,2),

  -- Context
  row_identifier TEXT,
  timestamp_detected TIMESTAMP DEFAULT NOW(),
  context JSONB DEFAULT '{}'::jsonb,

  -- Status
  status VARCHAR(50) DEFAULT 'new',
  resolution_action VARCHAR(255),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),

  -- Impact
  severity VARCHAR(50),
  auto_remediated BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anomaly_model ON quality_anomalies(model_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_asset ON quality_anomalies(asset_id);
CREATE INDEX IF NOT EXISTS idx_anomaly_status_anomaly ON quality_anomalies(status);
CREATE INDEX IF NOT EXISTS idx_anomaly_detected ON quality_anomalies(timestamp_detected);
CREATE INDEX IF NOT EXISTS idx_anomaly_score ON quality_anomalies(anomaly_score);

-- Add new columns to existing quality_issues table
ALTER TABLE quality_issues
ADD COLUMN IF NOT EXISTS auto_heal_eligible BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_heal_confidence DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS healing_strategy VARCHAR(100),
ADD COLUMN IF NOT EXISTS impact_score INTEGER,
ADD COLUMN IF NOT EXISTS downstream_assets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS business_impact JSONB DEFAULT '{}'::jsonb;

-- Add index for auto-healing
CREATE INDEX IF NOT EXISTS idx_quality_issues_auto_heal ON quality_issues(auto_heal_eligible, auto_heal_confidence) WHERE auto_heal_eligible = true;

-- View for quality dashboard metrics
CREATE OR REPLACE VIEW quality_dashboard_metrics AS
SELECT
  ds.id as datasource_id,
  ds.name as datasource_name,
  COUNT(DISTINCT qi.id) as total_issues,
  COUNT(DISTINCT qi.id) FILTER (WHERE qi.status = 'open') as open_issues,
  COUNT(DISTINCT qi.id) FILTER (WHERE qi.severity = 'critical') as critical_issues,
  COUNT(DISTINCT qi.id) FILTER (WHERE qi.auto_heal_eligible = true) as auto_healable_issues,
  COUNT(DISTINCT qha.id) FILTER (WHERE qha.success = true) as successful_healings,
  COUNT(DISTINCT qa.id) as total_anomalies,
  COUNT(DISTINCT qs.id) as total_slas,
  COUNT(DISTINCT qs.id) FILTER (WHERE qs.status = 'breached') as breached_slas,
  AVG(qia.impact_score) as avg_impact_score,
  SUM(qia.total_rows_affected) as total_rows_affected
FROM data_sources ds
LEFT JOIN catalog_assets ca ON ca.datasource_id = ds.id
LEFT JOIN quality_issues qi ON qi.asset_id = ca.id
LEFT JOIN quality_healing_attempts qha ON qha.issue_id = qi.id
LEFT JOIN quality_anomalies qa ON qa.asset_id = ca.id
LEFT JOIN quality_slas qs ON qs.datasource_id = ds.id
LEFT JOIN quality_impact_analysis qia ON qia.issue_id = qi.id
GROUP BY ds.id, ds.name;

-- Comments
COMMENT ON TABLE quality_healing_attempts IS 'Tracks automated data healing attempts and their results';
COMMENT ON TABLE quality_impact_analysis IS 'Caches lineage-based impact analysis for quality issues';
COMMENT ON TABLE quality_slas IS 'Data Quality Service Level Agreements and targets';
COMMENT ON TABLE quality_sla_breaches IS 'History of SLA breaches and their resolutions';
COMMENT ON TABLE quality_roi_metrics IS 'ROI and business impact metrics for quality initiatives';
COMMENT ON TABLE quality_anomaly_models IS 'ML and statistical models for anomaly detection';
COMMENT ON TABLE quality_anomalies IS 'Detected data anomalies and their status';
