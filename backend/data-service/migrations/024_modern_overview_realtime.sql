-- Migration 024: Modern Overview - Real-Time Quality Infrastructure
-- Purpose: Add tables and infrastructure for real-time quality monitoring, ML predictions, and business impact

-- ============================================================================
-- 1. REAL-TIME QUALITY SCORES
-- ============================================================================
-- Stores quality scores updated every 5 seconds for live dashboard
CREATE TABLE IF NOT EXISTS quality_scores_realtime (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  database_name VARCHAR(255),

  -- Score data
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  dimension_scores JSONB NOT NULL DEFAULT '{}'::jsonb,  -- {completeness: 92, accuracy: 85, ...}

  -- Metadata
  measured_at TIMESTAMP NOT NULL DEFAULT NOW(),
  trend VARCHAR(10) CHECK (trend IN ('up', 'down', 'stable')),
  change_percent DECIMAL(5,2),
  change_points INTEGER,  -- Absolute change: +3, -5

  -- Performance tracking
  calculation_duration_ms INTEGER,
  tables_scanned INTEGER,
  rows_scanned BIGINT,

  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_realtime_lookup ON quality_scores_realtime(data_source_id, measured_at DESC);
CREATE INDEX idx_realtime_latest ON quality_scores_realtime(measured_at DESC) WHERE measured_at > NOW() - INTERVAL '1 hour';

-- ============================================================================
-- 2. ML PREDICTIONS
-- ============================================================================
-- Stores machine learning predictions for quality forecasting and anomaly detection
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Prediction metadata
  prediction_type VARCHAR(50) NOT NULL CHECK (prediction_type IN (
    'quality_forecast',
    'anomaly_detection',
    'drift_warning',
    'pattern_recognition',
    'threshold_recommendation'
  )),

  -- Target
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  target_table VARCHAR(255),
  target_column VARCHAR(255),
  target_metric VARCHAR(100),  -- 'overall_score', 'null_rate', 'duplicate_count'

  -- Prediction results
  predicted_value DECIMAL(10,2),
  confidence DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),  -- 0.00 to 1.00

  -- Forecasting specific
  forecast_timeframe VARCHAR(10),  -- '7d', '30d', '90d'
  forecast_data JSONB,  -- [{date: '2025-01-15', value: 87, confidence: 0.92}, ...]

  -- Anomaly detection specific
  anomaly_type VARCHAR(50),  -- 'spike', 'drop', 'pattern_break', 'outlier'
  anomaly_severity DECIMAL(3,2),  -- 0.00 to 1.00

  -- Drift detection specific
  baseline_value DECIMAL(10,2),
  drift_magnitude DECIMAL(3,2),
  impacted_downstream TEXT[],  -- ['Marketing Dashboard', 'Sales Report']

  -- Explanation
  explanation TEXT,
  recommendation TEXT,

  -- Model metadata
  model_name VARCHAR(100),
  model_version VARCHAR(20),
  training_accuracy DECIMAL(5,4),

  -- Validity
  created_at TIMESTAMP DEFAULT NOW(),
  valid_until TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_predictions_active ON ml_predictions(target_table, prediction_type, valid_until DESC) WHERE is_active = true;
CREATE INDEX idx_predictions_recent ON ml_predictions(created_at DESC);

-- ============================================================================
-- 3. BUSINESS IMPACT CONFIGURATION
-- ============================================================================
-- User-configurable mappings to translate data quality into business metrics
CREATE TABLE IF NOT EXISTS business_impact_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,

  -- Revenue mapping
  revenue_tables JSONB DEFAULT '[]'::jsonb,
  -- [{table: 'orders', revenueColumn: 'total_amount', averageValue: 150, currencyColumn: 'currency'}]

  -- User impact mapping
  user_tables JSONB DEFAULT '[]'::jsonb,
  -- [{table: 'customers', userIdColumn: 'customer_id', isActiveColumn: 'is_active'}]

  -- Cost configuration
  hourly_downtime_cost DECIMAL(10,2) DEFAULT 0,  -- Cost per hour of downtime
  average_fix_cost DECIMAL(10,2) DEFAULT 0,      -- Average cost to fix an issue
  platform_cost_monthly DECIMAL(10,2) DEFAULT 0,  -- Cost of quality platform

  -- Custom impact rules
  custom_impact_rules JSONB DEFAULT '[]'::jsonb,
  -- [{metric: 'null_rate', threshold: 0.05, impact: 'revenue', formula: 'rows_affected * avg_order_value'}]

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Only one config per data source
  UNIQUE(data_source_id)
);

