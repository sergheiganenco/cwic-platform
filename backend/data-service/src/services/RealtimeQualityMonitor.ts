/**
 * Real-Time Quality Monitoring Service
 * Monitors quality metrics and broadcasts changes via WebSocket
 */

import { Pool } from 'pg';
import { EventEmitter } from 'events';
import Redis from 'ioredis';

export interface QualityMetric {
  assetId: string;
  assetName: string;
  metricType: 'score' | 'issues' | 'profiling' | 'lineage';
  previousValue: number | null;
  currentValue: number;
  change: number;
  changePercent: number;
  timestamp: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface QualityAlert {
  id: string;
  assetId: string;
  assetName: string;
  alertType: 'threshold_breach' | 'sudden_drop' | 'new_issues' | 'profiling_complete';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class RealtimeQualityMonitor extends EventEmitter {
  private pool: Pool;
  private redis: Redis;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastMetrics: Map<string, QualityMetric> = new Map();

  // Thresholds for alerting
  private readonly THRESHOLDS = {
    SCORE_DROP_CRITICAL: 20, // Alert if score drops by 20+ points
    SCORE_DROP_HIGH: 10,
    SCORE_DROP_MEDIUM: 5,
    ISSUE_INCREASE_CRITICAL: 10, // Alert if issues increase by 10+
    ISSUE_INCREASE_HIGH: 5,
    ISSUE_INCREASE_MEDIUM: 2,
  };

  constructor(pool: Pool, redisUrl?: string) {
    super();
    this.pool = pool;
    this.redis = redisUrl
      ? new Redis(redisUrl)
      : new Redis({
          host: process.env.REDIS_HOST || 'redis',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
        });
  }

  /**
   * Start monitoring quality metrics
   */
  public async start(intervalMs: number = 30000): Promise<void> {
    console.log(`🔴 Starting real-time quality monitoring (interval: ${intervalMs}ms)`);

    // Initial scan
    await this.scanQualityMetrics();

    // Set up periodic scanning
    this.monitoringInterval = setInterval(async () => {
      await this.scanQualityMetrics();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  public stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    console.log('🛑 Stopped real-time quality monitoring');
  }

  /**
   * Scan all assets for quality changes
   */
  private async scanQualityMetrics(): Promise<void> {
    try {
      // Get current quality scores
      const scoreMetrics = await this.getQualityScoreMetrics();

      // Get current issue counts
      const issueMetrics = await this.getIssueCountMetrics();

      // Check for changes and emit events
      for (const metric of [...scoreMetrics, ...issueMetrics]) {
        const key = `${metric.assetId}:${metric.metricType}`;
        const lastMetric = this.lastMetrics.get(key);

        if (lastMetric) {
          // Calculate change
          metric.previousValue = lastMetric.currentValue;
          metric.change = metric.currentValue - lastMetric.currentValue;
          metric.changePercent = lastMetric.currentValue !== 0
            ? (metric.change / lastMetric.currentValue) * 100
            : 0;

          // Check if significant change occurred
          if (this.isSignificantChange(metric)) {
            // Emit metric change event
            this.emit('metricChange', metric);

            // Check if alert threshold is breached
            const alert = this.checkAlertThreshold(metric);
            if (alert) {
              this.emit('alert', alert);
              await this.storeAlert(alert);
            }

            // Broadcast via Redis pub/sub
            await this.broadcastMetricChange(metric);
          }
        }

        // Update last metric
        this.lastMetrics.set(key, metric);
      }

      // Cache current metrics in Redis for quick access
      await this.cacheMetrics([...scoreMetrics, ...issueMetrics]);

    } catch (error) {
      console.error('❌ Error scanning quality metrics:', error);
      this.emit('error', error);
    }
  }

  /**
   * Get current quality score metrics for all assets
   */
  private async getQualityScoreMetrics(): Promise<QualityMetric[]> {
    const query = `
      SELECT
        a.id as asset_id,
        a.name as asset_name,
        COALESCE(a.quality_score, 0) as quality_score
      FROM assets a
      WHERE a.type IN ('table', 'view')
      ORDER BY a.updated_at DESC
      LIMIT 1000
    `;

    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      assetId: row.asset_id,
      assetName: row.asset_name,
      metricType: 'score' as const,
      previousValue: null,
      currentValue: parseFloat(row.quality_score) || 0,
      change: 0,
      changePercent: 0,
      timestamp: new Date(),
    }));
  }

  /**
   * Get current issue count metrics for all assets
   */
  private async getIssueCountMetrics(): Promise<QualityMetric[]> {
    const query = `
      SELECT
        a.id as asset_id,
        a.name as asset_name,
        COUNT(DISTINCT qi.id) as issue_count
      FROM assets a
      LEFT JOIN quality_issues qi ON qi.asset_id = a.id
        AND qi.status = 'open'
      WHERE a.type IN ('table', 'view')
      GROUP BY a.id, a.name
      HAVING COUNT(DISTINCT qi.id) > 0
      ORDER BY issue_count DESC
      LIMIT 1000
    `;

    const result = await this.pool.query(query);

    return result.rows.map(row => ({
      assetId: row.asset_id,
      assetName: row.asset_name,
      metricType: 'issues' as const,
      previousValue: null,
      currentValue: parseInt(row.issue_count) || 0,
      change: 0,
      changePercent: 0,
      timestamp: new Date(),
    }));
  }

  /**
   * Check if a metric change is significant enough to report
   */
  private isSignificantChange(metric: QualityMetric): boolean {
    // No change
    if (metric.change === 0) return false;

    // For scores, any drop of 1+ point is significant
    if (metric.metricType === 'score') {
      return Math.abs(metric.change) >= 1;
    }

    // For issues, any increase is significant
    if (metric.metricType === 'issues') {
      return metric.change > 0;
    }

    return false;
  }

  /**
   * Check if metric change exceeds alert thresholds
   */
  private checkAlertThreshold(metric: QualityMetric): QualityAlert | null {
    if (metric.metricType === 'score' && metric.change < 0) {
      // Score dropped
      const drop = Math.abs(metric.change);

      if (drop >= this.THRESHOLDS.SCORE_DROP_CRITICAL) {
        return {
          id: `${Date.now()}-${metric.assetId}`,
          assetId: metric.assetId,
          assetName: metric.assetName,
          alertType: 'sudden_drop',
          message: `Quality score dropped by ${drop.toFixed(1)} points (${metric.changePercent.toFixed(1)}%)`,
          severity: 'critical',
          timestamp: new Date(),
          metadata: {
            previousValue: metric.previousValue,
            currentValue: metric.currentValue,
            change: metric.change,
          },
        };
      } else if (drop >= this.THRESHOLDS.SCORE_DROP_HIGH) {
        return {
          id: `${Date.now()}-${metric.assetId}`,
          assetId: metric.assetId,
          assetName: metric.assetName,
          alertType: 'sudden_drop',
          message: `Quality score dropped by ${drop.toFixed(1)} points`,
          severity: 'high',
          timestamp: new Date(),
          metadata: {
            previousValue: metric.previousValue,
            currentValue: metric.currentValue,
            change: metric.change,
          },
        };
      } else if (drop >= this.THRESHOLDS.SCORE_DROP_MEDIUM) {
        return {
          id: `${Date.now()}-${metric.assetId}`,
          assetId: metric.assetId,
          assetName: metric.assetName,
          alertType: 'threshold_breach',
          message: `Quality score decreased by ${drop.toFixed(1)} points`,
          severity: 'medium',
          timestamp: new Date(),
          metadata: {
            previousValue: metric.previousValue,
            currentValue: metric.currentValue,
            change: metric.change,
          },
        };
      }
    } else if (metric.metricType === 'issues' && metric.change > 0) {
      // Issues increased
      const increase = metric.change;

      if (increase >= this.THRESHOLDS.ISSUE_INCREASE_CRITICAL) {
        return {
          id: `${Date.now()}-${metric.assetId}`,
          assetId: metric.assetId,
          assetName: metric.assetName,
          alertType: 'new_issues',
          message: `${increase} new quality issues detected`,
          severity: 'critical',
          timestamp: new Date(),
          metadata: {
            previousValue: metric.previousValue,
            currentValue: metric.currentValue,
            change: metric.change,
          },
        };
      } else if (increase >= this.THRESHOLDS.ISSUE_INCREASE_HIGH) {
        return {
          id: `${Date.now()}-${metric.assetId}`,
          assetId: metric.assetId,
          assetName: metric.assetName,
          alertType: 'new_issues',
          message: `${increase} new quality issues detected`,
          severity: 'high',
          timestamp: new Date(),
          metadata: {
            previousValue: metric.previousValue,
            currentValue: metric.currentValue,
            change: metric.change,
          },
        };
      } else if (increase >= this.THRESHOLDS.ISSUE_INCREASE_MEDIUM) {
        return {
          id: `${Date.now()}-${metric.assetId}`,
          assetId: metric.assetId,
          assetName: metric.assetName,
          alertType: 'new_issues',
          message: `${increase} new quality issues detected`,
          severity: 'medium',
          timestamp: new Date(),
          metadata: {
            previousValue: metric.previousValue,
            currentValue: metric.currentValue,
            change: metric.change,
          },
        };
      }
    }

    return null;
  }

  /**
   * Store alert in database
   */
  private async storeAlert(alert: QualityAlert): Promise<void> {
    const query = `
      INSERT INTO quality_alerts_realtime
        (id, asset_id, alert_type, message, severity, metadata, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO NOTHING
    `;

    await this.pool.query(query, [
      alert.id,
      alert.assetId,
      alert.alertType,
      alert.message,
      alert.severity,
      JSON.stringify(alert.metadata || {}),
      alert.timestamp,
    ]).catch(err => {
      // Log error but don't fail
      console.warn('⚠️  Could not store alert:', err.message);
    });
  }

  /**
   * Broadcast metric change via Redis pub/sub
   */
  private async broadcastMetricChange(metric: QualityMetric): Promise<void> {
    await this.redis.publish('quality:metrics', JSON.stringify(metric));
  }

  /**
   * Cache metrics in Redis for quick access
   */
  private async cacheMetrics(metrics: QualityMetric[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const metric of metrics) {
      const key = `quality:metric:${metric.assetId}:${metric.metricType}`;
      pipeline.setex(key, 300, JSON.stringify(metric)); // Cache for 5 minutes
    }

    await pipeline.exec();
  }

  /**
   * Get cached metric from Redis
   */
  public async getCachedMetric(assetId: string, metricType: string): Promise<QualityMetric | null> {
    const key = `quality:metric:${assetId}:${metricType}`;
    const cached = await this.redis.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  /**
   * Get all active alerts
   */
  public async getActiveAlerts(limit: number = 50): Promise<QualityAlert[]> {
    const query = `
      SELECT
        id, asset_id, alert_type, message, severity, metadata, created_at
      FROM quality_alerts_realtime
      WHERE status = 'active'
        AND created_at > NOW() - INTERVAL '24 hours'
      ORDER BY
        CASE severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        created_at DESC
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]).catch(() => ({ rows: [] }));

    return result.rows.map(row => ({
      id: row.id,
      assetId: row.asset_id,
      assetName: '', // Not in this query
      alertType: row.alert_type,
      message: row.message,
      severity: row.severity,
      timestamp: row.created_at,
      metadata: row.metadata,
    }));
  }

  /**
   * Subscribe to quality metric changes
   */
  public subscribeToMetrics(callback: (metric: QualityMetric) => void): () => void {
    const handler = (channel: string, message: string) => {
      if (channel === 'quality:metrics') {
        try {
          const metric = JSON.parse(message);
          callback(metric);
        } catch (error) {
          console.error('Error parsing metric message:', error);
        }
      }
    };

    const subscriber = this.redis.duplicate();
    subscriber.subscribe('quality:metrics');
    subscriber.on('message', handler);

    // Return unsubscribe function
    return () => {
      subscriber.unsubscribe('quality:metrics');
      subscriber.disconnect();
    };
  }

  /**
   * Clean up resources
   */
  public async cleanup(): Promise<void> {
    this.stop();
    await this.redis.quit();
  }
}
