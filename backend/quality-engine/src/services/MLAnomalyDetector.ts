// backend/quality-engine/src/services/MLAnomalyDetector.ts
// Machine Learning-based Anomaly Detection Service

import { mean, standardDeviation, quantile } from 'simple-statistics';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { DatabaseService } from '../utils/database';
import { AnomalyEvent, QualityDimension, MLModel } from '../types';
import { config } from '../config';

export class MLAnomalyDetector {
  private db: DatabaseService;
  private models: Map<string, any> = new Map();
  private thresholds: Map<string, number> = new Map();

  constructor() {
    this.db = new DatabaseService();
  }

  async initialize() {
    try {
      await this.db.connect();
      await this.loadExistingModels();
      logger.info('ML Anomaly Detector initialized');
    } catch (error) {
      logger.error('Failed to initialize ML Anomaly Detector:', error);
      throw error;
    }
  }

  private async loadExistingModels() {
    try {
      const models = await this.db.query(
        `SELECT * FROM quality_anomaly_models WHERE active = true`
      );

      for (const model of models.rows) {
        // Skip isolation forest for now - would load from saved model files
        // Load TensorFlow models for autoencoders and LSTMs
        // These would be loaded from saved model files
      }

      logger.info(`Loaded ${this.models.size} anomaly detection models`);
    } catch (error) {
      logger.error('Failed to load existing models:', error);
    }
  }

  async detectAnomalies(
    assetId: string,
    metrics: Record<QualityDimension, number>
  ): Promise<AnomalyEvent[]> {
    const anomalies: AnomalyEvent[] = [];

    // 1. Statistical anomaly detection
    const statAnomalies = await this.detectStatisticalAnomalies(assetId, metrics);
    anomalies.push(...statAnomalies);

    // 2. Isolation Forest anomaly detection
    if (config.ml.anomalyDetection.models.isolationForest) {
      const iforestAnomalies = await this.detectIsolationForestAnomalies(assetId, metrics);
      anomalies.push(...iforestAnomalies);
    }

    // 3. Autoencoder anomaly detection
    if (config.ml.anomalyDetection.models.autoencoder) {
      const autoencoderAnomalies = await this.detectAutoencoderAnomalies(assetId, metrics);
      anomalies.push(...autoencoderAnomalies);
    }

    // 4. LSTM time-series anomaly detection
    if (config.ml.anomalyDetection.models.lstm) {
      const lstmAnomalies = await this.detectLSTMAnomalies(assetId, metrics);
      anomalies.push(...lstmAnomalies);
    }

    // 5. Pattern-based anomaly detection
    const patternAnomalies = await this.detectPatternAnomalies(assetId, metrics);
    anomalies.push(...patternAnomalies);

    // Deduplicate and prioritize anomalies
    return this.consolidateAnomalies(anomalies);
  }