-- ============================================================================
-- 4. DATA CONTRACTS (SLA DEFINITIONS)
-- ============================================================================
-- Define quality SLAs and expectations for data consumers
CREATE TABLE IF NOT EXISTS data_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contract metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version VARCHAR(20) DEFAULT '1.0',

  -- Ownership
  owner_email VARCHAR(255),
  owner_team VARCHAR(100),
  owner_slack_channel VARCHAR(100),

  -- Scope
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  database_name VARCHAR(255),
  schema_name VARCHAR(255),
  tables TEXT[] NOT NULL,  -- Array of table names covered by this contract

  -- SLA metrics
  freshness_sla VARCHAR(50),  -- '< 5 minutes', '< 1 hour', '< 1 day'
  completeness_sla DECIMAL(5,2),  -- 99.5% (must be complete)
  accuracy_sla DECIMAL(5,2),  -- 95.0% (must be accurate)
  consistency_sla DECIMAL(5,2),  -- 98.0% (referential integrity)
  validity_sla DECIMAL(5,2),  -- 97.0% (format/pattern compliance)
  uniqueness_sla DECIMAL(5,2),  -- 100.0% (no duplicates)

  -- Custom SLAs
  custom_slas JSONB DEFAULT '[]'::jsonb,
  -- [{metric: 'null_rate', column: 'email', threshold: 0.01, operator: '<'}]

  -- Enforcement
  enforcement_action VARCHAR(20) DEFAULT 'alert' CHECK (enforcement_action IN ('block', 'alert', 'log')),
  block_downstream BOOLEAN DEFAULT false,  -- Block downstream jobs on violation

  -- Business impact
  penalty_per_day DECIMAL(10,2),  -- Financial penalty for SLA violation
  criticality VARCHAR(20) DEFAULT 'medium' CHECK (criticality IN ('low', 'medium', 'high', 'critical')),

  -- Notification settings
  notification_channels JSONB DEFAULT '[]'::jsonb,  -- ['email', 'slack', 'pagerduty']
  escalation_after_hours INTEGER DEFAULT 24,

  -- Status
  is_active BOOLEAN DEFAULT true,
  violations_count INTEGER DEFAULT 0,
  last_violation_at TIMESTAMP,
  compliance_rate DECIMAL(5,2),  -- 99.2% (percentage of time in compliance)

  -- Audit
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by VARCHAR(255),
  approved_by VARCHAR(255),
  approved_at TIMESTAMP
);

CREATE INDEX idx_contracts_active ON data_contracts(data_source_id, is_active) WHERE is_active = true;
CREATE INDEX idx_contracts_tables ON data_contracts USING GIN(tables);

-- ============================================================================
-- 5. SLA VIOLATIONS LOG
-- ============================================================================
-- Track every SLA violation for compliance reporting
CREATE TABLE IF NOT EXISTS sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contract reference
  contract_id UUID REFERENCES data_contracts(id) ON DELETE CASCADE,
  contract_name VARCHAR(255) NOT NULL,

  -- Violation details
  table_name VARCHAR(255) NOT NULL,
  column_name VARCHAR(255),
  metric_name VARCHAR(100) NOT NULL,  -- 'freshness', 'completeness', 'custom_null_rate'
  expected_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  deviation DECIMAL(10,2),  -- How far off: actual - expected

  -- Severity
  violation_severity VARCHAR(20) DEFAULT 'minor' CHECK (violation_severity IN ('minor', 'major', 'critical')),

  -- Business impact
  business_impact JSONB DEFAULT '{}'::jsonb,
  -- {revenue: 50000, users: 15000, cost: 12000, sla_penalty: 10000}

  -- Timeline
  detected_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolution_duration_hours INTEGER,

  -- Remediation
  auto_remediated BOOLEAN DEFAULT false,
  remediation_action TEXT,
  remediated_by VARCHAR(255),

  -- Notification
  notifications_sent JSONB DEFAULT '[]'::jsonb,  -- [{channel: 'email', to: 'owner@...', sentAt: '...'}]
  escalated BOOLEAN DEFAULT false,
  escalated_at TIMESTAMP
);

