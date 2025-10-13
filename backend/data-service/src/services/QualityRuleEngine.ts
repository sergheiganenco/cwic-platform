// backend/data-service/src/services/QualityRuleEngine.ts
import { Pool } from 'pg';
import { db } from '../db';
import { logger } from '../utils/logger';
import { ConnectorFactory } from './connectors/factory';

export interface QualityRule {
  id: string;
  name: string;
  description?: string;
  dimension: 'completeness' | 'accuracy' | 'consistency' | 'validity' | 'freshness' | 'uniqueness';
  severity: 'low' | 'medium' | 'high' | 'critical';
  assetId?: number;
  dataSourceId?: string;
  columnName?: string;
  ruleType: 'threshold' | 'sql' | 'ai_anomaly' | 'pattern' | 'comparison' | 'freshness_check';
  ruleConfig: any;
  thresholdConfig?: any;
  enabled: boolean;
}

export interface RuleExecutionResult {
  id: string;
  ruleId: string;
  assetId?: number;
  dataSourceId?: string;
  runAt: Date;
  status: 'passed' | 'failed' | 'warning' | 'error' | 'timeout';
  metricValue?: number;
  thresholdValue?: number;
  rowsChecked?: number;
  rowsFailed?: number;
  executionTimeMs: number;
  errorMessage?: string;
  sampleFailures?: any[];
  anomalyScore?: number;
}

export interface ScanResult {
  dataSourceId: string;
  totalRules: number;
  executedRules: number;
  passed: number;
  failed: number;
  errors: number;
  duration: number;
  results: RuleExecutionResult[];
}

export class QualityRuleEngine {
  private db: Pool;

  constructor(dbPool?: Pool) {
    this.db = dbPool || db;
  }

  /**
   * Execute a single quality rule
   */
  async executeRule(ruleId: string, userId?: string): Promise<RuleExecutionResult> {
    const startTime = Date.now();
    logger.info(`Executing quality rule ${ruleId}`);

    // Fetch rule
    const ruleResult = await this.db.query(
      `SELECT * FROM quality_rules WHERE id = $1`,
      [ruleId]
    );

    if (ruleResult.rows.length === 0) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    const rule: QualityRule = this.mapDbRuleToQualityRule(ruleResult.rows[0]);

    if (!rule.enabled) {
      throw new Error(`Rule ${ruleId} is disabled`);
    }

    let result: RuleExecutionResult;

    try {
      // Execute based on rule type
      switch (rule.ruleType) {
        case 'threshold':
          result = await this.executeThresholdRule(rule);
          break;
        case 'sql':
          result = await this.executeSqlRule(rule);
          break;
        case 'pattern':
          result = await this.executePatternRule(rule);
          break;
        case 'freshness_check':
          result = await this.executeFreshnessRule(rule);
          break;
        case 'comparison':
          result = await this.executeComparisonRule(rule);
          break;
        case 'ai_anomaly':
          result = await this.executeAnomalyRule(rule);
          break;
        default:
          throw new Error(`Unsupported rule type: ${rule.ruleType}`);
      }

      result.executionTimeMs = Date.now() - startTime;
      result.runAt = new Date();

    } catch (error: any) {
      logger.error(`Error executing rule ${ruleId}:`, error);
      result = {
        id: '',
        ruleId: rule.id,
        assetId: rule.assetId,
        dataSourceId: rule.dataSourceId,
        runAt: new Date(),
        status: 'error',
        executionTimeMs: Date.now() - startTime,
        errorMessage: error.message,
      };
    }

    // Save result to database
    await this.saveRuleResult(result);

    // Check if this creates/updates an issue
    if (result.status === 'failed') {
      await this.createOrUpdateIssue(result, rule);
    }

    // Update rule statistics
    await this.updateRuleStats(ruleId, result.executionTimeMs);

    logger.info(`Rule ${ruleId} executed: ${result.status} (${result.executionTimeMs}ms)`);

    return result;
  }