  private async detectStatisticalAnomalies(
    assetId: string,
    metrics: Record<QualityDimension, number>
  ): Promise<AnomalyEvent[]> {
    const anomalies: AnomalyEvent[] = [];

    // Get historical data
    const history = await this.db.query(
      `SELECT
        completeness_score,
        accuracy_score,
        consistency_score,
        validity_score,
        freshness_score,
        uniqueness_score,
        profile_date
      FROM data_profiles
      WHERE asset_id = (SELECT id FROM catalog_assets WHERE id::text = $1)
      ORDER BY profile_date DESC
      LIMIT 100`,
      [assetId]
    );

    if (history.rows.length < 10) {
      return anomalies; // Not enough data for statistical analysis
    }

    // Check each dimension
    for (const dimension of Object.keys(metrics) as QualityDimension[]) {
      const columnName = `${dimension}_score`;
      const historicalValues = history.rows.map((r: any) => r[columnName]);
      const currentValue = metrics[dimension];

      // Calculate statistics
      const avg = mean(historicalValues);
      const stdDev = standardDeviation(historicalValues);
      const q1 = quantile(historicalValues, 0.25);
      const q3 = quantile(historicalValues, 0.75);
      const iqr = q3 - q1;

      // Z-score based detection
      const zScore = Math.abs((currentValue - avg) / stdDev);
      if (zScore > 3) {
        anomalies.push({
          id: uuidv4(),
          assetId,
          type: 'outlier',
          severity: zScore > 4 ? 'critical' : 'high',
          confidence: Math.min(0.99, 1 - (1 / zScore)),
          description: `${dimension} score (${currentValue}) is ${zScore.toFixed(2)} standard deviations from mean (${avg.toFixed(2)})`,
          detectedAt: new Date(),
          metadata: {
            dimension,
            currentValue,
            mean: avg,
            stdDev,
            zScore
          }
        });
      }

      // IQR-based detection
      const lowerBound = q1 - 1.5 * iqr;
      const upperBound = q3 + 1.5 * iqr;
      if (currentValue < lowerBound || currentValue > upperBound) {
        anomalies.push({
          id: uuidv4(),
          assetId,
          type: 'outlier',
          severity: 'medium',
          confidence: 0.8,
          description: `${dimension} score (${currentValue}) is outside IQR bounds [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
          detectedAt: new Date(),
          metadata: {
            dimension,
            currentValue,
            lowerBound,
            upperBound,
            q1,
            q3,
            iqr
          }
        });
      }
    }

    return anomalies;
  }

  private async detectIsolationForestAnomalies(
    assetId: string,
    metrics: Record<QualityDimension, number>
  ): Promise<AnomalyEvent[]> {
    // Simplified implementation without external library
    // Would use a proper isolation forest implementation in production
    return [];
  }

  private async trainIsolationForest(assetId: string): Promise<any> {
    // Simplified - would implement proper isolation forest
    return null;
  }

  private async detectAutoencoderAnomalies(
    assetId: string,
    metrics: Record<QualityDimension, number>
  ): Promise<AnomalyEvent[]> {
    const anomalies: AnomalyEvent[] = [];

    // Simplified autoencoder using statistical methods
    // Calculate composite anomaly score based on metric correlations
    const history = await this.db.query(
      `SELECT
        completeness_score,
        accuracy_score,
        consistency_score,
        validity_score,
        freshness_score,
        uniqueness_score
      FROM data_profiles
      WHERE asset_id = (SELECT id FROM catalog_assets WHERE id::text = $1)
      ORDER BY profile_date DESC
      LIMIT 100`,
      [assetId]
    );

    if (history.rows.length < 20) {
      return anomalies;
    }

    // Calculate expected correlations
    const dimensions = ['completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'] as QualityDimension[];
    const currentVector = dimensions.map(d => metrics[d]);

    // Calculate mean vector
    const meanVector = dimensions.map(d => {
      const values = history.rows.map((r: any) => r[`${d}_score`]);
      return mean(values);
    });

    // Calculate deviation score (simplified reconstruction error)
    const deviationScore = currentVector.reduce((sum, val, i) => {
      const diff = val - meanVector[i];
      return sum + (diff * diff);
    }, 0) / currentVector.length;

    // Dynamic threshold based on historical deviations
    const threshold = this.thresholds.get(assetId) || 100;

    if (deviationScore > threshold) {
      anomalies.push({
        id: uuidv4(),
        assetId,
        type: 'pattern',
        severity: deviationScore > threshold * 2 ? 'high' : 'medium',
        confidence: Math.min(0.95, deviationScore / threshold / 2),
        description: `Unusual quality pattern detected (deviation score: ${deviationScore.toFixed(2)})`,
        detectedAt: new Date(),
        metadata: {
          model: 'pattern_detection',
          deviationScore,
          threshold,
          metrics
        }
      });
    }

    return anomalies;
  }

  private async trainStatisticalThresholds(assetId: string): Promise<void> {
    try {
      // Calculate statistical thresholds based on historical data
      const history = await this.db.query(
        `SELECT
          completeness_score,
          accuracy_score,
          consistency_score,
          validity_score,
          freshness_score,
          uniqueness_score
        FROM data_profiles
        WHERE asset_id = (SELECT id FROM catalog_assets WHERE id::text = $1)
        AND completeness_score IS NOT NULL
        ORDER BY profile_date DESC
        LIMIT 500`,
        [assetId]
      );

      if (history.rows.length < 50) {
        return;
      }

      // Calculate deviations for each historical record
      const dimensions = ['completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'];
      const deviations: number[] = [];

      // Calculate mean vector
      const meanVector = dimensions.map(d => {
        const values = history.rows.map((r: any) => r[`${d}_score`]);
        return mean(values);
      });

      // Calculate historical deviations
      for (const row of history.rows) {
        const vector = dimensions.map(d => row[`${d}_score`]);
        const deviation = vector.reduce((sum, val, i) => {
          const diff = val - meanVector[i];
          return sum + (diff * diff);
        }, 0) / vector.length;
        deviations.push(deviation);
      }

      // Set threshold at 95th percentile
      const threshold = quantile(deviations, 0.95);
      this.thresholds.set(assetId, threshold);

      logger.info(`Trained statistical thresholds for asset ${assetId}: ${threshold}`);

    } catch (error) {
      logger.error(`Failed to train thresholds for asset ${assetId}:`, error);
    }
  }

  private async detectLSTMAnomalies(
    assetId: string,
    metrics: Record<QualityDimension, number>
  ): Promise<AnomalyEvent[]> {
    // LSTM implementation for time-series anomaly detection
    // This would predict the next expected values and compare with actual
    return [];
  }

  private async detectPatternAnomalies(
    assetId: string,
    metrics: Record<QualityDimension, number>
  ): Promise<AnomalyEvent[]> {
    const anomalies: AnomalyEvent[] = [];

    // Detect specific patterns
    // 1. Sudden drops
    if (metrics.completeness < 50 && metrics.accuracy < 50) {
      anomalies.push({
        id: uuidv4(),
        assetId,
        type: 'pattern',
        severity: 'critical',
        confidence: 0.95,
        description: 'Critical quality degradation detected across multiple dimensions',
        detectedAt: new Date(),
        metadata: {
          pattern: 'multi_dimension_drop',
          metrics
        }
      });
    }

    // 2. Impossible combinations
    if (metrics.uniqueness === 100 && metrics.completeness < 100) {
      anomalies.push({
        id: uuidv4(),
        assetId,
        type: 'pattern',
        severity: 'medium',
        confidence: 0.8,
        description: 'Inconsistent quality metrics: 100% uniqueness with incomplete data',
        detectedAt: new Date(),
        metadata: {
          pattern: 'logical_inconsistency',
          metrics
        }
      });
    }

    return anomalies;
  }

  private consolidateAnomalies(anomalies: AnomalyEvent[]): AnomalyEvent[] {
    // Remove duplicates and prioritize by severity and confidence
    const uniqueAnomalies = new Map<string, AnomalyEvent>();

    for (const anomaly of anomalies) {
      const key = `${anomaly.assetId}_${anomaly.type}_${anomaly.metadata?.dimension || ''}`;
      const existing = uniqueAnomalies.get(key);

      if (!existing ||
          (anomaly.confidence > existing.confidence) ||
          (anomaly.severity === 'critical' && existing.severity !== 'critical')) {
        uniqueAnomalies.set(key, anomaly);
      }
    }

    return Array.from(uniqueAnomalies.values())
      .sort((a, b) => {
        // Sort by severity then confidence
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[b.severity] - severityOrder[a.severity];
        }
        return b.confidence - a.confidence;
      });
  }

  async retrainModels(): Promise<void> {
    logger.info('Starting threshold recalculation...');

    try {
      // Get all assets that need threshold updates
      const assets = await this.db.query(
        `SELECT DISTINCT ca.id
        FROM catalog_assets ca
        JOIN data_profiles dp ON ca.id = dp.asset_id
        WHERE dp.profile_date > NOW() - INTERVAL '7 days'`
      );

      for (const asset of assets.rows) {
        await this.trainStatisticalThresholds(asset.id);
      }

      logger.info(`Recalculated thresholds for ${assets.rows.length} assets`);
    } catch (error) {
      logger.error('Threshold recalculation failed:', error);
    }
  }
}