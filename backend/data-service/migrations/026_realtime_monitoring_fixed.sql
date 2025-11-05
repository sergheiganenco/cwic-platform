-- Migration: Real-Time Quality Monitoring (Fixed for existing schema)
-- Adds real-time monitoring tables that work with existing 'assets' and 'data_sources' tables

-- Quality Alerts table (for real-time monitoring)
CREATE TABLE IF NOT EXISTS quality_alerts_realtime (
  id VARCHAR(255) PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
    'threshold_breach',
    'sudden_drop',
    'new_issues',
    'profiling_complete',
    'score_improvement',
    'issue_resolved'
  )),
  message TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'ignored')),
  metadata JSONB DEFAULT '{}'::jsonb,
  acknowledged_at TIMESTAMP,
  acknowledged_by VARCHAR(255),
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qa_rt_asset_id ON quality_alerts_realtime(asset_id);
CREATE INDEX IF NOT EXISTS idx_qa_rt_severity ON quality_alerts_realtime(severity);
CREATE INDEX IF NOT EXISTS idx_qa_rt_status ON quality_alerts_realtime(status);
CREATE INDEX IF NOT EXISTS idx_qa_rt_created_at ON quality_alerts_realtime(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_rt_alert_type ON quality_alerts_realtime(alert_type);

-- Quality Metric History table (for trending and forecasting)
CREATE TABLE IF NOT EXISTS quality_metric_history (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
    'score',
    'issues',
    'profiling',
    'lineage',
    'completeness',
    'accuracy',
    'consistency',
    'timeliness',
    'uniqueness',
    'validity'
  )),
  metric_value NUMERIC(10, 2) NOT NULL,
  previous_value NUMERIC(10, 2),
  change_value NUMERIC(10, 2),
  change_percent NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qmh_asset_id ON quality_metric_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_qmh_metric_type ON quality_metric_history(metric_type);
CREATE INDEX IF NOT EXISTS idx_qmh_recorded_at ON quality_metric_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_qmh_asset_type_time ON quality_metric_history(asset_id, metric_type, recorded_at DESC);

-- WebSocket Sessions table
CREATE TABLE IF NOT EXISTS websocket_sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  connection_id VARCHAR(255) NOT NULL UNIQUE,
  subscriptions JSONB DEFAULT '[]'::jsonb,
  connected_at TIMESTAMP DEFAULT NOW(),
  last_ping_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ws_user_id ON websocket_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_connected_at ON websocket_sessions(connected_at);
CREATE INDEX IF NOT EXISTS idx_ws_last_ping ON websocket_sessions(last_ping_at);

