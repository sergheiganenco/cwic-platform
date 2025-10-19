// backend/data-service/src/services/QualityROIService.ts
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const cpdb = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Quality ROI Service
 * Calculates business value and return on investment for data quality initiatives
 */
export class QualityROIService {
  // Configurable cost factors (can be customized per organization)
  private readonly COST_FACTORS = {
    costPerBadRow: 0.10, // $0.10 per row with quality issues
    costPerCriticalIssue: 500, // $500 per critical quality issue
    costPerHighIssue: 100, // $100 per high severity issue
    costPerMediumIssue: 25, // $25 per medium severity issue
    costPerDowntimeHour: 10000, // $10k per hour of downtime
    revenueMultiplier: 2.5, // Revenue impact is 2.5x the cost
    averageHourlyRate: 75, // $75/hour for data team
    automationSavingsRate: 0.80 // 80% time savings from automation
  };

  /**
   * Calculate comprehensive ROI for a data source
   */
  async calculateDataSourceROI(
    dataSourceId: string,
    period: 'day' | 'week' | 'month' | 'quarter' | 'year' = 'month'
  ): Promise<QualityROIReport> {
    try {
      const periodDays = this.getPeriodDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      // Get all quality metrics for the period
      const metrics = await this.getQualityMetrics(dataSourceId, startDate);

      // Calculate costs
      const issueCosts = await this.calculateIssueCosts(metrics);
      const remediationCosts = await this.calculateRemediationCosts(metrics);
      const preventionSavings = await this.calculatePreventionSavings(metrics);
      const downstreamImpactCosts = await this.calculateDownstreamCosts(metrics);

      // Calculate time metrics
      const timeMetrics = await this.calculateTimeMetrics(metrics);

      // Calculate quality improvement value
      const qualityImprovementValue = await this.calculateQualityImprovementValue(metrics);

      // Calculate total ROI
      const totalCosts = issueCosts + remediationCosts + downstreamImpactCosts;
      const totalBenefits = preventionSavings + qualityImprovementValue + timeMetrics.timeSavingsValue;
      const netBenefit = totalBenefits - totalCosts;
      const roi = totalCosts > 0 ? ((netBenefit / totalCosts) * 100) : 0;

      // Store metrics
      await this.storeROIMetrics(dataSourceId, {
        totalIssues: metrics.totalIssues,
        issuesResolved: metrics.issuesResolved,
        issuesPrevented: metrics.issuesPrevented,
        rowsAffected: metrics.rowsAffected,
        rowsFixed: metrics.rowsFixed,
        downstreamAssetsProtected: metrics.downstreamAssetsProtected,
        estimatedIssueCost: issueCosts,
        remediationCost: remediationCosts,
        preventionSavings,
        totalROI: roi,
        timeSpentOnQuality: timeMetrics.timeSpent,
        timeSavedByAutomation: timeMetrics.timeSaved,
        avgQualityScore: metrics.avgQualityScore,
        qualityImprovement: metrics.qualityImprovement
      });

      return {
        dataSourceId,
        period,
        periodDays,

        // Cost Breakdown
        costs: {
          issueCosts,
          remediationCosts,
          downstreamImpactCosts,
          totalCosts
        },

        // Benefits Breakdown
        benefits: {
          preventionSavings,
          qualityImprovementValue,
          timeSavings: timeMetrics.timeSavingsValue,
          totalBenefits
        },

        // ROI Metrics
        netBenefit,
        roi,
        paybackPeriod: this.calculatePaybackPeriod(totalCosts, totalBenefits, periodDays),

        // Supporting Metrics
        metrics: {
          totalIssues: metrics.totalIssues,
          issuesResolved: metrics.issuesResolved,
          issuesPrevented: metrics.issuesPrevented,
          rowsAffected: metrics.rowsAffected,
          rowsFixed: metrics.rowsFixed,
          downstreamAssetsProtected: metrics.downstreamAssetsProtected,
          avgQualityScore: metrics.avgQualityScore,
          qualityImprovement: metrics.qualityImprovement
        },

        // Time Metrics
        timeMetrics: {
          hoursSpent: timeMetrics.timeSpent,
          hoursSaved: timeMetrics.timeSaved,
          netTimeSavings: timeMetrics.timeSaved - timeMetrics.timeSpent,
          automationEfficiency: timeMetrics.automationEfficiency
        },

        // Projections
        projections: this.calculateProjections(netBenefit, periodDays)
      };
    } catch (error: any) {
      logger.error('Failed to calculate ROI:', error);
      throw error;
    }
  }

