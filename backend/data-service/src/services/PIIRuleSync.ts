/**
 * PII Rule Synchronization Service
 *
 * Ensures that when PII rules are disabled/deleted/modified,
 * the catalog_columns and quality_issues are automatically updated
 */

import { Pool } from 'pg';

export class PIIRuleSyncService {
  constructor(private pool: Pool) {}

  /**
   * When a PII rule is DISABLED, clear all PII markers for that type
   */
  async syncRuleDisabled(piiType: string): Promise<{ columnsCleared: number; issuesResolved: number }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Clear PII markers from catalog_columns (case-insensitive)
      const columnsResult = await client.query(`
        UPDATE catalog_columns
        SET
          pii_type = NULL,
          data_classification = NULL,
          is_sensitive = false,
          profile_json = CASE
            WHEN profile_json IS NOT NULL THEN profile_json - 'quality_issues'
            ELSE profile_json
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(pii_type) = LOWER($1) OR LOWER(data_classification) = LOWER($1)
      `, [piiType]);

      // 2. Resolve quality issues related to this PII type
      const issuesResult = await client.query(`
        UPDATE quality_issues
        SET
          status = 'resolved',
          resolved_at = CURRENT_TIMESTAMP,
          remediation_plan = 'Auto-resolved: PII rule "' || $1 || '" was disabled.'
        WHERE
          status IN ('open', 'acknowledged')
          AND (title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%')
      `, [piiType]);

      await client.query('COMMIT');

      console.log(`[PIIRuleSync] Rule "${piiType}" disabled: cleared ${columnsResult.rowCount} columns, resolved ${issuesResult.rowCount} issues`);

      return {
        columnsCleared: columnsResult.rowCount || 0,
        issuesResolved: issuesResult.rowCount || 0,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[PIIRuleSync] Error syncing disabled rule "${piiType}":`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * When a PII rule is ENABLED, trigger rescan
   */
  async syncRuleEnabled(piiType: string): Promise<{ message: string }> {
    console.log(`[PIIRuleSync] Rule "${piiType}" enabled - recommend full rescan`);

    // Note: Actual rescan would be triggered by the caller
    return {
      message: `PII rule "${piiType}" enabled. Run a data scan to detect this PII type.`
    };
  }

  /**
   * When a PII rule is DELETED, clear all related data
   */
  async syncRuleDeleted(piiType: string): Promise<{ columnsCleared: number; issuesResolved: number }> {
    // Same as disabled, but more aggressive
    return this.syncRuleDisabled(piiType);
  }

  /**
   * When PII rule hints/regex are MODIFIED, clear and recommend rescan
   */
  async syncRuleModified(piiType: string, changes: { hintsChanged?: boolean; regexChanged?: boolean }): Promise<{ columnsCleared: number; message: string }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // If hints or regex changed significantly, clear existing classifications
      // to avoid stale data
      const columnsResult = await client.query(`
        UPDATE catalog_columns
        SET
          pii_type = NULL,
          data_classification = NULL,
          is_sensitive = false,
          profile_json = CASE
            WHEN profile_json IS NOT NULL THEN profile_json - 'quality_issues'
            ELSE profile_json
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(pii_type) = LOWER($1) OR LOWER(data_classification) = LOWER($1)
      `, [piiType]);

      await client.query('COMMIT');

      console.log(`[PIIRuleSync] Rule "${piiType}" modified: cleared ${columnsResult.rowCount} columns for rescan`);

      return {
        columnsCleared: columnsResult.rowCount || 0,
        message: `PII rule "${piiType}" modified. Cleared ${columnsResult.rowCount} columns. Run rescan to re-detect with new configuration.`
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`[PIIRuleSync] Error syncing modified rule "${piiType}":`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up orphaned PII classifications (no matching enabled rule)
   */
  async cleanupOrphanedPII(): Promise<{ columnsCleared: number; issuesResolved: number }> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Find all enabled PII rules
      const { rows: enabledRules } = await client.query(`
        SELECT LOWER(pii_type) as pii_type
        FROM pii_rule_definitions
        WHERE is_enabled = true
      `);

      const enabledTypes = enabledRules.map(r => r.pii_type);

      if (enabledTypes.length === 0) {
        // No enabled rules, clear all PII
        const columnsResult = await client.query(`
          UPDATE catalog_columns
          SET
            pii_type = NULL,
            data_classification = NULL,
            is_sensitive = false,
            profile_json = CASE
              WHEN profile_json IS NOT NULL THEN profile_json - 'quality_issues'
              ELSE profile_json
            END,
            updated_at = CURRENT_TIMESTAMP
          WHERE pii_type IS NOT NULL OR data_classification IS NOT NULL
        `);

        const issuesResult = await client.query(`
          UPDATE quality_issues
          SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP
          WHERE status IN ('open', 'acknowledged') AND title ILIKE '%PII%'
        `);

        await client.query('COMMIT');

        return {
          columnsCleared: columnsResult.rowCount || 0,
          issuesResolved: issuesResult.rowCount || 0,
        };
      }

      // Clear PII classifications that don't have an enabled rule
      const columnsResult = await client.query(`
        UPDATE catalog_columns
        SET
          pii_type = NULL,
          data_classification = NULL,
          is_sensitive = false,
          profile_json = CASE
            WHEN profile_json IS NOT NULL THEN profile_json - 'quality_issues'
            ELSE profile_json
          END,
          updated_at = CURRENT_TIMESTAMP
        WHERE
          (pii_type IS NOT NULL OR data_classification IS NOT NULL)
          AND LOWER(COALESCE(pii_type, data_classification)) != ALL($1::text[])
      `, [enabledTypes]);

      const issuesResult = await client.query(`
        UPDATE quality_issues
        SET
          status = 'resolved',
          resolved_at = CURRENT_TIMESTAMP,
          remediation_plan = 'Auto-resolved: No enabled PII rule for this type.'
        WHERE status IN ('open', 'acknowledged')
          AND title ILIKE '%PII%'
      `);

      await client.query('COMMIT');

      console.log(`[PIIRuleSync] Cleanup: cleared ${columnsResult.rowCount} orphaned PII columns, resolved ${issuesResult.rowCount} issues`);

      return {
        columnsCleared: columnsResult.rowCount || 0,
        issuesResolved: issuesResult.rowCount || 0,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('[PIIRuleSync] Error cleaning up orphaned PII:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}
