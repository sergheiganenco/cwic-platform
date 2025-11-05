-- backend/data-service/migrations/020_quality_engine_ml_tables.sql
-- Tables for the advanced Quality Engine v2.0 with ML capabilities

BEGIN;

-- 1. ML Model Registry
CREATE TABLE IF NOT EXISTS quality_anomaly_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL, -- References catalog_assets but using TEXT for compatibility
  model_type VARCHAR(50) NOT NULL, -- 'isolation_forest', 'autoencoder', 'lstm', 'prophet'
  dimension VARCHAR(50), -- Quality dimension if specific to one
  parameters JSONB NOT NULL DEFAULT '{}', -- Model hyperparameters
  training_data JSONB, -- Sample training data for reference
  accuracy DECIMAL(5,4), -- Model accuracy score
  features TEXT[], -- Feature names used
  window_size INTEGER, -- For time-series models
  trained_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP,
  version INTEGER DEFAULT 1,
  active BOOLEAN DEFAULT true,
  created_by VARCHAR(100),

  CONSTRAINT unique_model_per_asset_type UNIQUE (asset_id, model_type, dimension)
);

-- 2. Anomaly Detection Results
CREATE TABLE IF NOT EXISTS quality_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  anomaly_type VARCHAR(50) NOT NULL, -- 'outlier', 'drift', 'pattern', 'missing', 'duplicate'
  dimension VARCHAR(50),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  description TEXT NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolution_type VARCHAR(50), -- 'auto_healed', 'manual', 'false_positive'
  model_id UUID REFERENCES quality_anomaly_models(id),
  metadata JSONB DEFAULT '{}', -- Additional context

  INDEX idx_anomalies_asset (asset_id),
  INDEX idx_anomalies_severity (severity),
  INDEX idx_anomalies_detected (detected_at DESC)
);

-- 3. Quality Predictions
CREATE TABLE IF NOT EXISTS quality_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  dimension VARCHAR(50) NOT NULL,
  prediction_date DATE NOT NULL,
  predicted_score DECIMAL(5,2),
  confidence_lower DECIMAL(5,2),
  confidence_upper DECIMAL(5,2),
  trend VARCHAR(20) CHECK (trend IN ('improving', 'stable', 'degrading')),
  model_id UUID REFERENCES quality_anomaly_models(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  actual_score DECIMAL(5,2), -- Filled in when actual is known
  error DECIMAL(5,2), -- Prediction error when actual is known

  UNIQUE (asset_id, dimension, prediction_date),
  INDEX idx_predictions_asset_dim (asset_id, dimension),
  INDEX idx_predictions_date (prediction_date)
);

-- 4. Cost Tracking
CREATE TABLE IF NOT EXISTS quality_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID, -- References quality_rules
  asset_id TEXT,
  execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  compute_units INTEGER,
  storage_scanned_gb DECIMAL(10,4),
  monetary_cost DECIMAL(10,4),
  execution_time_ms INTEGER,
  row_count BIGINT,
  status VARCHAR(20),
  error_message TEXT,

  INDEX idx_cost_date (execution_date),
  INDEX idx_cost_rule (rule_id),
  INDEX idx_cost_asset (asset_id)
);

-- 5. Auto-Healing Actions
CREATE TABLE IF NOT EXISTS quality_healing_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID REFERENCES quality_anomalies(id),
  issue_id UUID, -- References quality_issues if exists
  asset_id TEXT NOT NULL,
  action_type VARCHAR(50) NOT NULL, -- 'impute', 'deduplicate', 'standardize', 'enrich'
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  confidence DECIMAL(5,4),
  executed_at TIMESTAMP,
  completed_at TIMESTAMP,
  rows_affected INTEGER,
  before_score DECIMAL(5,2),
  after_score DECIMAL(5,2),
  rollback_data JSONB, -- Data needed to rollback
  error_message TEXT,
  metadata JSONB DEFAULT '{}',

  INDEX idx_healing_asset (asset_id),
  INDEX idx_healing_status (status),
  INDEX idx_healing_executed (executed_at DESC)
);

