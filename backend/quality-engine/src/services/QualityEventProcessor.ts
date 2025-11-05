// backend/quality-engine/src/services/QualityEventProcessor.ts
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { EventStreamManager } from '../events/EventStreamManager';
import { MLAnomalyDetector } from './MLAnomalyDetector';
import { SmartProfiler } from './SmartProfiler';
import { CostAwareScheduler } from './CostAwareScheduler';
import { PredictiveQualityEngine } from './PredictiveQualityEngine';
import { AutoHealingService } from './AutoHealingService';
import { MetricsCollector } from '../observability/MetricsCollector';
import { QualityCheckRequest, QualityResult, QualityDimension } from '../types';
import { DatabaseService } from '../utils/database';
import { v4 as uuidv4 } from 'uuid';

interface ProcessorDependencies {
  eventStream: EventStreamManager;
  mlDetector: MLAnomalyDetector;
  smartProfiler: SmartProfiler;
  costScheduler: CostAwareScheduler;
  predictiveEngine: PredictiveQualityEngine;
  autoHealer: AutoHealingService;
  metricsCollector: MetricsCollector;
}

export class QualityEventProcessor extends EventEmitter {
  private deps: ProcessorDependencies;
  private db: DatabaseService;
  private isProcessing: boolean = false;

  constructor(dependencies: ProcessorDependencies) {
    super();
    this.deps = dependencies;
    this.db = new DatabaseService();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Process quality events
    this.deps.eventStream.on('process:quality_event', async (event) => {
      await this.processQualityEvent(event);
    });

    // Process quality results
    this.deps.eventStream.on('process:quality_result', async (result) => {
      await this.processQualityResult(result);
    });

    // Process anomalies
    this.deps.eventStream.on('process:anomaly', async (anomaly) => {
      await this.processAnomaly(anomaly);
    });

    // Process healing actions
    this.deps.eventStream.on('process:healing', async (healing) => {
      await this.processHealingAction(healing);
    });
  }

  async start() {
    this.isProcessing = true;
    await this.db.connect();
    logger.info('Quality Event Processor started');
  }

  async stop() {
    this.isProcessing = false;
    await this.db.disconnect();
    logger.info('Quality Event Processor stopped');
  }

  async runQualityCheck(request: QualityCheckRequest): Promise<QualityResult> {
    const startTime = Date.now();
    const checkId = uuidv4();

    try {
      // Estimate cost
      const costEstimate = await this.deps.costScheduler.estimateRuleCost(request.ruleId || '');

      // Check if within budget
      if (!await this.deps.costScheduler.isWithinBudget(costEstimate)) {
        throw new Error('Quality check would exceed budget limits');
      }

      // Get asset details
      const assetQuery = await this.db.query(
        'SELECT * FROM catalog_assets WHERE id::text = $1 LIMIT 1',
        [request.assetId]
      );

      if (assetQuery.rows.length === 0) {
        throw new Error(`Asset ${request.assetId} not found`);
      }

      const asset = assetQuery.rows[0];

      // Run smart profiling
      const profile = await this.deps.smartProfiler.profileAsset(request.assetId);

      // Calculate quality scores
      const result: QualityResult = {
        id: checkId,
        ruleId: request.ruleId || '',
        assetId: request.assetId,
        status: 'passed',
        score: profile.dimensions.completeness, // Simplified - would aggregate
        executionTimeMs: Date.now() - startTime,
        rowsChecked: profile.statistics.rowCount,
        timestamp: new Date(),
        metadata: {
          profile,
          costEstimate
        }
      };

      // Check for anomalies
      const anomalies = await this.deps.mlDetector.detectAnomalies(
        request.assetId,
        profile.dimensions
      );

      if (anomalies.length > 0) {
        result.status = 'warning';
        result.metadata!.anomalies = anomalies;

        // Publish anomalies to stream
        for (const anomaly of anomalies) {
          await this.deps.eventStream.publishAnomaly(anomaly);
        }
      }

      // Publish result
      await this.deps.eventStream.publishQualityResult(result);

      // Update metrics
      this.deps.metricsCollector.recordQualityCheck(result);

      return result;

    } catch (error: any) {
      logger.error('Quality check failed:', error);

      const result: QualityResult = {
        id: checkId,
        ruleId: request.ruleId || '',
        assetId: request.assetId,
        status: 'error',
        executionTimeMs: Date.now() - startTime,
        timestamp: new Date(),
        metadata: {
          error: error.message
        }
      };

      await this.deps.eventStream.publishQualityResult(result);
      return result;
    }
  }

