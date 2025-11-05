/**
 * PII Quality Integration Service
 * Connects configurable PII rules to the Data Quality system
 * Automatically generates quality rules and issues for PII violations
 */

import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { PIIFixValidator } from './PIIFixValidator';

export interface PIIRuleDefinition {
  id: number;
  piiType: string;
  displayName: string;
  description: string;
  category: string;
  regexPattern: string;
  columnNameHints: string[];
  sensitivityLevel: 'critical' | 'high' | 'medium' | 'low';
  complianceFlags: string[];
  isEnabled: boolean;
  requiresEncryption: boolean;
  requiresMasking: boolean;
  examples: string[];
}

export interface PIIViolation {
  columnId: string;
  assetId: string;
  dataSourceId: string;
  databaseName: string; // Added: database name from catalog_assets
  schemaName: string;
  tableName: string;
  columnName: string;
  piiType: string;
  piiDisplayName: string;
  sensitivityLevel: string;
  matchCount: number;
  sampleMatches: string[];
  complianceFlags: string[];
  requiresEncryption: boolean;
  requiresMasking: boolean;
  recommendation: string;
}

export interface PIIScanResult {
  dataSourceId: string;
  totalColumns: number;
  violationsFound: number;
  criticalViolations: number;
  highViolations: number;
  mediumViolations: number;
  lowViolations: number;
  violations: PIIViolation[];
  duration: number;
}

export class PIIQualityIntegration {
  private db: Pool;
  private validator: PIIFixValidator;

  constructor(dbPool: Pool) {
    this.db = dbPool;
    this.validator = new PIIFixValidator(dbPool);
  }

  /**
   * Get all enabled PII rules from configuration
   */
  async getEnabledPIIRules(): Promise<PIIRuleDefinition[]> {
    const result = await this.db.query(`
      SELECT
        id,
        pii_type as "piiType",
        display_name as "displayName",
        description,
        category,
        regex_pattern as "regexPattern",
        column_name_hints as "columnNameHints",
        sensitivity_level as "sensitivityLevel",
        compliance_flags as "complianceFlags",
        is_enabled as "isEnabled",
        requires_encryption as "requiresEncryption",
        requires_masking as "requiresMasking",
        examples
      FROM pii_rule_definitions
      WHERE is_enabled = true
      ORDER BY
        CASE sensitivity_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `);

    return result.rows;
  }

  /**
   * Scan a data source for PII violations
   */
  async scanDataSourceForPII(dataSourceId: string): Promise<PIIScanResult> {
    const startTime = Date.now();
    logger.info(`Scanning data source ${dataSourceId} for PII violations`);

    const violations: PIIViolation[] = [];

    try {
      // Get enabled PII rules
      const piiRules = await this.getEnabledPIIRules();
      if (piiRules.length === 0) {
        logger.warn('No enabled PII rules found');
        return this.createEmptyResult(dataSourceId, startTime);
      }

      // Get all columns from this data source via catalog_assets
      const columns = await this.getDataSourceColumns(dataSourceId);
      logger.info(`Found ${columns.length} columns to scan`);

      // Scan each column against PII rules
      for (const column of columns) {
        const columnViolations = await this.scanColumnForPII(column, piiRules);
        violations.push(...columnViolations);
      }

      // Create quality issues for violations
      for (const violation of violations) {
        await this.createQualityIssueForPIIViolation(violation);
      }

      const result: PIIScanResult = {
        dataSourceId,
        totalColumns: columns.length,
        violationsFound: violations.length,
        criticalViolations: violations.filter(v => v.sensitivityLevel === 'critical').length,
        highViolations: violations.filter(v => v.sensitivityLevel === 'high').length,
        mediumViolations: violations.filter(v => v.sensitivityLevel === 'medium').length,
        lowViolations: violations.filter(v => v.sensitivityLevel === 'low').length,
        violations,
        duration: Date.now() - startTime
      };

      logger.info(`PII scan complete: ${violations.length} violations found in ${result.duration}ms`);
      return result;

    } catch (error: any) {
      logger.error('Error scanning for PII:', error);
      return this.createEmptyResult(dataSourceId, startTime);
    }
  }