  /**
   * Get ROI trend over time
   */
  async getROITrend(
    dataSourceId: string,
    days: number = 90
  ): Promise<ROITrendData[]> {
    try {
      const { rows } = await cpdb.query(`
        SELECT
          metric_date,
          total_issues,
          issues_resolved,
          issues_prevented,
          rows_affected,
          rows_fixed,
          estimated_issue_cost,
          remediation_cost,
          prevention_savings,
          total_roi,
          avg_quality_score,
          quality_improvement
        FROM quality_roi_metrics
        WHERE datasource_id = $1
          AND metric_date >= CURRENT_DATE - INTERVAL '${days} days'
        ORDER BY metric_date ASC
      `, [dataSourceId]);

      return rows.map(row => ({
        date: row.metric_date,
        roi: parseFloat(row.total_roi) || 0,
        costs: parseFloat(row.estimated_issue_cost) + parseFloat(row.remediation_cost),
        savings: parseFloat(row.prevention_savings) || 0,
        qualityScore: parseFloat(row.avg_quality_score) || 0,
        issuesResolved: row.issues_resolved
      }));
    } catch (error: any) {
      logger.error('Failed to get ROI trend:', error);
      throw error;
    }
  }

  /**
   * Calculate ROI for specific quality initiative (e.g., automated healing)
   */
  async calculateInitiativeROI(
    dataSourceId: string,
    initiative: 'automated_healing' | 'profiling' | 'monitoring' | 'sla_management'
  ): Promise<InitiativeROI> {
    try {
      const metrics = await this.getInitiativeMetrics(dataSourceId, initiative);

      const investment = this.estimateInitiativeInvestment(initiative);
      const returns = this.calculateInitiativeReturns(initiative, metrics);

      const roi = ((returns - investment) / investment) * 100;

      return {
        initiative,
        investment,
        returns,
        roi,
        paybackMonths: investment > 0 ? Math.ceil((investment / (returns / 12))) : 0,
        metrics,
        recommendation: this.getInitiativeRecommendation(roi)
      };
    } catch (error: any) {
      logger.error('Failed to calculate initiative ROI:', error);
      throw error;
    }
  }