  private async processQualityEvent(event: any) {
    logger.debug('Processing quality event:', event.id);

    // Route to appropriate handler based on event type
    switch (event.type) {
      case 'check':
        await this.runQualityCheck({
          assetId: event.assetId,
          ruleId: event.ruleId,
          immediate: true,
          source: event.source,
          timestamp: new Date(event.timestamp)
        });
        break;
      case 'profile':
        await this.deps.smartProfiler.profileAsset(event.assetId);
        break;
      case 'anomaly':
        // Already processed by anomaly detector
        break;
      case 'healing':
        await this.deps.autoHealer.attemptHealing(event);
        break;
    }
  }

  private async processQualityResult(result: any) {
    logger.debug('Processing quality result:', result.id);

    // Update telemetry
    await this.db.query(
      `INSERT INTO quality_telemetry
      (check_id, rule_id, asset_id, start_time, end_time, execution_time_ms,
       result_status, result_score, rows_checked, rows_failed, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        result.id,
        result.ruleId,
        result.assetId,
        new Date(Date.now() - parseInt(result.executionTimeMs)),
        new Date(),
        parseInt(result.executionTimeMs),
        result.status,
        parseFloat(result.score || '0'),
        parseInt(result.rowsChecked || '0'),
        parseInt(result.rowsFailed || '0'),
        result.metadata || {}
      ]
    );

    // Check SLA compliance
    await this.checkSLACompliance(result);
  }

  private async processAnomaly(anomaly: any) {
    logger.info('Processing anomaly:', anomaly.id);

    // Determine if auto-healing should be attempted
    if (anomaly.severity === 'critical' && anomaly.confidence > 0.9) {
      await this.deps.autoHealer.attemptHealing({
        anomalyId: anomaly.id,
        assetId: anomaly.assetId,
        type: anomaly.type,
        confidence: anomaly.confidence
      });
    }

    // Send alerts if configured
    if (anomaly.severity === 'critical') {
      this.emit('alert:critical', anomaly);
    }
  }

  private async processHealingAction(healing: any) {
    logger.info('Processing healing action:', healing.id);

    // Update healing status in database
    await this.db.query(
      `UPDATE quality_healing_actions
      SET status = $1, completed_at = $2, rows_affected = $3,
          after_score = $4, error_message = $5
      WHERE id = $1`,
      [
        healing.status,
        healing.status === 'success' ? new Date() : null,
        healing.result?.rowsAffected,
        healing.result?.afterScore,
        healing.result?.error
      ]
    );
  }

  private async checkSLACompliance(result: any) {
    // Check if asset has SLA configuration
    const slaQuery = await this.db.query(
      `SELECT * FROM quality_sla_config
      WHERE asset_id = $1 AND enabled = true`,
      [result.assetId]
    );

    for (const sla of slaQuery.rows) {
      if (result.score < sla.min_threshold) {
        logger.warn(`SLA breach detected for asset ${result.assetId}`);

        // Record breach
        await this.db.query(
          `INSERT INTO quality_sla_breaches
          (sla_id, asset_id, dimension, actual_score, threshold, breach_time)
          VALUES ($1, $2, $3, $4, $5, NOW())`,
          [sla.id, result.assetId, sla.dimension, result.score, sla.min_threshold]
        );

        // Trigger breach action
        switch (sla.breach_action) {
          case 'alert':
            this.emit('sla:breach', { sla, result });
            break;
          case 'auto_heal':
            await this.deps.autoHealer.attemptHealing({
              assetId: result.assetId,
              type: 'sla_breach',
              sla
            });
            break;
          case 'escalate':
            // Implement escalation logic
            break;
        }
      }
    }
  }
}