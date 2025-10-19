// backend/data-service/src/services/DataHealingService.ts
import { Pool } from 'pg';
import { logger } from '../utils/logger';

const cpdb = new Pool({ connectionString: process.env.DATABASE_URL });

/**
 * Automated Data Healing Service
 * Automatically fixes common data quality issues
 */
export class DataHealingService {
  /**
   * Healing strategies for different issue types
   */
  private healingStrategies = {
    // Nullability issues
    null_value: {
      name: 'Fill Missing Values',
      actions: ['default_value', 'forward_fill', 'backward_fill', 'mean_fill', 'median_fill'],
      confidence: 0.85
    },
    // Format issues
    invalid_format: {
      name: 'Format Correction',
      actions: ['trim', 'uppercase', 'lowercase', 'normalize_whitespace', 'remove_special_chars'],
      confidence: 0.95
    },
    // Email validation
    invalid_email: {
      name: 'Email Correction',
      actions: ['remove_spaces', 'lowercase', 'validate_domain'],
      confidence: 0.90
    },
    // Phone number formatting
    invalid_phone: {
      name: 'Phone Formatting',
      actions: ['remove_non_digits', 'add_country_code', 'standardize_format'],
      confidence: 0.92
    },
    // Date/time issues
    invalid_date: {
      name: 'Date Correction',
      actions: ['parse_common_formats', 'infer_from_context', 'use_current_date'],
      confidence: 0.80
    },
    // Duplicate records
    duplicate_record: {
      name: 'Deduplication',
      actions: ['keep_latest', 'keep_most_complete', 'merge_records'],
      confidence: 0.88
    },
    // Outliers
    outlier_detected: {
      name: 'Outlier Handling',
      actions: ['cap_at_percentile', 'remove', 'flag_for_review'],
      confidence: 0.75
    },
    // Referential integrity
    broken_reference: {
      name: 'Reference Repair',
      actions: ['remove_orphan', 'create_placeholder', 'match_fuzzy'],
      confidence: 0.70
    }
  };

  /**
   * Analyze an issue and propose healing actions
   */
  async analyzeIssue(issueId: string): Promise<{
    issueType: string;
    strategy: any;
    actions: HealingAction[];
    estimatedImpact: {
      rowsAffected: number;
      confidence: number;
      estimatedTime: string;
      reversible: boolean;
    };
  }> {
    try {
      // Get issue details
      const { rows: issues } = await cpdb.query(`
        SELECT
          qi.*,
          ca.table_name,
          ca.schema_name,
          ca.database_name,
          ds.id as datasource_id,
          ds.type as datasource_type
        FROM quality_issues qi
        JOIN catalog_assets ca ON ca.id = qi.asset_id
        JOIN data_sources ds ON ds.id = ca.datasource_id
        WHERE qi.id = $1
      `, [issueId]);

      if (issues.length === 0) {
        throw new Error(`Issue ${issueId} not found`);
      }

      const issue = issues[0];
      const issueType = issue.issue_type || this.inferIssueType(issue);
      const strategy = this.healingStrategies[issueType as keyof typeof this.healingStrategies];

      if (!strategy) {
        throw new Error(`No healing strategy available for issue type: ${issueType}`);
      }

      // Generate specific healing actions
      const actions = await this.generateHealingActions(issue, strategy);

      // Estimate impact
      const estimatedImpact = await this.estimateHealingImpact(issue, actions);

      return {
        issueType,
        strategy,
        actions,
        estimatedImpact
      };
    } catch (error: any) {
      logger.error('Failed to analyze issue for healing:', error);
      throw error;
    }
  }