CREATE INDEX idx_violations_contract ON sla_violations(contract_id, detected_at DESC);
CREATE INDEX idx_violations_active ON sla_violations(detected_at DESC) WHERE resolved_at IS NULL;
CREATE INDEX idx_violations_table ON sla_violations(table_name, detected_at DESC);

-- ============================================================================
-- 6. ACTIVE ALERTS (REAL-TIME STREAMING)
-- ============================================================================
-- Real-time alerts for immediate action
CREATE TABLE IF NOT EXISTS alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Alert metadata
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Technical details
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  database_name VARCHAR(255),
  schema_name VARCHAR(255),
  table_name VARCHAR(255),
  column_name VARCHAR(255),
  metric_name VARCHAR(100),  -- 'null_rate', 'duplicate_count', 'outlier_count'
  threshold_value DECIMAL(10,2),
  current_value DECIMAL(10,2),

  -- Business impact (calculated at creation)
  revenue_at_risk DECIMAL(12,2),
  affected_users INTEGER,
  affected_rows BIGINT,
  sla_violations TEXT[],  -- Array of contract names violated

  -- AI insights
  root_cause TEXT,  -- AI-generated explanation
  prediction TEXT,  -- "Will worsen by 20% in 3 days"
  recommendations JSONB DEFAULT '[]'::jsonb,
  -- [{action: 'Add NOT NULL constraint', confidence: 0.92, impact: 'Fix 95% of issues', autoApplicable: true}]

  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'in_progress', 'resolved', 'false_positive')),
  trending VARCHAR(20) CHECK (trending IN ('worsening', 'improving', 'stable')),
  priority INTEGER DEFAULT 50,  -- 0-100, higher = more urgent

  -- Lifecycle
  created_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  resolution_notes TEXT,

  -- Auto-remediation
  auto_remediated BOOLEAN DEFAULT false,
  auto_remediation_action TEXT,
  auto_remediation_result JSONB,

  -- Related entities
  related_rule_id UUID REFERENCES quality_rules(id) ON DELETE SET NULL,
  related_issue_id UUID REFERENCES quality_issues(id) ON DELETE SET NULL,
  related_contract_id UUID REFERENCES data_contracts(id) ON DELETE SET NULL
);

CREATE INDEX idx_alerts_active ON alert_events(status, severity, created_at DESC) WHERE status = 'active';
CREATE INDEX idx_alerts_table ON alert_events(table_name, created_at DESC);
CREATE INDEX idx_alerts_datasource ON alert_events(data_source_id, created_at DESC);
CREATE INDEX idx_alerts_priority ON alert_events(priority DESC, created_at DESC) WHERE status = 'active';