-- 6. Quality SLA Configuration
CREATE TABLE IF NOT EXISTS quality_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  dimension VARCHAR(50) NOT NULL,
  min_threshold DECIMAL(5,2) NOT NULL,
  target_threshold DECIMAL(5,2) NOT NULL,
  breach_action VARCHAR(50) NOT NULL, -- 'alert', 'auto_heal', 'escalate'
  escalation_path TEXT[],
  alert_channels JSONB DEFAULT '{}', -- Slack, email, etc.
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (asset_id, dimension),
  INDEX idx_sla_asset (asset_id),
  INDEX idx_sla_enabled (enabled)
);

-- 7. Real-time Event Stream State
CREATE TABLE IF NOT EXISTS quality_event_stream_state (
  stream_name VARCHAR(100) PRIMARY KEY,
  last_processed_id VARCHAR(100),
  last_processed_at TIMESTAMP,
  consumer_group VARCHAR(100),
  consumer_id VARCHAR(100),
  pending_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'
);

-- 8. Quality Ownership
CREATE TABLE IF NOT EXISTS quality_ownership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL UNIQUE,
  owner_ids TEXT[] NOT NULL,
  steward_ids TEXT[],
  certification_level VARCHAR(20) CHECK (certification_level IN ('bronze', 'silver', 'gold', 'platinum')),
  certified_by VARCHAR(100),
  certified_at TIMESTAMP,
  certification_expires_at TIMESTAMP,
  sla_id UUID REFERENCES quality_sla_config(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  INDEX idx_ownership_asset (asset_id),
  INDEX idx_ownership_level (certification_level)
);

-- 9. Smart Profiling Patterns
CREATE TABLE IF NOT EXISTS quality_profiling_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  column_name VARCHAR(255),
  pattern_type VARCHAR(50) NOT NULL, -- 'pii', 'enum', 'relationship', 'seasonality'
  pattern_value JSONB NOT NULL, -- Pattern details
  confidence DECIMAL(5,4),
  detected_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(100),
  verified_at TIMESTAMP,

  INDEX idx_patterns_asset (asset_id),
  INDEX idx_patterns_type (pattern_type),
  INDEX idx_patterns_detected (detected_at DESC)
);

-- 10. Quality Telemetry
CREATE TABLE IF NOT EXISTS quality_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id VARCHAR(100) NOT NULL,
  rule_id UUID,
  asset_id TEXT,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  cpu_ms INTEGER,
  memory_mb INTEGER,
  io_operations INTEGER,
  result_status VARCHAR(20),
  result_score DECIMAL(5,2),
  rows_checked BIGINT,
  rows_failed BIGINT,
  trace_id VARCHAR(100),
  span_id VARCHAR(100),
  parent_span_id VARCHAR(100),
  metadata JSONB DEFAULT '{}',

  INDEX idx_telemetry_check (check_id),
  INDEX idx_telemetry_time (start_time DESC),
  INDEX idx_telemetry_trace (trace_id)
);

-- Create functions for cost budget enforcement
CREATE OR REPLACE FUNCTION check_cost_budget()
RETURNS TRIGGER AS $$
DECLARE
  daily_total DECIMAL(10,4);
  monthly_total DECIMAL(10,4);
BEGIN
  -- Calculate daily total
  SELECT COALESCE(SUM(monetary_cost), 0) INTO daily_total
  FROM quality_cost_tracking
  WHERE execution_date = NEW.execution_date;

  -- Calculate monthly total
  SELECT COALESCE(SUM(monetary_cost), 0) INTO monthly_total
  FROM quality_cost_tracking
  WHERE DATE_TRUNC('month', execution_date) = DATE_TRUNC('month', NEW.execution_date);

  -- Check limits (these would be configurable)
  IF daily_total + NEW.monetary_cost > 100 THEN
    RAISE EXCEPTION 'Daily cost budget exceeded: % + % > 100', daily_total, NEW.monetary_cost;
  END IF;

  IF monthly_total + NEW.monetary_cost > 2000 THEN
    RAISE EXCEPTION 'Monthly cost budget exceeded: % + % > 2000', monthly_total, NEW.monetary_cost;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for cost budget enforcement
