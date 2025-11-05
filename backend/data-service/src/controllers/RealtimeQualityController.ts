/**
 * Controller for Real-Time Quality Monitoring API
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';

export class RealtimeQualityController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * GET /api/quality/realtime/metrics
   * Get current quality metrics for all assets or specific asset
   */
  public getMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { assetId, metricType, limit = 100 } = req.query;

      let query = `
        SELECT
          qmh.id,
          qmh.asset_id,
          a.name as asset_name,
          a.type as asset_type,
          qmh.metric_type,
          qmh.metric_value,
          qmh.previous_value,
          qmh.change_value,
          qmh.change_percent,
          qmh.metadata,
          qmh.recorded_at
        FROM quality_metric_history qmh
        JOIN assets a ON a.id = qmh.asset_id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (assetId) {
        query += ` AND qmh.asset_id = $${paramIndex++}`;
        params.push(assetId);
      }

      if (metricType) {
        query += ` AND qmh.metric_type = $${paramIndex++}`;
        params.push(metricType);
      }

      query += ` ORDER BY qmh.recorded_at DESC LIMIT $${paramIndex}`;
      params.push(limit);

      const result = await this.pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting metrics:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * GET /api/quality/realtime/alerts
   * Get active quality alerts
   */
  public getAlerts = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        status = 'active',
        severity,
        assetId,
        limit = 50,
        hours = 24
      } = req.query;

      let query = `
        SELECT
          qa.id,
          qa.asset_id,
          a.name as asset_name,
          a.type as asset_type,
          ds.name as data_source_name,
          qa.alert_type,
          qa.message,
          qa.severity,
          qa.status,
          qa.metadata,
          qa.created_at,
          qa.acknowledged_at,
          qa.acknowledged_by,
          qa.resolved_at,
          qa.resolved_by
        FROM quality_alerts_realtime qa
        JOIN assets a ON a.id = qa.asset_id
        LEFT JOIN data_sources ds ON ds.id = a.data_source_id
        WHERE qa.created_at > NOW() - INTERVAL '${hours} hours'
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (status && status !== 'all') {
        query += ` AND qa.status = $${paramIndex++}`;
        params.push(status);
      }

      if (severity) {
        query += ` AND qa.severity = $${paramIndex++}`;
        params.push(severity);
      }

      if (assetId) {
        query += ` AND qa.asset_id = $${paramIndex++}`;
        params.push(assetId);
      }

      query += `
        ORDER BY
          CASE qa.severity
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            ELSE 4
          END,
          qa.created_at DESC
        LIMIT $${paramIndex}
      `;
      params.push(limit);

      const result = await this.pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting alerts:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * POST /api/quality/realtime/alerts/:id/acknowledge
   * Acknowledge an alert
   */
  public acknowledgeAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId = 'system' } = req.body;

      const result = await this.pool.query(
        `UPDATE quality_alerts_realtime
         SET status = 'acknowledged',
             acknowledged_at = NOW(),
             acknowledged_by = $1,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [userId, id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Alert not found',
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Alert acknowledged',
      });
    } catch (error: any) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * POST /api/quality/realtime/alerts/:id/resolve
   * Resolve an alert
   */
  public resolveAlert = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { userId = 'system', resolution } = req.body;

      const result = await this.pool.query(
        `UPDATE quality_alerts_realtime
         SET status = 'resolved',
             resolved_at = NOW(),
             resolved_by = $1,
             metadata = jsonb_set(metadata, '{resolution}', $2::jsonb),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [userId, JSON.stringify(resolution || {}), id]
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Alert not found',
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Alert resolved',
      });
    } catch (error: any) {
      console.error('Error resolving alert:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * GET /api/quality/realtime/trends
   * Get quality score trends
   */
  public getTrends = async (req: Request, res: Response): Promise<void> => {
    try {
      const { assetId, days = 30 } = req.query;

      let query = `
        SELECT
          qst.asset_id,
          a.name as asset_name,
          a.type as asset_type,
          qst.date,
          qst.avg_score,
          qst.min_score,
          qst.max_score,
          qst.std_dev,
          qst.data_points
        FROM quality_score_trends qst
        JOIN assets a ON a.id = qst.asset_id
        WHERE qst.date > NOW() - INTERVAL '${days} days'
      `;

      const params: any[] = [];
      if (assetId) {
        query += ` AND qst.asset_id = $1`;
        params.push(assetId);
      }

      query += ` ORDER BY qst.asset_id, qst.date DESC`;

      const result = await this.pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting trends:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * GET /api/quality/realtime/dimensions
   * Get multi-dimensional quality scores
   */
  public getDimensionScores = async (req: Request, res: Response): Promise<void> => {
    try {
      const { assetId } = req.query;

      const query = `
        SELECT
          qds.asset_id,
          a.name as asset_name,
          a.type as asset_type,
          qds.weighted_avg_score,
          qds.last_measured,
          qds.dimension_scores
        FROM quality_dimension_summary qds
        JOIN assets a ON a.id = qds.asset_id
        ${assetId ? 'WHERE qds.asset_id = $1' : ''}
        ORDER BY qds.weighted_avg_score ASC
        LIMIT 100
      `;

      const params = assetId ? [assetId] : [];
      const result = await this.pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error getting dimension scores:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * GET /api/quality/realtime/stats
   * Get overall quality statistics
   */
  public getStats = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get summary statistics
      const statsQuery = `
        WITH recent_metrics AS (
          SELECT DISTINCT ON (asset_id, metric_type)
            asset_id, metric_type, metric_value, recorded_at
          FROM quality_metric_history
          ORDER BY asset_id, metric_type, recorded_at DESC
        ),
        alert_counts AS (
          SELECT
            severity,
            COUNT(*) as count
          FROM quality_alerts_realtime
          WHERE status = 'active'
            AND created_at > NOW() - INTERVAL '24 hours'
          GROUP BY severity
        )
        SELECT
          (SELECT COUNT(*) FROM assets WHERE type IN ('table', 'view')) as total_assets,
          (SELECT AVG(metric_value) FROM recent_metrics WHERE metric_type = 'score') as avg_quality_score,
          (SELECT COUNT(*) FROM quality_issues WHERE status = 'open') as open_issues,
          (SELECT json_object_agg(severity, count) FROM alert_counts) as alerts_by_severity,
          (SELECT COUNT(DISTINCT asset_id) FROM quality_metric_history WHERE recorded_at > NOW() - INTERVAL '1 hour') as recently_monitored
      `;

      const result = await this.pool.query(statsQuery);
      const stats = result.rows[0];

      res.json({
        success: true,
        data: {
          totalAssets: parseInt(stats.total_assets) || 0,
          avgQualityScore: parseFloat(stats.avg_quality_score) || 0,
          openIssues: parseInt(stats.open_issues) || 0,
          alertsBySeverity: stats.alerts_by_severity || {},
          recentlyMonitored: parseInt(stats.recently_monitored) || 0,
          timestamp: new Date(),
        },
      });
    } catch (error: any) {
      console.error('Error getting stats:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };

  /**
   * GET /api/quality/realtime/ws/stats
   * Get WebSocket connection statistics
   */
  public getWebSocketStats = async (req: Request, res: Response): Promise<void> => {
    try {
      const query = `
        SELECT
          COUNT(*) as active_connections,
          COUNT(DISTINCT user_id) as unique_users,
          MIN(connected_at) as oldest_connection,
          MAX(connected_at) as newest_connection,
          AVG(EXTRACT(EPOCH FROM (NOW() - connected_at))) as avg_connection_duration_seconds
        FROM websocket_sessions
        WHERE last_ping_at > NOW() - INTERVAL '5 minutes'
      `;

      const result = await this.pool.query(query);
      const stats = result.rows[0];

      res.json({
        success: true,
        data: {
          activeConnections: parseInt(stats.active_connections) || 0,
          uniqueUsers: parseInt(stats.unique_users) || 0,
          oldestConnection: stats.oldest_connection,
          newestConnection: stats.newest_connection,
          avgConnectionDurationSeconds: parseFloat(stats.avg_connection_duration_seconds) || 0,
        },
      });
    } catch (error: any) {
      console.error('Error getting WebSocket stats:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  };
}
