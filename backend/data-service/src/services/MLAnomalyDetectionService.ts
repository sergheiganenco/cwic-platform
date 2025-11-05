/**
 * ML Anomaly Detection Service
 *
 * Provides statistical and basic ML-based anomaly detection:
 * - Z-score based detection (already implemented in TrendAnalysis)
 * - Moving average anomaly detection
 * - Isolation Forest (simplified version)
 * - Seasonal decomposition
 *
 * Note: This is a lightweight implementation using statistical methods.
 * For production ML models, integrate with Python services (scikit-learn, TensorFlow)
 */

import { Pool } from 'pg';

export interface AnomalyPrediction {
  id?: string;
  modelId: string;
  ruleId: string;
  assetId?: number;
  predictionType: 'anomaly' | 'forecast' | 'classification';
  predictedValue: number;
  confidence: number;
  anomalyScore: number;
  isAnomaly: boolean;
  predictionTimestamp: Date;
  createdAt: Date;
}

export interface AnomalyModel {
  id?: string;
  name: string;
  modelType: 'isolation_forest' | 'moving_average' | 'seasonal' | 'prophet';
  scopeType: 'global' | 'database' | 'table' | 'rule';
  scopeValue: string;
  modelParams: any;
  trainingDataStart?: Date;
  trainingDataEnd?: Date;
  trainingRowCount?: number;
  accuracyScore?: number;
  version: number;
  status: 'training' | 'active' | 'inactive' | 'failed';
  trainedAt?: Date;
}

export interface DataPoint {
  timestamp: Date;
  value: number;
}

