// PII Rescan Service - Re-classifies data when rules change
import { Pool } from 'pg';
import { PIIQualityIntegration, PIIViolation } from './PIIQualityIntegration';

export class PIIRescanService {
  private piiQualityIntegration: PIIQualityIntegration;

  constructor(private pool: Pool) {
    this.piiQualityIntegration = new PIIQualityIntegration(pool);
  }

  /**
   * Create quality issue for a PII column using PIIQualityIntegration
   * This is called after marking a column as PII
   * Now uses smart validation - only creates issue if data is NOT encrypted
   */
  private async createQualityIssueForPII(
    columnId: string,
    assetId: string,
    dataSourceId: string,
    databaseName: string,
    schemaName: string,
    tableName: string,
    columnName: string,
    piiType: string,
    piiDisplayName: string,
    requiresEncryption: boolean,
    requiresMasking: boolean,
    sensitivityLevel: string
  ): Promise<void> {
    try {
      // Create PIIViolation object for PIIQualityIntegration
      const violation: PIIViolation = {
        columnId,
        assetId: String(assetId),
        dataSourceId,
        databaseName,
        schemaName,
        tableName,
        columnName,
        piiType,
        piiDisplayName,
        sensitivityLevel,
        matchCount: 1,
        sampleMatches: [],
        complianceFlags: [],
        requiresEncryption,
        requiresMasking,
        recommendation: requiresEncryption
          ? 'Apply encryption to this column immediately'
          : 'Consider masking this field in UI displays',
      };

      // Use PIIQualityIntegration to create issue with validation
      // It will check if data is actually encrypted before creating issue
      await this.piiQualityIntegration.createQualityIssueForPIIViolation(violation);

      console.log(`✅ Processed PII quality issue for: ${piiType} in ${tableName}.${columnName}`);
    } catch (error) {
      console.error('Error creating quality issue for PII:', error);
    }
  }

  /**
   * Get impact of a rule change - how many columns would be affected
   */
  async getRuleImpact(piiType: string): Promise<{
    affectedColumns: number;
    affectedTables: number;
    affectedDataSources: number;
    sampleColumns: Array<{
      column_name: string;
      table_name: string;
      schema_name: string;
      database_name: string;
      data_source_name: string;
    }>;
  }> {
    try {
      // Count columns currently classified with this PII type
      const { rows: countRows } = await this.pool.query(
        `SELECT COUNT(DISTINCT cc.id) as column_count,
                COUNT(DISTINCT ca.id) as table_count,
                COUNT(DISTINCT ca.datasource_id) as datasource_count
         FROM catalog_columns cc
         JOIN catalog_assets ca ON ca.id = cc.asset_id
         WHERE cc.pii_type = $1 OR cc.data_classification = $1`,
        [piiType]
      );

      // Get sample columns for preview
      const { rows: sampleRows } = await this.pool.query(
        `SELECT
          cc.column_name,
          ca.table_name,
          ca.schema_name,
          ca.database_name,
          ds.name as data_source_name
         FROM catalog_columns cc
         JOIN catalog_assets ca ON ca.id = cc.asset_id
         LEFT JOIN data_sources ds ON ds.id::text = ca.datasource_id::text
         WHERE cc.pii_type = $1 OR cc.data_classification = $1
         LIMIT 10`,
        [piiType]
      );

      return {
        affectedColumns: parseInt(countRows[0].column_count) || 0,
        affectedTables: parseInt(countRows[0].table_count) || 0,
        affectedDataSources: parseInt(countRows[0].datasource_count) || 0,
        sampleColumns: sampleRows,
      };
    } catch (error) {
      console.error('Error getting rule impact:', error);
      throw error;
    }
  }

  /**
   * Clear PII classifications for a specific PII type
   */
  async clearPIIClassifications(piiType: string): Promise<number> {
    try {
      const result = await this.pool.query(
        `UPDATE catalog_columns
         SET
           pii_type = NULL,
           data_classification = NULL,
           is_sensitive = false,
           updated_at = CURRENT_TIMESTAMP
         WHERE pii_type = $1 OR data_classification = $1
         RETURNING id`,
        [piiType]
      );

      console.log(`Cleared PII classifications for ${result.rowCount} columns (type: ${piiType})`);
      return result.rowCount || 0;
    } catch (error) {
      console.error('Error clearing PII classifications:', error);
      throw error;
    }
  }

