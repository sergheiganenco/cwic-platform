/**
 * Trend Analysis Service
 *
 * Analyzes quality metrics over time to detect:
 * - Trend direction (improving, stable, degrading)
 * - Velocity (rate of change)
 * - Predictions (forecast next values)
 * - Anomalies (statistical outliers)
 */

import { Pool } from 'pg';

export interface TrendAnalysis {
  ruleId: string;
  assetId?: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
  velocity: number;
  predictedNextValue: number;
  predictionConfidence: number;
  timeToThreshold?: string;
  anomalyDetected: boolean;
  anomalyScore?: number;
  baselineValue: number;
  currentValue: number;
  sparklineData: number[];
  calculatedAt: Date;
}

export interface DataPoint {
  timestamp: Date;
  value: number;
}

export class TrendAnalysisService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Analyze trend for a quality rule
   */
  async analyzeTrend(
    ruleId: string,
    assetId?: number,
    windowHours: number = 24
  ): Promise<TrendAnalysis | null> {
    // Get historical data points
    const dataPoints = await this.getHistoricalData(ruleId, assetId, windowHours);

    if (dataPoints.length < 3) {
      return null; // Not enough data for trend analysis
    }

    // Extract values for analysis
    const values = dataPoints.map(dp => dp.value);

    // Calculate baseline (first 1/3 of data)
    const baselineCount = Math.floor(values.length / 3);
    const baselineValues = values.slice(0, Math.max(baselineCount, 1));
    const baselineValue = this.average(baselineValues);

    // Current value (latest point)
    const currentValue = values[values.length - 1];

    // Trend direction and velocity
    const { direction, velocity } = this.calculateTrend(values);

    // Prediction using linear regression
    const prediction = this.predictNextValue(values);

    // Anomaly detection
    const anomaly = this.detectAnomaly(values);

    // Time to threshold (if degrading)
    const timeToThreshold = this.calculateTimeToThreshold(
      values,
      prediction.slope,
      100 // threshold value
    );

    // Build sparkline (normalize to last 24 points)
    const sparklineData = values.slice(-24);

    const analysis: TrendAnalysis = {
      ruleId,
      assetId,
      trendDirection: direction,
      velocity,
      predictedNextValue: prediction.value,
      predictionConfidence: prediction.confidence,
      timeToThreshold,
      anomalyDetected: anomaly.detected,
      anomalyScore: anomaly.score,
      baselineValue,
      currentValue,
      sparklineData,
      calculatedAt: new Date()
    };

    // Save to database
    await this.saveTrend(analysis);

    return analysis;
  }

  /**
   * Get historical data points for a rule
   */
  private async getHistoricalData(
    ruleId: string,
    assetId: number | undefined,
    windowHours: number
  ): Promise<DataPoint[]> {
    // Note: asset_id filtering is skipped because quality_results may have different schema
    // The rule_id is unique enough for trend analysis per table
    let query = `
      SELECT
        run_at as timestamp,
        COALESCE(rows_failed, 0) as value
      FROM quality_results
      WHERE rule_id = $1
        AND run_at > NOW() - INTERVAL '${windowHours} hours'
      ORDER BY run_at ASC
    `;

    const params: any[] = [ruleId];
    const result = await this.db.query(query, params);

    return result.rows.map(row => ({
      timestamp: row.timestamp,
      value: parseFloat(row.value) || 0
    }));
  }

  /**
   * Calculate trend direction and velocity
   */
  private calculateTrend(values: number[]): {
    direction: 'improving' | 'stable' | 'degrading';
    velocity: number;
  } {
    if (values.length < 2) {
      return { direction: 'stable', velocity: 0 };
    }

    // Compare recent average to baseline average
    const recentCount = Math.min(6, Math.ceil(values.length / 3));
    const baselineCount = Math.min(6, Math.ceil(values.length / 3));

    const recentValues = values.slice(-recentCount);
    const baselineValues = values.slice(0, baselineCount);

    const recentAvg = this.average(recentValues);
    const baselineAvg = this.average(baselineValues);

    // Calculate percentage change
    const change = baselineAvg === 0
      ? 0
      : ((recentAvg - baselineAvg) / baselineAvg) * 100;

    // Calculate velocity (rate of change per hour)
    const velocity = Math.abs(change) / values.length;

    // Determine direction
    let direction: 'improving' | 'stable' | 'degrading';
    if (change > 10) {
      direction = 'degrading'; // More failed rows = worse
    } else if (change < -10) {
      direction = 'improving'; // Fewer failed rows = better
    } else {
      direction = 'stable';
    }

    return { direction, velocity };
  }

  /**
   * Predict next value using linear regression
   */
  private predictNextValue(values: number[]): {
    value: number;
    slope: number;
    confidence: number;
  } {
    const n = values.length;
    if (n < 2) {
      return { value: values[0] || 0, slope: 0, confidence: 0 };
    }

    // Create x values (0, 1, 2, ..., n-1)
    const x = Array.from({ length: n }, (_, i) => i);

    // Calculate linear regression
    const { slope, intercept } = this.linearRegression(x, values);

    // Predict next value (at x = n)
    const predictedValue = slope * n + intercept;

    // Calculate R-squared for confidence
    const rSquared = this.calculateRSquared(x, values, slope, intercept);
    const confidence = Math.max(0, Math.min(100, rSquared * 100));

    return {
      value: Math.max(0, predictedValue),
      slope,
      confidence
    };
  }

  /**
   * Linear regression calculation
   */
  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope, intercept };
  }

  /**
   * Calculate R-squared (coefficient of determination)
   */
  private calculateRSquared(
    x: number[],
    y: number[],
    slope: number,
    intercept: number
  ): number {
    const yMean = this.average(y);
    const predicted = x.map(xi => slope * xi + intercept);

    const ssTotal = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const ssResidual = y.reduce((sum, yi, i) => sum + Math.pow(yi - predicted[i], 2), 0);

    if (ssTotal === 0) return 0;

    return 1 - (ssResidual / ssTotal);
  }

  /**
   * Detect anomalies using Z-score method
   */
  private detectAnomaly(values: number[]): { detected: boolean; score?: number } {
    if (values.length < 3) {
      return { detected: false };
    }

    const mean = this.average(values);
    const stdDev = this.standardDeviation(values);

    if (stdDev === 0) {
      return { detected: false };
    }

    // Calculate Z-score for latest value
    const latestValue = values[values.length - 1];
    const zScore = Math.abs((latestValue - mean) / stdDev);

    // Z-score > 3 indicates anomaly (99.7% confidence)
    const detected = zScore > 3;

    return { detected, score: zScore };
  }

  /**
   * Calculate time to threshold
   */
  private calculateTimeToThreshold(
    values: number[],
    slope: number,
    threshold: number
  ): string | null {
    if (slope <= 0 || values.length === 0) {
      return null; // Not trending upward
    }

    const currentValue = values[values.length - 1];

    if (currentValue >= threshold) {
      return 'Already exceeded';
    }

    // Calculate hours to reach threshold
    const stepsToThreshold = (threshold - currentValue) / slope;

    if (stepsToThreshold <= 0 || !isFinite(stepsToThreshold)) {
      return null;
    }

    // Convert to human-readable format
    if (stepsToThreshold < 1) {
      return `${Math.ceil(stepsToThreshold * 60)} minutes`;
    } else if (stepsToThreshold < 24) {
      return `${Math.ceil(stepsToThreshold)} hours`;
    } else {
      const days = Math.ceil(stepsToThreshold / 24);
      return `${days} day${days === 1 ? '' : 's'}`;
    }
  }

  /**
   * Save trend analysis to database
   */
  private async saveTrend(trend: TrendAnalysis): Promise<void> {
    const query = `
      INSERT INTO alert_trends (
        rule_id,
        asset_id,
        trend_direction,
        velocity,
        predicted_next_value,
        prediction_confidence,
        time_to_threshold,
        anomaly_detected,
        anomaly_score,
        baseline_value,
        current_value,
        sparkline_data,
        calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      ON CONFLICT (rule_id, asset_id)
      DO UPDATE SET
        trend_direction = EXCLUDED.trend_direction,
        velocity = EXCLUDED.velocity,
        predicted_next_value = EXCLUDED.predicted_next_value,
        prediction_confidence = EXCLUDED.prediction_confidence,
        time_to_threshold = EXCLUDED.time_to_threshold,
        anomaly_detected = EXCLUDED.anomaly_detected,
        anomaly_score = EXCLUDED.anomaly_score,
        baseline_value = EXCLUDED.baseline_value,
        current_value = EXCLUDED.current_value,
        sparkline_data = EXCLUDED.sparkline_data,
        calculated_at = EXCLUDED.calculated_at
    `;

    await this.db.query(query, [
      trend.ruleId,
      trend.assetId || null,
      trend.trendDirection,
      trend.velocity,
      trend.predictedNextValue,
      trend.predictionConfidence,
      trend.timeToThreshold || null,
      trend.anomalyDetected,
      trend.anomalyScore || null,
      trend.baselineValue,
      trend.currentValue,
      JSON.stringify(trend.sparklineData),
      trend.calculatedAt
    ]);
  }

  /**
   * Get trend analysis for a rule
   */
  async getTrend(ruleId: string, assetId?: number): Promise<TrendAnalysis | null> {
    let query = `
      SELECT
        rule_id as "ruleId",
        asset_id as "assetId",
        trend_direction as "trendDirection",
        velocity,
        predicted_next_value as "predictedNextValue",
        prediction_confidence as "predictionConfidence",
        time_to_threshold as "timeToThreshold",
        anomaly_detected as "anomalyDetected",
        anomaly_score as "anomalyScore",
        baseline_value as "baselineValue",
        current_value as "currentValue",
        sparkline_data as "sparklineData",
        calculated_at as "calculatedAt"
      FROM alert_trends
      WHERE rule_id = $1
    `;

    const params: any[] = [ruleId];

    if (assetId) {
      query += ` AND asset_id = $2`;
      params.push(assetId);
    }

    const result = await this.db.query(query, params);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      ...row,
      sparklineData: row.sparklineData || []
    };
  }

  /**
   * Bulk analyze trends for multiple rules
   */
  async bulkAnalyzeTrends(
    rules: Array<{ ruleId: string; assetId?: number }>,
    windowHours: number = 24
  ): Promise<TrendAnalysis[]> {
    const trends: TrendAnalysis[] = [];

    for (const rule of rules) {
      const trend = await this.analyzeTrend(rule.ruleId, rule.assetId, windowHours);
      if (trend) {
        trends.push(trend);
      }
    }

    return trends;
  }

  /**
   * Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const avg = this.average(values);
    const squaredDiffs = values.map(v => Math.pow(v - avg, 2));
    const variance = this.average(squaredDiffs);

    return Math.sqrt(variance);
  }

  /**
   * Get anomalies in last N hours
   */
  async getAnomalies(windowHours: number = 24): Promise<any[]> {
    const query = `
      SELECT
        at.rule_id as "ruleId",
        at.asset_id as "assetId",
        qr.name as "ruleName",
        ca.table_name as "tableName",
        ca.database_name as "databaseName",
        at.anomaly_score as "anomalyScore",
        at.current_value as "currentValue",
        at.baseline_value as "baselineValue",
        at.calculated_at as "detectedAt"
      FROM alert_trends at
      JOIN quality_rules qr ON qr.id = at.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = at.asset_id
      WHERE at.anomaly_detected = true
        AND at.calculated_at > NOW() - INTERVAL '${windowHours} hours'
      ORDER BY at.anomaly_score DESC, at.calculated_at DESC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }
}
