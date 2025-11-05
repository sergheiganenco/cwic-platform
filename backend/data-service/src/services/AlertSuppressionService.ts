/**
 * Alert Suppression Service
 *
 * Manages intelligent suppression of non-critical alerts:
 * - Empty tables that have never had data (unused features)
 * - Test/dev database alerts
 * - Low-impact stable issues
 * - System/internal tables
 * - Custom user-defined suppression rules
 */

import { Pool } from 'pg';

export interface SuppressionRule {
  id: string;
  name: string;
  description: string;
  conditionType: string;
  conditionParams: any;
  enabled: boolean;
  priority: number;
}

export interface SuppressionResult {
  suppressed: boolean;
  reason?: string;
  ruleId?: string;
  ruleName?: string;
}

export interface Alert {
  id: string;
  table: string;
  database: string;
  severity: string;
  issue: string;
  rowsFailed: number;
  runAt: Date;
  assetId?: number;
  impact?: {
    financial?: number;
    users?: number;
  };
}

export class AlertSuppressionService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Check if an alert should be suppressed
   */
  async shouldSuppress(alert: Alert): Promise<SuppressionResult> {
    // Get active suppression rules ordered by priority
    const rules = await this.getActiveRules();

    for (const rule of rules) {
      const result = await this.evaluateRule(alert, rule);
      if (result.suppressed) {
        // Save suppression record
        await this.saveSuppression(alert.id, rule.id, result.reason || '');
        return result;
      }
    }

    return { suppressed: false };
  }

  /**
   * Evaluate a single suppression rule
   */
  private async evaluateRule(alert: Alert, rule: SuppressionRule): Promise<SuppressionResult> {
    try {
      switch (rule.conditionType) {
        case 'empty_table':
          return await this.evaluateEmptyTableRule(alert, rule);

        case 'test_db':
          return this.evaluateTestDatabaseRule(alert, rule);

        case 'low_impact':
          return this.evaluateLowImpactRule(alert, rule);

        case 'system_table':
          return this.evaluateSystemTableRule(alert, rule);

        case 'custom':
          return this.evaluateCustomRule(alert, rule);

        default:
          return { suppressed: false };
      }
    } catch (error) {
      console.error(`Error evaluating suppression rule ${rule.name}:`, error);
      return { suppressed: false };
    }
  }

  /**
   * Rule: Suppress empty table alerts for tables that have never had data
   */
  private async evaluateEmptyTableRule(
    alert: Alert,
    rule: SuppressionRule
  ): Promise<SuppressionResult> {
    // Check if alert is about empty table
    const isEmptyTableAlert =
      alert.issue.toLowerCase().includes('should contain at least one row') ||
      alert.issue.toLowerCase().includes('table is empty') ||
      alert.issue.toLowerCase().includes('no data');

    if (!isEmptyTableAlert) {
      return { suppressed: false };
    }

    const params = rule.conditionParams || {};
    const checkHistorical = params.check_historical ?? true;
    const minAgeDays = params.min_age_days ?? 7;

    if (!checkHistorical) {
      return {
        suppressed: true,
        reason: 'Empty table alert (feature not launched)',
        ruleId: rule.id,
        ruleName: rule.name
      };
    }

    // Check if table has EVER had data in quality results history
    const historyQuery = `
      SELECT COUNT(*) as pass_count
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE ca.table_name = $1
        AND ca.database_name = $2
        AND qres.status = 'passed'
        AND qres.run_at > NOW() - INTERVAL '${minAgeDays} days'
    `;

    const historyResult = await this.db.query(historyQuery, [alert.table, alert.database]);
    const hasHistoricalData = parseInt(historyResult.rows[0]?.pass_count || '0') > 0;

    if (!hasHistoricalData) {
      return {
        suppressed: true,
        reason: `Table has never contained data (checked last ${minAgeDays} days)`,
        ruleId: rule.id,
        ruleName: rule.name
      };
    }

    return { suppressed: false };
  }

  /**
   * Rule: Suppress alerts from test/dev databases
   */
  private evaluateTestDatabaseRule(alert: Alert, rule: SuppressionRule): SuppressionResult {
    const params = rule.conditionParams || {};
    const patterns: string[] = params.database_patterns || [
      'test_%',
      'dev_%',
      '%_test',
      '%_dev',
      'sandbox%'
    ];

    const databaseLower = alert.database.toLowerCase();

    for (const pattern of patterns) {
      const regex = new RegExp('^' + pattern.replace(/%/g, '.*') + '$', 'i');
      if (regex.test(databaseLower)) {
        return {
          suppressed: true,
          reason: `Alert from test/dev database (matched pattern: ${pattern})`,
          ruleId: rule.id,
          ruleName: rule.name
        };
      }
    }

    return { suppressed: false };
  }

  /**
   * Rule: Suppress low-impact issues that have been stable
   */
  private evaluateLowImpactRule(alert: Alert, rule: SuppressionRule): SuppressionResult {
    const params = rule.conditionParams || {};
    const maxFinancialImpact = params.max_financial_impact ?? 100;
    const maxUserImpact = params.max_user_impact ?? 10;

    const financialImpact = alert.impact?.financial || 0;
    const userImpact = alert.impact?.users || alert.rowsFailed || 0;

    const isLowImpact = financialImpact <= maxFinancialImpact && userImpact <= maxUserImpact;

    if (isLowImpact) {
      return {
        suppressed: true,
        reason: `Low impact issue (${userImpact} users, $${financialImpact} revenue)`,
        ruleId: rule.id,
        ruleName: rule.name
      };
    }

    return { suppressed: false };
  }

  /**
   * Rule: Suppress alerts from system/internal tables
   */
  private evaluateSystemTableRule(alert: Alert, rule: SuppressionRule): SuppressionResult {
    const params = rule.conditionParams || {};
    const patterns: string[] = params.table_patterns || [
      'pg_%',
      'information_schema.%',
      'sys.%',
      'INFORMATION_SCHEMA.%'
    ];

    const tableFullName = `${alert.database}.${alert.table}`.toLowerCase();

    for (const pattern of patterns) {
      const regex = new RegExp('^' + pattern.replace(/%/g, '.*') + '$', 'i');
      if (regex.test(tableFullName) || regex.test(alert.table.toLowerCase())) {
        return {
          suppressed: true,
          reason: `System/internal table (matched pattern: ${pattern})`,
          ruleId: rule.id,
          ruleName: rule.name
        };
      }
    }

    return { suppressed: false };
  }

  /**
   * Rule: Custom user-defined suppression logic
   */
  private evaluateCustomRule(alert: Alert, rule: SuppressionRule): SuppressionResult {
    // For custom rules, the condition_params should contain:
    // - field: which alert field to check
    // - operator: comparison operator
    // - value: value to compare against

    const params = rule.conditionParams || {};
    const field = params.field;
    const operator = params.operator;
    const value = params.value;

    if (!field || !operator) {
      return { suppressed: false };
    }

    const alertValue = (alert as any)[field];

    let shouldSuppress = false;

    switch (operator) {
      case 'equals':
        shouldSuppress = alertValue === value;
        break;
      case 'contains':
        shouldSuppress = String(alertValue).includes(value);
        break;
      case 'regex':
        shouldSuppress = new RegExp(value).test(String(alertValue));
        break;
      case 'less_than':
        shouldSuppress = Number(alertValue) < Number(value);
        break;
      case 'greater_than':
        shouldSuppress = Number(alertValue) > Number(value);
        break;
      default:
        shouldSuppress = false;
    }

    if (shouldSuppress) {
      return {
        suppressed: true,
        reason: `Custom rule: ${field} ${operator} ${value}`,
        ruleId: rule.id,
        ruleName: rule.name
      };
    }

    return { suppressed: false };
  }

  /**
   * Get all active suppression rules
   */
  private async getActiveRules(): Promise<SuppressionRule[]> {
    const query = `
      SELECT
        id,
        name,
        description,
        condition_type as "conditionType",
        condition_params as "conditionParams",
        enabled,
        priority
      FROM alert_suppression_rules
      WHERE enabled = true
      ORDER BY priority ASC, created_at ASC
    `;

    const result = await this.db.query(query);
    return result.rows;
  }

  /**
   * Save suppression record to database
   */
  private async saveSuppression(
    alertId: string,
    ruleId: string,
    reason: string
  ): Promise<void> {
    const query = `
      INSERT INTO alert_suppressions (alert_id, suppression_rule_id, reason, suppressed_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (alert_id) DO UPDATE
      SET suppression_rule_id = EXCLUDED.suppression_rule_id,
          reason = EXCLUDED.reason,
          suppressed_at = NOW()
    `;

    await this.db.query(query, [alertId, ruleId, reason]);
  }

  /**
   * Get suppressed alerts
   */
  async getSuppressedAlerts(filters?: {
    database?: string;
    ruleId?: string;
    limit?: number;
  }): Promise<any[]> {
    let query = `
      SELECT
        qres.id as "alertId",
        qr.severity,
        ca.table_name as "table",
        ca.database_name as "database",
        qr.description as "issue",
        qres.rows_failed as "rowsFailed",
        qres.run_at as "runAt",
        sup.reason as "suppressedReason",
        sup.suppressed_at as "suppressedAt",
        sr.name as "suppressedBy",
        sr.id as "suppressionRuleId"
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      JOIN alert_suppressions sup ON sup.alert_id = qres.id
      JOIN alert_suppression_rules sr ON sr.id = sup.suppression_rule_id
      WHERE qres.status = 'failed'
        AND qres.run_at > NOW() - INTERVAL '24 hours'
    `;

    const params: any[] = [];
    let paramCount = 1;

    if (filters?.database) {
      query += ` AND ca.database_name = $${paramCount++}`;
      params.push(filters.database);
    }

    if (filters?.ruleId) {
      query += ` AND sup.suppression_rule_id = $${paramCount++}`;
      params.push(filters.ruleId);
    }

    query += ` ORDER BY qres.run_at DESC`;

    if (filters?.limit) {
      query += ` LIMIT $${paramCount++}`;
      params.push(filters.limit);
    }

    const result = await this.db.query(query, params);
    return result.rows;
  }

  /**
   * Bulk process alerts for suppression
   */
  async bulkSuppress(alerts: Alert[]): Promise<{
    suppressed: Alert[];
    visible: Alert[];
  }> {
    const suppressed: Alert[] = [];
    const visible: Alert[] = [];

    for (const alert of alerts) {
      const result = await this.shouldSuppress(alert);
      if (result.suppressed) {
        suppressed.push(alert);
      } else {
        visible.push(alert);
      }
    }

    return { suppressed, visible };
  }

  /**
   * Create a new suppression rule
   */
  async createRule(rule: {
    name: string;
    description: string;
    conditionType: string;
    conditionParams: any;
    enabled?: boolean;
    priority?: number;
  }): Promise<SuppressionRule> {
    const query = `
      INSERT INTO alert_suppression_rules (
        name,
        description,
        condition_type,
        condition_params,
        enabled,
        priority
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        name,
        description,
        condition_type as "conditionType",
        condition_params as "conditionParams",
        enabled,
        priority
    `;

    const result = await this.db.query(query, [
      rule.name,
      rule.description,
      rule.conditionType,
      JSON.stringify(rule.conditionParams),
      rule.enabled ?? true,
      rule.priority ?? 100
    ]);

    return result.rows[0];
  }

  /**
   * Update a suppression rule
   */
  async updateRule(
    ruleId: string,
    updates: Partial<{
      name: string;
      description: string;
      conditionParams: any;
      enabled: boolean;
      priority: number;
    }>
  ): Promise<void> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramCount++}`);
      params.push(updates.name);
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramCount++}`);
      params.push(updates.description);
    }

    if (updates.conditionParams !== undefined) {
      setClauses.push(`condition_params = $${paramCount++}`);
      params.push(JSON.stringify(updates.conditionParams));
    }

    if (updates.enabled !== undefined) {
      setClauses.push(`enabled = $${paramCount++}`);
      params.push(updates.enabled);
    }

    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramCount++}`);
      params.push(updates.priority);
    }

    if (setClauses.length === 0) {
      return;
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(ruleId);

    const query = `
      UPDATE alert_suppression_rules
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
    `;

    await this.db.query(query, params);
  }

  /**
   * Delete a suppression rule
   */
  async deleteRule(ruleId: string): Promise<void> {
    const query = `DELETE FROM alert_suppression_rules WHERE id = $1`;
    await this.db.query(query, [ruleId]);
  }

  /**
   * Get suppression summary statistics
   */
  async getSuppressionStats(): Promise<{
    totalSuppressed: number;
    byRule: Array<{ ruleName: string; count: number }>;
    byDatabase: Array<{ database: string; count: number }>;
  }> {
    // Total suppressed
    const totalQuery = `
      SELECT COUNT(*) as count
      FROM alert_suppressions sup
      JOIN quality_results qres ON qres.id = sup.alert_id
      WHERE qres.run_at > NOW() - INTERVAL '24 hours'
    `;
    const totalResult = await this.db.query(totalQuery);
    const totalSuppressed = parseInt(totalResult.rows[0]?.count || '0');

    // By rule
    const byRuleQuery = `
      SELECT
        sr.name as "ruleName",
        COUNT(*) as count
      FROM alert_suppressions sup
      JOIN alert_suppression_rules sr ON sr.id = sup.suppression_rule_id
      JOIN quality_results qres ON qres.id = sup.alert_id
      WHERE qres.run_at > NOW() - INTERVAL '24 hours'
      GROUP BY sr.name
      ORDER BY count DESC
    `;
    const byRuleResult = await this.db.query(byRuleQuery);

    // By database
    const byDatabaseQuery = `
      SELECT
        ca.database_name as database,
        COUNT(*) as count
      FROM alert_suppressions sup
      JOIN quality_results qres ON qres.id = sup.alert_id
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qres.run_at > NOW() - INTERVAL '24 hours'
        AND ca.database_name IS NOT NULL
      GROUP BY ca.database_name
      ORDER BY count DESC
    `;
    const byDatabaseResult = await this.db.query(byDatabaseQuery);

    return {
      totalSuppressed,
      byRule: byRuleResult.rows,
      byDatabase: byDatabaseResult.rows
    };
  }
}
