-- Migration: Critical Alerts Enhancements
-- Description: Add tables for smart alert management, criticality scoring, and trends
-- Phase: 1-4 (All Phases)

-- ============================================================================
-- PHASE 1: Foundation Tables
-- ============================================================================

-- Table: alert_criticality_scores
-- Purpose: Store calculated criticality scores for each alert
CREATE TABLE IF NOT EXISTS alert_criticality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id) ON DELETE CASCADE,
  score NUMERIC(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
  base_severity_score NUMERIC(5,2),
  financial_impact_score NUMERIC(5,2),
  user_impact_score NUMERIC(5,2),
  compliance_risk_score NUMERIC(5,2),
  trend_score NUMERIC(5,2),
  downstream_impact_score NUMERIC(5,2),
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(alert_id)
);

CREATE INDEX idx_alert_criticality_score ON alert_criticality_scores(score DESC);
CREATE INDEX idx_alert_criticality_alert_id ON alert_criticality_scores(alert_id);

-- Table: alert_suppression_rules
-- Purpose: Define rules for suppressing non-critical alerts
CREATE TABLE IF NOT EXISTS alert_suppression_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  condition_type VARCHAR(50) NOT NULL,
  -- Types: 'empty_table', 'test_db', 'low_impact', 'snoozed', 'duplicate'
  condition_params JSONB,
  enabled BOOLEAN DEFAULT true,
  priority INT DEFAULT 100, -- Lower = higher priority
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_suppression_rules_enabled ON alert_suppression_rules(enabled) WHERE enabled = true;

-- Table: alert_suppressions
-- Purpose: Track which alerts have been suppressed
CREATE TABLE IF NOT EXISTS alert_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id) ON DELETE CASCADE,
  suppression_rule_id UUID NOT NULL REFERENCES alert_suppression_rules(id) ON DELETE CASCADE,
  suppressed_at TIMESTAMP DEFAULT NOW(),
  reason TEXT,
  UNIQUE(alert_id)
);

CREATE INDEX idx_alert_suppressions_alert_id ON alert_suppressions(alert_id);
CREATE INDEX idx_alert_suppressions_rule_id ON alert_suppressions(suppression_rule_id);

-- Table: table_business_impact
-- Purpose: Store business metadata for tables (criticality, revenue impact, owners)
CREATE TABLE IF NOT EXISTS table_business_impact (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id INT REFERENCES catalog_assets(id) ON DELETE CASCADE,
  table_name VARCHAR(255) NOT NULL,
  database_name VARCHAR(255),
  data_source_id UUID,
  criticality VARCHAR(20) DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  revenue_per_row NUMERIC(10,2) DEFAULT 0, -- Estimated $ impact per row
  affected_processes JSONB, -- Array of business processes
  owner_team VARCHAR(255),
  owner_contact VARCHAR(255),
  compliance_tags JSONB, -- ['PII', 'PHI', 'GDPR', 'SOX', 'PCI']
  sla_freshness_hours INT, -- Data freshness SLA in hours
  sla_completeness_pct NUMERIC(5,2), -- Min completeness % (e.g., 95.00)
  sla_accuracy_pct NUMERIC(5,2), -- Min accuracy % (e.g., 99.00)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(table_name, database_name, data_source_id)
);

CREATE INDEX idx_table_business_impact_asset_id ON table_business_impact(asset_id);
CREATE INDEX idx_table_business_impact_criticality ON table_business_impact(criticality);
CREATE INDEX idx_table_business_impact_table ON table_business_impact(table_name, database_name);

-- ============================================================================
-- PHASE 2: Intelligence Tables
-- ============================================================================

-- Table: alert_trends
-- Purpose: Store trend analysis for quality metrics
CREATE TABLE IF NOT EXISTS alert_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES quality_rules(id) ON DELETE CASCADE,
  asset_id INT REFERENCES catalog_assets(id) ON DELETE CASCADE,
  trend_direction VARCHAR(20), -- 'improving', 'stable', 'degrading'
  velocity NUMERIC(10,2), -- Rate of change
  predicted_next_value NUMERIC(10,2),
  prediction_confidence NUMERIC(5,2), -- 0-100
  time_to_threshold VARCHAR(50), -- e.g., "8 hours", "2 days"
  anomaly_detected BOOLEAN DEFAULT false,
  anomaly_score NUMERIC(5,2), -- Z-score
  baseline_value NUMERIC(10,2),
  current_value NUMERIC(10,2),
  sparkline_data JSONB, -- Array of last 24 data points
  calculated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(rule_id, asset_id)
);

