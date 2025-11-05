/**
 * Criticality Score Service
 *
 * Calculates criticality scores for quality alerts based on multiple factors:
 * - Base severity (critical, high, medium, low)
 * - Financial impact (estimated revenue at risk)
 * - User impact (number of users/rows affected)
 * - Compliance risk (PII, PHI, GDPR violations)
 * - Trend analysis (getting worse vs improving)
 * - Downstream dependencies (number of dependent assets)
 */

import { Pool } from 'pg';

export interface CriticalityFactors {
  baseSeverity: 'critical' | 'high' | 'medium' | 'low';
  financialImpact: number; // 0-100
  userImpact: number; // 0-100
  complianceRisk: number; // 0-100
  trendScore: number; // 0-100
  downstreamImpact: number; // 0-100
  affectedPercentage?: number; // 0-100
  tableImportance?: 'critical' | 'high' | 'medium' | 'low';
}

export interface CriticalityScore {
  alertId: string;
  score: number; // 0-100
  baseSeverityScore: number;
  financialImpactScore: number;
  userImpactScore: number;
  complianceRiskScore: number;
  trendScore: number;
  downstreamImpactScore: number;
  calculatedAt: Date;
}

export class CriticalityScoreService {
  private db: Pool;

  // Scoring weights (must sum to 1.0)
  private readonly weights = {
    baseSeverity: 0.20,
    financialImpact: 0.20,
    userImpact: 0.15,
    complianceRisk: 0.15,
    trendScore: 0.15,
    downstreamImpact: 0.15
  };

  // Severity multipliers
  private readonly severityScores = {
    critical: 100,
    high: 75,
    medium: 50,
    low: 25
  };

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Calculate criticality score for an alert
   */
  async calculateScore(
    alertId: string,
    factors: Partial<CriticalityFactors>
  ): Promise<CriticalityScore> {
    // Normalize all factor scores to 0-100 range
    const baseSeverityScore = factors.baseSeverity
      ? this.severityScores[factors.baseSeverity]
      : 50;

    const financialImpactScore = this.normalizeScore(factors.financialImpact ?? 0);
    const userImpactScore = this.normalizeScore(factors.userImpact ?? 0);
    const complianceRiskScore = this.normalizeScore(factors.complianceRisk ?? 0);
    const trendScore = this.normalizeScore(factors.trendScore ?? 50);
    const downstreamImpactScore = this.normalizeScore(factors.downstreamImpact ?? 0);

    // Calculate weighted score
    let score = 0;
    score += baseSeverityScore * this.weights.baseSeverity;
    score += financialImpactScore * this.weights.financialImpact;
    score += userImpactScore * this.weights.userImpact;
    score += complianceRiskScore * this.weights.complianceRisk;
    score += trendScore * this.weights.trendScore;
    score += downstreamImpactScore * this.weights.downstreamImpact;

    // Apply multipliers for critical conditions
    if (factors.affectedPercentage && factors.affectedPercentage > 50) {
      score *= 1.2; // 20% boost if >50% of data affected
    }

    if (factors.tableImportance === 'critical') {
      score *= 1.3; // 30% boost for critical tables
    }

    // Cap at 100
    score = Math.min(score, 100);

    const result: CriticalityScore = {
      alertId,
      score: Math.round(score * 100) / 100,
      baseSeverityScore: Math.round(baseSeverityScore * 100) / 100,
      financialImpactScore: Math.round(financialImpactScore * 100) / 100,
      userImpactScore: Math.round(userImpactScore * 100) / 100,
      complianceRiskScore: Math.round(complianceRiskScore * 100) / 100,
      trendScore: Math.round(trendScore * 100) / 100,
      downstreamImpactScore: Math.round(downstreamImpactScore * 100) / 100,
      calculatedAt: new Date()
    };

    // Save to database
    await this.saveScore(result);

    return result;
  }

