// backend/data-service/src/services/RealtimeQualityService.ts
// Real-Time Quality Monitoring Service with WebSocket Support

import { Server as SocketServer, Socket } from 'socket.io';
import { EventEmitter } from 'events';
import pool from '../db';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LiveQualityScore {
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
  changePercent: number;
  lastUpdated: Date;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  benchmarks: {
    industry: number;
    yourAvg: number;
  };
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
    freshness: number;
    uniqueness: number;
  };
}

export interface QuickStats {
  monitoring: {
    tables: number;
    columns: number;
    dataSources: number;
    totalRows: number;
  };
  activity: {
    rowsScannedToday: number;
    rulesExecutedToday: number;
    alertsTriggered: number;
    issuesResolved: number;
  };
  rules: {
    total: number;
    enabled: number;
    passing: number;
    failing: number;
  };
  health: {
    overallCompliance: number;
    criticalIssues: number;
    warnings: number;
    healthy: number;
  };
  liveMetrics: {
    rowsScannedPerSecond: number;
    alertsPerHour: number;
    averageResponseTime: number;
  };
}

export interface ActiveAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  table: string;
  column?: string;
  metric: string;
  threshold: number;
  current: number;
  businessImpact: {
    revenueAtRisk: number;
    affectedUsers: number;
    slaViolations: string[];
  };
  rootCause?: string;
  prediction?: string;
  recommendations: Array<{
    action: string;
    confidence: number;
    estimatedImpact: string;
    autoApplicable: boolean;
  }>;
  createdAt: Date;
  trending: 'worsening' | 'improving' | 'stable';
  priority: number;
}

// ============================================================================
// REALTIME QUALITY SERVICE
// ============================================================================

export class RealtimeQualityService extends EventEmitter {
  private io: SocketServer;
  private updateInterval: NodeJS.Timer | null = null;
  private connectedClients: Map<string, { socket: Socket; filters: any }> = new Map();
  private lastQualityScores: Map<string, LiveQualityScore> = new Map();

  constructor(io: SocketServer) {
    super();
    this.io = io;
    this.setupSocketHandlers();
    this.startRealtimeUpdates();
    console.log('✅ RealtimeQualityService initialized');
  }

  // ============================================================================
  // SOCKET.IO HANDLERS
  // ============================================================================