CREATE INDEX idx_alert_trends_rule_id ON alert_trends(rule_id);
CREATE INDEX idx_alert_trends_asset_id ON alert_trends(asset_id);
CREATE INDEX idx_alert_trends_anomaly ON alert_trends(anomaly_detected) WHERE anomaly_detected = true;

-- Table: alert_categories
-- Purpose: Categorize alerts by business impact type
CREATE TABLE IF NOT EXISTS alert_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  icon VARCHAR(50), -- Emoji or icon name
  color VARCHAR(20), -- Hex color for UI
  priority INT DEFAULT 100, -- Lower = higher priority
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: alert_category_mappings
-- Purpose: Map alerts to categories
CREATE TABLE IF NOT EXISTS alert_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES alert_categories(id) ON DELETE CASCADE,
  confidence NUMERIC(5,2) DEFAULT 100.00, -- 0-100
  assigned_at TIMESTAMP DEFAULT NOW(),
  assigned_by VARCHAR(50) DEFAULT 'system', -- 'system', 'user', 'ml'
  UNIQUE(alert_id, category_id)
);

CREATE INDEX idx_alert_category_mappings_alert_id ON alert_category_mappings(alert_id);
CREATE INDEX idx_alert_category_mappings_category_id ON alert_category_mappings(category_id);

-- Table: alert_groups
-- Purpose: Group related alerts together
CREATE TABLE IF NOT EXISTS alert_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(500) NOT NULL,
  description TEXT,
  category_id UUID REFERENCES alert_categories(id),
  group_key VARCHAR(255) UNIQUE NOT NULL,
  group_type VARCHAR(50), -- 'table', 'pipeline', 'business_process', 'dimension'
  first_seen TIMESTAMP NOT NULL,
  last_updated TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'resolved', 'snoozed', 'investigating'
  severity VARCHAR(20), -- Max severity in group
  aggregated_impact JSONB,
  alert_count INT DEFAULT 0
);

CREATE INDEX idx_alert_groups_status ON alert_groups(status);
CREATE INDEX idx_alert_groups_category_id ON alert_groups(category_id);
CREATE INDEX idx_alert_groups_last_updated ON alert_groups(last_updated DESC);

-- Table: alert_group_members
-- Purpose: Link alerts to groups
CREATE TABLE IF NOT EXISTS alert_group_members (
  alert_group_id UUID NOT NULL REFERENCES alert_groups(id) ON DELETE CASCADE,
  alert_id UUID NOT NULL REFERENCES quality_results(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (alert_group_id, alert_id)
);

CREATE INDEX idx_alert_group_members_group_id ON alert_group_members(alert_group_id);
CREATE INDEX idx_alert_group_members_alert_id ON alert_group_members(alert_id);

-- ============================================================================
-- PHASE 3: Automation Tables
-- ============================================================================

-- Table: alert_snoozes
-- Purpose: Track snoozed alerts
CREATE TABLE IF NOT EXISTS alert_snoozes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES quality_results(id) ON DELETE CASCADE,
  alert_group_id UUID REFERENCES alert_groups(id) ON DELETE CASCADE,
  snoozed_by VARCHAR(255),
  snooze_until TIMESTAMP NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CHECK ((alert_id IS NOT NULL) OR (alert_group_id IS NOT NULL))
);

CREATE INDEX idx_alert_snoozes_alert_id ON alert_snoozes(alert_id);
CREATE INDEX idx_alert_snoozes_group_id ON alert_snoozes(alert_group_id);
CREATE INDEX idx_alert_snoozes_until ON alert_snoozes(snooze_until);

-- Table: alert_recommendations
-- Purpose: Store actionable recommendations for alerts
CREATE TABLE IF NOT EXISTS alert_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'auto_fix', 'manual_fix', 'investigation', 'escalation'
  title VARCHAR(500) NOT NULL,
  description TEXT,
  steps JSONB, -- Array of step strings
  sql_query TEXT,
  api_call TEXT,
  estimated_time_minutes INT,
  risk_level VARCHAR(20) DEFAULT 'low', -- 'low', 'medium', 'high'
  required_permissions JSONB, -- Array of permission strings
  confidence NUMERIC(5,2) DEFAULT 80.00,
  priority INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_recommendations_alert_id ON alert_recommendations(alert_id);
CREATE INDEX idx_alert_recommendations_type ON alert_recommendations(type);