CREATE TRIGGER enforce_cost_budget
  BEFORE INSERT ON quality_cost_tracking
  FOR EACH ROW
  EXECUTE FUNCTION check_cost_budget();

-- Create function to calculate quality trend
CREATE OR REPLACE FUNCTION calculate_quality_trend(
  p_asset_id TEXT,
  p_dimension VARCHAR(50),
  p_days INTEGER DEFAULT 7
) RETURNS VARCHAR(20) AS $$
DECLARE
  current_avg DECIMAL(5,2);
  previous_avg DECIMAL(5,2);
  trend VARCHAR(20);
BEGIN
  -- Get current period average
  SELECT AVG(
    CASE p_dimension
      WHEN 'completeness' THEN completeness_score
      WHEN 'accuracy' THEN accuracy_score
      WHEN 'consistency' THEN consistency_score
      WHEN 'validity' THEN validity_score
      WHEN 'freshness' THEN freshness_score
      WHEN 'uniqueness' THEN uniqueness_score
    END
  ) INTO current_avg
  FROM data_profiles dp
  JOIN catalog_assets ca ON dp.asset_id = ca.id
  WHERE ca.id::text = p_asset_id
    AND profile_date >= CURRENT_DATE - INTERVAL '1 day' * p_days;

  -- Get previous period average
  SELECT AVG(
    CASE p_dimension
      WHEN 'completeness' THEN completeness_score
      WHEN 'accuracy' THEN accuracy_score
      WHEN 'consistency' THEN consistency_score
      WHEN 'validity' THEN validity_score
      WHEN 'freshness' THEN freshness_score
      WHEN 'uniqueness' THEN uniqueness_score
    END
  ) INTO previous_avg
  FROM data_profiles dp
  JOIN catalog_assets ca ON dp.asset_id = ca.id
  WHERE ca.id::text = p_asset_id
    AND profile_date >= CURRENT_DATE - INTERVAL '1 day' * (p_days * 2)
    AND profile_date < CURRENT_DATE - INTERVAL '1 day' * p_days;

  -- Determine trend
  IF current_avg IS NULL OR previous_avg IS NULL THEN
    trend := 'stable';
  ELSIF current_avg > previous_avg + 5 THEN
    trend := 'improving';
  ELSIF current_avg < previous_avg - 5 THEN
    trend := 'degrading';
  ELSE
    trend := 'stable';
  END IF;

  RETURN trend;
END;
$$ LANGUAGE plpgsql;

-- Add indexes for performance
CREATE INDEX idx_quality_anomaly_models_asset ON quality_anomaly_models(asset_id);
CREATE INDEX idx_quality_anomaly_models_active ON quality_anomaly_models(active) WHERE active = true;
CREATE INDEX idx_quality_predictions_created ON quality_predictions(created_at DESC);
CREATE INDEX idx_quality_healing_anomaly ON quality_healing_actions(anomaly_id);
CREATE INDEX idx_quality_cost_tracking_monetary ON quality_cost_tracking(monetary_cost DESC);

-- Add comments
COMMENT ON TABLE quality_anomaly_models IS 'ML models for anomaly detection and prediction';
COMMENT ON TABLE quality_anomalies IS 'Detected data quality anomalies';
COMMENT ON TABLE quality_predictions IS 'Predictive quality forecasts';
COMMENT ON TABLE quality_cost_tracking IS 'Cost tracking for quality checks';
COMMENT ON TABLE quality_healing_actions IS 'Automated healing actions for quality issues';
COMMENT ON TABLE quality_sla_config IS 'SLA configuration for quality dimensions';
COMMENT ON TABLE quality_ownership IS 'Ownership and certification for data assets';
COMMENT ON TABLE quality_profiling_patterns IS 'Detected patterns from smart profiling';
COMMENT ON TABLE quality_telemetry IS 'Detailed telemetry for quality checks';

COMMIT;

-- Verification
SELECT 'Quality Engine v2.0 tables created successfully' as status;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'quality_%'
ORDER BY table_name;