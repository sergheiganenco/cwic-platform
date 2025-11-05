-- backend/data-service/migrations/021_quality_engine_ml_tables_fixed.sql
-- Tables for the advanced Quality Engine v2.0 with ML capabilities (Fixed syntax)

BEGIN;

-- 1. ML Model Registry
CREATE TABLE IF NOT EXISTS quality_anomaly_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  model_type VARCHAR(50) NOT NULL,
  dimension VARCHAR(50),
  parameters JSONB NOT NULL DEFAULT '{}',
  training_data JSONB,
  accuracy DECIMAL(5,4),
  features TEXT[],
  window_size INTEGER,
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
  anomaly_type VARCHAR(50) NOT NULL,
  dimension VARCHAR(50),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  description TEXT NOT NULL,
  detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolution_type VARCHAR(50),
  model_id UUID REFERENCES quality_anomaly_models(id),
  metadata JSONB DEFAULT '{}'
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
  actual_score DECIMAL(5,2),
  error DECIMAL(5,2),

  UNIQUE (asset_id, dimension, prediction_date)
);

-- 4. Cost Tracking
CREATE TABLE IF NOT EXISTS quality_cost_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID,
  asset_id TEXT,
  execution_date DATE NOT NULL DEFAULT CURRENT_DATE,
  compute_units INTEGER,
  storage_scanned_gb DECIMAL(10,4),
  monetary_cost DECIMAL(10,4),
  execution_time_ms INTEGER,
  row_count BIGINT,
  status VARCHAR(20),
  error_message TEXT
);

-- 5. Auto-Healing Actions
CREATE TABLE IF NOT EXISTS quality_healing_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id UUID REFERENCES quality_anomalies(id),
  issue_id UUID,
  asset_id TEXT NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  confidence DECIMAL(5,4),
  executed_at TIMESTAMP,
  completed_at TIMESTAMP,
  rows_affected INTEGER,
  before_score DECIMAL(5,2),
  after_score DECIMAL(5,2),
  rollback_data JSONB,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

-- 6. Quality SLA Configuration
CREATE TABLE IF NOT EXISTS quality_sla_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  dimension VARCHAR(50) NOT NULL,
  min_threshold DECIMAL(5,2) NOT NULL,
  target_threshold DECIMAL(5,2) NOT NULL,
  breach_action VARCHAR(50) NOT NULL,
  escalation_path TEXT[],
  alert_channels JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  UNIQUE (asset_id, dimension)
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
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 9. Smart Profiling Patterns
CREATE TABLE IF NOT EXISTS quality_profiling_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id TEXT NOT NULL,
  column_name VARCHAR(255),
  pattern_type VARCHAR(50) NOT NULL,
  pattern_value JSONB NOT NULL,
  confidence DECIMAL(5,4),
  detected_at TIMESTAMP DEFAULT NOW(),
  verified BOOLEAN DEFAULT false,
  verified_by VARCHAR(100),
  verified_at TIMESTAMP
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
  metadata JSONB DEFAULT '{}'
);

-- Create indexes separately
CREATE INDEX IF NOT EXISTS idx_anomalies_asset ON quality_anomalies(asset_id);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON quality_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_detected ON quality_anomalies(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_predictions_asset_dim ON quality_predictions(asset_id, dimension);
CREATE INDEX IF NOT EXISTS idx_predictions_date ON quality_predictions(prediction_date);

CREATE INDEX IF NOT EXISTS idx_cost_date ON quality_cost_tracking(execution_date);
CREATE INDEX IF NOT EXISTS idx_cost_rule ON quality_cost_tracking(rule_id);
CREATE INDEX IF NOT EXISTS idx_cost_asset ON quality_cost_tracking(asset_id);

CREATE INDEX IF NOT EXISTS idx_healing_asset ON quality_healing_actions(asset_id);
CREATE INDEX IF NOT EXISTS idx_healing_status ON quality_healing_actions(status);
CREATE INDEX IF NOT EXISTS idx_healing_executed ON quality_healing_actions(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_sla_asset ON quality_sla_config(asset_id);
CREATE INDEX IF NOT EXISTS idx_sla_enabled ON quality_sla_config(enabled);

CREATE INDEX IF NOT EXISTS idx_ownership_asset ON quality_ownership(asset_id);
CREATE INDEX IF NOT EXISTS idx_ownership_level ON quality_ownership(certification_level);

CREATE INDEX IF NOT EXISTS idx_patterns_asset ON quality_profiling_patterns(asset_id);
CREATE INDEX IF NOT EXISTS idx_patterns_type ON quality_profiling_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_patterns_detected ON quality_profiling_patterns(detected_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_check ON quality_telemetry(check_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_time ON quality_telemetry(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_trace ON quality_telemetry(trace_id);

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
DROP TRIGGER IF EXISTS enforce_cost_budget ON quality_cost_tracking;
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

-- Additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_quality_anomaly_models_asset ON quality_anomaly_models(asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_anomaly_models_active ON quality_anomaly_models(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_quality_predictions_created ON quality_predictions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_healing_anomaly ON quality_healing_actions(anomaly_id);
CREATE INDEX IF NOT EXISTS idx_quality_cost_tracking_monetary ON quality_cost_tracking(monetary_cost DESC);

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
AND table_name IN (
  'quality_anomaly_models',
  'quality_anomalies',
  'quality_predictions',
  'quality_cost_tracking',
  'quality_healing_actions',
  'quality_sla_config',
  'quality_event_stream_state',
  'quality_ownership',
  'quality_profiling_patterns',
  'quality_telemetry'
)
ORDER BY table_name;