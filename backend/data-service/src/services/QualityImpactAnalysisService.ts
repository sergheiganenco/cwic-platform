// backend/data-service/src/services/QualityImpactAnalysisService.ts
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const cpdb = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Quality Impact Analysis Service
 * Analyzes how quality issues propagate through data lineage
 */
export class QualityImpactAnalysisService {
  /**
   * Analyze the downstream impact of a quality issue using lineage
   */
  async analyzeIssueImpact(issueId: string, options: {
    maxDepth?: number;
    includeViewsonly?: boolean;
  } = {}): Promise<QualityImpactReport> {
    const maxDepth = options.maxDepth || 5;

    try {
      // Get the issue details
      const { rows: issues } = await cpdb.query(`
        SELECT
          qi.*,
          ca.id as asset_id,
          ca.table_name,
          ca.schema_name,
          ca.database_name,
          ca.datasource_id
        FROM quality_issues qi
        JOIN catalog_assets ca ON ca.id = qi.asset_id
        WHERE qi.id = $1
      `, [issueId]);

      if (issues.length === 0) {
        throw new Error(`Issue ${issueId} not found`);
      }

      const issue = issues[0];

      // Trace downstream dependencies using lineage
      const downstreamAssets = await this.traceDownstreamAssets(
        issue.asset_id,
        maxDepth
      );

      // Analyze impact on each downstream asset
      const impactedAssets: ImpactedAsset[] = [];

      for (const asset of downstreamAssets) {
        const impact = await this.analyzeAssetImpact(issue, asset);
        impactedAssets.push(impact);
      }

      // Calculate overall impact score
      const impactScore = this.calculateImpactScore(issue, impactedAssets);

      // Generate impact visualization
      const impactGraph = await this.generateImpactGraph(issue.asset_id, impactedAssets);

      // Identify critical paths
      const criticalPaths = this.identifyCriticalPaths(impactedAssets);

      // Generate recommendations
      const recommendations = this.generateRecommendations(issue, impactedAssets, impactScore);

      return {
        issueId,
        issueTitle: issue.title,
        issueSeverity: issue.severity,
        sourceAsset: {
          id: issue.asset_id,
          name: issue.table_name,
          schema: issue.schema_name,
          affectedRows: issue.affected_rows
        },
        impactScore,
        impactedAssets,
        totalAssetsAffected: impactedAssets.length,
        criticalPaths,
        impactGraph,
        estimatedBusinessImpact: await this.estimateBusinessImpact(issue, impactedAssets),
        recommendations
      };
    } catch (error: any) {
      logger.error('Failed to analyze issue impact:', error);
      throw error;
    }
  }

  /**
   * Get impact summary for all issues in a data source
   */
  async getDataSourceImpactSummary(dataSourceId: string): Promise<DataSourceImpactSummary> {
    try {
      const { rows: issues } = await cpdb.query(`
        SELECT
          qi.*,
          ca.table_name,
          ca.id as asset_id
        FROM quality_issues qi
        JOIN catalog_assets ca ON ca.id = qi.asset_id
        WHERE ca.datasource_id = $1
          AND qi.status = 'open'
        ORDER BY qi.severity DESC
      `, [dataSourceId]);

      const impacts: ImpactAnalysis[] = [];
      let totalDownstreamAssets = 0;
      let criticalIssuesCount = 0;

      for (const issue of issues) {
        const downstreamCount = await this.countDownstreamAssets(issue.asset_id);
        totalDownstreamAssets += downstreamCount;

        if (issue.severity === 'critical' && downstreamCount > 0) {
          criticalIssuesCount++;
        }

        impacts.push({
          issueId: issue.id,
          issueTitle: issue.title,
          severity: issue.severity,
          sourceTable: issue.table_name,
          downstreamAssets: downstreamCount,
          propagationRisk: this.calculatePropagationRisk(issue.severity, downstreamCount)
        });
      }

      return {
        dataSourceId,
        totalIssues: issues.length,
        criticalIssues: criticalIssuesCount,
        totalDownstreamAssets,
        averageDownstreamImpact: Math.round(totalDownstreamAssets / Math.max(issues.length, 1)),
        highestRiskIssues: impacts
          .sort((a, b) => b.propagationRisk - a.propagationRisk)
          .slice(0, 10),
        impactDistribution: {
          high: impacts.filter(i => i.propagationRisk >= 0.7).length,
          medium: impacts.filter(i => i.propagationRisk >= 0.4 && i.propagationRisk < 0.7).length,
          low: impacts.filter(i => i.propagationRisk < 0.4).length
        }
      };
    } catch (error: any) {
      logger.error('Failed to get impact summary:', error);
      throw error;
    }
  }