  /**
   * Re-scan all data sources using a specific PII rule
   * This applies the rule's regex pattern and column hints to existing data
   */
  async rescanWithRule(ruleId: number): Promise<{
    columnsScanned: number;
    columnsClassified: number;
    tablesAffected: number;
  }> {
    try {
      // Get the rule details
      const { rows: ruleRows } = await this.pool.query(
        `SELECT pii_type, display_name, regex_pattern, column_name_hints, is_enabled
         FROM pii_rule_definitions
         WHERE id = $1`,
        [ruleId]
      );

      if (ruleRows.length === 0) {
        throw new Error(`PII rule ${ruleId} not found`);
      }

      const rule = ruleRows[0];

      if (!rule.is_enabled) {
        console.log(`Rule ${rule.pii_type} is disabled, skipping rescan`);
        return { columnsScanned: 0, columnsClassified: 0, tablesAffected: 0 };
      }

      // Get additional rule properties for quality issue creation
      const { rows: ruleDetailsRows } = await this.pool.query(
        `SELECT requires_encryption, requires_masking, sensitivity_level
         FROM pii_rule_definitions
         WHERE id = $1`,
        [ruleId]
      );

      const requiresEncryption = ruleDetailsRows[0]?.requires_encryption || false;
      const requiresMasking = ruleDetailsRows[0]?.requires_masking || false;
      const sensitivityLevel = ruleDetailsRows[0]?.sensitivity_level || 'medium';

      let columnsClassified = 0;
      const affectedTables = new Set<string>();

      // Step 1: Find columns that match column name hints
      if (rule.column_name_hints && rule.column_name_hints.length > 0) {
        // Use EXACT case-insensitive matching only
        // If hint is "FirstName", only match columns named exactly "firstname" (case-insensitive)
        // This prevents false positives like "First_Name_Suffix" matching "FirstName"
        const hintsCondition = rule.column_name_hints
          .map((hint: string, idx: number) => `LOWER(cc.column_name) = LOWER($${idx + 2})`)
          .join(' OR ');

        const hintsQuery = `
          SELECT
            cc.id,
            cc.column_name,
            ca.id as asset_id,
            ca.datasource_id,
            ca.database_name,
            ca.schema_name,
            ca.table_name
          FROM catalog_columns cc
          JOIN catalog_assets ca ON ca.id = cc.asset_id
          WHERE (${hintsCondition})
            AND (cc.pii_type IS NULL OR cc.pii_type != $1)
            AND ca.database_name NOT IN ('cwic_platform', 'master', 'sys', 'information_schema', 'pg_catalog', 'msdb', 'tempdb', 'model')
        `;

        // Use exact column name matching (case-insensitive)
        // No regex patterns, no word boundaries - just exact matches
        const hintsParams = [
          rule.pii_type,
          ...rule.column_name_hints,
        ];

        const { rows: matchingColumns } = await this.pool.query(hintsQuery, hintsParams);

        // Get exclusions for this rule to filter out false positives
        const { rows: exclusions } = await this.pool.query(
          `SELECT exclusion_type, column_name, table_name, schema_name, database_name, pattern
           FROM pii_exclusions
           WHERE pii_rule_id = (SELECT id FROM pii_rule_definitions WHERE pii_type = $1 LIMIT 1)`,
          [rule.pii_type]
        );

        // Classify these columns (skipping excluded ones)
        for (const col of matchingColumns) {
          // Check if this column is excluded
          const isExcluded = exclusions.some(excl => {
            if (excl.exclusion_type === 'exact_column') {
              // Match any column with this exact name (any table)
              return excl.column_name.toLowerCase() === col.column_name.toLowerCase();
            } else if (excl.exclusion_type === 'table_column') {
              // Match specific table + column combination
              return (
                excl.column_name.toLowerCase() === col.column_name.toLowerCase() &&
                (!excl.table_name || excl.table_name.toLowerCase() === col.table_name.toLowerCase()) &&
                (!excl.schema_name || excl.schema_name.toLowerCase() === col.schema_name.toLowerCase()) &&
                (!excl.database_name || excl.database_name.toLowerCase() === col.database_name.toLowerCase())
              );
            } else if (excl.exclusion_type === 'column_pattern' && excl.pattern) {
              // Match regex pattern
              try {
                const regex = new RegExp(excl.pattern, 'i');
                return regex.test(col.column_name);
              } catch {
                return false;
              }
            }
            return false;
          });

          if (isExcluded) {
            console.log(
              `⏭️  Skipping excluded column: ${col.schema_name}.${col.table_name}.${col.column_name} (rule: ${rule.pii_type})`
            );
            continue; // Skip this column
          }

          // Only update if the column doesn't already have this PII type
          const { rowCount } = await this.pool.query(
            `UPDATE catalog_columns
             SET
               pii_type = $1,
               data_classification = $1,
               is_sensitive = true,
               updated_at = CURRENT_TIMESTAMP
             WHERE id = $2 AND (pii_type IS NULL OR pii_type != $1)`,
            [rule.pii_type, col.id]
          );

          // Only increment counter and create quality issue if column was actually updated
          if (rowCount && rowCount > 0) {
            // Create quality issue for this PII detection
            await this.createQualityIssueForPII(
              col.id,
              col.asset_id,
              col.datasource_id,
              col.database_name,
              col.schema_name,
              col.table_name,
              col.column_name,
              rule.pii_type,
              rule.display_name,
              requiresEncryption,
              requiresMasking,
              sensitivityLevel
            );

            columnsClassified++;
            affectedTables.add(col.asset_id);

            console.log(
              `✅ Classified column ${col.schema_name}.${col.table_name}.${col.column_name} as ${rule.pii_type} (hint match)`
            );
          } else {
            console.log(
              `⏭️  Column ${col.schema_name}.${col.table_name}.${col.column_name} already classified as ${rule.pii_type}`
            );
          }
        }

        console.log(
          `Processed ${matchingColumns.length} columns matching name hints for rule: ${rule.pii_type}`
        );
      }

      // Step 2: Apply regex pattern to sample values (if available)
      if (rule.regex_pattern) {
        try {
          const regex = new RegExp(rule.regex_pattern);

          // Get exclusions for this rule (reuse if already fetched)
          const { rows: exclusions } = await this.pool.query(
            `SELECT exclusion_type, column_name, table_name, schema_name, database_name, pattern
             FROM pii_exclusions
             WHERE pii_rule_id = (SELECT id FROM pii_rule_definitions WHERE pii_type = $1 LIMIT 1)`,
            [rule.pii_type]
          );

          // Get columns with sample values that aren't already classified with this PII type
          const { rows: columnsWithSamples } = await this.pool.query(
            `SELECT
               cc.id,
               cc.column_name,
               cc.sample_values,
               ca.id as asset_id,
               ca.datasource_id,
               ca.database_name,
               ca.schema_name,
               ca.table_name
             FROM catalog_columns cc
             JOIN catalog_assets ca ON ca.id = cc.asset_id
             WHERE cc.sample_values IS NOT NULL
               AND jsonb_array_length(cc.sample_values) > 0
               AND (cc.pii_type IS NULL OR cc.pii_type != $1)
               AND ca.database_name NOT IN ('cwic_platform', 'master', 'sys', 'information_schema', 'pg_catalog', 'msdb', 'tempdb', 'model')
             LIMIT 1000`,
            [rule.pii_type]
          );

          for (const col of columnsWithSamples) {
            // Check if this column is excluded
            const isExcluded = exclusions.some(excl => {
              if (excl.exclusion_type === 'exact_column') {
                return excl.column_name.toLowerCase() === col.column_name.toLowerCase();
              } else if (excl.exclusion_type === 'table_column') {
                return (
                  excl.column_name.toLowerCase() === col.column_name.toLowerCase() &&
                  (!excl.table_name || excl.table_name.toLowerCase() === col.table_name.toLowerCase()) &&
                  (!excl.schema_name || excl.schema_name.toLowerCase() === col.schema_name.toLowerCase()) &&
                  (!excl.database_name || excl.database_name.toLowerCase() === col.database_name.toLowerCase())
                );
              } else if (excl.exclusion_type === 'column_pattern' && excl.pattern) {
                try {
                  const excludeRegex = new RegExp(excl.pattern, 'i');
                  return excludeRegex.test(col.column_name);
                } catch {
                  return false;
                }
              }
              return false;
            });

            if (isExcluded) {
              continue; // Skip excluded columns
            }
            const samples = col.sample_values;

            // Test if any sample values match the pattern
            const matchCount = samples.filter((val: string) => {
              if (!val) return false;
              try {
                return regex.test(String(val));
              } catch {
                return false;
              }
            }).length;

            // If more than 70% of samples match, classify as this PII type
            const matchPercentage = (matchCount / samples.length) * 100;

            if (matchPercentage >= 70) {
              // Only update if the column doesn't already have this PII type
              const { rowCount } = await this.pool.query(
                `UPDATE catalog_columns
                 SET
                   pii_type = $1,
                   data_classification = $1,
                   is_sensitive = true,
                   updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2 AND (pii_type IS NULL OR pii_type != $1)`,
                [rule.pii_type, col.id]
              );

              // Only increment counter and create quality issue if column was actually updated
              if (rowCount && rowCount > 0) {
                // Create quality issue for this PII detection
                await this.createQualityIssueForPII(
                  col.id,
                  col.asset_id,
                  col.datasource_id,
                  col.database_name,
                  col.schema_name,
                  col.table_name,
                  col.column_name,
                  rule.pii_type,
                  rule.display_name,
                  requiresEncryption,
                  requiresMasking,
                  sensitivityLevel
                );

                columnsClassified++;
                affectedTables.add(col.asset_id);

                console.log(
                  `✅ Classified column ${col.column_name} as ${rule.pii_type} (${matchPercentage.toFixed(1)}% regex match)`
                );
              } else {
                console.log(
                  `⏭️  Column ${col.column_name} already classified as ${rule.pii_type} (${matchPercentage.toFixed(1)}% match, skipped)`
                );
              }
            }
          }
        } catch (regexError) {
          console.error(`Invalid regex pattern for rule ${rule.pii_type}:`, regexError);
        }
      }

      // Update pii_detected flag on affected assets
      if (affectedTables.size > 0) {
        const assetIds = Array.from(affectedTables);
        await this.pool.query(
          `UPDATE catalog_assets
           SET pii_detected = true, updated_at = CURRENT_TIMESTAMP
           WHERE id = ANY($1::bigint[])`,
          [assetIds]
        );
        console.log(`✓ Updated pii_detected flag for ${affectedTables.size} assets`);
      }

      console.log(`Rescan complete for rule ${rule.pii_type}:`);
      console.log(`- Columns classified: ${columnsClassified}`);
      console.log(`- Tables affected: ${affectedTables.size}`);

      return {
        columnsScanned: columnsClassified, // Simplified for now
        columnsClassified,
        tablesAffected: affectedTables.size,
      };
    } catch (error) {
      console.error('Error rescanning with rule:', error);
      throw error;
    }
  }