-- Table: alert_auto_fixes
-- Purpose: Track auto-fix executions
CREATE TABLE IF NOT EXISTS alert_auto_fixes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES quality_results(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES alert_recommendations(id),
  fix_type VARCHAR(100) NOT NULL,
  fix_params JSONB,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  rows_affected INT,
  execution_time_ms INT,
  error_message TEXT,
  executed_by VARCHAR(255),
  executed_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_alert_auto_fixes_alert_id ON alert_auto_fixes(alert_id);
CREATE INDEX idx_alert_auto_fixes_status ON alert_auto_fixes(status);

-- Table: alert_routing_rules
-- Purpose: Define rules for routing alerts to owners
CREATE TABLE IF NOT EXISTS alert_routing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  condition_type VARCHAR(50), -- 'database', 'table', 'category', 'severity'
  condition_value VARCHAR(255),
  destination_type VARCHAR(50), -- 'email', 'slack', 'pagerduty', 'teams'
  destination_config JSONB,
  notify_on_create BOOLEAN DEFAULT true,
  notify_on_update BOOLEAN DEFAULT false,
  notify_on_resolve BOOLEAN DEFAULT true,
  escalation_delay_minutes INT,
  enabled BOOLEAN DEFAULT true,
  priority INT DEFAULT 100,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_routing_rules_enabled ON alert_routing_rules(enabled) WHERE enabled = true;

-- Table: alert_notifications
-- Purpose: Track sent notifications
CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES quality_results(id) ON DELETE CASCADE,
  alert_group_id UUID REFERENCES alert_groups(id) ON DELETE CASCADE,
  routing_rule_id UUID REFERENCES alert_routing_rules(id),
  notification_type VARCHAR(50), -- 'email', 'slack', 'pagerduty', 'teams'
  recipient VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_alert_notifications_alert_id ON alert_notifications(alert_id);
CREATE INDEX idx_alert_notifications_status ON alert_notifications(status);

-- ============================================================================
-- PHASE 4: Advanced Features Tables
-- ============================================================================

-- Table: quality_sla_definitions
-- Purpose: Define quality SLAs for tables/databases
CREATE TABLE IF NOT EXISTS quality_sla_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  scope_type VARCHAR(50), -- 'table', 'database', 'data_source', 'global'
  scope_value VARCHAR(255),
  asset_id INT REFERENCES catalog_assets(id),
  data_source_id UUID,
  sla_type VARCHAR(50), -- 'freshness', 'completeness', 'accuracy', 'consistency'
  threshold_value NUMERIC(10,2),
  threshold_operator VARCHAR(10), -- '>', '<', '>=', '<=', '='
  measurement_window_hours INT DEFAULT 24,
  breach_severity VARCHAR(20) DEFAULT 'high',
  enabled BOOLEAN DEFAULT true,
  created_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_sla_defs_scope ON quality_sla_definitions(scope_type, scope_value);
CREATE INDEX idx_quality_sla_defs_enabled ON quality_sla_definitions(enabled) WHERE enabled = true;

-- Table: quality_sla_breaches
-- Purpose: Track SLA breaches
CREATE TABLE IF NOT EXISTS quality_sla_breaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_id UUID NOT NULL REFERENCES quality_sla_definitions(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES quality_results(id),
  breach_type VARCHAR(50),
  expected_value NUMERIC(10,2),
  actual_value NUMERIC(10,2),
  deviation_pct NUMERIC(5,2),
  breach_start TIMESTAMP NOT NULL,
  breach_end TIMESTAMP,
  duration_minutes INT,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'resolved', 'acknowledged'
  resolution_notes TEXT,
  acknowledged_by VARCHAR(255),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quality_sla_breaches_sla_id ON quality_sla_breaches(sla_id);
CREATE INDEX idx_quality_sla_breaches_status ON quality_sla_breaches(status);
CREATE INDEX idx_quality_sla_breaches_start ON quality_sla_breaches(breach_start DESC);

-- Table: alert_root_causes
-- Purpose: Store identified root causes for alerts
CREATE TABLE IF NOT EXISTS alert_root_causes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID REFERENCES quality_results(id) ON DELETE CASCADE,
  alert_group_id UUID REFERENCES alert_groups(id) ON DELETE CASCADE,
  cause_type VARCHAR(50), -- 'deployment', 'data_source', 'pipeline', 'manual', 'unknown'
  cause_description TEXT,
  evidence JSONB, -- Supporting evidence (deployment ID, pipeline run, etc.)
  confidence NUMERIC(5,2) DEFAULT 50.00,
  identified_by VARCHAR(50) DEFAULT 'system', -- 'system', 'ml', 'user'
  identified_at TIMESTAMP DEFAULT NOW(),
  verified_by VARCHAR(255),
  verified_at TIMESTAMP
);

CREATE INDEX idx_alert_root_causes_alert_id ON alert_root_causes(alert_id);
CREATE INDEX idx_alert_root_causes_group_id ON alert_root_causes(alert_group_id);
CREATE INDEX idx_alert_root_causes_type ON alert_root_causes(cause_type);

-- Table: ml_anomaly_models
-- Purpose: Store ML model metadata for anomaly detection
CREATE TABLE IF NOT EXISTS ml_anomaly_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  model_type VARCHAR(50), -- 'isolation_forest', 'lstm', 'prophet', 'arima'
  scope_type VARCHAR(50), -- 'global', 'database', 'table', 'rule'
  scope_value VARCHAR(255),
  model_params JSONB,
  training_data_start TIMESTAMP,
  training_data_end TIMESTAMP,
  training_row_count INT,
  accuracy_score NUMERIC(5,2),
  version INT DEFAULT 1,
  status VARCHAR(50) DEFAULT 'training', -- 'training', 'active', 'inactive', 'failed'
  trained_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ml_anomaly_models_status ON ml_anomaly_models(status);
CREATE INDEX idx_ml_anomaly_models_scope ON ml_anomaly_models(scope_type, scope_value);

-- Table: ml_anomaly_predictions
-- Purpose: Store ML predictions for quality metrics
CREATE TABLE IF NOT EXISTS ml_anomaly_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id UUID NOT NULL REFERENCES ml_anomaly_models(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES quality_rules(id),
  asset_id INT REFERENCES catalog_assets(id),
  prediction_type VARCHAR(50), -- 'anomaly', 'forecast', 'classification'
  predicted_value NUMERIC(10,2),
  confidence NUMERIC(5,2),
  anomaly_score NUMERIC(5,2),
  is_anomaly BOOLEAN DEFAULT false,
  prediction_timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ml_predictions_model_id ON ml_anomaly_predictions(model_id);
CREATE INDEX idx_ml_predictions_rule_id ON ml_anomaly_predictions(rule_id);
CREATE INDEX idx_ml_predictions_timestamp ON ml_anomaly_predictions(prediction_timestamp DESC);
CREATE INDEX idx_ml_predictions_anomaly ON ml_anomaly_predictions(is_anomaly) WHERE is_anomaly = true;

-- ============================================================================
-- Insert Default Alert Categories
-- ============================================================================

INSERT INTO alert_categories (name, display_name, description, icon, color, priority) VALUES
  ('data_corruption', 'Data Corruption', 'Invalid or corrupted data values', '💥', '#DC2626', 10),
  ('financial_risk', 'Financial Risk', 'Issues affecting revenue or financial data', '💰', '#EA580C', 20),
  ('compliance_breach', 'Compliance Breach', 'Violations of regulatory requirements', '🔒', '#9333EA', 30),
  ('pii_exposure', 'PII Exposure', 'Unencrypted or exposed sensitive data', '🚨', '#BE123C', 40),
  ('pipeline_failure', 'Pipeline Failure', 'ETL or data pipeline failures', '⚙️', '#DC2626', 50),
  ('sla_breach', 'SLA Breach', 'Data quality SLA violations', '⏰', '#EA580C', 60),
  ('downstream_impact', 'Downstream Impact', 'Breaking dependent systems', '🔗', '#D97706', 70),
  ('completeness_issue', 'Completeness Issue', 'Missing or NULL data', '📋', '#CA8A04', 80),
  ('accuracy_drift', 'Accuracy Drift', 'Data quality degrading over time', '📉', '#EAB308', 90),
  ('consistency_issue', 'Consistency Issue', 'Data mismatches across tables', '⚖️', '#84CC16', 100),
  ('referential_integrity', 'Referential Integrity', 'Orphaned or invalid references', '🔗', '#10B981', 110),
  ('constraint_violation', 'Constraint Violation', 'Database constraint failures', '⛔', '#14B8A6', 120)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Insert Default Suppression Rules
-- ============================================================================

INSERT INTO alert_suppression_rules (name, description, condition_type, condition_params, enabled, priority) VALUES
  (
    'empty-unused-tables',
    'Suppress empty table alerts for tables that have never contained data',
    'empty_table',
    '{"check_historical": true, "min_age_days": 7}',
    true,
    10
  ),
  (
    'test-databases',
    'Suppress alerts from test, dev, or sandbox databases',
    'test_db',
    '{"database_patterns": ["test_%", "dev_%", "%_test", "%_dev", "sandbox%"]}',
    true,
    20
  ),
  (
    'low-impact-stable',
    'Suppress low-impact issues that have been stable for >7 days',
    'low_impact',
    '{"max_financial_impact": 100, "max_user_impact": 10, "min_stable_days": 7}',
    true,
    30
  ),
  (
    'system-tables',
    'Suppress alerts from system/internal tables',
    'system_table',
    '{"table_patterns": ["pg_%", "information_schema.%", "sys.%", "INFORMATION_SCHEMA.%"]}',
    true,
    40
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- Insert Sample Business Impact Data
-- ============================================================================

-- Mark important tables as critical
INSERT INTO table_business_impact (
  table_name,
  database_name,
  criticality,
  revenue_per_row,
  affected_processes,
  compliance_tags,
  sla_freshness_hours,
  sla_completeness_pct,
  sla_accuracy_pct
) VALUES
  -- AdventureWorks critical tables
  (
    'customers',
    'adventureworks',
    'critical',
    50.00,
    '["customer_registration", "email_marketing", "password_reset"]',
    '["PII", "GDPR"]',
    24,
    95.00,
    99.00
  ),
  (
    'orders',
    'adventureworks',
    'critical',
    250.00,
    '["order_processing", "payment_processing", "inventory_management"]',
    '["PCI", "SOX"]',
    1,
    99.00,
    99.50
  ),
  (
    'payments',
    'adventureworks',
    'critical',
    300.00,
    '["payment_processing", "financial_reporting", "reconciliation"]',
    '["PCI", "SOX"]',
    1,
    100.00,
    99.90
  ),
  (
    'products',
    'adventureworks',
    'high',
    100.00,
    '["catalog_management", "pricing", "inventory"]',
    '[]',
    12,
    95.00,
    98.00
  ),
  (
    'inventory',
    'adventureworks',
    'high',
    75.00,
    '["inventory_management", "fulfillment", "purchasing"]',
    '[]',
    4,
    98.00,
    99.00
  ),
  (
    'employees',
    'adventureworks',
    'high',
    0.00,
    '["hr_management", "payroll", "access_control"]',
    '["PII", "GDPR"]',
    24,
    100.00,
    99.50
  )
ON CONFLICT (table_name, database_name, data_source_id) DO NOTHING;

-- ============================================================================
-- Create Indexes for Performance
-- ============================================================================

-- Quality results indexes for trend analysis
CREATE INDEX IF NOT EXISTS idx_quality_results_rule_run
  ON quality_results(rule_id, run_at DESC);

CREATE INDEX IF NOT EXISTS idx_quality_results_status_run
  ON quality_results(status, run_at DESC)
  WHERE status = 'failed';

-- Comments
COMMENT ON TABLE alert_criticality_scores IS 'Stores calculated criticality scores (0-100) for quality alerts';
COMMENT ON TABLE alert_suppression_rules IS 'Defines rules for automatically suppressing non-critical alerts';
COMMENT ON TABLE alert_suppressions IS 'Tracks which alerts have been suppressed by which rules';
COMMENT ON TABLE table_business_impact IS 'Business metadata for tables including criticality and revenue impact';
COMMENT ON TABLE alert_trends IS 'Trend analysis data including predictions and anomaly detection';
COMMENT ON TABLE alert_categories IS 'Predefined categories for classifying alerts by impact type';
COMMENT ON TABLE alert_groups IS 'Groups of related alerts (e.g., same root cause, same pipeline)';
COMMENT ON TABLE alert_snoozes IS 'Tracks snoozed alerts with expiration timestamps';
COMMENT ON TABLE alert_recommendations IS 'Actionable recommendations for resolving alerts';
COMMENT ON TABLE alert_auto_fixes IS 'History of automated fix attempts';
COMMENT ON TABLE quality_sla_definitions IS 'Quality SLA definitions for tables/databases';
COMMENT ON TABLE quality_sla_breaches IS 'Tracks quality SLA breaches';
COMMENT ON TABLE alert_root_causes IS 'Identified root causes for alerts';
COMMENT ON TABLE ml_anomaly_models IS 'ML models for anomaly detection and forecasting';
COMMENT ON TABLE ml_anomaly_predictions IS 'ML predictions and anomaly scores';

-- ============================================================================
-- Migration Complete
-- ============================================================================

SELECT 'Migration 024: Critical Alerts Enhancements - COMPLETE' as status;
