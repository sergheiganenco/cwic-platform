-- Migration: Quality Autopilot System
-- Creates tables and structures for automated rule generation and management

-- Table for rule groups (Autopilot, per-table groups, etc.)
CREATE TABLE IF NOT EXISTS quality_rule_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) NOT NULL, -- 'autopilot', 'table', 'custom'
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data_source_id, type, name)
);

-- Link rules to groups
CREATE TABLE IF NOT EXISTS quality_rule_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES quality_rule_groups(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES quality_rules(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(group_id, rule_id)
);

-- Rule templates for quick toggles
CREATE TABLE IF NOT EXISTS quality_rule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  display_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'quick', 'privacy', 'health', 'custom'
  rule_type VARCHAR(50) NOT NULL,
  icon VARCHAR(50),
  config_template JSONB NOT NULL, -- Template for rule config
  applies_to VARCHAR(50), -- 'table', 'column', 'database'
  detection_logic JSONB, -- How to detect if this rule applies
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Track autopilot profiling results
CREATE TABLE IF NOT EXISTS quality_autopilot_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  profile_data JSONB NOT NULL, -- Detailed profiling results
  rules_generated INTEGER DEFAULT 0,
  profiled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  profiled_by VARCHAR(255),
  status VARCHAR(50) DEFAULT 'completed' -- 'pending', 'running', 'completed', 'failed'
);

-- Scheduled scan configurations
CREATE TABLE IF NOT EXISTS quality_scan_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  rule_group_id UUID REFERENCES quality_rule_groups(id) ON DELETE CASCADE,
  cron_expression VARCHAR(100) NOT NULL, -- e.g., '0 3 * * *' for daily at 3 AM
  timezone VARCHAR(50) DEFAULT 'UTC',
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Scan execution history
CREATE TABLE IF NOT EXISTS quality_scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES quality_scan_schedules(id) ON DELETE SET NULL,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed'
  rules_executed INTEGER DEFAULT 0,
  rules_passed INTEGER DEFAULT 0,
  rules_failed INTEGER DEFAULT 0,
  rules_errored INTEGER DEFAULT 0,
  duration_ms INTEGER,
  error_message TEXT,
  triggered_by VARCHAR(50) -- 'schedule', 'manual', 'api'
);

-- Insert default rule templates
INSERT INTO quality_rule_templates (name, display_name, description, category, rule_type, icon, config_template, applies_to, sort_order) VALUES
  -- Quick Checks
  ('check_nulls', 'Check for empty values', 'Ensures important columns are not empty', 'quick', 'threshold', '⚠️',
   '{"metric": "null_rate", "operator": "<", "threshold": 0.01}', 'column', 1),

  ('validate_email_format', 'Validate email formats', 'Checks that emails follow standard format', 'quick', 'pattern', '📧',
   '{"pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$", "expectMatch": true}', 'column', 2),

  ('detect_duplicates', 'Detect duplicate records', 'Finds duplicate values in unique columns', 'quick', 'sql', '🔄',
   '{"expectZero": true}', 'column', 3),

  ('validate_phone_format', 'Validate phone formats', 'Checks phone numbers follow expected format', 'quick', 'pattern', '📱',
   '{"pattern": "^[+]?[(]?[0-9]{1,4}[)]?[-\\s\\.]?[(]?[0-9]{1,4}[)]?[-\\s\\.]?[0-9]{1,9}$", "expectMatch": true}', 'column', 4),

  ('check_data_freshness', 'Monitor data freshness', 'Alerts if data hasn''t been updated recently', 'quick', 'freshness_check', '⏰',
   '{"maxAgeDays": 1, "timestampColumn": "updated_at"}', 'table', 5),

  -- Privacy & Security
  ('detect_pii', 'Detect PII automatically', 'Identifies columns containing personal information', 'privacy', 'pii', '🔐',
   '{"autoDetect": true, "sensitivity": "high"}', 'table', 11),

  ('require_encryption', 'Require encryption for sensitive data', 'Ensures PII columns are encrypted', 'privacy', 'pii', '🔒',
   '{"requireEncryption": true}', 'column', 12),

  ('check_ssn_format', 'Validate SSN formats', 'Ensures SSNs follow correct format', 'privacy', 'pattern', '🆔',
   '{"pattern": "^(?!000|666)[0-8][0-9]{2}-(?!00)[0-9]{2}-(?!0000)[0-9]{4}$", "expectMatch": true}', 'column', 13),

  -- Data Health
  ('check_referential_integrity', 'Validate foreign key relationships', 'Ensures foreign keys reference existing records', 'health', 'comparison', '🔗',
   '{"checkOrphans": true}', 'column', 21),

  ('monitor_row_count', 'Monitor table row counts', 'Alerts on unexpected changes in row count', 'health', 'threshold', '📊',
   '{"metric": "row_count", "operator": ">", "threshold": 0, "anomalyDetection": true}', 'table', 22),

  ('check_data_types', 'Validate data types', 'Ensures columns contain expected data types', 'health', 'pattern', '🔢',
   '{"validateType": true}', 'column', 23)
ON CONFLICT (name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rule_groups_data_source ON quality_rule_groups(data_source_id);
CREATE INDEX IF NOT EXISTS idx_rule_groups_type ON quality_rule_groups(type);
CREATE INDEX IF NOT EXISTS idx_rule_group_members_group ON quality_rule_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_rule_group_members_rule ON quality_rule_group_members(rule_id);
CREATE INDEX IF NOT EXISTS idx_autopilot_profiles_ds ON quality_autopilot_profiles(data_source_id);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_ds ON quality_scan_schedules(data_source_id);
CREATE INDEX IF NOT EXISTS idx_scan_schedules_next_run ON quality_scan_schedules(next_run_at) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_scan_history_ds ON quality_scan_history(data_source_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_started ON quality_scan_history(started_at DESC);

-- Add trigger to update updated_at
CREATE OR REPLACE FUNCTION update_quality_rule_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rule_groups_updated_at
  BEFORE UPDATE ON quality_rule_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_quality_rule_groups_updated_at();

CREATE TRIGGER trigger_update_scan_schedules_updated_at
  BEFORE UPDATE ON quality_scan_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_quality_rule_groups_updated_at();

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Quality Autopilot system tables created successfully!';
  RAISE NOTICE 'Added 11 default rule templates';
END $$;
