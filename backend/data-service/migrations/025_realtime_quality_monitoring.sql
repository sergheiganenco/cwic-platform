-- Migration: Real-Time Quality Monitoring
-- Creates tables for real-time quality alerts and monitoring

-- Quality Alerts table
CREATE TABLE IF NOT EXISTS quality_alerts (
  id VARCHAR(255) PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES data_assets(id) ON DELETE CASCADE,
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

-- Indexes for quality_alerts
CREATE INDEX IF NOT EXISTS idx_quality_alerts_asset_id ON quality_alerts(asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_severity ON quality_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_status ON quality_alerts(status);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_created_at ON quality_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_alerts_alert_type ON quality_alerts(alert_type);

-- Quality Metric History table (for trending)
CREATE TABLE IF NOT EXISTS quality_metric_history (
  id SERIAL PRIMARY KEY,
  asset_id UUID NOT NULL REFERENCES data_assets(id) ON DELETE CASCADE,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN (
    'score',
    'issues',
    'profiling',
    'lineage',
    'completeness',
    'accuracy',
    'consistency',
    'timeliness'
  )),
  metric_value NUMERIC(10, 2) NOT NULL,
  previous_value NUMERIC(10, 2),
  change NUMERIC(10, 2),
  change_percent NUMERIC(10, 2),
  metadata JSONB DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for quality_metric_history
CREATE INDEX IF NOT EXISTS idx_quality_metric_history_asset_id ON quality_metric_history(asset_id);
CREATE INDEX IF NOT EXISTS idx_quality_metric_history_metric_type ON quality_metric_history(metric_type);
CREATE INDEX IF NOT EXISTS idx_quality_metric_history_recorded_at ON quality_metric_history(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_quality_metric_history_asset_type ON quality_metric_history(asset_id, metric_type, recorded_at DESC);

-- WebSocket Sessions table (track active connections)
CREATE TABLE IF NOT EXISTS websocket_sessions (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  connection_id VARCHAR(255) NOT NULL UNIQUE,
  subscriptions JSONB DEFAULT '[]'::jsonb,
  connected_at TIMESTAMP DEFAULT NOW(),
  last_ping_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for websocket_sessions
CREATE INDEX IF NOT EXISTS idx_websocket_sessions_user_id ON websocket_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_websocket_sessions_connected_at ON websocket_sessions(connected_at);
CREATE INDEX IF NOT EXISTS idx_websocket_sessions_last_ping ON websocket_sessions(last_ping_at);

-- Alert Subscriptions table (user preferences for alerts)
CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  asset_id UUID REFERENCES data_assets(id) ON DELETE CASCADE,
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

-- Indexes for alert_subscriptions
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_user_id ON alert_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_asset_id ON alert_subscriptions(asset_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_data_source_id ON alert_subscriptions(data_source_id);
CREATE INDEX IF NOT EXISTS idx_alert_subscriptions_enabled ON alert_subscriptions(enabled);

-- Function to clean up old metric history (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_metric_history()
RETURNS void AS $$
BEGIN
  DELETE FROM quality_metric_history
  WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Function to clean up stale websocket sessions (inactive for 1 hour)
CREATE OR REPLACE FUNCTION cleanup_stale_websocket_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM websocket_sessions
  WHERE last_ping_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at on quality_alerts
CREATE OR REPLACE FUNCTION update_quality_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quality_alerts_update_timestamp
BEFORE UPDATE ON quality_alerts
FOR EACH ROW
EXECUTE FUNCTION update_quality_alerts_updated_at();

-- Trigger to update updated_at on alert_subscriptions
CREATE TRIGGER alert_subscriptions_update_timestamp
BEFORE UPDATE ON alert_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_quality_alerts_updated_at();

-- View for active critical alerts
CREATE OR REPLACE VIEW active_critical_alerts AS
SELECT
  qa.*,
  da.name as asset_name,
  da.type as asset_type,
  ds.name as data_source_name
FROM quality_alerts qa
JOIN data_assets da ON da.id = qa.asset_id
JOIN data_sources ds ON ds.id = da.data_source_id
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

-- View for quality score trends (last 7 days)
CREATE OR REPLACE VIEW quality_score_trends AS
SELECT
  asset_id,
  DATE(recorded_at) as date,
  AVG(metric_value) as avg_score,
  MIN(metric_value) as min_score,
  MAX(metric_value) as max_score,
  COUNT(*) as data_points
FROM quality_metric_history
WHERE metric_type = 'score'
  AND recorded_at > NOW() - INTERVAL '7 days'
GROUP BY asset_id, DATE(recorded_at)
ORDER BY asset_id, date DESC;

-- Grant permissions (adjust as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON quality_alerts TO cwic_user;
GRANT SELECT, INSERT ON quality_metric_history TO cwic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON websocket_sessions TO cwic_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON alert_subscriptions TO cwic_user;
GRANT USAGE, SELECT ON SEQUENCE quality_metric_history_id_seq TO cwic_user;
GRANT USAGE, SELECT ON SEQUENCE alert_subscriptions_id_seq TO cwic_user;
GRANT SELECT ON active_critical_alerts TO cwic_user;
GRANT SELECT ON quality_score_trends TO cwic_user;

-- Insert some sample alert subscriptions for testing
INSERT INTO alert_subscriptions (user_id, alert_types, severity_threshold, channels)
VALUES
  ('admin', ARRAY['sudden_drop', 'new_issues', 'threshold_breach'], 'medium', ARRAY['websocket', 'email']),
  ('data_steward', ARRAY['sudden_drop', 'new_issues'], 'high', ARRAY['websocket', 'slack'])
ON CONFLICT DO NOTHING;

COMMENT ON TABLE quality_alerts IS 'Real-time quality monitoring alerts';
COMMENT ON TABLE quality_metric_history IS 'Historical tracking of quality metrics for trending';
COMMENT ON TABLE websocket_sessions IS 'Active WebSocket connections for real-time updates';
COMMENT ON TABLE alert_subscriptions IS 'User preferences for quality alert notifications';
COMMENT ON VIEW active_critical_alerts IS 'Currently active critical and high severity alerts';
COMMENT ON VIEW quality_score_trends IS 'Quality score trends over the last 7 days';