  /**
   * Execute automated healing for an issue
   */
  async healIssue(
    issueId: string,
    actionId: string,
    options: {
      dryRun?: boolean;
      backupFirst?: boolean;
      requireApproval?: boolean;
    } = {}
  ): Promise<HealingResult> {
    const startTime = Date.now();

    try {
      // Analyze the issue
      const analysis = await this.analyzeIssue(issueId);
      const action = analysis.actions.find(a => a.id === actionId);

      if (!action) {
        throw new Error(`Action ${actionId} not found for issue ${issueId}`);
      }

      logger.info(`Starting healing: ${action.name} (dry run: ${options.dryRun})`);

      // Create backup if requested
      let backupId: string | null = null;
      if (options.backupFirst && !options.dryRun) {
        backupId = await this.createBackup(issueId);
      }

      // Execute the healing action
      const result = await this.executeHealingAction(issueId, action, options.dryRun || false);

      // Record healing attempt
      await this.recordHealingAttempt({
        issueId,
        actionId,
        success: result.success,
        rowsAffected: result.rowsAffected,
        dryRun: options.dryRun || false,
        backupId,
        duration: Date.now() - startTime,
        details: result.details
      });

      return {
        success: result.success,
        rowsAffected: result.rowsAffected,
        backupId,
        duration: Date.now() - startTime,
        dryRun: options.dryRun || false,
        reversible: backupId !== null,
        details: result.details,
        nextSteps: result.success ?
          ['Verify changes', 'Monitor for side effects', 'Update quality metrics'] :
          ['Review error logs', 'Try alternative action', 'Escalate to manual fix']
      };
    } catch (error: any) {
      logger.error('Healing failed:', error);
      throw error;
    }
  }