  /**
   * Scan a single column for PII violations
   */
  private async scanColumnForPII(
    column: any,
    piiRules: PIIRuleDefinition[]
  ): Promise<PIIViolation[]> {
    const violations: PIIViolation[] = [];

    for (const rule of piiRules) {
      // Check column name hints first
      const columnNameLower = column.column_name.toLowerCase();
      const hasNameHint = rule.columnNameHints.some(hint =>
        columnNameLower.includes(hint.toLowerCase())
      );

      // If column name matches, it's a strong indicator of PII
      if (hasNameHint) {
        // Try to sample the column data for confirmation
        const samples = await this.sampleColumnData(
          column.data_source_id,
          column.schema_name,
          column.table_name,
          column.column_name
        );

        let matchCount = 0;
        let sampleMatches: string[] = [];

        if (samples.length > 0) {
          // Test samples against regex pattern
          const matches = this.testSamplesAgainstPattern(samples, rule.regexPattern);
          matchCount = matches.length;
          sampleMatches = matches.slice(0, 3); // First 3 matches
        }

        // Create violation if:
        // 1. Column name matches AND we have confirming sample data
        // 2. Column name matches AND we don't have sample data (assume PII based on name)
        if (matchCount > 0 || samples.length === 0) {
          violations.push({
            columnId: column.id,
            assetId: column.asset_id,
            dataSourceId: column.data_source_id,
            databaseName: column.database_name, // Database from catalog_assets
            schemaName: column.schema_name,
            tableName: column.table_name,
            columnName: column.column_name,
            piiType: rule.piiType,
            piiDisplayName: rule.displayName,
            sensitivityLevel: rule.sensitivityLevel,
            matchCount: matchCount || 1, // At least 1 if detected by name
            sampleMatches: sampleMatches,
            complianceFlags: rule.complianceFlags,
            requiresEncryption: rule.requiresEncryption,
            requiresMasking: rule.requiresMasking,
            recommendation: this.getRecommendation(rule)
          });

          logger.info(`✅ PII detected: ${rule.displayName} in ${column.schema_name}.${column.table_name}.${column.column_name} (${matchCount > 0 ? 'data confirmed' : 'name-based'})`);
        } else if (samples.length > 0 && matchCount === 0) {
          // Column name matches but sample data doesn't match pattern - likely false positive
          logger.warn(`⚠️ False positive: ${column.column_name} matches name hint "${rule.columnNameHints.join(',')}" but data doesn't match ${rule.piiType} pattern`);
        }
      }
    }

    return violations;
  }

  /**
   * Get all columns from a data source
   */
  private async getDataSourceColumns(dataSourceId: string): Promise<any[]> {
    const result = await this.db.query(`
      SELECT
        cc.id,
        cc.asset_id,
        ca.datasource_id as data_source_id,
        ca.database_name,
        ca.schema_name,
        ca.table_name,
        cc.column_name,
        cc.data_type,
        cc.profile_json as statistics
      FROM catalog_columns cc
      JOIN catalog_assets ca ON cc.asset_id = ca.id
      WHERE ca.datasource_id = $1
      ORDER BY ca.schema_name, ca.table_name, cc.column_name
    `, [dataSourceId]);

    return result.rows;
  }

  /**
   * Sample column data for PII detection
   */
  private async sampleColumnData(
    dataSourceId: string,
    schemaName: string,
    tableName: string,
    columnName: string,
    sampleSize: number = 100
  ): Promise<string[]> {
    try {
      // Get connection details
      const dsResult = await this.db.query(
        `SELECT type, host, port, database_name, connection_config
         FROM data_sources
         WHERE id = $1`,
        [dataSourceId]
      );

      if (dsResult.rows.length === 0) {
        return [];
      }

      const dataSource = dsResult.rows[0];

      // Get sample data from catalog_columns (NOT catalog_assets!)
      const statsResult = await this.db.query(`
        SELECT cc.profile_json, cc.sample_values
        FROM catalog_columns cc
        JOIN catalog_assets ca ON cc.asset_id = ca.id
        WHERE ca.datasource_id = $1
          AND ca.schema_name = $2
          AND ca.table_name = $3
          AND cc.column_name = $4
        LIMIT 1
      `, [dataSourceId, schemaName, tableName, columnName]);

      if (statsResult.rows.length > 0) {
        const row = statsResult.rows[0];

        // Try sample_values column first
        if (row.sample_values && Array.isArray(row.sample_values)) {
          return row.sample_values.map(v => String(v)).filter(Boolean);
        }

        // Try profile_json
        if (row.profile_json && row.profile_json.sample_values) {
          return row.profile_json.sample_values.map(v => String(v)).filter(Boolean);
        }
      }

      return [];
    } catch (error) {
      logger.warn(`Could not sample column ${schemaName}.${tableName}.${columnName}:`, error);
      return [];
    }
  }