export class MLAnomalyDetectionService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Detect anomalies using moving average method
   */
  async detectMovingAverageAnomalies(
    dataPoints: DataPoint[],
    windowSize: number = 7,
    threshold: number = 2.0
  ): Promise<{ isAnomaly: boolean; score: number; threshold: number }[]> {
    if (dataPoints.length < windowSize) {
      return dataPoints.map(() => ({ isAnomaly: false, score: 0, threshold }));
    }

    const results: { isAnomaly: boolean; score: number; threshold: number }[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      if (i < windowSize) {
        // Not enough history for this point
        results.push({ isAnomaly: false, score: 0, threshold });
        continue;
      }

      // Calculate moving average and std dev
      const window = dataPoints.slice(i - windowSize, i);
      const values = window.map(dp => dp.value);

      const mean = this.calculateMean(values);
      const stdDev = this.calculateStdDev(values);

      // Calculate anomaly score (Z-score)
      const currentValue = dataPoints[i].value;
      const zScore = stdDev === 0 ? 0 : Math.abs((currentValue - mean) / stdDev);

      const isAnomaly = zScore > threshold;

      results.push({
        isAnomaly,
        score: zScore,
        threshold
      });
    }

    return results;
  }

  /**
   * Detect seasonal anomalies
   */
  async detectSeasonalAnomalies(
    dataPoints: DataPoint[],
    seasonalPeriod: number = 24 // hours
  ): Promise<{ isAnomaly: boolean; score: number }[]> {
    if (dataPoints.length < seasonalPeriod * 2) {
      return dataPoints.map(() => ({ isAnomaly: false, score: 0 }));
    }

    const results: { isAnomaly: boolean; score: number }[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      if (i < seasonalPeriod) {
        results.push({ isAnomaly: false, score: 0 });
        continue;
      }

      // Get values from same position in previous periods
      const seasonalValues: number[] = [];
      for (let j = i - seasonalPeriod; j >= 0; j -= seasonalPeriod) {
        seasonalValues.push(dataPoints[j].value);
      }

      if (seasonalValues.length < 2) {
        results.push({ isAnomaly: false, score: 0 });
        continue;
      }

      // Calculate expected value (mean of seasonal values)
      const expectedValue = this.calculateMean(seasonalValues);
      const stdDev = this.calculateStdDev(seasonalValues);

      // Calculate deviation from expected
      const currentValue = dataPoints[i].value;
      const zScore = stdDev === 0 ? 0 : Math.abs((currentValue - expectedValue) / stdDev);

      const isAnomaly = zScore > 2.5;

      results.push({
        isAnomaly,
        score: zScore
      });
    }

    return results;
  }

  /**
   * Simple Isolation Forest implementation
   * (Simplified version - for production use scikit-learn)
   */
  async detectIsolationForestAnomalies(
    dataPoints: DataPoint[],
    contamination: number = 0.1
  ): Promise<{ isAnomaly: boolean; score: number }[]> {
    if (dataPoints.length < 10) {
      return dataPoints.map(() => ({ isAnomaly: false, score: 0 }));
    }

    const values = dataPoints.map(dp => dp.value);

    // Calculate isolation scores (simplified)
    // Real implementation would build trees and calculate path lengths
    const mean = this.calculateMean(values);
    const stdDev = this.calculateStdDev(values);

    // Sort values to find outliers
    const sorted = [...values].sort((a, b) => a - b);
    const threshold = sorted[Math.floor(sorted.length * (1 - contamination))];

    return values.map(value => {
      // Distance from mean normalized by std dev
      const zScore = stdDev === 0 ? 0 : Math.abs((value - mean) / stdDev);

      // Simple isolation score: higher for outliers
      const isolationScore = zScore;

      const isAnomaly = value > threshold || zScore > 3;

      return {
        isAnomaly,
        score: isolationScore
      };
    });
  }

  /**
   * Train and save an anomaly detection model
   */
  async trainModel(
    modelName: string,
    modelType: string,
    scopeType: string,
    scopeValue: string,
    trainingData: DataPoint[]
  ): Promise<string> {
    if (trainingData.length < 100) {
      throw new Error('Insufficient training data (minimum 100 points required)');
    }

    const modelParams: any = {};

    // Calculate baseline statistics for the model
    const values = trainingData.map(dp => dp.value);
    modelParams.mean = this.calculateMean(values);
    modelParams.stdDev = this.calculateStdDev(values);
    modelParams.min = Math.min(...values);
    modelParams.max = Math.max(...values);
    modelParams.median = this.calculateMedian(values);

    // For moving average models
    if (modelType === 'moving_average') {
      modelParams.windowSize = 7;
      modelParams.threshold = 2.5;
    }

    // For seasonal models
    if (modelType === 'seasonal') {
      modelParams.seasonalPeriod = 24;
      modelParams.threshold = 2.5;
    }

    // Save model
    const query = `
      INSERT INTO ml_anomaly_models (
        name,
        model_type,
        scope_type,
        scope_value,
        model_params,
        training_data_start,
        training_data_end,
        training_row_count,
        accuracy_score,
        version,
        status,
        trained_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `;

    const trainingStart = trainingData[0].timestamp;
    const trainingEnd = trainingData[trainingData.length - 1].timestamp;

    const result = await this.db.query(query, [
      modelName,
      modelType,
      scopeType,
      scopeValue,
      JSON.stringify(modelParams),
      trainingStart,
      trainingEnd,
      trainingData.length,
      null, // Accuracy calculated during validation
      1, // Version
      'active',
      new Date()
    ]);

    return result.rows[0].id;
  }

  /**
   * Make predictions using a trained model
   */
  async predict(
    modelId: string,
    ruleId: string,
    dataPoints: DataPoint[]
  ): Promise<AnomalyPrediction[]> {
    // Get model
    const model = await this.getModel(modelId);

    if (!model) {
      throw new Error(`Model not found: ${modelId}`);
    }

    let anomalies: { isAnomaly: boolean; score: number }[];

    // Apply model based on type
    switch (model.modelType) {
      case 'moving_average':
        anomalies = await this.detectMovingAverageAnomalies(
          dataPoints,
          model.modelParams.windowSize,
          model.modelParams.threshold
        );
        break;

      case 'seasonal':
        anomalies = await this.detectSeasonalAnomalies(
          dataPoints,
          model.modelParams.seasonalPeriod
        );
        break;

      case 'isolation_forest':
        anomalies = await this.detectIsolationForestAnomalies(dataPoints, 0.1);
        break;

      default:
        throw new Error(`Unknown model type: ${model.modelType}`);
    }

    // Create predictions
    const predictions: AnomalyPrediction[] = [];

    for (let i = 0; i < dataPoints.length; i++) {
      const prediction: AnomalyPrediction = {
        modelId,
        ruleId,
        predictionType: 'anomaly',
        predictedValue: dataPoints[i].value,
        confidence: anomalies[i].score > 0 ? Math.min(anomalies[i].score * 20, 100) : 50,
        anomalyScore: anomalies[i].score,
        isAnomaly: anomalies[i].isAnomaly,
        predictionTimestamp: dataPoints[i].timestamp,
        createdAt: new Date()
      };

      // Save prediction
      await this.savePrediction(prediction);
      predictions.push(prediction);
    }

    return predictions;
  }

  /**
   * Get model by ID
   */
  private async getModel(modelId: string): Promise<AnomalyModel | null> {
    const query = `
      SELECT
        id,
        name,
        model_type as "modelType",
        scope_type as "scopeType",
        scope_value as "scopeValue",
        model_params as "modelParams",
        training_data_start as "trainingDataStart",
        training_data_end as "trainingDataEnd",
        training_row_count as "trainingRowCount",
        accuracy_score as "accuracyScore",
        version,
        status,
        trained_at as "trainedAt"
      FROM ml_anomaly_models
      WHERE id = $1
    `;

    const result = await this.db.query(query, [modelId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Save prediction
   */
  private async savePrediction(prediction: AnomalyPrediction): Promise<void> {
    const query = `
      INSERT INTO ml_anomaly_predictions (
        model_id,
        rule_id,
        asset_id,
        prediction_type,
        predicted_value,
        confidence,
        anomaly_score,
        is_anomaly,
        prediction_timestamp
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await this.db.query(query, [
      prediction.modelId,
      prediction.ruleId,
      prediction.assetId || null,
      prediction.predictionType,
      prediction.predictedValue,
      prediction.confidence,
      prediction.anomalyScore,
      prediction.isAnomaly,
      prediction.predictionTimestamp
    ]);
  }

  /**
   * Calculate mean
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = this.calculateMean(values);
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const variance = this.calculateMean(squaredDiffs);

    return Math.sqrt(variance);
  }

  /**
   * Calculate median
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }

    return sorted[mid];
  }

  /**
   * Get recent anomalies
   */
  async getRecentAnomalies(windowHours: number = 24): Promise<any[]> {
    const query = `
      SELECT
        pred.id,
        pred.rule_id as "ruleId",
        pred.anomaly_score as "anomalyScore",
        pred.predicted_value as "predictedValue",
        pred.confidence,
        pred.prediction_timestamp as "predictionTimestamp",
        model.name as "modelName",
        model.model_type as "modelType"
      FROM ml_anomaly_predictions pred
      JOIN ml_anomaly_models model ON model.id = pred.model_id
      WHERE pred.is_anomaly = true
        AND pred.prediction_timestamp > NOW() - INTERVAL '${windowHours} hours'
      ORDER BY pred.anomaly_score DESC, pred.prediction_timestamp DESC
      LIMIT 100
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Get model performance metrics
   */
  async getModelMetrics(modelId: string): Promise<any> {
    const query = `
      SELECT
        COUNT(*) as total_predictions,
        COUNT(CASE WHEN is_anomaly THEN 1 END) as anomaly_count,
        AVG(confidence) as avg_confidence,
        AVG(anomaly_score) as avg_anomaly_score,
        MAX(prediction_timestamp) as last_prediction_at
      FROM ml_anomaly_predictions
      WHERE model_id = $1
    `;

    const result = await this.db.query(query, [modelId]);

    return {
      modelId,
      totalPredictions: parseInt(result.rows[0].total_predictions),
      anomalyCount: parseInt(result.rows[0].anomaly_count),
      anomalyRate: (parseInt(result.rows[0].anomaly_count) / parseInt(result.rows[0].total_predictions)) * 100,
      avgConfidence: parseFloat(result.rows[0].avg_confidence),
      avgAnomalyScore: parseFloat(result.rows[0].avg_anomaly_score),
      lastPredictionAt: result.rows[0].last_prediction_at
    };
  }
}
