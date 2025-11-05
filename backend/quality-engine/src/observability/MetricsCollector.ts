// backend/quality-engine/src/observability/MetricsCollector.ts
import { register, Counter, Histogram, Gauge, Registry } from 'prom-client';
import { QualityResult } from '../types';

export class MetricsCollector {
  private registry: Registry;
  private qualityChecksTotal: Counter<string>;
  private qualityCheckDuration: Histogram<string>;
  private qualityScore: Gauge<string>;
  private anomaliesDetected: Counter<string>;
  private healingAttempts: Counter<string>;
  private costTotal: Counter<string>;

  constructor() {
    this.registry = new Registry();

    // Define metrics
    this.qualityChecksTotal = new Counter({
      name: 'quality_checks_total',
      help: 'Total number of quality checks performed',
      labelNames: ['status', 'asset_id', 'rule_id'],
      registers: [this.registry]
    });

    this.qualityCheckDuration = new Histogram({
      name: 'quality_check_duration_seconds',
      help: 'Duration of quality checks in seconds',
      labelNames: ['asset_id', 'rule_id'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry]
    });

    this.qualityScore = new Gauge({
      name: 'quality_score',
      help: 'Current quality score',
      labelNames: ['asset_id', 'dimension'],
      registers: [this.registry]
    });

    this.anomaliesDetected = new Counter({
      name: 'anomalies_detected_total',
      help: 'Total number of anomalies detected',
      labelNames: ['severity', 'type', 'asset_id'],
      registers: [this.registry]
    });

    this.healingAttempts = new Counter({
      name: 'healing_attempts_total',
      help: 'Total number of auto-healing attempts',
      labelNames: ['status', 'action', 'asset_id'],
      registers: [this.registry]
    });

    this.costTotal = new Counter({
      name: 'quality_cost_total',
      help: 'Total cost of quality checks',
      labelNames: ['asset_id'],
      registers: [this.registry]
    });
  }

  recordQualityCheck(result: QualityResult) {
    this.qualityChecksTotal.inc({
      status: result.status,
      asset_id: result.assetId,
      rule_id: result.ruleId
    });

    this.qualityCheckDuration.observe(
      {
        asset_id: result.assetId,
        rule_id: result.ruleId
      },
      result.executionTimeMs / 1000
    );

    if (result.score !== undefined) {
      this.qualityScore.set(
        {
          asset_id: result.assetId,
          dimension: 'overall'
        },
        result.score
      );
    }
  }

  recordAnomaly(severity: string, type: string, assetId: string) {
    this.anomaliesDetected.inc({
      severity,
      type,
      asset_id: assetId
    });
  }

  recordHealing(status: string, action: string, assetId: string) {
    this.healingAttempts.inc({
      status,
      action,
      asset_id: assetId
    });
  }

  recordCost(amount: number, assetId: string) {
    this.costTotal.inc({
      asset_id: assetId
    }, amount);
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}