  /**
   * Compare quality costs across data sources
   */
  async compareDataSourceCosts(period: 'month' | 'quarter' = 'month'): Promise<DataSourceComparison[]> {
    try {
      const periodDays = this.getPeriodDays(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - periodDays);

      const { rows } = await cpdb.query(`
        SELECT
          ds.id,
          ds.name,
          COUNT(DISTINCT qi.id) as total_issues,
          COUNT(DISTINCT qi.id) FILTER (WHERE qi.severity = 'critical') as critical_issues,
          SUM(qi.affected_rows) as total_affected_rows,
          AVG(qrm.total_roi) as avg_roi,
          SUM(qrm.estimated_issue_cost) as total_cost,
          SUM(qrm.prevention_savings) as total_savings
        FROM data_sources ds
        LEFT JOIN catalog_assets ca ON ca.datasource_id = ds.id
        LEFT JOIN quality_issues qi ON qi.asset_id = ca.id AND qi.created_at >= $1
        LEFT JOIN quality_roi_metrics qrm ON qrm.datasource_id = ds.id AND qrm.metric_date >= $1::date
        GROUP BY ds.id, ds.name
        ORDER BY total_cost DESC NULLS LAST
      `, [startDate]);

      return rows.map(row => ({
        dataSourceId: row.id,
        dataSourceName: row.name,
        totalIssues: row.total_issues || 0,
        criticalIssues: row.critical_issues || 0,
        totalAffectedRows: parseInt(row.total_affected_rows || '0'),
        totalCost: parseFloat(row.total_cost) || 0,
        totalSavings: parseFloat(row.total_savings) || 0,
        avgROI: parseFloat(row.avg_roi) || 0,
        costPerIssue: row.total_issues > 0 ?
          (parseFloat(row.total_cost) || 0) / row.total_issues : 0
      }));
    } catch (error: any) {
      logger.error('Failed to compare data sources:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async getQualityMetrics(dataSourceId: string, startDate: Date): Promise<any> {
    const { rows: issueRows } = await cpdb.query(`
      SELECT
        COUNT(*) as total_issues,
        COUNT(*) FILTER (WHERE status = 'resolved') as issues_resolved,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_issues,
        COUNT(*) FILTER (WHERE severity = 'high') as high_issues,
        COUNT(*) FILTER (WHERE severity = 'medium') as medium_issues,
        SUM(affected_rows) as rows_affected,
        AVG(impact_score) as avg_impact_score
      FROM quality_issues qi
      JOIN catalog_assets ca ON ca.id = qi.asset_id
      WHERE ca.datasource_id = $1
        AND qi.created_at >= $2
    `, [dataSourceId, startDate]);

    const { rows: healingRows } = await cpdb.query(`
      SELECT
        COUNT(*) FILTER (WHERE success = true) as successful_healings,
        SUM(rows_affected) as rows_fixed
      FROM quality_healing_attempts qha
      JOIN quality_issues qi ON qi.id = qha.issue_id
      JOIN catalog_assets ca ON ca.id = qi.asset_id
      WHERE ca.datasource_id = $1
        AND qha.created_at >= $2
    `, [dataSourceId, startDate]);

    const { rows: profileRows } = await cpdb.query(`
      SELECT
        AVG(quality_score) as avg_quality_score
      FROM data_profiles
      WHERE datasource_id = $1
        AND created_at >= $2
    `, [dataSourceId, startDate]);

    const issues = issueRows[0] || {};
    const healing = healingRows[0] || {};
    const profile = profileRows[0] || {};

    return {
      totalIssues: parseInt(issues.total_issues) || 0,
      issuesResolved: parseInt(issues.issues_resolved) || 0,
      issuesPrevented: 0, // Would need to track this separately
      criticalIssues: parseInt(issues.critical_issues) || 0,
      highIssues: parseInt(issues.high_issues) || 0,
      mediumIssues: parseInt(issues.medium_issues) || 0,
      rowsAffected: parseInt(issues.rows_affected) || 0,
      rowsFixed: parseInt(healing.rows_fixed) || 0,
      downstreamAssetsProtected: 0, // From impact analysis
      avgQualityScore: parseFloat(profile.avg_quality_score) || 0,
      qualityImprovement: 0, // Calculate from historical data
      avgImpactScore: parseFloat(issues.avg_impact_score) || 0
    };
  }

  private async calculateIssueCosts(metrics: any): Promise<number> {
    const rowCosts = metrics.rowsAffected * this.COST_FACTORS.costPerBadRow;
    const criticalCosts = metrics.criticalIssues * this.COST_FACTORS.costPerCriticalIssue;
    const highCosts = metrics.highIssues * this.COST_FACTORS.costPerHighIssue;
    const mediumCosts = metrics.mediumIssues * this.COST_FACTORS.costPerMediumIssue;

    return Math.round(rowCosts + criticalCosts + highCosts + mediumCosts);
  }

  private async calculateRemediationCosts(metrics: any): Promise<number> {
    // Estimate time spent fixing issues
    const avgTimePerIssue = 2; // 2 hours per issue
    const totalHours = metrics.issuesResolved * avgTimePerIssue;
    return Math.round(totalHours * this.COST_FACTORS.averageHourlyRate);
  }

  private async calculatePreventionSavings(metrics: any): Promise<number> {
    // Calculate savings from prevented issues
    const preventedIssueCost = metrics.issuesPrevented * this.COST_FACTORS.costPerMediumIssue;
    return Math.round(preventedIssueCost);
  }

  private async calculateDownstreamCosts(metrics: any): Promise<number> {
    // Estimated cost of quality issues propagating downstream
    const propagationMultiplier = 1.5; // Issues cost 50% more when they propagate
    return Math.round(metrics.avgImpactScore * propagationMultiplier * 100);
  }

  private async calculateTimeMetrics(metrics: any): Promise<any> {
    const manualTimePerIssue = 2; // 2 hours manually
    const automatedTimePerIssue = 0.25; // 15 minutes automated

    const timeSpent = metrics.issuesResolved * automatedTimePerIssue;
    const timeSaved = metrics.issuesResolved * (manualTimePerIssue - automatedTimePerIssue);

    const timeSavingsValue = Math.round(timeSaved * this.COST_FACTORS.averageHourlyRate);
    const automationEfficiency = manualTimePerIssue > 0 ?
      ((timeSaved / (metrics.issuesResolved * manualTimePerIssue)) * 100) : 0;

    return {
      timeSpent,
      timeSaved,
      timeSavingsValue,
      automationEfficiency
    };
  }

  private async calculateQualityImprovementValue(metrics: any): Promise<number> {
    // Value of quality improvement
    const improvementPoints = metrics.qualityImprovement;
    const valuePerPoint = 1000; // $1000 per quality point improvement

    return Math.round(improvementPoints * valuePerPoint);
  }

  private calculatePaybackPeriod(costs: number, benefits: number, periodDays: number): number {
    if (benefits <= costs) return Infinity;

    const dailyNetBenefit = (benefits - costs) / periodDays;
    const paybackDays = costs / dailyNetBenefit;

    return Math.ceil(paybackDays);
  }

  private calculateProjections(netBenefit: number, periodDays: number): any {
    const dailyBenefit = netBenefit / periodDays;

    return {
      monthly: Math.round(dailyBenefit * 30),
      quarterly: Math.round(dailyBenefit * 90),
      annual: Math.round(dailyBenefit * 365)
    };
  }

  private async storeROIMetrics(dataSourceId: string, metrics: any): Promise<void> {
    await cpdb.query(`
      INSERT INTO quality_roi_metrics (
        datasource_id, metric_date, total_issues, issues_resolved, issues_prevented,
        rows_affected, rows_fixed, downstream_assets_protected,
        estimated_issue_cost, remediation_cost, prevention_savings, total_roi,
        time_spent_on_quality, time_saved_by_automation,
        avg_quality_score, quality_improvement
      ) VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (datasource_id, metric_date)
      DO UPDATE SET
        total_issues = EXCLUDED.total_issues,
        issues_resolved = EXCLUDED.issues_resolved,
        issues_prevented = EXCLUDED.issues_prevented,
        rows_affected = EXCLUDED.rows_affected,
        rows_fixed = EXCLUDED.rows_fixed,
        downstream_assets_protected = EXCLUDED.downstream_assets_protected,
        estimated_issue_cost = EXCLUDED.estimated_issue_cost,
        remediation_cost = EXCLUDED.remediation_cost,
        prevention_savings = EXCLUDED.prevention_savings,
        total_roi = EXCLUDED.total_roi,
        time_spent_on_quality = EXCLUDED.time_spent_on_quality,
        time_saved_by_automation = EXCLUDED.time_saved_by_automation,
        avg_quality_score = EXCLUDED.avg_quality_score,
        quality_improvement = EXCLUDED.quality_improvement
    `, [
      dataSourceId,
      metrics.totalIssues,
      metrics.issuesResolved,
      metrics.issuesPrevented,
      metrics.rowsAffected,
      metrics.rowsFixed,
      metrics.downstreamAssetsProtected,
      metrics.estimatedIssueCost,
      metrics.remediationCost,
      metrics.preventionSavings,
      metrics.totalROI,
      metrics.timeSpentOnQuality,
      metrics.timeSavedByAutomation,
      metrics.avgQualityScore,
      metrics.qualityImprovement
    ]);
  }

  private getPeriodDays(period: string): number {
    const periodMap = {
      day: 1,
      week: 7,
      month: 30,
      quarter: 90,
      year: 365
    };
    return periodMap[period as keyof typeof periodMap] || 30;
  }

  private async getInitiativeMetrics(dataSourceId: string, initiative: string): Promise<any> {
    // Would fetch initiative-specific metrics
    return {
      usageCount: 0,
      successRate: 0,
      timeSaved: 0
    };
  }

  private estimateInitiativeInvestment(initiative: string): number {
    const investmentMap: Record<string, number> = {
      automated_healing: 5000,
      profiling: 3000,
      monitoring: 2000,
      sla_management: 4000
    };
    return investmentMap[initiative] || 0;
  }

  private calculateInitiativeReturns(initiative: string, metrics: any): number {
    // Simplified return calculation
    return metrics.timeSaved * this.COST_FACTORS.averageHourlyRate;
  }

  private getInitiativeRecommendation(roi: number): string {
    if (roi >= 200) return 'Excellent investment - strongly recommended';
    if (roi >= 100) return 'Good investment - recommended';
    if (roi >= 50) return 'Moderate ROI - consider with other factors';
    return 'Low ROI - evaluate alternatives';
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface QualityROIReport {
  dataSourceId: string;
  period: string;
  periodDays: number;
  costs: {
    issueCosts: number;
    remediationCosts: number;
    downstreamImpactCosts: number;
    totalCosts: number;
  };
  benefits: {
    preventionSavings: number;
    qualityImprovementValue: number;
    timeSavings: number;
    totalBenefits: number;
  };
  netBenefit: number;
  roi: number;
  paybackPeriod: number;
  metrics: any;
  timeMetrics: any;
  projections: {
    monthly: number;
    quarterly: number;
    annual: number;
  };
}

interface ROITrendData {
  date: string;
  roi: number;
  costs: number;
  savings: number;
  qualityScore: number;
  issuesResolved: number;
}

interface InitiativeROI {
  initiative: string;
  investment: number;
  returns: number;
  roi: number;
  paybackMonths: number;
  metrics: any;
  recommendation: string;
}

interface DataSourceComparison {
  dataSourceId: string;
  dataSourceName: string;
  totalIssues: number;
  criticalIssues: number;
  totalAffectedRows: number;
  totalCost: number;
  totalSavings: number;
  avgROI: number;
  costPerIssue: number;
}