  /**
   * Simulate the propagation of a quality issue
   */
  async simulateIssuePropagation(
    issueId: string,
    scenario: 'best_case' | 'worst_case' | 'realistic'
  ): Promise<PropagationSimulation> {
    try {
      const impact = await this.analyzeIssueImpact(issueId);

      // Calculate propagation probabilities
      const propagationProbabilities = impact.impactedAssets.map(asset => {
        let probability: number;

        switch (scenario) {
          case 'best_case':
            probability = asset.propagationProbability * 0.5; // 50% of calculated
            break;
          case 'worst_case':
            probability = Math.min(asset.propagationProbability * 1.5, 1.0); // 150% of calculated
            break;
          case 'realistic':
          default:
            probability = asset.propagationProbability;
        }

        return {
          assetId: asset.assetId,
          assetName: asset.assetName,
          probability,
          estimatedAffectedRows: Math.round(asset.estimatedAffectedRows * probability),
          timeToImpact: this.estimateTimeToImpact(asset.depth, scenario)
        };
      });

      // Calculate aggregate metrics
      const totalEstimatedRows = propagationProbabilities.reduce(
        (sum, p) => sum + p.estimatedAffectedRows,
        0
      );

      return {
        scenario,
        issueId,
        timeHorizon: '30 days',
        propagationSteps: propagationProbabilities,
        totalAffectedAssets: propagationProbabilities.filter(p => p.probability > 0.5).length,
        totalEstimatedRows,
        peakImpactTime: this.calculatePeakImpactTime(propagationProbabilities),
        containmentStrategies: this.suggestContainmentStrategies(impact)
      };
    } catch (error: any) {
      logger.error('Failed to simulate propagation:', error);
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private async traceDownstreamAssets(
    assetId: string,
    maxDepth: number
  ): Promise<Array<{ assetId: string; assetName: string; depth: number; path: string[] }>> {
    const visited = new Set<string>();
    const results: Array<{ assetId: string; assetName: string; depth: number; path: string[] }> = [];

    const traverse = async (currentAssetId: string, depth: number, path: string[]) => {
      if (depth > maxDepth || visited.has(currentAssetId)) {
        return;
      }

      visited.add(currentAssetId);

      // Get direct downstream dependencies
      const { rows } = await cpdb.query(`
        SELECT
          cl.to_asset_id,
          ca.table_name as asset_name,
          cl.edge_type,
          cl.metadata
        FROM catalog_lineage cl
        JOIN catalog_assets ca ON ca.id = cl.to_asset_id
        WHERE cl.from_asset_id = $1
      `, [currentAssetId]);

      for (const row of rows) {
        const newPath = [...path, row.asset_name];
        results.push({
          assetId: row.to_asset_id,
          assetName: row.asset_name,
          depth,
          path: newPath
        });

        // Recursively trace further
        await traverse(row.to_asset_id, depth + 1, newPath);
      }
    };

    await traverse(assetId, 1, []);

    return results;
  }

  private async analyzeAssetImpact(issue: any, asset: any): Promise<ImpactedAsset> {
    // Get asset statistics
    const { rows: assetStats } = await cpdb.query(`
      SELECT
        ca.*,
        COUNT(DISTINCT cc.column_name) as column_count
      FROM catalog_assets ca
      LEFT JOIN catalog_columns cc ON cc.asset_id = ca.id
      WHERE ca.id = $1
      GROUP BY ca.id
    `, [asset.assetId]);

    const assetStat = assetStats[0] || {};

    // Calculate propagation probability based on:
    // 1. Issue severity
    // 2. Depth in lineage
    // 3. Type of relationship
    const severityWeight = {
      critical: 0.9,
      high: 0.7,
      medium: 0.5,
      low: 0.3
    }[issue.severity] || 0.5;

    const depthPenalty = Math.pow(0.8, asset.depth); // 20% reduction per level
    const propagationProbability = severityWeight * depthPenalty;

    // Estimate affected rows
    const sourceAffectedRate = issue.affected_rows / Math.max(issue.total_rows || 1, 1);
    const estimatedAffectedRows = Math.round(
      (assetStat.row_count || 0) * sourceAffectedRate * propagationProbability
    );

    return {
      assetId: asset.assetId,
      assetName: asset.assetName,
      assetType: assetStat.asset_type || 'table',
      depth: asset.depth,
      path: asset.path,
      totalRows: assetStat.row_count || 0,
      estimatedAffectedRows,
      propagationProbability,
      impactSeverity: this.calculateImpactSeverity(propagationProbability, estimatedAffectedRows),
      dependencies: asset.path.length,
      criticalityScore: await this.calculateAssetCriticality(asset.assetId)
    };
  }

  private calculateImpactScore(issue: any, impactedAssets: ImpactedAsset[]): number {
    // Weighted score based on:
    // - Number of affected assets (30%)
    // - Total affected rows (30%)
    // - Criticality of affected assets (40%)

    const assetCount = impactedAssets.length;
    const totalAffectedRows = impactedAssets.reduce((sum, a) => sum + a.estimatedAffectedRows, 0);
    const avgCriticality = impactedAssets.reduce((sum, a) => sum + a.criticalityScore, 0) / Math.max(assetCount, 1);

    const assetScore = Math.min(assetCount / 10, 1) * 30; // Max 10 assets = 30 points
    const rowScore = Math.min(totalAffectedRows / 100000, 1) * 30; // Max 100k rows = 30 points
    const criticalityScore = avgCriticality * 40; // Max criticality = 40 points

    return Math.round(assetScore + rowScore + criticalityScore);
  }

  private async generateImpactGraph(sourceAssetId: string, impactedAssets: ImpactedAsset[]): Promise<ImpactGraph> {
    const nodes: ImpactNode[] = [];
    const edges: ImpactEdge[] = [];

    // Add source node
    nodes.push({
      id: sourceAssetId,
      type: 'source',
      label: 'Source Issue',
      severity: 'critical'
    });

    // Add impacted nodes
    for (const asset of impactedAssets) {
      nodes.push({
        id: asset.assetId,
        type: 'impacted',
        label: asset.assetName,
        severity: asset.impactSeverity,
        depth: asset.depth,
        affectedRows: asset.estimatedAffectedRows
      });

      // Add edge (simplified - would need actual lineage edges)
      if (asset.depth === 1) {
        edges.push({
          from: sourceAssetId,
          to: asset.assetId,
          probability: asset.propagationProbability,
          type: 'direct'
        });
      }
    }

    return { nodes, edges };
  }

  private identifyCriticalPaths(impactedAssets: ImpactedAsset[]): CriticalPath[] {
    // Identify paths with high criticality
    const paths: CriticalPath[] = impactedAssets
      .filter(asset => asset.criticalityScore >= 0.7)
      .map(asset => ({
        path: asset.path,
        finalAsset: asset.assetName,
        criticalityScore: asset.criticalityScore,
        estimatedImpact: asset.estimatedAffectedRows,
        riskLevel: asset.impactSeverity
      }))
      .sort((a, b) => b.criticalityScore - a.criticalityScore)
      .slice(0, 5);

    return paths;
  }

  private generateRecommendations(
    issue: any,
    impactedAssets: ImpactedAsset[],
    impactScore: number
  ): string[] {
    const recommendations: string[] = [];

    if (impactScore >= 70) {
      recommendations.push('🚨 URGENT: High downstream impact detected. Prioritize immediate resolution.');
    }

    if (impactedAssets.some(a => a.criticalityScore >= 0.8)) {
      recommendations.push('⚠️ Critical business assets affected. Notify stakeholders immediately.');
    }

    recommendations.push('🔍 Review and fix source issue to prevent propagation');

    if (impactedAssets.length > 5) {
      recommendations.push('📊 Consider implementing data quality monitoring on downstream assets');
    }

    recommendations.push('🛡️ Set up alerts for similar issues in the future');

    if (impactScore >= 50) {
      recommendations.push('📝 Document root cause and remediation steps');
    }

    return recommendations;
  }

  private async calculateAssetCriticality(assetId: string): Promise<number> {
    // Calculate based on:
    // - Number of downstream dependencies
    // - Usage frequency
    // - Business importance tags

    const { rows } = await cpdb.query(`
      SELECT COUNT(*) as downstream_count
      FROM catalog_lineage
      WHERE from_asset_id = $1
    `, [assetId]);

    const downstreamCount = parseInt(rows[0]?.downstream_count || '0');

    // Simple heuristic: more dependencies = higher criticality
    return Math.min(downstreamCount / 10, 1);
  }

  private calculateImpactSeverity(probability: number, affectedRows: number): 'critical' | 'high' | 'medium' | 'low' {
    const score = probability * Math.min(affectedRows / 1000, 1);

    if (score >= 0.7) return 'critical';
    if (score >= 0.5) return 'high';
    if (score >= 0.3) return 'medium';
    return 'low';
  }

  private calculatePropagationRisk(severity: string, downstreamCount: number): number {
    const severityScore = {
      critical: 1.0,
      high: 0.75,
      medium: 0.5,
      low: 0.25
    }[severity] || 0.5;

    const downstreamScore = Math.min(downstreamCount / 10, 1);

    return (severityScore * 0.6) + (downstreamScore * 0.4);
  }

  private async countDownstreamAssets(assetId: string): Promise<number> {
    const { rows } = await cpdb.query(`
      WITH RECURSIVE downstream AS (
        SELECT to_asset_id FROM catalog_lineage WHERE from_asset_id = $1
        UNION
        SELECT cl.to_asset_id
        FROM catalog_lineage cl
        INNER JOIN downstream d ON cl.from_asset_id = d.to_asset_id
      )
      SELECT COUNT(DISTINCT to_asset_id) as count FROM downstream
    `, [assetId]);

    return parseInt(rows[0]?.count || '0');
  }

  private estimateTimeToImpact(depth: number, scenario: string): string {
    const baseTime = depth * 24; // 24 hours per level

    const multiplier = {
      best_case: 1.5,
      worst_case: 0.5,
      realistic: 1.0
    }[scenario] || 1.0;

    const hours = Math.round(baseTime * multiplier);

    if (hours < 24) return `${hours} hours`;
    const days = Math.round(hours / 24);
    return `${days} day${days > 1 ? 's' : ''}`;
  }

  private calculatePeakImpactTime(propagationSteps: any[]): string {
    // Find the step with highest impact
    const peakStep = propagationSteps.reduce((max, step) =>
      step.estimatedAffectedRows > max.estimatedAffectedRows ? step : max
    , propagationSteps[0] || {});

    return peakStep?.timeToImpact || 'Unknown';
  }

  private suggestContainmentStrategies(impact: QualityImpactReport): string[] {
    const strategies: string[] = [];

    if (impact.totalAssetsAffected > 5) {
      strategies.push('Break lineage temporarily to prevent further propagation');
    }

    strategies.push('Fix source issue immediately');

    if (impact.criticalPaths.length > 0) {
      strategies.push('Monitor critical path assets closely');
    }

    strategies.push('Implement data quality gates on downstream pipelines');

    return strategies;
  }

  private async estimateBusinessImpact(issue: any, impactedAssets: ImpactedAsset[]): Promise<BusinessImpact> {
    const totalAffectedRows = impactedAssets.reduce((sum, a) => sum + a.estimatedAffectedRows, 0);

    // Simple cost estimation (would be customizable in production)
    const costPerBadRow = 0.10; // $0.10 per bad row
    const estimatedCost = totalAffectedRows * costPerBadRow;

    return {
      estimatedCost,
      affectedBusinessProcesses: impactedAssets.filter(a => a.criticalityScore >= 0.7).length,
      potentialRevenueLoss: estimatedCost * 2, // 2x multiplier for revenue impact
      complianceRisk: issue.severity === 'critical' ? 'High' : 'Medium',
      customerImpact: this.estimateCustomerImpact(totalAffectedRows)
    };
  }

  private estimateCustomerImpact(affectedRows: number): string {
    if (affectedRows > 10000) return 'High';
    if (affectedRows > 1000) return 'Medium';
    return 'Low';
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface QualityImpactReport {
  issueId: string;
  issueTitle: string;
  issueSeverity: string;
  sourceAsset: {
    id: string;
    name: string;
    schema: string;
    affectedRows: number;
  };
  impactScore: number;
  impactedAssets: ImpactedAsset[];
  totalAssetsAffected: number;
  criticalPaths: CriticalPath[];
  impactGraph: ImpactGraph;
  estimatedBusinessImpact: BusinessImpact;
  recommendations: string[];
}

interface ImpactedAsset {
  assetId: string;
  assetName: string;
  assetType: string;
  depth: number;
  path: string[];
  totalRows: number;
  estimatedAffectedRows: number;
  propagationProbability: number;
  impactSeverity: 'critical' | 'high' | 'medium' | 'low';
  dependencies: number;
  criticalityScore: number;
}

interface ImpactGraph {
  nodes: ImpactNode[];
  edges: ImpactEdge[];
}

interface ImpactNode {
  id: string;
  type: 'source' | 'impacted';
  label: string;
  severity: string;
  depth?: number;
  affectedRows?: number;
}

interface ImpactEdge {
  from: string;
  to: string;
  probability: number;
  type: string;
}

interface CriticalPath {
  path: string[];
  finalAsset: string;
  criticalityScore: number;
  estimatedImpact: number;
  riskLevel: string;
}

interface BusinessImpact {
  estimatedCost: number;
  affectedBusinessProcesses: number;
  potentialRevenueLoss: number;
  complianceRisk: string;
  customerImpact: string;
}

interface DataSourceImpactSummary {
  dataSourceId: string;
  totalIssues: number;
  criticalIssues: number;
  totalDownstreamAssets: number;
  averageDownstreamImpact: number;
  highestRiskIssues: ImpactAnalysis[];
  impactDistribution: {
    high: number;
    medium: number;
    low: number;
  };
}

interface ImpactAnalysis {
  issueId: string;
  issueTitle: string;
  severity: string;
  sourceTable: string;
  downstreamAssets: number;
  propagationRisk: number;
}

interface PropagationSimulation {
  scenario: string;
  issueId: string;
  timeHorizon: string;
  propagationSteps: Array<{
    assetId: string;
    assetName: string;
    probability: number;
    estimatedAffectedRows: number;
    timeToImpact: string;
  }>;
  totalAffectedAssets: number;
  totalEstimatedRows: number;
  peakImpactTime: string;
  containmentStrategies: string[];
}