  /**
   * Calculate financial impact score based on revenue at risk
   */
  calculateFinancialImpact(revenueAtRisk: number): number {
    // Logarithmic scale: $0 = 0, $1K = 25, $10K = 50, $100K = 75, $1M+ = 100
    if (revenueAtRisk <= 0) return 0;
    if (revenueAtRisk >= 1000000) return 100;

    const score = 25 * Math.log10(revenueAtRisk / 100);
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate user impact score based on affected users/rows
   */
  calculateUserImpact(affectedRows: number, totalRows: number = 0): number {
    if (affectedRows <= 0) return 0;

    // If we know total rows, use percentage
    if (totalRows > 0) {
      const percentage = (affectedRows / totalRows) * 100;
      return Math.min(percentage, 100);
    }

    // Otherwise, use logarithmic scale
    // 1 row = 5, 10 rows = 20, 100 rows = 35, 1000 rows = 50, 10000+ rows = 75
    if (affectedRows >= 10000) return 75;

    const score = 15 * Math.log10(affectedRows + 1);
    return Math.min(Math.max(score, 0), 100);
  }

  /**
   * Calculate compliance risk score
   */
  calculateComplianceRisk(complianceTags: string[]): number {
    if (!complianceTags || complianceTags.length === 0) return 0;

    // High-risk compliance tags
    const riskScores: { [key: string]: number } = {
      PII: 80,
      PHI: 90,
      PCI: 85,
      GDPR: 75,
      SOX: 70,
      HIPAA: 90
    };

    let maxScore = 0;
    for (const tag of complianceTags) {
      const tagUpper = tag.toUpperCase();
      const score = riskScores[tagUpper] || 50;
      maxScore = Math.max(maxScore, score);
    }

    return maxScore;
  }

  /**
   * Calculate trend score (higher = worse trend)
   */
  calculateTrendScore(
    trendDirection: 'improving' | 'stable' | 'degrading',
    velocity: number
  ): number {
    if (trendDirection === 'improving') {
      return Math.max(0, 50 - velocity * 10); // Lower score if improving
    } else if (trendDirection === 'degrading') {
      return Math.min(100, 50 + velocity * 10); // Higher score if degrading
    }
    return 50; // Neutral for stable
  }

  /**
   * Calculate downstream impact score
   */
  calculateDownstreamImpact(dependentAssets: number): number {
    if (dependentAssets <= 0) return 0;
    if (dependentAssets >= 20) return 100;

    // Linear scale: 1 asset = 5, 10 assets = 50, 20+ assets = 100
    return Math.min((dependentAssets * 5), 100);
  }

  /**
   * Save criticality score to database
   */
  private async saveScore(score: CriticalityScore): Promise<void> {
    const query = `
      INSERT INTO alert_criticality_scores (
        alert_id,
        score,
        base_severity_score,
        financial_impact_score,
        user_impact_score,
        compliance_risk_score,
        trend_score,
        downstream_impact_score,
        calculated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (alert_id)
      DO UPDATE SET
        score = EXCLUDED.score,
        base_severity_score = EXCLUDED.base_severity_score,
        financial_impact_score = EXCLUDED.financial_impact_score,
        user_impact_score = EXCLUDED.user_impact_score,
        compliance_risk_score = EXCLUDED.compliance_risk_score,
        trend_score = EXCLUDED.trend_score,
        downstream_impact_score = EXCLUDED.downstream_impact_score,
        calculated_at = EXCLUDED.calculated_at
    `;

    await this.db.query(query, [
      score.alertId,
      score.score,
      score.baseSeverityScore,
      score.financialImpactScore,
      score.userImpactScore,
      score.complianceRiskScore,
      score.trendScore,
      score.downstreamImpactScore,
      score.calculatedAt
    ]);
  }

  /**
   * Get criticality score for an alert
   */
  async getScore(alertId: string): Promise<CriticalityScore | null> {
    const query = `
      SELECT
        alert_id as "alertId",
        score,
        base_severity_score as "baseSeverityScore",
        financial_impact_score as "financialImpactScore",
        user_impact_score as "userImpactScore",
        compliance_risk_score as "complianceRiskScore",
        trend_score as "trendScore",
        downstream_impact_score as "downstreamImpactScore",
        calculated_at as "calculatedAt"
      FROM alert_criticality_scores
      WHERE alert_id = $1
    `;

    const result = await this.db.query(query, [alertId]);

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }

  /**
   * Normalize any value to 0-100 range
   */
  private normalizeScore(value: number): number {
    return Math.min(Math.max(value, 0), 100);
  }

  /**
   * Bulk calculate scores for multiple alerts
   */
  async bulkCalculateScores(
    alerts: Array<{
      id: string;
      severity: string;
      rowsFailed: number;
      totalRows?: number;
      revenueImpact?: number;
      complianceTags?: string[];
      trendDirection?: 'improving' | 'stable' | 'degrading';
      trendVelocity?: number;
      downstreamCount?: number;
      tableImportance?: string;
    }>
  ): Promise<CriticalityScore[]> {
    const scores: CriticalityScore[] = [];

    for (const alert of alerts) {
      const factors: Partial<CriticalityFactors> = {
        baseSeverity: (alert.severity as any) || 'medium',
        financialImpact: alert.revenueImpact
          ? this.calculateFinancialImpact(alert.revenueImpact)
          : 0,
        userImpact: this.calculateUserImpact(alert.rowsFailed, alert.totalRows),
        complianceRisk: alert.complianceTags
          ? this.calculateComplianceRisk(alert.complianceTags)
          : 0,
        trendScore: alert.trendDirection
          ? this.calculateTrendScore(alert.trendDirection, alert.trendVelocity || 0)
          : 50,
        downstreamImpact: alert.downstreamCount
          ? this.calculateDownstreamImpact(alert.downstreamCount)
          : 0,
        tableImportance: (alert.tableImportance as any) || 'medium'
      };

      const score = await this.calculateScore(alert.id, factors);
      scores.push(score);
    }

    return scores;
  }
}