  private setupSocketHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`🔌 Client connected: ${socket.id}`);

      // Handle subscription to overview updates
      socket.on('subscribe:overview', async (filters: any) => {
        console.log(`📡 Client ${socket.id} subscribed with filters:`, filters);
        this.connectedClients.set(socket.id, { socket, filters });

        // Send immediate data on subscription
        try {
          const qualityScore = await this.calculateLiveQualityScore(filters.dataSourceId);
          const stats = await this.getQuickStats(filters.dataSourceId);
          const alerts = await this.getActiveAlerts(filters.dataSourceId);

          socket.emit('quality:update', qualityScore);
          socket.emit('stats:update', stats);
          socket.emit('alerts:initial', alerts);
        } catch (error) {
          console.error('Error sending initial data:', error);
        }
      });

      // Handle unsubscription
      socket.on('unsubscribe:overview', () => {
        console.log(`📴 Client ${socket.id} unsubscribed`);
        this.connectedClients.delete(socket.id);
      });

      // Handle prediction requests
      socket.on('request:prediction', async (data: { table: string; metric: string }) => {
        try {
          // This would call ML service - for now, return mock
          const prediction = await this.requestMLPrediction(data.table, data.metric);
          socket.emit('prediction:ready', prediction);
        } catch (error) {
          console.error('Error generating prediction:', error);
        }
      });

      // Handle recommendation application
      socket.on('apply:recommendation', async (data: { alertId: string; actionIndex: number }) => {
        try {
          const result = await this.applyRecommendation(data.alertId, data.actionIndex);
          socket.emit('recommendation:applied', result);

          // Refresh quality score after applying recommendation
          const qualityScore = await this.calculateLiveQualityScore();
          this.io.emit('quality:update', qualityScore);
        } catch (error) {
          console.error('Error applying recommendation:', error);
          socket.emit('recommendation:error', { error: error.message });
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`🔌 Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  // ============================================================================
  // REAL-TIME UPDATE LOOP
  // ============================================================================

  private startRealtimeUpdates() {
    // Update every 5 seconds
    this.updateInterval = setInterval(async () => {
      try {
        await this.broadcastQualityUpdates();
      } catch (error) {
        console.error('Error in realtime update loop:', error);
      }
    }, 5000);

    console.log('⏱️  Real-time update loop started (5s interval)');
  }

  private async broadcastQualityUpdates() {
    // Get unique data source IDs from connected clients
    const dataSourceIds = new Set<string | undefined>();
    this.connectedClients.forEach(({ filters }) => {
      dataSourceIds.add(filters?.dataSourceId);
    });

    // Calculate and broadcast for each data source
    for (const dataSourceId of dataSourceIds) {
      try {
        const qualityScore = await this.calculateLiveQualityScore(dataSourceId);
        const stats = await this.getQuickStats(dataSourceId);

        // Check if score changed significantly (>1 point)
        const lastScore = this.lastQualityScores.get(dataSourceId || 'global');
        const hasSignificantChange = !lastScore || Math.abs(qualityScore.current - lastScore.current) >= 1;

        if (hasSignificantChange) {
          console.log(`📊 Quality score updated for ${dataSourceId || 'all'}: ${qualityScore.current}%`);
          this.lastQualityScores.set(dataSourceId || 'global', qualityScore);

          // Persist to database
          await this.persistQualityScore(qualityScore, dataSourceId);
        }

        // Broadcast to relevant clients
        this.connectedClients.forEach(({ socket, filters }) => {
          if (!filters.dataSourceId || filters.dataSourceId === dataSourceId) {
            socket.emit('quality:update', qualityScore);
            socket.emit('stats:update', stats);
          }
        });
      } catch (error) {
        console.error(`Error updating quality for ${dataSourceId}:`, error);
      }
    }
  }

  // ============================================================================
  // QUALITY SCORE CALCULATION
  // ============================================================================

  async calculateLiveQualityScore(dataSourceId?: string): Promise<LiveQualityScore> {
    try {
      // Use the stored procedure we created in migration
      const result = await pool.query(
        'SELECT * FROM calculate_realtime_quality_score($1, NULL)',
        [dataSourceId]
      );

      const { overall_score, dimension_scores } = result.rows[0] || {
        overall_score: 0,
        dimension_scores: {
          completeness: 0,
          accuracy: 0,
          consistency: 0,
          validity: 0,
          freshness: 0,
          uniqueness: 0
        }
      };

      // Get previous score for trend calculation
      const previousResult = await pool.query(`
        SELECT overall_score, measured_at
        FROM quality_scores_realtime
        WHERE data_source_id = $1 OR ($1 IS NULL AND data_source_id IS NULL)
        ORDER BY measured_at DESC
        LIMIT 1 OFFSET 1
      `, [dataSourceId]);

      const previous = previousResult.rows[0]?.overall_score || overall_score;
      const change = overall_score - previous;
      const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

      // Determine trend
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (Math.abs(change) >= 1) {
        trend = change > 0 ? 'up' : 'down';
      }

      // Determine status
      let status: 'excellent' | 'good' | 'warning' | 'critical';
      if (overall_score >= 90) status = 'excellent';
      else if (overall_score >= 75) status = 'good';
      else if (overall_score >= 50) status = 'warning';
      else status = 'critical';

      // Calculate benchmarks
      const industryAvg = 82; // Hardcoded for now - could come from external API
      const yourAvgResult = await pool.query(`
        SELECT AVG(overall_score)::integer as avg_score
        FROM quality_scores_realtime
        WHERE (data_source_id = $1 OR $1 IS NULL)
          AND measured_at > NOW() - INTERVAL '30 days'
      `, [dataSourceId]);
      const yourAvg = yourAvgResult.rows[0]?.avg_score || overall_score;

      return {
        current: overall_score,
        previous,
        trend,
        change,
        changePercent: Math.round(changePercent * 10) / 10,
        lastUpdated: new Date(),
        status,
        benchmarks: {
          industry: industryAvg,
          yourAvg
        },
        dimensionScores: dimension_scores
      };
    } catch (error) {
      console.error('Error calculating live quality score:', error);
      // Return fallback data
      return {
        current: 0,
        previous: 0,
        trend: 'stable',
        change: 0,
        changePercent: 0,
        lastUpdated: new Date(),
        status: 'critical',
        benchmarks: { industry: 82, yourAvg: 0 },
        dimensionScores: {
          completeness: 0,
          accuracy: 0,
          consistency: 0,
          validity: 0,
          freshness: 0,
          uniqueness: 0
        }
      };
    }
  }

  // ============================================================================
  // QUICK STATS CALCULATION
  // ============================================================================

  async getQuickStats(dataSourceId?: string): Promise<QuickStats> {
    try {
      const [monitoring, activity, rules, health] = await Promise.all([
        this.getMonitoringStats(dataSourceId),
        this.getActivityStats(dataSourceId),
        this.getRuleStats(dataSourceId),
        this.getHealthStats(dataSourceId)
      ]);

      // Calculate live metrics
      const liveMetrics = await this.getLiveMetrics(dataSourceId);

      return {
        monitoring,
        activity,
        rules,
        health,
        liveMetrics
      };
    } catch (error) {
      console.error('Error getting quick stats:', error);
      return this.getFallbackStats();
    }
  }

  private async getMonitoringStats(dataSourceId?: string) {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT table_name) as tables,
        COUNT(DISTINCT column_name) as columns,
        COUNT(DISTINCT data_source_id) as data_sources,
        SUM(affected_rows)::bigint as total_rows
      FROM quality_issues
      WHERE (data_source_id = $1 OR $1 IS NULL)
        AND created_at > NOW() - INTERVAL '30 days'
    `, [dataSourceId]);

    const row = result.rows[0];
    return {
      tables: parseInt(row.tables) || 0,
      columns: parseInt(row.columns) || 0,
      dataSources: parseInt(row.data_sources) || 1,
      totalRows: parseInt(row.total_rows) || 0
    };
  }

  private async getActivityStats(dataSourceId?: string) {
    const result = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN DATE(created_at) = CURRENT_DATE THEN affected_rows ELSE 0 END), 0)::bigint as rows_scanned,
        COALESCE(COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE THEN 1 END), 0) as rules_executed,
        COALESCE(COUNT(CASE WHEN DATE(created_at) = CURRENT_DATE AND severity IN ('critical', 'high') THEN 1 END), 0) as alerts,
        COALESCE(COUNT(CASE WHEN DATE(resolved_at) = CURRENT_DATE THEN 1 END), 0) as resolved
      FROM quality_issues
      WHERE data_source_id = $1 OR $1 IS NULL
    `, [dataSourceId]);

    const row = result.rows[0];
    return {
      rowsScannedToday: parseInt(row.rows_scanned) || 0,
      rulesExecutedToday: parseInt(row.rules_executed) || 0,
      alertsTriggered: parseInt(row.alerts) || 0,
      issuesResolved: parseInt(row.resolved) || 0
    };
  }

  private async getRuleStats(dataSourceId?: string) {
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN enabled = true THEN 1 END) as enabled,
        COUNT(CASE WHEN enabled = true AND last_run_status = 'passed' THEN 1 END) as passing,
        COUNT(CASE WHEN enabled = true AND last_run_status = 'failed' THEN 1 END) as failing
      FROM quality_rules
      WHERE data_source_id = $1 OR $1 IS NULL
    `, [dataSourceId]);

    const row = result.rows[0];
    return {
      total: parseInt(row.total) || 0,
      enabled: parseInt(row.enabled) || 0,
      passing: parseInt(row.passing) || 0,
      failing: parseInt(row.failing) || 0
    };
  }

  private async getHealthStats(dataSourceId?: string) {
    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT table_name) as total_tables,
        COUNT(DISTINCT CASE WHEN severity = 'critical' THEN table_name END) as critical,
        COUNT(DISTINCT CASE WHEN severity IN ('high', 'medium') THEN table_name END) as warnings,
        COUNT(DISTINCT CASE WHEN status = 'resolved' THEN table_name END) as healthy
      FROM quality_issues
      WHERE (data_source_id = $1 OR $1 IS NULL)
        AND created_at > NOW() - INTERVAL '7 days'
    `, [dataSourceId]);

    const row = result.rows[0];
    const total = parseInt(row.total_tables) || 1;
    const healthy = parseInt(row.healthy) || 0;
    const compliance = (healthy / total) * 100;

    return {
      overallCompliance: Math.round(compliance * 10) / 10,
      criticalIssues: parseInt(row.critical) || 0,
      warnings: parseInt(row.warnings) || 0,
      healthy: parseInt(row.healthy) || 0
    };
  }

  private async getLiveMetrics(dataSourceId?: string) {
    // Calculate metrics from recent activity
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 second') as rows_scanned_per_sec,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour' AND severity IN ('critical', 'high')) as alerts_per_hour,
        AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) * 1000)::integer as avg_response_time
      FROM quality_issues
      WHERE data_source_id = $1 OR $1 IS NULL
    `, [dataSourceId]);

    const row = result.rows[0];
    return {
      rowsScannedPerSecond: parseInt(row.rows_scanned_per_sec) || 0,
      alertsPerHour: parseInt(row.alerts_per_hour) || 0,
      averageResponseTime: parseInt(row.avg_response_time) || 0
    };
  }

  private getFallbackStats(): QuickStats {
    return {
      monitoring: { tables: 0, columns: 0, dataSources: 0, totalRows: 0 },
      activity: { rowsScannedToday: 0, rulesExecutedToday: 0, alertsTriggered: 0, issuesResolved: 0 },
      rules: { total: 0, enabled: 0, passing: 0, failing: 0 },
      health: { overallCompliance: 0, criticalIssues: 0, warnings: 0, healthy: 0 },
      liveMetrics: { rowsScannedPerSecond: 0, alertsPerHour: 0, averageResponseTime: 0 }
    };
  }

  // ============================================================================
  // ACTIVE ALERTS
  // ============================================================================

  async getActiveAlerts(dataSourceId?: string, limit: number = 10): Promise<ActiveAlert[]> {
    try {
      const result = await pool.query(`
        SELECT
          id,
          severity,
          title,
          description,
          table_name,
          column_name,
          metric_name,
          threshold_value,
          current_value,
          revenue_at_risk,
          affected_users,
          sla_violations,
          root_cause,
          prediction,
          recommendations,
          created_at,
          trending,
          priority
        FROM alert_events
        WHERE status = 'active'
          AND (data_source_id = $1 OR $1 IS NULL)
        ORDER BY priority DESC, created_at DESC
        LIMIT $2
      `, [dataSourceId, limit]);

      return result.rows.map(row => ({
        id: row.id,
        severity: row.severity,
        title: row.title,
        description: row.description,
        table: row.table_name,
        column: row.column_name,
        metric: row.metric_name,
        threshold: parseFloat(row.threshold_value) || 0,
        current: parseFloat(row.current_value) || 0,
        businessImpact: {
          revenueAtRisk: parseFloat(row.revenue_at_risk) || 0,
          affectedUsers: parseInt(row.affected_users) || 0,
          slaViolations: row.sla_violations || []
        },
        rootCause: row.root_cause,
        prediction: row.prediction,
        recommendations: row.recommendations || [],
        createdAt: row.created_at,
        trending: row.trending || 'stable',
        priority: parseInt(row.priority) || 50
      }));
    } catch (error) {
      console.error('Error fetching active alerts:', error);
      return [];
    }
  }

  // ============================================================================
  // PERSISTENCE
  // ============================================================================

  private async persistQualityScore(score: LiveQualityScore, dataSourceId?: string) {
    try {
      await pool.query(`
        INSERT INTO quality_scores_realtime (
          data_source_id,
          overall_score,
          dimension_scores,
          measured_at,
          trend,
          change_percent,
          change_points
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        dataSourceId,
        score.current,
        JSON.stringify(score.dimensionScores),
        score.lastUpdated,
        score.trend,
        score.changePercent,
        score.change
      ]);
    } catch (error) {
      console.error('Error persisting quality score:', error);
    }
  }

  // ============================================================================
  // ML INTEGRATION (PLACEHOLDER)
  // ============================================================================

  private async requestMLPrediction(table: string, metric: string): Promise<any> {
    // This would call the ML service - for now return mock data
    return {
      type: 'quality_forecast',
      table,
      metric,
      forecast: {
        timeframe: '7d',
        predicted: [
          { date: new Date(), score: 85, confidence: 0.92 },
          { date: new Date(Date.now() + 86400000), score: 83, confidence: 0.89 },
          { date: new Date(Date.now() + 172800000), score: 80, confidence: 0.85 }
        ],
        trend: 'declining',
        expectedChange: -5.8
      },
      confidence: 0.89,
      recommendation: 'Quality likely to decline. Consider adding validation rules.'
    };
  }

  // ============================================================================
  // RECOMMENDATION APPLICATION
  // ============================================================================

  private async applyRecommendation(alertId: string, actionIndex: number): Promise<any> {
    try {
      // Get the alert and recommendation
      const alertResult = await pool.query(
        'SELECT recommendations FROM alert_events WHERE id = $1',
        [alertId]
      );

      if (alertResult.rows.length === 0) {
        throw new Error('Alert not found');
      }

      const recommendations = alertResult.rows[0].recommendations || [];
      const recommendation = recommendations[actionIndex];

      if (!recommendation) {
        throw new Error('Recommendation not found');
      }

      // Apply the recommendation (this would execute actual remediation)
      // For now, just mark as applied
      await pool.query(`
        UPDATE alert_events
        SET
          auto_remediated = true,
          auto_remediation_action = $1,
          auto_remediation_result = $2
        WHERE id = $3
      `, [
        recommendation.action,
        JSON.stringify({ success: true, timestamp: new Date() }),
        alertId
      ]);

      return {
        success: true,
        message: `Applied: ${recommendation.action}`,
        estimatedImpact: recommendation.estimatedImpact
      };
    } catch (error) {
      console.error('Error applying recommendation:', error);
      throw error;
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  public stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.connectedClients.clear();
    console.log('❌ RealtimeQualityService stopped');
  }
}

export default RealtimeQualityService;
