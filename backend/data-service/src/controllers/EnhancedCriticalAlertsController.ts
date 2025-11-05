/**
 * Enhanced Critical Alerts Controller
 *
 * Provides intelligent, context-aware critical alerts with:
 * - Smart criticality scoring
 * - Automatic suppression of noise
 * - Trend analysis and predictions
 * - Alert grouping and categorization
 * - Actionable recommendations
 * - Auto-fix capabilities
 */

import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { CriticalityScoreService } from '../services/CriticalityScoreService';
import { AlertSuppressionService } from '../services/AlertSuppressionService';
import { TrendAnalysisService } from '../services/TrendAnalysisService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import { AutoFixService } from '../services/AutoFixService';
import { SLAManagementService } from '../services/SLAManagementService';
import { RootCauseAnalysisService } from '../services/RootCauseAnalysisService';
import { MLAnomalyDetectionService } from '../services/MLAnomalyDetectionService';

export class EnhancedCriticalAlertsController {
  private db: Pool;
  private criticalityService: CriticalityScoreService;
  private suppressionService: AlertSuppressionService;
  private trendService: TrendAnalysisService;
  private recommendationEngine: RecommendationEngine;
  private autoFixService: AutoFixService;
  private slaService: SLAManagementService;
  private rootCauseService: RootCauseAnalysisService;
  private mlAnomalyService: MLAnomalyDetectionService;

  constructor(db: Pool) {
    this.db = db;
    this.criticalityService = new CriticalityScoreService(db);
    this.suppressionService = new AlertSuppressionService(db);
    this.trendService = new TrendAnalysisService(db);
    this.recommendationEngine = new RecommendationEngine(db);
    this.autoFixService = new AutoFixService(db);
    this.slaService = new SLAManagementService(db);
    this.rootCauseService = new RootCauseAnalysisService(db);
    this.mlAnomalyService = new MLAnomalyDetectionService(db);
  }

  /**
   * GET /api/quality/critical-alerts/enhanced
   * Get enhanced critical alerts with scoring, suppression, and trends
   */
  getEnhancedCriticalAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const {
        dataSourceId,
        database,
        databases,
        minCriticalityScore = 70,
        category,
        showSuppressed = 'false',
        groupBy,
        includeHistory = 'false',
        limit = 10
      } = req.query;

      // Get failed quality results from last 24 hours
      const rawAlerts = await this.getRawAlerts({
        dataSourceId: dataSourceId as string,
        database: database as string,
        databases: databases as string
      });

      console.log(`[Enhanced Alerts] Found ${rawAlerts.length} raw failed quality checks`);

      // Process each alert through the enhancement pipeline
      const processedAlerts = [];