  /**
   * Execute threshold-based rule (e.g., null_rate < 5%)
   */
  private async executeThresholdRule(rule: QualityRule): Promise<RuleExecutionResult> {
    const { columnName, metric, operator, value } = rule.ruleConfig;

    if (!rule.assetId) {
      throw new Error('Asset ID required for threshold rules');
    }

    // Get asset details
    const assetResult = await this.db.query(
      `SELECT table_name, schema_name, datasource_id FROM catalog_assets WHERE id = $1`,
      [rule.assetId]
    );

    if (assetResult.rows.length === 0) {
      throw new Error(`Asset ${rule.assetId} not found`);
    }

    const asset = assetResult.rows[0];
    const { table_name, schema_name, datasource_id } = asset;

    // Get data source connection
    const dsResult = await this.db.query(
      `SELECT type, host, port, database_name, connection_config FROM data_sources WHERE id = $1`,
      [datasource_id]
    );

    const dataSource = dsResult.rows[0];
    const connector = ConnectorFactory.create({
      type: dataSource.type,
      host: dataSource.host,
      port: dataSource.port,
      database: dataSource.database_name,
      ...dataSource.connection_config,
    });

    try {
      const fullTableName = `"${schema_name}"."${table_name}"`;
      const escapedColumn = `"${columnName}"`;

      let metricValue: number;
      let rowsChecked: number = 0;
      let rowsFailed: number = 0;

      // Get row count
      const countResult = await connector.query(`SELECT COUNT(*) as cnt FROM ${fullTableName}`);
      rowsChecked = parseInt(countResult.rows[0].cnt);

      // Calculate metric based on type
      if (metric === 'null_rate') {
        const nullResult = await connector.query(
          `SELECT COUNT(*) - COUNT(${escapedColumn}) as null_count FROM ${fullTableName}`
        );
        rowsFailed = parseInt(nullResult.rows[0].null_count);
        metricValue = rowsChecked > 0 ? rowsFailed / rowsChecked : 0;
      } else if (metric === 'unique_rate') {
        const uniqueResult = await connector.query(
          `SELECT COUNT(DISTINCT ${escapedColumn}) as unique_count FROM ${fullTableName}`
        );
        const uniqueCount = parseInt(uniqueResult.rows[0].unique_count);
        metricValue = rowsChecked > 0 ? uniqueCount / rowsChecked : 0;
      } else if (metric === 'duplicate_rate') {
        const dupResult = await connector.query(
          `SELECT COUNT(*) - COUNT(DISTINCT ${escapedColumn}) as dup_count FROM ${fullTableName}`
        );
        rowsFailed = parseInt(dupResult.rows[0].dup_count);
        metricValue = rowsChecked > 0 ? rowsFailed / rowsChecked : 0;
      } else {
        throw new Error(`Unsupported metric: ${metric}`);
      }

      // Evaluate threshold
      const passed = this.evaluateOperator(metricValue, operator, value);

      return {
        id: '',
        ruleId: rule.id,
        assetId: rule.assetId,
        dataSourceId: datasource_id,
        runAt: new Date(),
        status: passed ? 'passed' : 'failed',
        metricValue,
        thresholdValue: value,
        rowsChecked,
        rowsFailed,
        executionTimeMs: 0,
      };
    } finally {
      await connector.close();
    }
  }