  /**
   * Re-scan all columns for all enabled PII rules
   * This is a full system-wide rescan
   */
  async rescanAllRules(): Promise<{
    rulesApplied: number;
    totalColumnsClassified: number;
    totalTablesAffected: number;
    ruleResults: Array<{
      pii_type: string;
      display_name: string;
      columnsClassified: number;
      tablesAffected: number;
    }>;
  }> {
    try {
      console.log('Starting full PII rescan...');

      // Get all enabled rules
      const { rows: rules } = await this.pool.query(
        `SELECT id, pii_type, display_name
         FROM pii_rule_definitions
         WHERE is_enabled = true
         ORDER BY
           CASE sensitivity_level
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'medium' THEN 3
             ELSE 4
           END`
      );

      let totalColumnsClassified = 0;
      const allAffectedTables = new Set<string>();
      const ruleResults = [];

      for (const rule of rules) {
        console.log(`Applying rule: ${rule.pii_type}...`);
        const result = await this.rescanWithRule(rule.id);

        totalColumnsClassified += result.columnsClassified;

        // Track unique tables across all rules
        const { rows: ruleTables } = await this.pool.query(
          `SELECT DISTINCT ca.id
           FROM catalog_columns cc
           JOIN catalog_assets ca ON ca.id = cc.asset_id
           WHERE cc.pii_type = $1`,
          [rule.pii_type]
        );

        ruleTables.forEach(t => allAffectedTables.add(t.id));

        ruleResults.push({
          pii_type: rule.pii_type,
          display_name: rule.display_name,
          columnsClassified: result.columnsClassified,
          tablesAffected: result.tablesAffected
        });
      }

      console.log('Full PII rescan complete:');
      console.log(`- Rules applied: ${rules.length}`);
      console.log(`- Total columns classified: ${totalColumnsClassified}`);
      console.log(`- Total tables affected: ${allAffectedTables.size}`);

      return {
        rulesApplied: rules.length,
        totalColumnsClassified,
        totalTablesAffected: allAffectedTables.size,
        ruleResults,
      };
    } catch (error) {
      console.error('Error in full rescan:', error);
      throw error;
    }
  }

  /**
   * Re-scan a specific data source
   */
  async rescanDataSource(dataSourceId: string): Promise<{
    columnsScanned: number;
    columnsClassified: number;
  }> {
    try {
      console.log(`Starting PII rescan for data source: ${dataSourceId}`);

      // Clear existing PII classifications for this data source
      await this.pool.query(
        `UPDATE catalog_columns cc
         SET
           pii_type = NULL,
           data_classification = NULL,
           is_sensitive = false,
           updated_at = CURRENT_TIMESTAMP
         FROM catalog_assets ca
         WHERE ca.id = cc.asset_id
           AND ca.datasource_id::text = $1
           AND cc.pii_type IS NOT NULL`,
        [dataSourceId]
      );

      // Re-apply all enabled rules
      const result = await this.rescanAllRules();

      return {
        columnsScanned: result.totalColumnsClassified,
        columnsClassified: result.totalColumnsClassified,
      };
    } catch (error) {
      console.error('Error rescanning data source:', error);
      throw error;
    }
  }
}

export default PIIRescanService;