-- Alert Subscriptions table
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE CASCADE,
  alert_types TEXT[] DEFAULT ARRAY[]::TEXT[],
  severity_threshold VARCHAR(20) CHECK (severity_threshold IN ('low', 'medium', 'high', 'critical')),
  channels TEXT[] DEFAULT ARRAY['websocket']::TEXT[] CHECK (
    channels <@ ARRAY['websocket', 'email', 'slack', 'teams', 'webhook']::TEXT[]
  ),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT alert_sub_asset_or_source CHECK (
    (asset_id IS NOT NULL AND data_source_id IS NULL) OR
    (asset_id IS NULL AND data_source_id IS NOT NULL) OR
    (asset_id IS NULL AND data_source_id IS NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_as_user_id ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_as_asset_id ON alert_subscriptions(asset_id);
CREATE INDEX IF NOT EXISTS idx_as_data_source_id ON alert_subscriptions(data_source_id);
CREATE INDEX IF NOT EXISTS idx_as_enabled ON alert_subscriptions(enabled);

-- Quality Dimensions Scoring table (for multi-dimensional quality)
CREATE TABLE IF NOT EXISTS quality_dimension_scores (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  dimension VARCHAR(50) NOT NULL CHECK (dimension IN (
    'completeness',
    'accuracy',
    'consistency',
    'timeliness',
    'uniqueness',
    'validity',
    'integrity'
  )),
  score NUMERIC(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  weight NUMERIC(3, 2) DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1),
  details JSONB DEFAULT '{}'::jsonb,
  measured_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(asset_id, dimension, measured_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qds_asset_id ON quality_dimension_scores(asset_id);
CREATE INDEX IF NOT EXISTS idx_qds_dimension ON quality_dimension_scores(dimension);
CREATE INDEX IF NOT EXISTS idx_qds_measured_at ON quality_dimension_scores(measured_at DESC);
CREATE INDEX IF NOT EXISTS idx_qds_score ON quality_dimension_scores(score);

-- Functions
CREATE OR REPLACE FUNCTION cleanup_old_metric_history()
RETURNS void AS $$
BEGIN
  DELETE FROM quality_metric_history
  WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_stale_websocket_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM websocket_sessions
  WHERE last_ping_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_realtime_alerts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
DROP TRIGGER IF EXISTS quality_alerts_rt_update_timestamp ON quality_alerts_realtime;
CREATE TRIGGER quality_alerts_rt_update_timestamp
BEFORE UPDATE ON quality_alerts_realtime
FOR EACH ROW
EXECUTE FUNCTION update_realtime_alerts_timestamp();

DROP TRIGGER IF EXISTS alert_subscriptions_update_timestamp ON alert_subscriptions;
CREATE TRIGGER alert_subscriptions_update_timestamp
BEFORE UPDATE ON alert_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_realtime_alerts_timestamp();

-- Views
CREATE OR REPLACE VIEW active_critical_alerts AS
SELECT
  qa.*,
  a.name as asset_name,
  a.type as asset_type,
  ds.name as data_source_name
FROM quality_alerts_realtime qa
JOIN assets a ON a.id = qa.asset_id
LEFT JOIN data_sources ds ON ds.id = a.data_source_id
WHERE qa.status = 'active'
  AND qa.severity IN ('critical', 'high')
  AND qa.created_at > NOW() - INTERVAL '24 hours'
ORDER BY
  CASE qa.severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    ELSE 4
  END,
  qa.created_at DESC;

CREATE OR REPLACE VIEW quality_score_trends AS
SELECT
  asset_id,
  DATE(recorded_at) as date,
  AVG(metric_value) as avg_score,
  MIN(metric_value) as min_score,
  MAX(metric_value) as max_score,
  STDDEV(metric_value) as std_dev,
  COUNT(*) as data_points
FROM quality_metric_history
WHERE metric_type = 'score'
  AND recorded_at > NOW() - INTERVAL '30 days'
GROUP BY asset_id, DATE(recorded_at)
ORDER BY asset_id, date DESC;

CREATE OR REPLACE VIEW quality_dimension_summary AS
SELECT
  qds.asset_id,
  a.name as asset_name,
  a.type as asset_type,
  AVG(qds.score * qds.weight) as weighted_avg_score,
  MAX(qds.measured_at) as last_measured,
  jsonb_object_agg(qds.dimension, qds.score) as dimension_scores
FROM quality_dimension_scores qds
JOIN assets a ON a.id = qds.asset_id
WHERE qds.measured_at > NOW() - INTERVAL '24 hours'
GROUP BY qds.asset_id, a.name, a.type;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON quality_alerts_realtime TO cwic_user;
GRANT SELECT, INSERT ON quality_metric_history TO cwic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON websocket_sessions TO cwic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_subscriptions TO cwic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON quality_dimension_scores TO cwic_user;
GRANT USAGE, SELECT ON SEQUENCE quality_metric_history_id_seq TO cwic_user;
GRANT USAGE, SELECT ON SEQUENCE alert_subscriptions_id_seq TO cwic_user;
GRANT USAGE, SELECT ON SEQUENCE quality_dimension_scores_id_seq TO cwic_user;
GRANT SELECT ON active_critical_alerts TO cwic_user;
GRANT SELECT ON quality_score_trends TO cwic_user;
GRANT SELECT ON quality_dimension_summary TO cwic_user;

-- Insert default alert subscriptions
INSERT INTO alert_subscriptions (user_id, alert_types, severity_threshold, channels)
VALUES
  ('admin', ARRAY['sudden_drop', 'new_issues', 'threshold_breach'], 'medium', ARRAY['websocket']),
  ('data_steward', ARRAY['sudden_drop', 'new_issues'], 'high', ARRAY['websocket'])
ON CONFLICT DO NOTHING;

-- Comments
COMMENT ON TABLE quality_alerts_realtime IS 'Real-time quality monitoring alerts with WebSocket support';
COMMENT ON TABLE quality_metric_history IS 'Historical tracking of quality metrics for trending and forecasting';
COMMENT ON TABLE websocket_sessions IS 'Active WebSocket connections for real-time updates';
COMMENT ON TABLE alert_subscriptions IS 'User preferences for quality alert notifications';
COMMENT ON TABLE quality_dimension_scores IS 'Multi-dimensional quality scoring (completeness, accuracy, etc.)';
COMMENT ON VIEW active_critical_alerts IS 'Currently active critical and high severity alerts';
COMMENT ON VIEW quality_score_trends IS 'Quality score trends over the last 30 days';
COMMENT ON VIEW quality_dimension_summary IS 'Latest quality dimension scores per asset';

-- Insert initial metric history from existing quality scores
INSERT INTO quality_metric_history (asset_id, metric_type, metric_value, metadata)
SELECT
  id as asset_id,
  'score' as metric_type,
  COALESCE(quality_score, 0) as metric_value,
  jsonb_build_object('source', 'initial_migration', 'migrated_at', NOW()) as metadata
FROM assets
WHERE quality_score IS NOT NULL
  AND type IN ('table', 'view')
ON CONFLICT DO NOTHING;

COMMIT;
