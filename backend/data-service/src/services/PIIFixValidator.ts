import { Pool } from 'pg';
import { logger } from '../utils/logger';

/**
 * PIIFixValidator
 *
 * Validates whether PII issues have been actually fixed by checking:
 * 1. If column data is encrypted in the database
 * 2. If column has masking configuration
 *
 * This prevents false "resolved" states where users claim they fixed
 * the issue but the column is still unencrypted/unmasked.
 */

export interface PIIFixValidationResult {
  isFixed: boolean;
  reason: string;
  details: {
    isEncrypted?: boolean;
    isMasked?: boolean;
    sampleData?: string[];
    validationMethod?: string;
  };
}

export interface ColumnInfo {
  dataSourceId: string;
  databaseName: string; // Added: database name from catalog_assets
  schemaName: string;
  tableName: string;
  columnName: string;
  requiresEncryption: boolean;
  requiresMasking: boolean;
}

export class PIIFixValidator {
  constructor(private pool: Pool) {}

  /**
   * Validates if a PII issue has been fixed
   *
   * @param columnInfo - Information about the column
   * @returns Validation result indicating if fix was applied
   */
  async validatePIIFix(columnInfo: ColumnInfo): Promise<PIIFixValidationResult> {
    try {
      const { dataSourceId, databaseName, schemaName, tableName, columnName, requiresEncryption, requiresMasking } = columnInfo;

      // Get data source connection info (server-level: host, port, username, password)
      const { rows: dsRows } = await this.pool.query(
        `SELECT host, port, username, password_encrypted, connection_config FROM data_sources WHERE id = $1`,
        [dataSourceId]
      );

      if (dsRows.length === 0) {
        return {
          isFixed: false,
          reason: 'Data source not found',
          details: { validationMethod: 'none' }
        };
      }

      const dataSource = dsRows[0];

      // Check if column is encrypted
      if (requiresEncryption) {
        const encryptionResult = await this.checkColumnEncryption(
          dataSource,
          databaseName, // Pass database name from catalog_assets
          schemaName,
          tableName,
          columnName
        );

        if (!encryptionResult.isEncrypted) {
          return {
            isFixed: false,
            reason: 'Column is not encrypted in database',
            details: {
              isEncrypted: false,
              sampleData: encryptionResult.sampleData,
              validationMethod: 'database_scan'
            }
          };
        }
      }

      // Check if masking is configured
      if (requiresMasking) {
        const maskingResult = await this.checkMaskingConfiguration(
          columnInfo
        );

        if (!maskingResult.isMasked) {
          return {
            isFixed: false,
            reason: 'Column does not have masking configuration',
            details: {
              isMasked: false,
              validationMethod: 'config_check'
            }
          };
        }
      }

      // All validations passed
      return {
        isFixed: true,
        reason: 'All PII protection measures are in place',
        details: {
          isEncrypted: requiresEncryption ? true : undefined,
          isMasked: requiresMasking ? true : undefined,
          validationMethod: 'comprehensive'
        }
      };

    } catch (error) {
      logger.error('[PIIFixValidator] Error validating PII fix:', error);
      return {
        isFixed: false,
        reason: 'Validation failed due to error',
        details: { validationMethod: 'error' }
      };
    }
  }

  /**
   * Checks if column data is encrypted in the database
   *
   * Strategy:
   * 1. Sample 10 random rows from the column
   * 2. Check if data appears to be encrypted (base64, hex, binary, etc.)
   * 3. If all samples look encrypted → likely encrypted
   * 4. If samples contain readable text → not encrypted
   */
  private async checkColumnEncryption(
    dataSource: any,
    databaseName: string, // Database name from catalog_assets
    schemaName: string,
    tableName: string,
    columnName: string
  ): Promise<{ isEncrypted: boolean; sampleData: string[] }> {
    try {
      // Build connection config from server-level data source + specific database
      const config = {
        host: dataSource.host,
        port: dataSource.port,
        user: dataSource.username,
        password: dataSource.password_encrypted, // TODO: decrypt if encrypted
        database: databaseName, // Use database from catalog_assets
        ssl: dataSource.connection_config?.ssl || false
      };

      // Create a temporary pool for this specific database
      const targetPool = new Pool(config);

      try {
        // Sample 10 rows from the column
        const sampleQuery = `
          SELECT "${columnName}"::TEXT as value
          FROM "${schemaName}"."${tableName}"
          WHERE "${columnName}" IS NOT NULL
          ORDER BY RANDOM()
          LIMIT 10
        `;

        const { rows } = await targetPool.query(sampleQuery);

        if (rows.length === 0) {
          // No data to validate - assume not encrypted
          return { isEncrypted: false, sampleData: [] };
        }

        const sampleData = rows.map(r => r.value);

        // Check if data looks encrypted
        const encryptedCount = sampleData.filter(value =>
          this.looksEncrypted(value)
        ).length;

        // If 80% or more of samples look encrypted, consider it encrypted
        const isEncrypted = encryptedCount >= (sampleData.length * 0.8);

        return {
          isEncrypted,
          sampleData: sampleData.slice(0, 3) // Return first 3 samples
        };

      } finally {
        await targetPool.end();
      }

    } catch (error) {
      logger.error('[PIIFixValidator] Error checking column encryption:', error);
      return { isEncrypted: false, sampleData: [] };
    }
  }