  /**
   * Execute custom SQL rule
   */
  private async executeSqlRule(rule: QualityRule): Promise<RuleExecutionResult> {
    const { query, expectZero } = rule.ruleConfig;

    if (!rule.dataSourceId) {
      throw new Error('Data source ID required for SQL rules');
    }

    const dsResult = await this.db.query(
      `SELECT type, host, port, database_name, connection_config FROM data_sources WHERE id = $1`,
      [rule.dataSourceId]
    );

    const dataSource = dsResult.rows[0];
    const connector = ConnectorFactory.create({
      type: dataSource.type,
      host: dataSource.host,
      port: dataSource.port,
      database: dataSource.database_name,
      ...dataSource.connection_config,
    });

    try {
      const result = await connector.query(query);
      const rowCount = result.rows.length;

      const passed = expectZero ? rowCount === 0 : rowCount > 0;

      return {
        id: '',
        ruleId: rule.id,
        dataSourceId: rule.dataSourceId,
        runAt: new Date(),
        status: passed ? 'passed' : 'failed',
        rowsChecked: rowCount,
        rowsFailed: expectZero ? rowCount : 0,
        sampleFailures: result.rows.slice(0, 5),
        executionTimeMs: 0,
      };
    } finally {
      await connector.close();
    }
  }

  /**
   * Execute pattern matching rule (e.g., email regex)
   */
  private async executePatternRule(rule: QualityRule): Promise<RuleExecutionResult> {
    const { columnName, pattern } = rule.ruleConfig;

    if (!rule.assetId) {
      throw new Error('Asset ID required for pattern rules');
    }

    const assetResult = await this.db.query(
      `SELECT table_name, schema_name, datasource_id FROM catalog_assets WHERE id = $1`,
      [rule.assetId]
    );

    const asset = assetResult.rows[0];
    const dsResult = await this.db.query(
      `SELECT type, host, port, database_name, connection_config FROM data_sources WHERE id = $1`,
      [asset.datasource_id]
    );

    const dataSource = dsResult.rows[0];
    const connector = ConnectorFactory.create({
      type: dataSource.type,
      host: dataSource.host,
      port: dataSource.port,
      database: dataSource.database_name,
      ...dataSource.connection_config,
    });

    try {
      const fullTableName = `"${asset.schema_name}"."${asset.table_name}"`;
      const escapedColumn = `"${columnName}"`;

      // Count total rows
      const totalResult = await connector.query(`SELECT COUNT(*) as cnt FROM ${fullTableName}`);
      const rowsChecked = parseInt(totalResult.rows[0].cnt);

      // Count rows NOT matching pattern (failures)
      const failQuery = `
        SELECT COUNT(*) as fail_count
        FROM ${fullTableName}
        WHERE ${escapedColumn} IS NOT NULL
          AND ${escapedColumn} !~ $1
      `;

      const failResult = await connector.query(failQuery, [pattern]);
      const rowsFailed = parseInt(failResult.rows[0].fail_count);

      const metricValue = rowsChecked > 0 ? (rowsChecked - rowsFailed) / rowsChecked : 1;
      const passed = rowsFailed === 0;

      return {
        id: '',
        ruleId: rule.id,
        assetId: rule.assetId,
        dataSourceId: asset.datasource_id,
        runAt: new Date(),
        status: passed ? 'passed' : 'failed',
        metricValue,
        thresholdValue: 1.0,
        rowsChecked,
        rowsFailed,
        executionTimeMs: 0,
      };
    } finally {
      await connector.close();
    }
  }