  /**
   * Test sample values against a regex pattern
   */
  private testSamplesAgainstPattern(samples: string[], regexPattern: string): string[] {
    try {
      const regex = new RegExp(regexPattern);
      const matches: string[] = [];

      for (const sample of samples) {
        if (!sample) continue;
        const trimmed = String(sample).trim();
        if (regex.test(trimmed)) {
          matches.push(trimmed);
        }
      }

      return matches;
    } catch (error) {
      logger.warn(`Invalid regex pattern: ${regexPattern}`, error);
      return [];
    }
  }

  /**
   * Create a quality issue for a PII violation
   * Made public so PIIRescanService can call it
   */
  public async createQualityIssueForPIIViolation(violation: PIIViolation): Promise<void> {
    try {
      // Map PII sensitivity to quality severity
      const severity = this.mapSensitivityToSeverity(violation.sensitivityLevel);

      // Check if issue already exists (including resolved ones)
      // Check for both old format (PII Detected: phone) and new format (PII Detected: Phone Number)
      const existingIssue = await this.db.query(`
        SELECT id, status FROM quality_issues
        WHERE asset_id = $1
          AND title LIKE 'PII Detected:%'
          AND (title LIKE $2 OR title LIKE $3)
        ORDER BY created_at DESC
        LIMIT 1
      `, [violation.assetId, `%${violation.piiDisplayName}%`, `%${violation.piiType}%`]);

      const complianceInfo = violation.complianceFlags.length > 0
        ? `\n\nCompliance: ${violation.complianceFlags.join(', ')}`
        : '';

      const sampleInfo = violation.sampleMatches.length > 0
        ? `\n\nSample matches (${violation.matchCount}): ${violation.sampleMatches.join(', ')}`
        : '';

      const description = `Column "${violation.schemaName}.${violation.tableName}.${violation.columnName}" contains ${violation.piiDisplayName}.

${violation.recommendation}${complianceInfo}${sampleInfo}

Sensitivity: ${violation.sensitivityLevel}
Requires Encryption: ${violation.requiresEncryption ? 'Yes' : 'No'}
Requires Masking: ${violation.requiresMasking ? 'Yes' : 'No'}`;

      if (existingIssue.rows.length > 0) {
        const issue = existingIssue.rows[0];

        // Check if this is now monitoring mode (no protection required)
        if (!violation.requiresEncryption && !violation.requiresMasking) {
          // Protection is no longer required - auto-resolve the issue
          await this.db.query(`
            UPDATE quality_issues
            SET
              status = 'resolved',
              resolved_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP,
              last_seen_at = CURRENT_TIMESTAMP,
              description = description || $1
            WHERE id = $2
          `, [
            `\n\n✅ MONITORING MODE ENABLED: Protection requirements have been removed from PII settings.
This column is now in monitoring mode - encryption and masking are no longer required.
The issue has been automatically resolved.`,
            issue.id
          ]);

          logger.info(`AUTO-RESOLVED quality issue #${issue.id} for PII: ${violation.piiType} - monitoring mode enabled (no protection required)`);

          // Update catalog to mark PII type
          await this.updateCatalogColumnPII(violation);
          return; // Exit early
        }

        // If issue was resolved, validate if fix was actually applied
        if (issue.status === 'resolved') {
          // Validate if the PII protection measures are in place
          const validationResult = await this.validator.validatePIIFix({
            dataSourceId: violation.dataSourceId,
            databaseName: violation.databaseName, // Database from catalog_assets
            schemaName: violation.schemaName,
            tableName: violation.tableName,
            columnName: violation.columnName,
            requiresEncryption: violation.requiresEncryption,
            requiresMasking: violation.requiresMasking
          });

          if (!validationResult.isFixed) {
            // Fix was NOT applied - reopen the issue
            await this.db.query(`
              UPDATE quality_issues
              SET
                status = 'open',
                resolved_at = NULL,
                title = $1,
                description = $2,
                updated_at = CURRENT_TIMESTAMP,
                last_seen_at = CURRENT_TIMESTAMP,
                occurrence_count = occurrence_count + 1
              WHERE id = $3
            `, [
              `PII Detected: ${violation.piiDisplayName}`,
              `${description}

⚠️ ISSUE REOPENED: This issue was marked as resolved, but validation failed.
Reason: ${validationResult.reason}
${validationResult.details.sampleData ? `Sample unencrypted data: ${validationResult.details.sampleData.slice(0, 2).join(', ')}` : ''}

Please ensure the column is properly ${violation.requiresEncryption ? 'encrypted' : ''}${violation.requiresEncryption && violation.requiresMasking ? ' and ' : ''}${violation.requiresMasking ? 'masked' : ''}.${this.generateFixProposal(violation)}`,
              issue.id
            ]);

            logger.warn(`Reopened quality issue #${issue.id} for PII: ${violation.piiType} (${violation.piiDisplayName}) - Fix validation failed: ${validationResult.reason}`);
          } else {
            // Fix WAS applied - keep it resolved, just update last_seen_at
            await this.db.query(`
              UPDATE quality_issues
              SET
                last_seen_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
            `, [issue.id]);

            logger.info(`Issue #${issue.id} remains resolved - Fix validation passed: ${validationResult.reason}`);
          }
        } else {
          // Existing open/acknowledged issue - validate if it should still be open
          const validationResult = await this.validator.validatePIIFix({
            dataSourceId: violation.dataSourceId,
            databaseName: violation.databaseName, // Database from catalog_assets
            schemaName: violation.schemaName,
            tableName: violation.tableName,
            columnName: violation.columnName,
            requiresEncryption: violation.requiresEncryption,
            requiresMasking: violation.requiresMasking
          });

          if (!validationResult.isFixed) {
            // Still not fixed - keep issue open, update description
            await this.db.query(`
              UPDATE quality_issues
              SET
                description = $1,
                updated_at = CURRENT_TIMESTAMP,
                last_seen_at = CURRENT_TIMESTAMP,
                occurrence_count = occurrence_count + 1
              WHERE id = $2
            `, [
              `${description}

⚠️ DATA STILL NOT PROTECTED: Latest scan confirms this column still contains unprotected PII data.
${validationResult.details.sampleData ? `Sample unencrypted data: ${validationResult.details.sampleData.slice(0, 2).join(', ')}` : ''}${this.generateFixProposal(violation)}`,
              issue.id
            ]);

            logger.info(`Updated existing quality issue #${issue.id} for PII: ${violation.piiType} - still not protected`);
          } else {
            // Data is now protected! Auto-resolve the issue
            await this.db.query(`
              UPDATE quality_issues
              SET
                status = 'resolved',
                resolved_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP,
                last_seen_at = CURRENT_TIMESTAMP,
                description = $1
              WHERE id = $2
            `, [
              `${description}

✅ DATA NOW PROTECTED: Validation confirms this column is now properly protected.
${validationResult.reason}

This issue has been automatically resolved.`,
              issue.id
            ]);

            logger.info(`AUTO-RESOLVED quality issue #${issue.id} for PII: ${violation.piiType} - ${validationResult.reason}`);
          }
        }
      } else {
        // NEW PII DETECTION: Check if encryption or masking is required
        // If BOTH are false, this is monitoring mode only - no quality issue needed
        if (!violation.requiresEncryption && !violation.requiresMasking) {
          logger.info(`PII detected in MONITORING MODE (no protection required): ${violation.piiType} in ${violation.schemaName}.${violation.tableName}.${violation.columnName}`);
          // Just update catalog to mark PII type, don't create quality issue
          await this.updateCatalogColumnPII(violation);
          return; // Exit early - no quality issue for monitoring mode
        }

        // Validate if data is actually protected BEFORE creating issue
        const validationResult = await this.validator.validatePIIFix({
          dataSourceId: violation.dataSourceId,
          databaseName: violation.databaseName, // Database from catalog_assets
          schemaName: violation.schemaName,
          tableName: violation.tableName,
          columnName: violation.columnName,
          requiresEncryption: violation.requiresEncryption,
          requiresMasking: violation.requiresMasking
        });

        // Only create an issue if data is NOT protected
        if (!validationResult.isFixed) {
          // Get or create a PII quality rule
          const ruleId = await this.getOrCreatePIIQualityRule(violation.piiType, violation.piiDisplayName);

          // Create new issue - data is not protected
          await this.db.query(`
            INSERT INTO quality_issues (
              rule_id,
              asset_id,
              data_source_id,
              severity,
              dimension,
              status,
              title,
              description,
              sample_data,
              affected_rows,
              created_at,
              updated_at,
              first_seen_at,
              last_seen_at
            ) VALUES (
              $1, $2, $3, $4, $5, 'open', $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
            )
          `, [
            ruleId,
            violation.assetId,
            violation.dataSourceId,
            severity,
            'privacy', // PII issues are privacy dimension
            `PII Detected: ${violation.piiDisplayName}`,
            `${description}

⚠️ DATA NOT PROTECTED: Validation shows this column contains unprotected PII data.
${validationResult.details.sampleData ? `Sample unencrypted data: ${validationResult.details.sampleData.slice(0, 2).join(', ')}` : ''}

Action Required: Please ${violation.requiresEncryption ? 'encrypt' : ''}${violation.requiresEncryption && violation.requiresMasking ? ' and ' : ''}${violation.requiresMasking ? 'mask' : ''} this column.${this.generateFixProposal(violation)}`,
            JSON.stringify({
              piiType: violation.piiType,
              sensitivityLevel: violation.sensitivityLevel,
              matchCount: violation.matchCount,
              sampleMatches: violation.sampleMatches,
              requiresEncryption: violation.requiresEncryption,
              requiresMasking: violation.requiresMasking,
              complianceFlags: violation.complianceFlags,
              validationFailed: true,
              validationReason: validationResult.reason
            }),
            violation.matchCount
          ]);

          logger.warn(`Created quality issue for UNPROTECTED PII: ${violation.piiType} in ${violation.schemaName}.${violation.tableName}.${violation.columnName} - ${validationResult.reason}`);
        } else {
          // Data IS protected - no need to create an issue
          logger.info(`PII detected but data is PROTECTED: ${violation.piiType} in ${violation.schemaName}.${violation.tableName}.${violation.columnName} - ${validationResult.reason}`);
        }
      }

      // Update catalog_columns to mark the PII type
      await this.updateCatalogColumnPII(violation);
    } catch (error) {
      logger.error('Error creating quality issue for PII violation:', error);
    }
  }