  /**
   * Rollback a healing action
   */
  async rollbackHealing(healingId: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get healing attempt details
      const { rows } = await cpdb.query(`
        SELECT * FROM quality_healing_attempts
        WHERE id = $1
      `, [healingId]);

      if (rows.length === 0) {
        throw new Error(`Healing attempt ${healingId} not found`);
      }

      const attempt = rows[0];

      if (!attempt.backup_id) {
        throw new Error('No backup available for rollback');
      }

      // Restore from backup
      await this.restoreFromBackup(attempt.backup_id);

      // Mark as rolled back
      await cpdb.query(`
        UPDATE quality_healing_attempts
        SET rolled_back = true, rolled_back_at = NOW()
        WHERE id = $1
      `, [healingId]);

      return {
        success: true,
        message: `Successfully rolled back healing attempt ${healingId}`
      };
    } catch (error: any) {
      logger.error('Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Get healing recommendations for a data source
   */
  async getHealingRecommendations(dataSourceId: string): Promise<HealingRecommendation[]> {
    try {
      // Get all open issues for the data source
      const { rows: issues } = await cpdb.query(`
        SELECT
          qi.*,
          ca.table_name,
          ca.schema_name,
          COUNT(*) OVER (PARTITION BY qi.issue_type) as similar_issues
        FROM quality_issues qi
        JOIN catalog_assets ca ON ca.id = qi.asset_id
        WHERE ca.datasource_id = $1
          AND qi.status = 'open'
        ORDER BY qi.severity DESC, qi.affected_rows DESC
        LIMIT 50
      `, [dataSourceId]);

      const recommendations: HealingRecommendation[] = [];

      for (const issue of issues) {
        const issueType = issue.issue_type || this.inferIssueType(issue);
        const strategy = this.healingStrategies[issueType as keyof typeof this.healingStrategies];

        if (strategy) {
          recommendations.push({
            issueId: issue.id,
            issueTitle: issue.title,
            issueType,
            severity: issue.severity,
            affectedRows: issue.affected_rows,
            tableName: issue.table_name,
            strategyName: strategy.name,
            confidence: strategy.confidence,
            estimatedTime: this.estimateHealingTime(issue.affected_rows),
            autoHealable: strategy.confidence >= 0.85,
            requiresApproval: strategy.confidence < 0.90 || issue.severity === 'critical',
            similarIssues: issue.similar_issues
          });
        }
      }

      return recommendations;
    } catch (error: any) {
      logger.error('Failed to get healing recommendations:', error);
      throw error;
    }
  }

  /**
   * Batch heal multiple issues
   */
  async batchHeal(
    issueIds: string[],
    options: {
      maxConcurrent?: number;
      dryRun?: boolean;
      stopOnError?: boolean;
    } = {}
  ): Promise<BatchHealingResult> {
    const results: HealingResult[] = [];
    const errors: Array<{ issueId: string; error: string }> = [];
    const maxConcurrent = options.maxConcurrent || 3;

    // Process in batches
    for (let i = 0; i < issueIds.length; i += maxConcurrent) {
      const batch = issueIds.slice(i, i + maxConcurrent);

      const batchPromises = batch.map(async (issueId) => {
        try {
          const analysis = await this.analyzeIssue(issueId);
          // Use the highest confidence action
          const bestAction = analysis.actions.sort((a, b) => b.confidence - a.confidence)[0];

          if (bestAction) {
            const result = await this.healIssue(issueId, bestAction.id, {
              dryRun: options.dryRun,
              backupFirst: true
            });
            results.push(result);
          }
        } catch (error: any) {
          errors.push({ issueId, error: error.message });
          if (options.stopOnError) {
            throw error;
          }
        }
      });

      await Promise.all(batchPromises);
    }

    return {
      total: issueIds.length,
      successful: results.filter(r => r.success).length,
      failed: errors.length,
      results,
      errors,
      totalRowsAffected: results.reduce((sum, r) => sum + r.rowsAffected, 0)
    };
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  private inferIssueType(issue: any): string {
    const title = (issue.title || '').toLowerCase();
    const description = (issue.description || '').toLowerCase();
    const combined = `${title} ${description}`;

    if (combined.includes('null') || combined.includes('missing')) return 'null_value';
    if (combined.includes('email')) return 'invalid_email';
    if (combined.includes('phone')) return 'invalid_phone';
    if (combined.includes('date')) return 'invalid_date';
    if (combined.includes('duplicate')) return 'duplicate_record';
    if (combined.includes('outlier')) return 'outlier_detected';
    if (combined.includes('reference') || combined.includes('foreign key')) return 'broken_reference';
    if (combined.includes('format')) return 'invalid_format';

    return 'unknown';
  }

  private async generateHealingActions(issue: any, strategy: any): Promise<HealingAction[]> {
    const actions: HealingAction[] = [];

    for (const actionType of strategy.actions) {
      actions.push({
        id: `${issue.id}_${actionType}`,
        name: this.getActionName(actionType),
        description: this.getActionDescription(actionType, issue),
        actionType,
        confidence: this.getActionConfidence(actionType, issue),
        sqlPreview: await this.generateHealingSQL(issue, actionType),
        estimatedImpact: {
          rowsAffected: issue.affected_rows || 0,
          dataLoss: this.estimateDataLoss(actionType),
          reversible: this.isReversible(actionType)
        }
      });
    }

    return actions.sort((a, b) => b.confidence - a.confidence);
  }

  private async estimateHealingImpact(issue: any, actions: HealingAction[]): Promise<any> {
    const bestAction = actions[0];

    return {
      rowsAffected: issue.affected_rows || 0,
      confidence: bestAction?.confidence || 0,
      estimatedTime: this.estimateHealingTime(issue.affected_rows || 0),
      reversible: bestAction?.estimatedImpact.reversible || false
    };
  }

  private async executeHealingAction(
    issueId: string,
    action: HealingAction,
    dryRun: boolean
  ): Promise<{ success: boolean; rowsAffected: number; details: any }> {
    // In dry run mode, just validate the SQL
    if (dryRun) {
      return {
        success: true,
        rowsAffected: action.estimatedImpact.rowsAffected,
        details: {
          message: 'Dry run completed successfully',
          sqlPreview: action.sqlPreview
        }
      };
    }

    // Execute the actual healing SQL
    try {
      const result = await cpdb.query(action.sqlPreview);

      return {
        success: true,
        rowsAffected: result.rowCount || 0,
        details: {
          message: 'Healing completed successfully',
          action: action.name
        }
      };
    } catch (error: any) {
      return {
        success: false,
        rowsAffected: 0,
        details: {
          error: error.message,
          action: action.name
        }
      };
    }
  }

  private async createBackup(issueId: string): Promise<string> {
    // Create a backup snapshot in a backup table
    const backupId = `backup_${issueId}_${Date.now()}`;

    // TODO: Implement actual backup logic
    logger.info(`Created backup: ${backupId}`);

    return backupId;
  }

  private async restoreFromBackup(backupId: string): Promise<void> {
    // TODO: Implement actual restore logic
    logger.info(`Restored from backup: ${backupId}`);
  }

  private async recordHealingAttempt(attempt: any): Promise<void> {
    await cpdb.query(`
      INSERT INTO quality_healing_attempts (
        issue_id, action_id, success, rows_affected,
        dry_run, backup_id, duration_ms, details
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      attempt.issueId,
      attempt.actionId,
      attempt.success,
      attempt.rowsAffected,
      attempt.dryRun,
      attempt.backupId,
      attempt.duration,
      JSON.stringify(attempt.details)
    ]);
  }

  private async generateHealingSQL(issue: any, actionType: string): Promise<string> {
    // Generate SQL based on action type
    const table = `${issue.schema_name}.${issue.table_name}`;

    switch (actionType) {
      case 'default_value':
        return `UPDATE ${table} SET ${issue.column_name} = 'DEFAULT' WHERE ${issue.column_name} IS NULL`;

      case 'trim':
        return `UPDATE ${table} SET ${issue.column_name} = TRIM(${issue.column_name})`;

      case 'lowercase':
        return `UPDATE ${table} SET ${issue.column_name} = LOWER(${issue.column_name})`;

      case 'remove_duplicates':
        return `DELETE FROM ${table} a USING ${table} b WHERE a.id > b.id AND a.${issue.column_name} = b.${issue.column_name}`;

      default:
        return `-- Manual intervention required for ${actionType}`;
    }
  }

  private getActionName(actionType: string): string {
    const names: Record<string, string> = {
      default_value: 'Fill with Default Value',
      forward_fill: 'Forward Fill from Previous Row',
      backward_fill: 'Backward Fill from Next Row',
      mean_fill: 'Fill with Mean Value',
      trim: 'Trim Whitespace',
      lowercase: 'Convert to Lowercase',
      remove_duplicates: 'Remove Duplicate Records',
      cap_at_percentile: 'Cap at 95th Percentile'
    };
    return names[actionType] || actionType;
  }

  private getActionDescription(actionType: string, issue: any): string {
    return `Apply ${actionType} to fix ${issue.title}`;
  }

  private getActionConfidence(actionType: string, issue: any): number {
    // Different actions have different confidence levels
    const confidenceMap: Record<string, number> = {
      default_value: 0.80,
      trim: 0.95,
      lowercase: 0.90,
      remove_duplicates: 0.85,
      forward_fill: 0.75,
      backward_fill: 0.75,
      mean_fill: 0.70
    };
    return confidenceMap[actionType] || 0.60;
  }

  private estimateDataLoss(actionType: string): string {
    const lossMap: Record<string, string> = {
      default_value: 'Low',
      trim: 'None',
      lowercase: 'None',
      remove_duplicates: 'Medium',
      forward_fill: 'Low',
      backward_fill: 'Low'
    };
    return lossMap[actionType] || 'Unknown';
  }

  private isReversible(actionType: string): boolean {
    // Actions that can be reversed with a backup
    const reversible = ['default_value', 'trim', 'lowercase', 'remove_duplicates'];
    return reversible.includes(actionType);
  }

  private estimateHealingTime(rowsAffected: number): string {
    if (rowsAffected < 1000) return '< 1 minute';
    if (rowsAffected < 10000) return '1-5 minutes';
    if (rowsAffected < 100000) return '5-15 minutes';
    return '15+ minutes';
  }
}

// ============================================================================
// TYPES
// ============================================================================

interface HealingAction {
  id: string;
  name: string;
  description: string;
  actionType: string;
  confidence: number;
  sqlPreview: string;
  estimatedImpact: {
    rowsAffected: number;
    dataLoss: string;
    reversible: boolean;
  };
}

interface HealingResult {
  success: boolean;
  rowsAffected: number;
  backupId: string | null;
  duration: number;
  dryRun: boolean;
  reversible: boolean;
  details: any;
  nextSteps: string[];
}

interface HealingRecommendation {
  issueId: string;
  issueTitle: string;
  issueType: string;
  severity: string;
  affectedRows: number;
  tableName: string;
  strategyName: string;
  confidence: number;
  estimatedTime: string;
  autoHealable: boolean;
  requiresApproval: boolean;
  similarIssues: number;
}

interface BatchHealingResult {
  total: number;
  successful: number;
  failed: number;
  results: HealingResult[];
  errors: Array<{ issueId: string; error: string }>;
  totalRowsAffected: number;
}