      for (const alert of rawAlerts) {
        // Step 1: Get business impact metadata
        const businessImpact = await this.getBusinessImpact(alert.table, alert.database);

        // Step 2: Get downstream dependencies from lineage
        const downstreamDeps = await this.getDownstreamDependencies(alert.assetId);

        // Step 3: Analyze trend
        const trend = await this.trendService.analyzeTrend(
          alert.ruleId,
          alert.assetId,
          24
        );

        // Step 4: Calculate criticality score
        const revenueImpact = businessImpact
          ? (alert.rowsFailed || 0) * (businessImpact.revenuePerRow || 0)
          : 0;

        const criticalityScore = await this.criticalityService.calculateScore(
          alert.id,
          {
            baseSeverity: alert.severity as any,
            financialImpact: this.criticalityService.calculateFinancialImpact(revenueImpact),
            userImpact: this.criticalityService.calculateUserImpact(
              alert.rowsFailed || 0
            ),
            complianceRisk: businessImpact
              ? this.criticalityService.calculateComplianceRisk(businessImpact.complianceTags || [])
              : 0,
            trendScore: trend
              ? this.criticalityService.calculateTrendScore(trend.trendDirection, trend.velocity)
              : 50,
            downstreamImpact: this.criticalityService.calculateDownstreamImpact(
              downstreamDeps.length
            ),
            tableImportance: businessImpact?.criticality as any
          }
        );

        // Step 5: Check suppression rules
        const suppressionResult = await this.suppressionService.shouldSuppress({
          id: alert.id,
          table: alert.table,
          database: alert.database,
          severity: alert.severity,
          issue: alert.issue,
          rowsFailed: alert.rowsFailed || 0,
          runAt: alert.runAt,
          assetId: alert.assetId,
          impact: {
            financial: revenueImpact,
            users: alert.rowsFailed || 0
          }
        });

        // Skip if suppressed (unless showSuppressed is true)
        if (suppressionResult.suppressed && showSuppressed !== 'true') {
          continue;
        }

        // Skip if below minimum criticality score
        if (criticalityScore.score < Number(minCriticalityScore)) {
          continue;
        }

        // Build enhanced alert
        const enhancedAlert = {
          id: alert.id,
          severity: alert.severity,
          table: alert.table,
          database: alert.database,
          issue: alert.issue,
          timestamp: this.getTimeAgo(alert.runAt),
          runAt: alert.runAt,

          // Criticality scoring
          criticalityScore: {
            total: criticalityScore.score,
            breakdown: {
              baseSeverity: criticalityScore.baseSeverityScore,
              financial: criticalityScore.financialImpactScore,
              users: criticalityScore.userImpactScore,
              compliance: criticalityScore.complianceRiskScore,
              trend: criticalityScore.trendScore,
              downstream: criticalityScore.downstreamImpactScore
            }
          },

          // Business impact
          impact: {
            financial: {
              value: revenueImpact,
              display: this.formatCurrency(revenueImpact)
            },
            users: alert.rowsFailed || 0,
            downstream: {
              count: downstreamDeps.length,
              assets: downstreamDeps.map(dep => ({
                id: dep.id,
                name: dep.name,
                type: dep.type
              }))
            },
            processes: businessImpact?.affectedProcesses || [],
            compliance: businessImpact?.complianceTags || []
          },

          // Trend analysis
          trend: trend ? {
            direction: trend.trendDirection,
            velocity: trend.velocity,
            prediction: {
              nextValue: trend.predictedNextValue,
              confidence: trend.predictionConfidence,
              timeToThreshold: trend.timeToThreshold
            },
            anomaly: {
              detected: trend.anomalyDetected,
              score: trend.anomalyScore
            },
            sparkline: trend.sparklineData,
            baseline: trend.baselineValue,
            current: trend.currentValue
          } : null,

          // Business context
          context: {
            tableImportance: businessImpact?.criticality || 'medium',
            owner: businessImpact?.ownerTeam,
            contact: businessImpact?.ownerContact,
            sla: businessImpact ? {
              freshness: businessImpact.slaFreshnessHours,
              completeness: businessImpact.slaCompletenessPct,
              accuracy: businessImpact.slaAccuracyPct
            } : null
          },

          // Suppression info
          suppressed: suppressionResult.suppressed,
          suppressionReason: suppressionResult.reason,

          // Rule metadata
          ruleId: alert.ruleId,
          assetId: alert.assetId
        };

        processedAlerts.push(enhancedAlert);
      }

      // Sort by criticality score (descending)
      processedAlerts.sort((a, b) => b.criticalityScore.total - a.criticalityScore.total);

      // Limit results
      const limitedAlerts = processedAlerts.slice(0, Number(limit));

      console.log(`[Enhanced Alerts] Returning ${limitedAlerts.length} enhanced alerts`);
      console.log(`[Enhanced Alerts] Suppressed: ${rawAlerts.length - processedAlerts.length}`);