  /**
   * Generate SQL fix proposal for PII protection
   */
  private generateFixProposal(violation: PIIViolation): string {
    const { schemaName, tableName, columnName, requiresEncryption, requiresMasking, piiType } = violation;

    let proposal = '\n\n📋 FIX PROPOSAL:\n';
    proposal += '─────────────────────────────────────────────────────────\n';

    if (requiresEncryption && requiresMasking) {
      proposal += '\n✓ Step 1: Encrypt the column data\n';
      proposal += '```sql\n';
      proposal += `-- Encrypt ${columnName} using pgcrypto extension\n`;
      proposal += `-- First, ensure pgcrypto extension is enabled:\n`;
      proposal += `CREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n`;
      proposal += `-- Create backup column\n`;
      proposal += `ALTER TABLE ${schemaName}.${tableName} ADD COLUMN ${columnName}_backup TEXT;\n`;
      proposal += `UPDATE ${schemaName}.${tableName} SET ${columnName}_backup = ${columnName};\n\n`;
      proposal += `-- Encrypt the data\n`;
      proposal += `UPDATE ${schemaName}.${tableName}\n`;
      proposal += `SET ${columnName} = encode(encrypt(${columnName}::bytea, 'your-encryption-key', 'aes'), 'base64')\n`;
      proposal += `WHERE ${columnName} IS NOT NULL;\n`;
      proposal += '```\n\n';

      proposal += '✓ Step 2: Apply UI masking\n';
      proposal += `Add masking rule in frontend for column: ${columnName}\n`;
      proposal += `Pattern: ${this.getMaskingPattern(piiType)}\n`;

    } else if (requiresEncryption) {
      proposal += '\n✓ Apply encryption to this column\n';
      proposal += '```sql\n';
      proposal += `-- Encrypt ${columnName} using pgcrypto extension\n`;
      proposal += `CREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n`;
      proposal += `UPDATE ${schemaName}.${tableName}\n`;
      proposal += `SET ${columnName} = encode(encrypt(${columnName}::bytea, 'your-encryption-key', 'aes'), 'base64')\n`;
      proposal += `WHERE ${columnName} IS NOT NULL;\n`;
      proposal += '```\n';

    } else if (requiresMasking) {
      proposal += '\n✓ Apply UI masking for this column\n';
      proposal += `Column: ${schemaName}.${tableName}.${columnName}\n`;
      proposal += `Masking Pattern: ${this.getMaskingPattern(piiType)}\n`;
      proposal += `\nImplement in frontend to display as: ${this.getMaskingExample(piiType)}\n`;
    }

    proposal += '\n⚠️  IMPORTANT:\n';
    proposal += '• Test the encryption/masking on a backup first\n';
    proposal += '• Update application code to decrypt data when needed\n';
    proposal += '• Verify compliance with your data protection policies\n';
    proposal += '─────────────────────────────────────────────────────────\n';

    return proposal;
  }