  /**
   * Checks if data looks encrypted
   *
   * Heuristics:
   * - Base64 encoded (e.g., "Zm9vYmFy")
   * - Hex encoded (e.g., "48656c6c6f")
   * - Starts with encryption prefix (e.g., "ENC:", "ENCRYPTED:")
   * - Contains mostly non-printable characters
   * - High entropy (random-looking data)
   */
  private looksEncrypted(value: string): boolean {
    if (!value || value.length === 0) {
      return false;
    }

    // Check for encryption prefixes
    const encryptionPrefixes = ['ENC:', 'ENCRYPTED:', 'AES:', 'RSA:'];
    if (encryptionPrefixes.some(prefix => value.startsWith(prefix))) {
      return true;
    }

    // Check if it's base64 encoded (length divisible by 4, only contains base64 chars)
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (value.length % 4 === 0 && base64Regex.test(value) && value.length > 20) {
      return true;
    }

    // Check if it's hex encoded (only contains hex chars, even length)
    const hexRegex = /^[0-9a-fA-F]+$/;
    if (value.length % 2 === 0 && hexRegex.test(value) && value.length > 20) {
      return true;
    }

    // Check entropy - encrypted data has high entropy
    const entropy = this.calculateEntropy(value);
    if (entropy > 4.5) { // High entropy threshold
      return true;
    }

    return false;
  }

  /**
   * Calculates Shannon entropy of a string
   * High entropy (>4.5) indicates random/encrypted data
   */
  private calculateEntropy(str: string): number {
    const len = str.length;
    const frequencies: { [key: string]: number } = {};

    // Count character frequencies
    for (let i = 0; i < len; i++) {
      const char = str[i];
      frequencies[char] = (frequencies[char] || 0) + 1;
    }

    // Calculate entropy
    let entropy = 0;
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      entropy -= p * Math.log2(p);
    }

    return entropy;
  }

  /**
   * Checks if masking is configured for a column
   *
   * Looks for masking configuration in:
   * 1. Column metadata in catalog_columns
   * 2. Data source masking rules
   */
  private async checkMaskingConfiguration(
    columnInfo: ColumnInfo
  ): Promise<{ isMasked: boolean }> {
    try {
      // Check if column has masking configuration in catalog
      const { rows } = await this.pool.query(`
        SELECT
          cc.profile_json,
          ca.id
        FROM catalog_columns cc
        JOIN catalog_assets ca ON ca.id = cc.asset_id
        WHERE ca.datasource_id = $1
          AND ca.schema_name = $2
          AND ca.table_name = $3
          AND cc.column_name = $4
        LIMIT 1
      `, [
        columnInfo.dataSourceId,
        columnInfo.schemaName,
        columnInfo.tableName,
        columnInfo.columnName
      ]);

      if (rows.length === 0) {
        return { isMasked: false };
      }

      const profileJson = rows[0].profile_json;

      // Check if profile_json contains masking configuration
      if (profileJson && typeof profileJson === 'object') {
        if (profileJson.masking_enabled === true || profileJson.mask_in_ui === true) {
          return { isMasked: true };
        }
      }

      // For now, we'll assume masking needs to be explicitly configured
      // In a real implementation, you'd check:
      // - API layer masking rules
      // - Database views that mask data
      // - Application-level masking configuration
      return { isMasked: false };

    } catch (error) {
      logger.error('[PIIFixValidator] Error checking masking configuration:', error);
      return { isMasked: false };
    }
  }

  /**
   * Parses PostgreSQL connection string into config object
   */
  private parseConnectionString(connStr: string): any {
    // Format: postgresql://user:password@host:port/database
    const match = connStr.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);

    if (!match) {
      throw new Error('Invalid connection string format');
    }

    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: parseInt(match[4]),
      database: match[5]
    };
  }

  /**
   * Batch validates multiple PII issues
   * Returns map of issueId -> validation result
   */
  async batchValidate(issues: Array<{ id: string; columnInfo: ColumnInfo }>): Promise<Map<string, PIIFixValidationResult>> {
    const results = new Map<string, PIIFixValidationResult>();

    for (const issue of issues) {
      const result = await this.validatePIIFix(issue.columnInfo);
      results.set(issue.id, result);
    }

    return results;
  }
}

export default PIIFixValidator;