-- ============================================================================
-- 7. QUALITY METRICS CACHE (REDIS ALTERNATIVE)
-- ============================================================================
-- Fast lookup cache for frequently accessed quality metrics
CREATE TABLE IF NOT EXISTS quality_metrics_cache (
  cache_key VARCHAR(255) PRIMARY KEY,
  cache_value JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_cache_expiry ON quality_metrics_cache(expires_at);

-- Auto-cleanup expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM quality_metrics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. REALTIME QUALITY CALCULATION FUNCTION
-- ============================================================================
-- Stored procedure to calculate overall quality score from current data
CREATE OR REPLACE FUNCTION calculate_realtime_quality_score(
  p_data_source_id UUID,
  p_database_name VARCHAR DEFAULT NULL
)
RETURNS TABLE(
  overall_score INTEGER,
  dimension_scores JSONB,
  tables_scanned INTEGER,
  rows_scanned BIGINT
) AS $$
DECLARE
  v_completeness INTEGER;
  v_accuracy INTEGER;
  v_consistency INTEGER;
  v_validity INTEGER;
  v_freshness INTEGER;
  v_uniqueness INTEGER;
  v_overall INTEGER;
  v_tables INTEGER;
  v_rows BIGINT;
BEGIN
  -- Get latest dimension scores from quality_issues and quality_results
  -- This is a simplified calculation - real implementation would be more sophisticated

  SELECT
    COALESCE(AVG(CASE WHEN dimension = 'completeness' THEN score ELSE NULL END)::INTEGER, 0),
    COALESCE(AVG(CASE WHEN dimension = 'accuracy' THEN score ELSE NULL END)::INTEGER, 0),
    COALESCE(AVG(CASE WHEN dimension = 'consistency' THEN score ELSE NULL END)::INTEGER, 0),
    COALESCE(AVG(CASE WHEN dimension = 'validity' THEN score ELSE NULL END)::INTEGER, 0),
    COALESCE(AVG(CASE WHEN dimension = 'freshness' THEN score ELSE NULL END)::INTEGER, 0),
    COALESCE(AVG(CASE WHEN dimension = 'uniqueness' THEN score ELSE NULL END)::INTEGER, 0),
    COUNT(DISTINCT table_name)::INTEGER,
    SUM(affected_rows)::BIGINT
  INTO
    v_completeness, v_accuracy, v_consistency, v_validity, v_freshness, v_uniqueness, v_tables, v_rows
  FROM quality_issues qi
  WHERE qi.data_source_id = p_data_source_id
    AND (p_database_name IS NULL OR qi.database_name = p_database_name)
    AND qi.status != 'resolved'
    AND qi.created_at > NOW() - INTERVAL '7 days';

  -- Calculate overall score as average of dimensions
  v_overall := (v_completeness + v_accuracy + v_consistency + v_validity + v_freshness + v_uniqueness) / 6;

  RETURN QUERY SELECT
    v_overall,
    jsonb_build_object(
      'completeness', v_completeness,
      'accuracy', v_accuracy,
      'consistency', v_consistency,
      'validity', v_validity,
      'freshness', v_freshness,
      'uniqueness', v_uniqueness
    ),
    COALESCE(v_tables, 0),
    COALESCE(v_rows, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. ALERT PRIORITY CALCULATION FUNCTION
-- ============================================================================
-- Calculate priority score (0-100) based on severity, business impact, and trend
CREATE OR REPLACE FUNCTION calculate_alert_priority(
  p_severity VARCHAR,
  p_revenue_at_risk DECIMAL,
  p_affected_users INTEGER,
  p_trending VARCHAR
)
RETURNS INTEGER AS $$
DECLARE
  v_priority INTEGER := 0;
BEGIN
  -- Base priority from severity
  v_priority := CASE p_severity
    WHEN 'critical' THEN 70
    WHEN 'high' THEN 50
    WHEN 'medium' THEN 30
    WHEN 'low' THEN 10
    ELSE 0
  END;

  -- Add points for business impact
  IF p_revenue_at_risk > 100000 THEN
    v_priority := v_priority + 20;
  ELSIF p_revenue_at_risk > 10000 THEN
    v_priority := v_priority + 10;
  END IF;

  IF p_affected_users > 10000 THEN
    v_priority := v_priority + 10;
  ELSIF p_affected_users > 1000 THEN
    v_priority := v_priority + 5;
  END IF;

  -- Adjust for trend
  IF p_trending = 'worsening' THEN
    v_priority := v_priority + 10;
  ELSIF p_trending = 'improving' THEN
    v_priority := v_priority - 5;
  END IF;

  -- Cap at 100
  RETURN LEAST(v_priority, 100);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. TRIGGERS FOR AUTO-CALCULATION
-- ============================================================================
-- Auto-calculate priority when alert is created/updated
CREATE OR REPLACE FUNCTION auto_calculate_alert_priority()
RETURNS TRIGGER AS $$
BEGIN
  NEW.priority := calculate_alert_priority(
    NEW.severity,
    NEW.revenue_at_risk,
    NEW.affected_users,
    NEW.trending
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alert_priority
  BEFORE INSERT OR UPDATE ON alert_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_calculate_alert_priority();

-- ============================================================================
-- 11. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View: Latest quality score per data source
CREATE OR REPLACE VIEW v_latest_quality_scores AS
SELECT DISTINCT ON (data_source_id)
  id,
  data_source_id,
  database_name,
  overall_score,
  dimension_scores,
  measured_at,
  trend,
  change_percent,
  change_points
FROM quality_scores_realtime
ORDER BY data_source_id, measured_at DESC;

-- View: Active alerts with business context
CREATE OR REPLACE VIEW v_active_alerts_enriched AS
SELECT
  ae.*,
  ds.name as data_source_name,
  ds.type as data_source_type,
  dc.name as contract_name,
  dc.owner_email,
  dc.penalty_per_day as sla_penalty
FROM alert_events ae
LEFT JOIN data_sources ds ON ae.data_source_id = ds.id
LEFT JOIN data_contracts dc ON ae.related_contract_id = dc.id
WHERE ae.status = 'active'
ORDER BY ae.priority DESC, ae.created_at DESC;

-- View: SLA compliance summary
CREATE OR REPLACE VIEW v_sla_compliance_summary AS
SELECT
  dc.id,
  dc.name,
  dc.owner_team,
  dc.tables,
  dc.is_active,
  dc.violations_count,
  dc.compliance_rate,
  COUNT(sv.id) FILTER (WHERE sv.resolved_at IS NULL) as active_violations,
  SUM(COALESCE((sv.business_impact->>'revenue')::DECIMAL, 0)) as total_revenue_at_risk
FROM data_contracts dc
LEFT JOIN sla_violations sv ON dc.id = sv.contract_id
GROUP BY dc.id;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================
-- Grant access to application user (adjust username as needed)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'cwic_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cwic_app;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cwic_app;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cwic_app;
  END IF;
END $$;

-- ============================================================================
-- SAMPLE DATA FOR TESTING
-- ============================================================================
-- Insert sample business impact config (optional, for demo purposes)
INSERT INTO business_impact_config (data_source_id, revenue_tables, user_tables, hourly_downtime_cost, average_fix_cost, platform_cost_monthly)
SELECT
  id,
  '[{"table": "orders", "revenueColumn": "total_amount", "averageValue": 150}]'::jsonb,
  '[{"table": "customers", "userIdColumn": "customer_id", "isActiveColumn": "is_active"}]'::jsonb,
  5000.00,
  2000.00,
  10000.00
FROM data_sources
WHERE name = 'AdventureWorks'
ON CONFLICT (data_source_id) DO NOTHING;

-- ============================================================================
-- CLEANUP JOBS (RUN PERIODICALLY VIA CRON)
-- ============================================================================
-- Clean up old realtime scores (keep last 24 hours)
-- DELETE FROM quality_scores_realtime WHERE measured_at < NOW() - INTERVAL '24 hours';

-- Clean up expired predictions
-- DELETE FROM ml_predictions WHERE valid_until < NOW();

-- Clean up resolved violations older than 90 days
-- DELETE FROM sla_violations WHERE resolved_at IS NOT NULL AND resolved_at < NOW() - INTERVAL '90 days';

-- Clean up resolved alerts older than 30 days
-- DELETE FROM alert_events WHERE status = 'resolved' AND resolved_at < NOW() - INTERVAL '30 days';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration adds comprehensive infrastructure for:
-- ✅ Real-time quality monitoring
-- ✅ ML predictions and forecasting
-- ✅ Business impact tracking
-- ✅ Data contracts (SLAs)
-- ✅ Active alerts with auto-remediation
-- ✅ Performance optimization (indexes, views, caching)