  /**
   * Execute freshness check
   */
  private async executeFreshnessRule(rule: QualityRule): Promise<RuleExecutionResult> {
    const { timestampColumn, maxAgeHours } = rule.ruleConfig;

    if (!rule.assetId) {
      throw new Error('Asset ID required for freshness rules');
    }

    const assetResult = await this.db.query(
      `SELECT table_name, schema_name, datasource_id FROM catalog_assets WHERE id = $1`,
      [rule.assetId]
    );

    const asset = assetResult.rows[0];
    const dsResult = await this.db.query(
      `SELECT type, host, port, database_name, connection_config FROM data_sources WHERE id = $1`,
      [asset.datasource_id]
    );

    const dataSource = dsResult.rows[0];
    const connector = ConnectorFactory.create({
      type: dataSource.type,
      host: dataSource.host,
      port: dataSource.port,
      database: dataSource.database_name,
      ...dataSource.connection_config,
    });

    try {
      const fullTableName = `"${asset.schema_name}"."${asset.table_name}"`;
      const escapedColumn = `"${timestampColumn}"`;

      const freshnessQuery = `
        SELECT MAX(${escapedColumn}) as latest_timestamp
        FROM ${fullTableName}
      `;

      const result = await connector.query(freshnessQuery);
      const latestTimestamp = result.rows[0].latest_timestamp;

      if (!latestTimestamp) {
        return {
          id: '',
          ruleId: rule.id,
          assetId: rule.assetId,
          dataSourceId: asset.datasource_id,
          runAt: new Date(),
          status: 'failed',
          errorMessage: 'No timestamp found',
          executionTimeMs: 0,
        };
      }

      const ageHours = (Date.now() - new Date(latestTimestamp).getTime()) / (1000 * 60 * 60);
      const passed = ageHours <= maxAgeHours;

      return {
        id: '',
        ruleId: rule.id,
        assetId: rule.assetId,
        dataSourceId: asset.datasource_id,
        runAt: new Date(),
        status: passed ? 'passed' : 'failed',
        metricValue: ageHours,
        thresholdValue: maxAgeHours,
        executionTimeMs: 0,
      };
    } finally {
      await connector.close();
    }
  }

  /**
   * Execute comparison rule (cross-table validation)
   */
  private async executeComparisonRule(rule: QualityRule): Promise<RuleExecutionResult> {
    // Placeholder - would implement FK validation, cross-table comparisons
    return {
      id: '',
      ruleId: rule.id,
      runAt: new Date(),
      status: 'passed',
      executionTimeMs: 0,
    };
  }

  /**
   * Execute AI anomaly detection rule
   */
  private async executeAnomalyRule(rule: QualityRule): Promise<RuleExecutionResult> {
    // Placeholder - would call AI service for anomaly detection
    return {
      id: '',
      ruleId: rule.id,
      runAt: new Date(),
      status: 'passed',
      anomalyScore: 0.15,
      executionTimeMs: 0,
    };
  }