  /**
   * Get masking pattern for PII type
   */
  private getMaskingPattern(piiType: string): string {
    const patterns: { [key: string]: string } = {
      'email': 'x***@***.com',
      'phone': '***-***-####',
      'ssn': '***-**-####',
      'credit_card': '****-****-****-####',
      'name': 'X***',
      'address': '*** *** ***',
      'date_of_birth': '****-**-##',
      'ip_address': '***.***.***.###',
      'passport': '***####',
      'drivers_license': '***####'
    };
    return patterns[piiType] || '***';
  }

  /**
   * Get masking example for PII type
   */
  private getMaskingExample(piiType: string): string {
    const examples: { [key: string]: string } = {
      'email': 'j***n@e***l.com',
      'phone': '555-***-1234',
      'ssn': '***-**-5678',
      'credit_card': '****-****-****-4532',
      'name': 'J***',
      'address': '123 Main St → *** *** ***',
      'date_of_birth': '1990-05-15 → ****-**-15',
      'ip_address': '192.168.1.100 → ***.***.***.100',
      'passport': 'AB1234567 → ***4567',
      'drivers_license': 'D1234567 → ***4567'
    };
    return examples[piiType] || '***';
  }

  /**
   * Get or create a quality rule for PII detection
   */
  private async getOrCreatePIIQualityRule(piiType: string, displayName: string): Promise<string> {
    // Check if rule exists
    const existing = await this.db.query(`
      SELECT id FROM quality_rules
      WHERE name = $1
      LIMIT 1
    `, [`PII Detection: ${displayName}`]);

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }

    // Create new rule using actual quality_rules schema
    const result = await this.db.query(`
      INSERT INTO quality_rules (
        name,
        description,
        dimension,
        severity,
        type,
        dialect,
        expression,
        rule_type,
        rule_config,
        tags,
        enabled,
        auto_generated
      ) VALUES (
        $1, $2, 'validity', 'high', 'sql', 'postgres', 'SELECT 1 WHERE 1=0', 'validation', $3, $4, true, true
      )
      RETURNING id
    `, [
      `PII Detection: ${displayName}`,
      `Automatically detects ${displayName} in data columns`,
      JSON.stringify({
        piiType,
        automated: true,
        source: 'pii_rule_definitions'
      }),
      ['pii', 'privacy', piiType]
    ]);

    logger.info(`Created quality rule for PII type: ${piiType}`);
    return result.rows[0].id;
  }

  /**
   * Update catalog_columns table to mark PII type
   */
  private async updateCatalogColumnPII(violation: PIIViolation): Promise<void> {
    try {
      await this.db.query(`
        UPDATE catalog_columns
        SET
          pii_type = $1,
          data_classification = $1,
          is_sensitive = true,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [violation.piiType, violation.columnId]);

      logger.info(`Updated catalog column ${violation.columnId} with PII type: ${violation.piiType}`);
    } catch (error) {
      logger.error('Error updating catalog column PII:', error);
    }
  }

  /**
   * Map PII sensitivity level to quality severity
   */
  private mapSensitivityToSeverity(sensitivityLevel: string): string {
    const mapping: {[key: string]: string} = {
      'critical': 'critical',
      'high': 'high',
      'medium': 'medium',
      'low': 'low'
    };
    return mapping[sensitivityLevel] || 'medium';
  }

  /**
   * Get recommendation based on PII rule
   */
  private getRecommendation(rule: PIIRuleDefinition): string {
    const actions: string[] = [];

    if (rule.requiresEncryption) {
      actions.push('⚠️ ENCRYPT this column immediately');
    }
    if (rule.requiresMasking) {
      actions.push('🔒 MASK in UI displays');
    }
    if (rule.complianceFlags.length > 0) {
      actions.push(`📋 Compliance: ${rule.complianceFlags.join(', ')}`);
    }

    return actions.join('. ');
  }

  /**
   * Create empty scan result
   */
  private createEmptyResult(dataSourceId: string, startTime: number): PIIScanResult {
    return {
      dataSourceId,
      totalColumns: 0,
      violationsFound: 0,
      criticalViolations: 0,
      highViolations: 0,
      mediumViolations: 0,
      lowViolations: 0,
      violations: [],
      duration: Date.now() - startTime
    };
  }
}