      res.json({
        success: true,
        data: {
          alerts: limitedAlerts,
          summary: {
            total: limitedAlerts.length,
            totalRaw: rawAlerts.length,
            suppressed: rawAlerts.length - processedAlerts.length,
            avgCriticalityScore: this.average(
              limitedAlerts.map(a => a.criticalityScore.total)
            ),
            byTrend: {
              degrading: limitedAlerts.filter(a => a.trend?.direction === 'degrading').length,
              stable: limitedAlerts.filter(a => a.trend?.direction === 'stable').length,
              improving: limitedAlerts.filter(a => a.trend?.direction === 'improving').length
            },
            anomaliesDetected: limitedAlerts.filter(a => a.trend?.anomaly.detected).length
          }
        },
        meta: {
          timestamp: new Date().toISOString(),
          filters: {
            dataSourceId,
            database,
            databases,
            minCriticalityScore,
            showSuppressed
          }
        }
      });
    } catch (error: any) {
      console.error('[Enhanced Alerts] Error:', error);
      next(error);
    }
  };

  /**
   * Get raw failed quality checks
   */
  private async getRawAlerts(filters: {
    dataSourceId?: string;
    database?: string;
    databases?: string;
  }): Promise<any[]> {
    let query = `
      SELECT
        qres.id,
        qres.status,
        qres.rows_failed as "rowsFailed",
        qres.run_at as "runAt",
        qr.id as "ruleId",
        qr.name as "ruleName",
        qr.dimension,
        qr.severity,
        qr.description as issue,
        ca.id as "assetId",
        ca.table_name as "table",
        ca.database_name as "database",
        ca.asset_type as "assetType"
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qres.status = 'failed'
        AND qres.run_at > NOW() - INTERVAL '24 hours'
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (filters.dataSourceId) {
      query += ` AND qres.data_source_id = $${paramCount++}`;
      params.push(filters.dataSourceId);
    }

    const databaseFilter = filters.databases || filters.database;
    if (databaseFilter) {
      const databaseList = databaseFilter.split(',').map(d => d.trim()).filter(d => d);
      if (databaseList.length > 0) {
        query += ` AND ca.database_name = ANY($${paramCount++}::text[])`;
        params.push(databaseList);
      }
    }

    query += ` ORDER BY qres.run_at DESC LIMIT 1000`;

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Get business impact metadata for a table
   */
  private async getBusinessImpact(
    tableName: string,
    databaseName: string
  ): Promise<any | null> {
    const query = `
      SELECT
        criticality,
        revenue_per_row as "revenuePerRow",
        affected_processes as "affectedProcesses",
        owner_team as "ownerTeam",
        owner_contact as "ownerContact",
        compliance_tags as "complianceTags",
        sla_freshness_hours as "slaFreshnessHours",
        sla_completeness_pct as "slaCompletenessPct",
        sla_accuracy_pct as "slaAccuracyPct"
      FROM table_business_impact
      WHERE table_name = $1 AND database_name = $2
    `;

    const result = await this.db.query(query, [tableName, databaseName]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Get downstream dependencies from lineage
   */
  private async getDownstreamDependencies(assetId?: number): Promise<any[]> {
    if (!assetId) {
      return [];
    }

    const query = `
      SELECT DISTINCT
        ca.id,
        ca.table_name as name,
        ca.asset_type as type
      FROM lineage_edges le
      JOIN catalog_assets ca ON ca.id = le.target_asset_id
      WHERE le.source_asset_id = $1
        AND le.lineage_type IN ('data_flow', 'dependency')
      LIMIT 50
    `;

    const result = await this.db.query(query, [assetId]);
    return result.rows;
  }

  /**
   * GET /api/quality/alerts/suppressed
   * Get suppressed alerts
   */
  getSuppressedAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { database, ruleId, limit = 100 } = req.query;

      const suppressedAlerts = await this.suppressionService.getSuppressedAlerts({
        database: database as string,
        ruleId: ruleId as string,
        limit: Number(limit)
      });

      res.json({
        success: true,
        data: suppressedAlerts,
        meta: {
          count: suppressedAlerts.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/alerts/suppression-stats
   * Get suppression statistics
   */
  getSuppressionStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const stats = await this.suppressionService.getSuppressionStats();

      res.json({
        success: true,
        data: stats,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/alerts/anomalies
   * Get detected anomalies
   */
  getAnomalies = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { windowHours = 24 } = req.query;

      const anomalies = await this.trendService.getAnomalies(Number(windowHours));

      res.json({
        success: true,
        data: anomalies,
        meta: {
          count: anomalies.length,
          windowHours: Number(windowHours),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/quality/alerts/snooze
   * Snooze an alert
   */
  snoozeAlert = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { alertId, duration, reason } = req.body;

      if (!alertId || !duration) {
        res.status(400).json({
          success: false,
          error: 'alertId and duration are required'
        });
        return;
      }

      // Calculate snooze_until timestamp
      const durationMap: { [key: string]: number } = {
        '1h': 1,
        '24h': 24,
        '7d': 24 * 7,
        '30d': 24 * 30
      };

      const hours = durationMap[duration] || 1;
      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

      // Insert snooze record
      const query = `
        INSERT INTO alert_snoozes (alert_id, snoozed_by, snooze_until, reason)
        VALUES ($1, $2, $3, $4)
        RETURNING id, snooze_until
      `;

      const result = await this.db.query(query, [
        alertId,
        'user', // TODO: Get from auth context
        snoozeUntil,
        reason || 'No reason provided'
      ]);

      res.json({
        success: true,
        data: {
          snoozeId: result.rows[0].id,
          snoozeUntil: result.rows[0].snooze_until
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Utility: Format currency
   */
  private formatCurrency(amount: number): string {
    if (amount === 0) return '$0';
    if (amount < 1000) return `$${Math.round(amount)}`;
    if (amount < 1000000) return `$${(amount / 1000).toFixed(1)}K`;
    return `$${(amount / 1000000).toFixed(1)}M`;
  }

  /**
   * Utility: Get time ago string
   */
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  /**
   * Utility: Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }

  // ============================================================================
  // PHASE 3: AUTOMATION ENDPOINTS
  // ============================================================================

  /**
   * GET /api/quality/alerts/:id/recommendations
   * Get actionable recommendations for an alert
   */
  getRecommendations = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      // Get alert details
      const alertQuery = `
        SELECT
          qres.id,
          qres.status,
          qres.rows_failed as "rowsFailed",
          qres.run_at as "runAt",
          qr.id as "ruleId",
          qr.name as "ruleName",
          qr.dimension,
          qr.severity,
          qr.description as issue,
          ca.id as "assetId",
          ca.table_name as "table",
          ca.database_name as "database",
          ca.asset_type as "assetType"
        FROM quality_results qres
        JOIN quality_rules qr ON qr.id = qres.rule_id
        LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
        WHERE qres.id = $1
      `;

      const alertResult = await this.db.query(alertQuery, [id]);

      if (alertResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
        return;
      }

      const alert = alertResult.rows[0];

      // Generate recommendations
      const recommendations = await this.recommendationEngine.generateRecommendations(alert);

      res.json({
        success: true,
        data: {
          alertId: id,
          alert: {
            table: alert.table,
            database: alert.database,
            issue: alert.issue,
            severity: alert.severity,
            dimension: alert.dimension
          },
          recommendations,
          summary: {
            total: recommendations.length,
            autoFixAvailable: recommendations.filter(r => r.type === 'auto_fix').length,
            highPriority: recommendations.filter(r => r.priority >= 8).length
          }
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/alerts/:id/auto-fix-preview
   * Preview auto-fix details before execution (for user review/approval)
   */
  previewAutoFix = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { fixType } = req.query;

      if (!fixType) {
        res.status(400).json({
          success: false,
          error: 'fixType query parameter is required'
        });
        return;
      }

      // Get alert details
      const alertQuery = `
        SELECT
          qres.id,
          qres.rows_failed as "rowsFailed",
          qr.dimension,
          qr.severity,
          qr.description as issue,
          ca.table_name as "table",
          ca.database_name as "database"
        FROM quality_results qres
        JOIN quality_rules qr ON qr.id = qres.rule_id
        LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
        WHERE qres.id = $1
      `;

      const alertResult = await this.db.query(alertQuery, [id]);

      if (alertResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Alert not found'
        });
        return;
      }

      const alert = alertResult.rows[0];

      // Execute dry-run to get affected rows count
      const dryRunResult = await this.autoFixService.executeAutoFix({
        alertId: id,
        fixType: fixType as string,
        params: {
          dryRun: true,
          strategy: 'keep_newest'
        }
      });

      // Generate SQL preview based on fix type
      let sqlPreview = '';
      let explanation = '';
      let warnings: string[] = [];
      let strategies: Array<{name: string, label: string, description: string}> = [];

      switch (fixType) {
        case 'set_null_defaults':
          sqlPreview = `UPDATE ${alert.database}.${alert.table}\nSET column_name = '<default_value>'\nWHERE column_name IS NULL;`;
          explanation = `This will update ${dryRunResult.rowsAffected} rows with NULL values, setting them to a default value you specify.`;
          warnings = [
            'Make sure the default value is appropriate for your business logic',
            'This operation cannot be undone without a backup',
            'Consider if NULL values have business meaning (e.g., "unknown" vs empty)'
          ];
          break;

        case 'remove_duplicates':
          sqlPreview = `DELETE FROM ${alert.database}.${alert.table}\nWHERE id IN (\n  SELECT id FROM (\n    SELECT id,\n      ROW_NUMBER() OVER (PARTITION BY duplicate_column ORDER BY created_at DESC) as rn\n    FROM ${alert.database}.${alert.table}\n  ) t\n  WHERE rn > 1\n);`;
          explanation = `This will delete ${dryRunResult.rowsAffected} duplicate rows from the table. You can choose which record to keep.`;
          warnings = [
            'Duplicate records will be permanently deleted',
            'Make sure you have a backup before proceeding',
            'Consider if duplicates are intentional (e.g., historical records)'
          ];
          strategies = [
            {
              name: 'keep_newest',
              label: 'Keep Newest',
              description: 'Keep the most recently created record (recommended for active data)'
            },
            {
              name: 'keep_oldest',
              label: 'Keep Oldest',
              description: 'Keep the first created record (recommended for historical data)'
            },
            {
              name: 'keep_most_complete',
              label: 'Keep Most Complete',
              description: 'Keep the record with the most non-NULL fields (best data preservation)'
            }
          ];
          break;

        case 'correct_invalid_values':
          sqlPreview = `UPDATE ${alert.database}.${alert.table}\nSET column_name = CASE\n  WHEN column_name < 0 THEN 0\n  WHEN column_name > max_value THEN max_value\n  ELSE column_name\nEND\nWHERE condition;`;
          explanation = `This will correct ${dryRunResult.rowsAffected} rows with invalid values according to your validation rules.`;
          warnings = [
            'Verify the correction logic matches your business rules',
            'Original values will be overwritten',
            'Consider logging changed values for audit purposes'
          ];
          break;

        case 'fix_negative_values':
          sqlPreview = `UPDATE ${alert.database}.${alert.table}\nSET column_name = 0\nWHERE column_name < 0;`;
          explanation = `This will set ${dryRunResult.rowsAffected} negative values to 0.`;
          warnings = [
            'All negative values will be set to 0',
            'Consider if negative values have business meaning (e.g., refunds, adjustments)',
            'This is irreversible without a backup'
          ];
          break;

        default:
          sqlPreview = 'SQL query will be generated based on fix type';
          explanation = 'Fix details will be shown here';
      }

      res.json({
        success: true,
        data: {
          alertId: id,
          alert: {
            table: alert.table,
            database: alert.database,
            issue: alert.issue,
            severity: alert.severity,
            rowsFailed: alert.rowsFailed
          },
          fix: {
            type: fixType,
            rowsAffected: dryRunResult.rowsAffected,
            sqlPreview,
            explanation,
            warnings,
            strategies: strategies.length > 0 ? strategies : undefined,
            estimatedExecutionTime: `${Math.max(1, Math.ceil(dryRunResult.rowsAffected / 1000))} seconds`,
            riskLevel: dryRunResult.rowsAffected > 1000 ? 'high' : dryRunResult.rowsAffected > 100 ? 'medium' : 'low'
          },
          recommendations: [
            '✅ Create a database backup before proceeding',
            '✅ Review the SQL query and affected row count',
            '✅ Test in a non-production environment first',
            '✅ Have a rollback plan ready'
          ]
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/quality/alerts/auto-fix
   * Execute an auto-fix for an alert (requires user confirmation)
   */
  executeAutoFix = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { alertId, fixType, defaultValue, confirmed = false, strategy = 'keep_newest' } = req.body;

      if (!alertId || !fixType) {
        res.status(400).json({
          success: false,
          error: 'alertId and fixType are required'
        });
        return;
      }

      // Require explicit confirmation for actual execution
      if (!confirmed) {
        res.status(400).json({
          success: false,
          error: 'Fix execution requires explicit confirmation. Set confirmed=true to proceed.',
          hint: 'Use GET /api/quality/alerts/:id/auto-fix-preview to review fix details first'
        });
        return;
      }

      // Execute auto-fix (NOT dry-run since user confirmed)
      const result = await this.autoFixService.executeAutoFix({
        alertId,
        fixType,
        params: {
          defaultValue,
          dryRun: false, // Actually execute since confirmed=true
          strategy
        }
      });

      res.json({
        success: true,
        data: result,
        message: `Auto-fix executed successfully. ${result.rowsAffected} rows affected.`,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/alerts/:id/auto-fix-history
   * Get auto-fix execution history for an alert
   */
  getAutoFixHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const query = `
        SELECT
          id,
          fix_type as "fixType",
          status,
          rows_affected as "rowsAffected",
          execution_time_ms as "executionTimeMs",
          dry_run as "dryRun",
          executed_at as "executedAt",
          completed_at as "completedAt",
          error_message as "errorMessage"
        FROM auto_fix_executions
        WHERE alert_id = $1
        ORDER BY executed_at DESC
        LIMIT 50
      `;

      const result = await this.db.query(query, [id]);

      res.json({
        success: true,
        data: result.rows,
        meta: {
          count: result.rows.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/alerts/:id/available-fixes
   * Get available auto-fix types for an alert
   */
  getAvailableFixes = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const fixTypes = await this.autoFixService.getAvailableFixTypes(id);

      res.json({
        success: true,
        data: {
          alertId: id,
          availableFixes: fixTypes
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================================
  // PHASE 4: ADVANCED FEATURES ENDPOINTS
  // ============================================================================

  /**
   * GET /api/quality/sla/compliance
   * Get SLA compliance report
   */
  getSLACompliance = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { scopeType, windowHours = 24 } = req.query;

      const report = await this.slaService.getSLAComplianceReport(
        scopeType as string,
        Number(windowHours)
      );

      res.json({
        success: true,
        data: report,
        meta: {
          scopeType: scopeType || 'all',
          windowHours: Number(windowHours),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/sla/breaches
   * Get active SLA breaches
   */
  getSLABreaches = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const breaches = await this.slaService.monitorSLACompliance();

      res.json({
        success: true,
        data: breaches,
        meta: {
          count: breaches.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/quality/sla/breaches/:id/acknowledge
   * Acknowledge an SLA breach
   */
  acknowledgeSLABreach = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { acknowledgedBy, notes } = req.body;

      const query = `
        UPDATE sla_breaches
        SET
          acknowledged_at = NOW(),
          acknowledged_by = $1,
          notes = $2
        WHERE id = $3
        RETURNING *
      `;

      const result = await this.db.query(query, [
        acknowledgedBy || 'system',
        notes || null,
        id
      ]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'SLA breach not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/quality/sla
   * Create a new SLA definition
   */
  createSLA = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sla = req.body;

      const slaId = await this.slaService.createSLA(sla);

      res.status(201).json({
        success: true,
        data: {
          id: slaId,
          ...sla
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/alerts/:id/root-causes
   * Get root cause analysis for an alert
   */
  getRootCauses = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const rootCauses = await this.rootCauseService.analyzeRootCause(id);

      res.json({
        success: true,
        data: {
          alertId: id,
          rootCauses,
          summary: {
            totalCauses: rootCauses.length,
            highConfidence: rootCauses.filter(rc => rc.confidence >= 75).length,
            byType: rootCauses.reduce((acc: any, rc) => {
              acc[rc.causeType] = (acc[rc.causeType] || 0) + 1;
              return acc;
            }, {})
          }
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/quality/alerts/:id/root-causes/verify
   * Verify a root cause
   */
  verifyRootCause = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;
      const { rootCauseId, verified, verifiedBy, notes } = req.body;

      const query = `
        UPDATE alert_root_causes
        SET
          verified = $1,
          verified_by = $2,
          verified_at = NOW(),
          verification_notes = $3
        WHERE id = $4 AND alert_id = $5
        RETURNING *
      `;

      const result = await this.db.query(query, [
        verified,
        verifiedBy || 'system',
        notes || null,
        rootCauseId,
        id
      ]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Root cause not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/root-causes/patterns
   * Get recurring root cause patterns
   */
  getRootCausePatterns = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { windowHours = 168 } = req.query; // Default 7 days

      const patterns = await this.rootCauseService.analyzePatterns(Number(windowHours));

      res.json({
        success: true,
        data: patterns,
        meta: {
          windowHours: Number(windowHours),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/ml/anomalies
   * Get ML-detected anomalies
   */
  getMLAnomalies = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { windowHours = 24 } = req.query;

      const anomalies = await this.mlAnomalyService.getRecentAnomalies(Number(windowHours));

      res.json({
        success: true,
        data: anomalies,
        meta: {
          count: anomalies.length,
          windowHours: Number(windowHours),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/quality/ml/train
   * Train a new ML anomaly detection model
   */
  trainMLModel = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { modelName, modelType, scopeType, scopeValue, ruleId, windowDays = 30 } = req.body;

      if (!modelName || !modelType || !scopeType || !scopeValue || !ruleId) {
        res.status(400).json({
          success: false,
          error: 'modelName, modelType, scopeType, scopeValue, and ruleId are required'
        });
        return;
      }

      // Get training data from quality results
      const query = `
        SELECT
          run_at as timestamp,
          COALESCE(rows_failed, 0) as value
        FROM quality_results
        WHERE rule_id = $1
          AND run_at > NOW() - INTERVAL '${windowDays} days'
        ORDER BY run_at ASC
      `;

      const result = await this.db.query(query, [ruleId]);

      if (result.rows.length < 100) {
        res.status(400).json({
          success: false,
          error: 'Insufficient training data (minimum 100 data points required)'
        });
        return;
      }

      const trainingData = result.rows.map((row: any) => ({
        timestamp: row.timestamp,
        value: parseFloat(row.value) || 0
      }));

      // Train model
      const modelId = await this.mlAnomalyService.trainModel(
        modelName,
        modelType,
        scopeType,
        scopeValue,
        trainingData
      );

      res.status(201).json({
        success: true,
        data: {
          modelId,
          modelName,
          modelType,
          trainingDataPoints: trainingData.length
        },
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/quality/ml/models/:id/metrics
   * Get performance metrics for an ML model
   */
  getMLModelMetrics = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { id } = req.params;

      const metrics = await this.mlAnomalyService.getModelMetrics(id);

      res.json({
        success: true,
        data: metrics,
        meta: {
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };
}
