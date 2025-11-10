-- Migration: Create Field Discovery Tables
-- Description: Complete schema for field discovery, classification, and history tracking

-- 1. Main discovered fields table
CREATE TABLE IF NOT EXISTS discovered_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INTEGER NOT NULL DEFAULT 1,

  -- Field identification
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  asset_id BIGINT REFERENCES catalog_assets(id) ON DELETE CASCADE,
  column_id BIGINT REFERENCES catalog_columns(id) ON DELETE CASCADE,

  -- Field metadata
  field_name VARCHAR(255) NOT NULL,
  schema_name VARCHAR(255) NOT NULL,
  table_name VARCHAR(255) NOT NULL,
  data_type VARCHAR(100) NOT NULL,
  is_nullable BOOLEAN DEFAULT TRUE,

  -- Classification
  classification VARCHAR(50) NOT NULL CHECK (classification IN ('General', 'PII', 'PHI', 'Financial', 'Confidential')),
  sensitivity VARCHAR(50) NOT NULL CHECK (sensitivity IN ('Low', 'Medium', 'High', 'Critical')),
  confidence NUMERIC(3,2) DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  is_ai_generated BOOLEAN DEFAULT FALSE,

  -- Status tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'needs-review')),
  status_reason TEXT,

  -- Content
  description TEXT,
  business_context TEXT,
  suggested_tags TEXT[],
  suggested_rules TEXT[],
  data_patterns TEXT[],

  -- Timestamps and audit
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint to prevent duplicates
  CONSTRAINT unique_field_per_column UNIQUE (datasource_id, schema_name, table_name, field_name)
);

-- 2. Field discovery sessions table (track each scan)
CREATE TABLE IF NOT EXISTS field_discovery_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INTEGER NOT NULL DEFAULT 1,
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  -- Session metadata
  session_type VARCHAR(50) DEFAULT 'manual' CHECK (session_type IN ('manual', 'scheduled', 'drift-detection')),
  triggered_by VARCHAR(255),

  -- Scope
  target_schemas TEXT[],
  target_tables TEXT[],

  -- Results
  fields_discovered INTEGER DEFAULT 0,
  fields_classified INTEGER DEFAULT 0,
  pii_fields_found INTEGER DEFAULT 0,
  phi_fields_found INTEGER DEFAULT 0,
  financial_fields_found INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  duration_ms INTEGER,

  -- Status
  status VARCHAR(50) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Field classification history (track changes over time)
CREATE TABLE IF NOT EXISTS field_classification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES discovered_fields(id) ON DELETE CASCADE,

  -- What changed
  previous_classification VARCHAR(50),
  new_classification VARCHAR(50),
  previous_sensitivity VARCHAR(50),
  new_sensitivity VARCHAR(50),
  previous_status VARCHAR(50),
  new_status VARCHAR(50),

  -- Why it changed
  change_reason TEXT,
  changed_by VARCHAR(255),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Audit
  session_id UUID REFERENCES field_discovery_sessions(id) ON DELETE SET NULL
);

-- 4. Field validation rules (auto-generated or custom)
CREATE TABLE IF NOT EXISTS field_validation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES discovered_fields(id) ON DELETE CASCADE,

  -- Rule definition
  rule_type VARCHAR(100) NOT NULL,
  rule_name VARCHAR(255) NOT NULL,
  rule_expression TEXT,
  rule_parameters JSONB,

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  severity VARCHAR(50) DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  auto_generated BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255)
);

-- 5. Field drift alerts (schema changes)
CREATE TABLE IF NOT EXISTS field_drift_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID REFERENCES discovered_fields(id) ON DELETE CASCADE,
  datasource_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,

  -- Alert details
  alert_type VARCHAR(100) NOT NULL CHECK (alert_type IN ('new_field', 'removed_field', 'type_change', 'nullable_change', 'pattern_change')),
  alert_severity VARCHAR(50) DEFAULT 'medium' CHECK (alert_severity IN ('low', 'medium', 'high', 'critical')),

  -- Field info
  schema_name VARCHAR(255),
  table_name VARCHAR(255),
  field_name VARCHAR(255),

  -- Change details
  previous_value TEXT,
  new_value TEXT,
  description TEXT,

  -- Status
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'ignored')),
  resolved_by VARCHAR(255),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolution_notes TEXT,

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Field relationships (for lineage)
CREATE TABLE IF NOT EXISTS field_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_field_id UUID NOT NULL REFERENCES discovered_fields(id) ON DELETE CASCADE,
  target_field_id UUID NOT NULL REFERENCES discovered_fields(id) ON DELETE CASCADE,

  -- Relationship type
  relationship_type VARCHAR(100) NOT NULL CHECK (relationship_type IN ('derives_from', 'maps_to', 'aggregates_from', 'joins_with')),
  confidence NUMERIC(3,2) DEFAULT 0.50,

  -- Metadata
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR(255),
  verified_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT unique_field_relationship UNIQUE (source_field_id, target_field_id, relationship_type)
);

-- Indexes for performance
CREATE INDEX idx_discovered_fields_datasource ON discovered_fields(datasource_id);
CREATE INDEX idx_discovered_fields_status ON discovered_fields(status);
CREATE INDEX idx_discovered_fields_classification ON discovered_fields(classification);
CREATE INDEX idx_discovered_fields_sensitivity ON discovered_fields(sensitivity);
CREATE INDEX idx_discovered_fields_table ON discovered_fields(schema_name, table_name);
CREATE INDEX idx_discovered_fields_reviewed ON discovered_fields(reviewed_at) WHERE reviewed_at IS NOT NULL;

CREATE INDEX idx_field_sessions_datasource ON field_discovery_sessions(datasource_id);
CREATE INDEX idx_field_sessions_status ON field_discovery_sessions(status);
CREATE INDEX idx_field_sessions_started ON field_discovery_sessions(started_at);

CREATE INDEX idx_field_history_field ON field_classification_history(field_id);
CREATE INDEX idx_field_history_changed ON field_classification_history(changed_at);

CREATE INDEX idx_drift_alerts_status ON field_drift_alerts(status);
CREATE INDEX idx_drift_alerts_datasource ON field_drift_alerts(datasource_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_discovered_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_discovered_fields_updated_at
BEFORE UPDATE ON discovered_fields
FOR EACH ROW
EXECUTE FUNCTION update_discovered_fields_updated_at();

-- Comments for documentation
COMMENT ON TABLE discovered_fields IS 'Stores discovered and classified fields from data sources';
COMMENT ON TABLE field_discovery_sessions IS 'Tracks field discovery scan sessions';
COMMENT ON TABLE field_classification_history IS 'Audit trail of classification changes';
COMMENT ON TABLE field_validation_rules IS 'Validation rules for discovered fields';
COMMENT ON TABLE field_drift_alerts IS 'Schema change alerts for fields';
COMMENT ON TABLE field_relationships IS 'Relationships between fields for lineage';

COMMENT ON COLUMN discovered_fields.classification IS 'Field classification: General, PII, PHI, Financial, Confidential';
COMMENT ON COLUMN discovered_fields.sensitivity IS 'Data sensitivity level: Low, Medium, High, Critical';
COMMENT ON COLUMN discovered_fields.confidence IS 'AI confidence score (0-1)';
COMMENT ON COLUMN discovered_fields.status IS 'Review status: pending, accepted, rejected, needs-review';