  /**
   * Scan entire data source with all enabled rules
   */
  async scanDataSource(dataSourceId: string, ruleIds?: string[]): Promise<ScanResult> {
    const startTime = Date.now();
    logger.info(`Starting data source scan for ${dataSourceId}`);

    let query = `
      SELECT id FROM quality_rules
      WHERE enabled = true
      AND (data_source_id = $1 OR asset_id IN (
        SELECT id FROM catalog_assets WHERE datasource_id = $1
      ))
    `;

    const params: any[] = [dataSourceId];

    if (ruleIds && ruleIds.length > 0) {
      query += ` AND id = ANY($2)`;
      params.push(ruleIds);
    }

    const rulesResult = await this.db.query(query, params);
    const totalRules = rulesResult.rows.length;

    const results: RuleExecutionResult[] = [];
    let passed = 0;
    let failed = 0;
    let errors = 0;

    for (const ruleRow of rulesResult.rows) {
      try {
        const result = await this.executeRule(ruleRow.id);
        results.push(result);

        if (result.status === 'passed') passed++;
        else if (result.status === 'failed') failed++;
        else if (result.status === 'error') errors++;
      } catch (error) {
        errors++;
        logger.error(`Error executing rule ${ruleRow.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;

    logger.info(`Scan complete: ${passed} passed, ${failed} failed, ${errors} errors (${duration}ms)`);

    return {
      dataSourceId,
      totalRules,
      executedRules: results.length,
      passed,
      failed,
      errors,
      duration,
      results,
    };
  }

  /**
   * Save rule execution result to database
   */
  private async saveRuleResult(result: RuleExecutionResult): Promise<void> {
    const resultId = await this.db.query(
      `INSERT INTO quality_results (
        rule_id, asset_id, data_source_id, run_at, status,
        metric_value, threshold_value, rows_checked, rows_failed,
        execution_time_ms, error_message, sample_failures, anomaly_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id`,
      [
        result.ruleId,
        result.assetId || null,
        result.dataSourceId || null,
        result.runAt,
        result.status,
        result.metricValue || null,
        result.thresholdValue || null,
        result.rowsChecked || null,
        result.rowsFailed || null,
        result.executionTimeMs,
        result.errorMessage || null,
        result.sampleFailures ? JSON.stringify(result.sampleFailures) : null,
        result.anomaly_score || null,
      ]
    );

    result.id = resultId.rows[0].id;
  }

  /**
   * Create or update quality issue from failed rule
   */
  private async createOrUpdateIssue(result: RuleExecutionResult, rule: QualityRule): Promise<void> {
    // Check if issue already exists (open)
    const existingIssue = await this.db.query(
      `SELECT id, occurrence_count FROM quality_issues
       WHERE rule_id = $1 AND asset_id = $2 AND status = 'open'
       ORDER BY first_seen_at DESC LIMIT 1`,
      [rule.id, result.assetId || null]
    );

    if (existingIssue.rows.length > 0) {
      // Update existing issue
      await this.db.query(
        `UPDATE quality_issues
         SET last_seen_at = now(), occurrence_count = occurrence_count + 1, updated_at = now()
         WHERE id = $1`,
        [existingIssue.rows[0].id]
      );
    } else {
      // Create new issue
      const title = `${rule.name} failed`;
      const description = `Quality check failed: ${result.errorMessage || 'Threshold not met'}`;

      await this.db.query(
        `INSERT INTO quality_issues (
          result_id, rule_id, asset_id, data_source_id, severity, dimension,
          title, description, impact_score, affected_rows
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          result.id,
          rule.id,
          result.assetId || null,
          result.dataSourceId || null,
          rule.severity,
          rule.dimension,
          title,
          description,
          this.calculateImpactScore(result, rule),
          result.rowsFailed || 0,
        ]
      );
    }
  }

  /**
   * Update rule execution statistics
   */
  private async updateRuleStats(ruleId: string, executionTime: number): Promise<void> {
    await this.db.query(
      `UPDATE quality_rules
       SET last_executed_at = now(),
           execution_count = execution_count + 1,
           avg_execution_time_ms = COALESCE(
             (avg_execution_time_ms * execution_count + $2) / (execution_count + 1),
             $2
           )
       WHERE id = $1`,
      [ruleId, executionTime]
    );
  }

  /**
   * Helper: Evaluate comparison operator
   */
  private evaluateOperator(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '<': return value < threshold;
      case '<=': return value <= threshold;
      case '>': return value > threshold;
      case '>=': return value >= threshold;
      case '=': return value === threshold;
      case '!=': return value !== threshold;
      default: throw new Error(`Unknown operator: ${operator}`);
    }
  }

  /**
   * Helper: Calculate impact score for issue
   */
  private calculateImpactScore(result: RuleExecutionResult, rule: QualityRule): number {
    let score = 0;

    // Severity weight
    const severityWeight = { low: 10, medium: 30, high: 60, critical: 90 };
    score += severityWeight[rule.severity] || 30;

    // Rows affected weight
    if (result.rowsChecked && result.rowsFailed) {
      const affectedRate = result.rowsFailed / result.rowsChecked;
      score += affectedRate * 10;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Helper: Map database row to QualityRule
   */
  private mapDbRuleToQualityRule(row: any): QualityRule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      dimension: row.dimension,
      severity: row.severity,
      assetId: row.asset_id,
      dataSourceId: row.data_source_id,
      columnName: row.column_name,
      ruleType: row.rule_type,
      ruleConfig: row.rule_config || {},
      thresholdConfig: row.threshold_config,
      enabled: row.enabled,
    };
  }
}
