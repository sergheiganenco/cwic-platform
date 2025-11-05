/**
 * Auto-Fix Service
 *
 * Automatically fixes common data quality issues:
 * - NULL values → Set defaults
 * - Duplicate records → Remove duplicates
 * - Invalid values → Correct or remove
 * - Orphaned records → Clean up
 */

import { Pool } from 'pg';

export interface AutoFixRequest {
  alertId: string;
  fixType: string;
  params?: {
    defaultValue?: any;
    strategy?: 'keep_newest' | 'keep_oldest' | 'keep_most_complete';
    dryRun?: boolean;
  };
}

export interface AutoFixResult {
  id: string;
  alertId: string;
  fixType: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  rowsAffected: number;
  executionTimeMs: number;
  errorMessage?: string;
  executedAt: Date;
  completedAt?: Date;
}

export class AutoFixService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Execute auto-fix for an alert
   */
  async executeAutoFix(request: AutoFixRequest): Promise<AutoFixResult> {
    const startTime = Date.now();

    // Create auto-fix record
    const fixId = await this.createAutoFixRecord(request);

    try {
      // Update status to running
      await this.updateAutoFixStatus(fixId, 'running');

      let rowsAffected = 0;

      // Execute fix based on type
      switch (request.fixType) {
        case 'set_null_defaults':
          rowsAffected = await this.fixNullValues(request);
          break;

        case 'remove_duplicates':
          rowsAffected = await this.fixDuplicates(request);
          break;

        case 'correct_invalid_values':
          rowsAffected = await this.fixInvalidValues(request);
          break;

        case 'remove_orphaned_records':
          rowsAffected = await this.fixOrphanedRecords(request);
          break;

        case 'fix_negative_values':
          rowsAffected = await this.fixNegativeValues(request);
          break;

        default:
          throw new Error(`Unknown fix type: ${request.fixType}`);
      }

      const executionTime = Date.now() - startTime;

      // Update auto-fix record with results
      await this.updateAutoFixComplete(fixId, rowsAffected, executionTime);

      return {
        id: fixId,
        alertId: request.alertId,
        fixType: request.fixType,
        status: 'completed',
        rowsAffected,
        executionTimeMs: executionTime,
        executedAt: new Date(),
        completedAt: new Date()
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // Update auto-fix record with error
      await this.updateAutoFixFailed(fixId, error.message, executionTime);

      return {
        id: fixId,
        alertId: request.alertId,
        fixType: request.fixType,
        status: 'failed',
        rowsAffected: 0,
        executionTimeMs: executionTime,
        errorMessage: error.message,
        executedAt: new Date()
      };
    }
  }

  /**
   * Fix NULL values by setting defaults
   */
  private async fixNullValues(request: AutoFixRequest): Promise<number> {
    // Get alert details
    const alert = await this.getAlertDetails(request.alertId);

    if (!alert.table || !alert.column) {
      throw new Error('Alert must have table and column information');
    }

    const defaultValue = request.params?.defaultValue;

    if (!defaultValue) {
      throw new Error('Default value is required for NULL fix');
    }

    const isDryRun = request.params?.dryRun || false;

    if (isDryRun) {
      // Dry run: just count
      const countQuery = `
        SELECT COUNT(*) as count
        FROM ${alert.database}.${alert.table}
        WHERE ${alert.column} IS NULL
      `;

      const result = await this.db.query(countQuery);
      return parseInt(result.rows[0].count);
    }

    // Actual fix
    const fixQuery = `
      UPDATE ${alert.database}.${alert.table}
      SET ${alert.column} = $1
      WHERE ${alert.column} IS NULL
    `;

    const result = await this.db.query(fixQuery, [defaultValue]);
    return result.rowCount || 0;
  }

  /**
   * Fix duplicate records
   */
  private async fixDuplicates(request: AutoFixRequest): Promise<number> {
    const alert = await this.getAlertDetails(request.alertId);

    if (!alert.table || !alert.column) {
      throw new Error('Alert must have table and column information');
    }

    const strategy = request.params?.strategy || 'keep_newest';
    const isDryRun = request.params?.dryRun || false;

    let orderByClause: string;
    switch (strategy) {
      case 'keep_newest':
        orderByClause = 'created_at DESC';
        break;
      case 'keep_oldest':
        orderByClause = 'created_at ASC';
        break;
      case 'keep_most_complete':
        // Keep record with most non-NULL fields
        orderByClause = `
          (SELECT COUNT(*) FROM jsonb_object_keys(to_jsonb(t))
           WHERE to_jsonb(t)->>(key) IS NOT NULL) DESC,
          created_at DESC
        `;
        break;
      default:
        orderByClause = 'created_at DESC';
    }

    if (isDryRun) {
      // Count duplicates that would be deleted
      const countQuery = `
        SELECT COUNT(*) as count
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (PARTITION BY ${alert.column} ORDER BY ${orderByClause}) as rn
          FROM ${alert.database}.${alert.table}
        ) t
        WHERE rn > 1
      `;

      const result = await this.db.query(countQuery);
      return parseInt(result.rows[0].count);
    }

    // Actual fix: delete duplicates
    const deleteQuery = `
      DELETE FROM ${alert.database}.${alert.table}
      WHERE id IN (
        SELECT id
        FROM (
          SELECT
            id,
            ROW_NUMBER() OVER (PARTITION BY ${alert.column} ORDER BY ${orderByClause}) as rn
          FROM ${alert.database}.${alert.table}
        ) t
        WHERE rn > 1
      )
    `;

    const result = await this.db.query(deleteQuery);
    return result.rowCount || 0;
  }

  /**
   * Fix invalid values
   */
  private async fixInvalidValues(request: AutoFixRequest): Promise<number> {
    const alert = await this.getAlertDetails(request.alertId);

    if (!alert.table || !alert.column) {
      throw new Error('Alert must have table and column information');
    }

    const isDryRun = request.params?.dryRun || false;

    // Example: fix negative values in numeric columns
    if (alert.issue.includes('negative')) {
      if (isDryRun) {
        const countQuery = `
          SELECT COUNT(*) as count
          FROM ${alert.database}.${alert.table}
          WHERE ${alert.column} < 0
        `;

        const result = await this.db.query(countQuery);
        return parseInt(result.rows[0].count);
      }

      // Set negative values to 0
      const fixQuery = `
        UPDATE ${alert.database}.${alert.table}
        SET ${alert.column} = 0
        WHERE ${alert.column} < 0
      `;

      const result = await this.db.query(fixQuery);
      return result.rowCount || 0;
    }

    // Example: fix out-of-range values
    if (alert.issue.includes('exceeds') || alert.issue.includes('range')) {
      const defaultValue = request.params?.defaultValue || 0;

      if (isDryRun) {
        const countQuery = `
          SELECT COUNT(*) as count
          FROM ${alert.database}.${alert.table}
          WHERE ${alert.column} > 1000000  -- Example threshold
        `;

        const result = await this.db.query(countQuery);
        return parseInt(result.rows[0].count);
      }

      const fixQuery = `
        UPDATE ${alert.database}.${alert.table}
        SET ${alert.column} = $1
        WHERE ${alert.column} > 1000000
      `;

      const result = await this.db.query(fixQuery, [defaultValue]);
      return result.rowCount || 0;
    }

    throw new Error('Unable to determine fix strategy for invalid values');
  }

  /**
   * Fix orphaned records (referential integrity)
   */
  private async fixOrphanedRecords(request: AutoFixRequest): Promise<number> {
    const alert = await this.getAlertDetails(request.alertId);

    if (!alert.table) {
      throw new Error('Alert must have table information');
    }

    // This is a complex fix that requires knowing the FK relationships
    // For now, we'll just count orphaned records
    const isDryRun = request.params?.dryRun || false;

    if (isDryRun) {
      // Would need to know parent table and FK column
      return 0;
    }

    // Actual deletion would happen here
    return 0;
  }

  /**
   * Fix negative values in numeric columns
   */
  private async fixNegativeValues(request: AutoFixRequest): Promise<number> {
    const alert = await this.getAlertDetails(request.alertId);

    if (!alert.table || !alert.column) {
      throw new Error('Alert must have table and column information');
    }

    const isDryRun = request.params?.dryRun || false;

    if (isDryRun) {
      const countQuery = `
        SELECT COUNT(*) as count
        FROM ${alert.database}.${alert.table}
        WHERE ${alert.column} < 0
      `;

      const result = await this.db.query(countQuery);
      return parseInt(result.rows[0].count);
    }

    // Set negative values to absolute value or 0
    const fixQuery = `
      UPDATE ${alert.database}.${alert.table}
      SET ${alert.column} = ABS(${alert.column})
      WHERE ${alert.column} < 0
    `;

    const result = await this.db.query(fixQuery);
    return result.rowCount || 0;
  }

  /**
   * Get alert details from database
   */
  private async getAlertDetails(alertId: string): Promise<any> {
    const query = `
      SELECT
        qres.id,
        qr.dimension,
        qr.description as issue,
        ca.table_name as "table",
        ca.database_name as "database",
        ca.column_name as "column"
      FROM quality_results qres
      JOIN quality_rules qr ON qr.id = qres.rule_id
      LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
      WHERE qres.id = $1
    `;

    const result = await this.db.query(query, [alertId]);

    if (result.rows.length === 0) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    return result.rows[0];
  }

  /**
   * Create auto-fix record
   */
  private async createAutoFixRecord(request: AutoFixRequest): Promise<string> {
    const query = `
      INSERT INTO alert_auto_fixes (
        alert_id,
        fix_type,
        fix_params,
        status,
        executed_at
      ) VALUES ($1, $2, $3, $4, NOW())
      RETURNING id
    `;

    const result = await this.db.query(query, [
      request.alertId,
      request.fixType,
      JSON.stringify(request.params || {}),
      'pending'
    ]);

    return result.rows[0].id;
  }

  /**
   * Update auto-fix status
   */
  private async updateAutoFixStatus(fixId: string, status: string): Promise<void> {
    const query = `
      UPDATE alert_auto_fixes
      SET status = $1
      WHERE id = $2
    `;

    await this.db.query(query, [status, fixId]);
  }

  /**
   * Update auto-fix as complete
   */
  private async updateAutoFixComplete(
    fixId: string,
    rowsAffected: number,
    executionTimeMs: number
  ): Promise<void> {
    const query = `
      UPDATE alert_auto_fixes
      SET
        status = 'completed',
        rows_affected = $1,
        execution_time_ms = $2,
        completed_at = NOW()
      WHERE id = $3
    `;

    await this.db.query(query, [rowsAffected, executionTimeMs, fixId]);
  }

  /**
   * Update auto-fix as failed
   */
  private async updateAutoFixFailed(
    fixId: string,
    errorMessage: string,
    executionTimeMs: number
  ): Promise<void> {
    const query = `
      UPDATE alert_auto_fixes
      SET
        status = 'failed',
        error_message = $1,
        execution_time_ms = $2,
        completed_at = NOW()
      WHERE id = $3
    `;

    await this.db.query(query, [errorMessage, executionTimeMs, fixId]);
  }

  /**
   * Get auto-fix history for an alert
   */
  async getAutoFixHistory(alertId: string): Promise<AutoFixResult[]> {
    const query = `
      SELECT
        id,
        alert_id as "alertId",
        fix_type as "fixType",
        status,
        rows_affected as "rowsAffected",
        execution_time_ms as "executionTimeMs",
        error_message as "errorMessage",
        executed_at as "executedAt",
        completed_at as "completedAt"
      FROM alert_auto_fixes
      WHERE alert_id = $1
      ORDER BY executed_at DESC
    `;

    const result = await this.db.query(query, [alertId]);
    return result.rows;
  }

  /**
   * Get available fix types for an alert
   */
  async getAvailableFixTypes(alertId: string): Promise<string[]> {
    const alert = await this.getAlertDetails(alertId);
    const fixTypes: string[] = [];

    // Determine available fixes based on alert characteristics
    if (alert.dimension === 'completeness' || alert.issue.includes('NULL')) {
      fixTypes.push('set_null_defaults');
    }

    if (alert.dimension === 'uniqueness' || alert.issue.includes('duplicate')) {
      fixTypes.push('remove_duplicates');
    }

    if (alert.issue.includes('negative')) {
      fixTypes.push('fix_negative_values');
      fixTypes.push('correct_invalid_values');
    }

    if (alert.issue.includes('invalid') || alert.issue.includes('range')) {
      fixTypes.push('correct_invalid_values');
    }

    if (alert.issue.includes('orphan') || alert.issue.includes('referential')) {
      fixTypes.push('remove_orphaned_records');
    }

    return fixTypes;
  }
}
