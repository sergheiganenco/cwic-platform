/**
 * Data Sampling Service
 * Safely sample and preview data with automatic PII masking
 */

import { Pool } from 'pg';
import { EnhancedPIIDetection, PIIType, SensitivityLevel } from './EnhancedPIIDetection';

export interface DataSample {
  columnName: string;
  dataType: string;
  sampleValues: any[];
  maskedValues: string[];
  hasPII: boolean;
  piiType: PIIType | null;
  sensitivity: SensitivityLevel | null;
  totalRows: number;
  nullCount: number;
  distinctCount: number;
  min?: any;
  max?: any;
  avg?: number;
}

export interface ColumnIssueDetail {
  columnName: string;
  issueType: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedRows: number;
  sampleData: {
    original: any[];
    masked: string[];
  };
  fixScript: string;
  recommendation: string;
}

export class DataSamplingService {
  private pool: Pool;
  private piiDetection: EnhancedPIIDetection;

  constructor(pool: Pool) {
    this.pool = pool;
    this.piiDetection = new EnhancedPIIDetection(pool);
  }

  /**
   * Sample data from a column with automatic PII masking
   */
  public async sampleColumn(
    schema: string,
    table: string,
    column: string,
    sampleSize: number = 10,
    maskPII: boolean = true
  ): Promise<DataSample> {
    try {
      // Get column stats
      const stats = await this.getColumnStats(schema, table, column);

      // Sample values
      const samples = await this.getSampleValues(schema, table, column, sampleSize);

      // Detect PII
      const piiResult = await this.piiDetection.detectPIIInColumn(
        'local',
        schema,
        table,
        column,
        50
      );

      // Mask values if PII detected and masking enabled
      const maskedValues = maskPII && piiResult.piiType
        ? samples.map(v => this.maskValue(v, piiResult.piiType!))
        : samples.map(v => String(v));

      return {
        columnName: column,
        dataType: stats.dataType,
        sampleValues: samples,
        maskedValues,
        hasPII: piiResult.piiType !== null,
        piiType: piiResult.piiType,
        sensitivity: piiResult.sensitivity,
        totalRows: stats.totalRows,
        nullCount: stats.nullCount,
        distinctCount: stats.distinctCount,
        min: stats.min,
        max: stats.max,
        avg: stats.avg
      };
    } catch (error: any) {
      console.error('Error sampling column:', error);
      throw error;
    }
  }

  /**
   * Get detailed information about column issues with sample data
   */
  public async getColumnIssueDetails(
    schema: string,
    table: string,
    column: string,
    issueType: string
  ): Promise<ColumnIssueDetail | null> {
    try {
      const issue = await this.identifyIssue(schema, table, column, issueType);

      if (!issue) return null;

      // Get sample data showing the issue
      const sampleData = await this.getSampleIssueData(schema, table, column, issueType);

      // Detect PII for masking
      const piiResult = await this.piiDetection.detectPIIInColumn(
        'local',
        schema,
        table,
        column,
        20
      );

      const maskedSamples = piiResult.piiType
        ? sampleData.map(v => this.maskValue(v, piiResult.piiType!))
        : sampleData.map(v => String(v));

      return {
        columnName: column,
        issueType,
        severity: issue.severity,
        description: issue.description,
        affectedRows: issue.affectedRows,
        sampleData: {
          original: sampleData,
          masked: maskedSamples
        },
        fixScript: this.generateFixScript(schema, table, column, issueType, issue),
        recommendation: issue.recommendation
      };
    } catch (error: any) {
      console.error('Error getting column issue details:', error);
      return null;
    }
  }

  /**
   * Get column statistics
   */
  private async getColumnStats(schema: string, table: string, column: string): Promise<any> {
    const query = `
      WITH stats AS (
        SELECT
          COUNT(*) as total_rows,
          COUNT("${column}") as non_null_count,
          COUNT(DISTINCT "${column}") as distinct_count,
          pg_typeof("${column}")::text as data_type,
          MIN("${column}") as min_value,
          MAX("${column}") as max_value,
          AVG(CASE WHEN pg_typeof("${column}")::text IN ('integer', 'bigint', 'numeric', 'real', 'double precision')
            THEN "${column}"::numeric ELSE NULL END) as avg_value
        FROM "${schema}"."${table}"
      )
      SELECT * FROM stats
    `;

    const result = await this.pool.query(query);
    const row = result.rows[0];

    return {
      dataType: row.data_type,
      totalRows: parseInt(row.total_rows),
      nullCount: parseInt(row.total_rows) - parseInt(row.non_null_count),
      distinctCount: parseInt(row.distinct_count),
      min: row.min_value,
      max: row.max_value,
      avg: row.avg_value ? parseFloat(row.avg_value) : null
    };
  }

  /**
   * Get sample values from a column
   */
  private async getSampleValues(
    schema: string,
    table: string,
    column: string,
    limit: number
  ): Promise<any[]> {
    const query = `
      SELECT "${column}"
      FROM "${schema}"."${table}"
      WHERE "${column}" IS NOT NULL
      ORDER BY RANDOM()
      LIMIT $1
    `;

    const result = await this.pool.query(query, [limit]);
    return result.rows.map(row => row[column]);
  }

  /**
   * Get sample data that demonstrates an issue
   */
  private async getSampleIssueData(
    schema: string,
    table: string,
    column: string,
    issueType: string
  ): Promise<any[]> {
    let query = '';

    switch (issueType) {
      case 'null_values':
        query = `
          SELECT "${column}"
          FROM "${schema}"."${table}"
          WHERE "${column}" IS NULL
          LIMIT 10
        `;
        break;

      case 'duplicate_values':
        query = `
          SELECT "${column}", COUNT(*) as count
          FROM "${schema}"."${table}"
          WHERE "${column}" IS NOT NULL
          GROUP BY "${column}"
          HAVING COUNT(*) > 1
          ORDER BY count DESC
          LIMIT 10
        `;
        break;

      case 'invalid_format':
        // Assuming we have a validation rule
        query = `
          SELECT "${column}"
          FROM "${schema}"."${table}"
          WHERE "${column}" IS NOT NULL
          LIMIT 10
        `;
        break;

      case 'outliers':
        query = `
          WITH stats AS (
            SELECT
              AVG("${column}"::numeric) as mean,
              STDDEV("${column}"::numeric) as stddev
            FROM "${schema}"."${table}"
            WHERE "${column}" IS NOT NULL
          )
          SELECT "${column}"
          FROM "${schema}"."${table}", stats
          WHERE ABS("${column}"::numeric - stats.mean) > 3 * stats.stddev
          LIMIT 10
        `;
        break;

      default:
        query = `
          SELECT "${column}"
          FROM "${schema}"."${table}"
          WHERE "${column}" IS NOT NULL
          LIMIT 10
        `;
    }

    const result = await this.pool.query(query);
    return result.rows.map(row => row[column]);
  }

  /**
   * Identify issue details
   */
  private async identifyIssue(
    schema: string,
    table: string,
    column: string,
    issueType: string
  ): Promise<any> {
    const columnStats = await this.getColumnStats(schema, table, column);

    const issueMap: {[key: string]: any} = {
      'null_values': {
        severity: columnStats.nullCount > columnStats.totalRows * 0.5 ? 'high' : 'medium',
        description: `${columnStats.nullCount} NULL values found (${((columnStats.nullCount / columnStats.totalRows) * 100).toFixed(1)}%)`,
        affectedRows: columnStats.nullCount,
        recommendation: 'Consider adding default values or making column nullable'
      },
      'duplicate_values': {
        severity: 'medium',
        description: `Duplicate values detected in column that should be unique`,
        affectedRows: columnStats.totalRows - columnStats.distinctCount,
        recommendation: 'Review duplicate values and consider adding unique constraint'
      },
      'invalid_format': {
        severity: 'high',
        description: `Values do not match expected format`,
        affectedRows: 0, // Would need specific validation
        recommendation: 'Apply format validation and clean invalid data'
      },
      'outliers': {
        severity: 'low',
        description: `Statistical outliers detected (>3 standard deviations)`,
        affectedRows: 0, // Would need calculation
        recommendation: 'Review outliers for data entry errors'
      },
      'pii_unencrypted': {
        severity: 'critical',
        description: `PII data is not encrypted`,
        affectedRows: columnStats.totalRows - columnStats.nullCount,
        recommendation: 'Encrypt this column immediately to comply with regulations'
      }
    };

    return issueMap[issueType] || null;
  }

  /**
   * Generate SQL fix script for an issue
   */
  private generateFixScript(
    schema: string,
    table: string,
    column: string,
    issueType: string,
    issue: any
  ): string {
    const fixes: {[key: string]: string} = {
      'null_values': `
-- Option 1: Set default value for NULL entries
UPDATE "${schema}"."${table}"
SET "${column}" = '<default_value>'
WHERE "${column}" IS NULL;

-- Option 2: Add NOT NULL constraint (after fixing NULLs)
ALTER TABLE "${schema}"."${table}"
ALTER COLUMN "${column}" SET NOT NULL;
`,

      'duplicate_values': `
-- Find duplicates
SELECT "${column}", COUNT(*) as count
FROM "${schema}"."${table}"
GROUP BY "${column}"
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Remove duplicates (keep first occurrence)
DELETE FROM "${schema}"."${table}" a
USING "${schema}"."${table}" b
WHERE a.ctid > b.ctid
  AND a."${column}" = b."${column}";

-- Add unique constraint
ALTER TABLE "${schema}"."${table}"
ADD CONSTRAINT ${table}_${column}_unique UNIQUE ("${column}");
`,

      'invalid_format': `
-- Identify invalid formats
SELECT "${column}"
FROM "${schema}"."${table}"
WHERE "${column}" !~ '<your_regex_pattern>'
  AND "${column}" IS NOT NULL;

-- Clean invalid data (example: trim whitespace)
UPDATE "${schema}"."${table}"
SET "${column}" = TRIM("${column}")
WHERE "${column}" != TRIM("${column}");
`,

      'outliers': `
-- Identify outliers
WITH stats AS (
  SELECT
    AVG("${column}"::numeric) as mean,
    STDDEV("${column}"::numeric) as stddev
  FROM "${schema}"."${table}"
)
SELECT "${column}"
FROM "${schema}"."${table}", stats
WHERE ABS("${column}"::numeric - stats.mean) > 3 * stats.stddev;

-- Review and correct outliers manually
-- or cap values to acceptable range
`,

      'pii_unencrypted': `
-- Install pgcrypto extension (if not installed)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create encrypted column
ALTER TABLE "${schema}"."${table}"
ADD COLUMN "${column}_encrypted" BYTEA;

-- Encrypt existing data
UPDATE "${schema}"."${table}"
SET "${column}_encrypted" = pgp_sym_encrypt("${column}"::text, 'your-encryption-key')
WHERE "${column}" IS NOT NULL;

-- Drop original column (after verification)
-- ALTER TABLE "${schema}"."${table}" DROP COLUMN "${column}";
-- RENAME encrypted column
-- ALTER TABLE "${schema}"."${table}" RENAME COLUMN "${column}_encrypted" TO "${column}";
`
    };

    return fixes[issueType] || '-- No fix script available for this issue type';
  }

  /**
   * Mask a value based on PII type
   */
  private maskValue(value: any, piiType: PIIType): string {
    if (value === null || value === undefined) return '';

    const str = String(value);

    const maskStrategies: {[key in PIIType]: (v: string) => string} = {
      [PIIType.SSN]: (v) => v.replace(/\d(?=\d{4})/g, '*'),  // ***-**-1234
      [PIIType.CREDIT_CARD]: (v) => v.replace(/\d(?=\d{4})/g, '*'),  // ****-****-****-1234
      [PIIType.EMAIL]: (v) => {
        const [user, domain] = v.split('@');
        return user.length > 2
          ? `${user[0]}***${user[user.length-1]}@${domain}`
          : `***@${domain}`;
      },
      [PIIType.PHONE]: (v) => v.replace(/\d(?=\d{4})/g, '*'),  // ***-***-1234
      [PIIType.IP_ADDRESS]: (v) => v.replace(/\d+/g, (match, offset, string) => {
        const parts = string.split('.');
        const index = string.substring(0, offset).split('.').length - 1;
        return index < 2 ? match : '***';  // Show first two octets
      }),
      [PIIType.NAME]: (v) => {
        const parts = v.split(' ');
        return parts.map(p => p.length > 1 ? `${p[0]}***` : p).join(' ');
      },
      [PIIType.ADDRESS]: (v) => '*** [ADDRESS REDACTED] ***',
      [PIIType.DATE_OF_BIRTH]: (v) => v.replace(/\d{4}/, '****'),  // Mask year
      [PIIType.PASSPORT]: (v) => v.replace(/\d/g, '*'),
      [PIIType.DRIVERS_LICENSE]: (v) => v.replace(/\d/g, '*'),
      [PIIType.TAX_ID]: (v) => v.replace(/\d/g, '*'),
      [PIIType.BANK_ACCOUNT]: (v) => v.replace(/\d(?=\d{4})/g, '*'),
      [PIIType.MAC_ADDRESS]: (v) => v.replace(/[0-9A-Fa-f]/g, (match, offset) =>
        offset < v.length - 4 ? '*' : match
      ),
      [PIIType.ZIP_CODE]: (v) => v,  // Zip codes can be shown
      [PIIType.AGE]: (v) => v,  // Age can be shown
      [PIIType.USERNAME]: (v) => v.length > 4 ? `${v.substring(0, 2)}***${v[v.length-1]}` : '****',
      [PIIType.EMPLOYEE_ID]: (v) => v.replace(/\d/g, '*'),
      [PIIType.CUSTOMER_ID]: (v) => v.replace(/\d/g, '*'),
      [PIIType.GENERIC]: (v) => '*** [MASKED] ***'
    };

    return maskStrategies[piiType]?.(str) || str;
  }

  /**
   * Get all columns with issues and their sample data
   */
  public async getTableIssuesWithSamples(
    schema: string,
    table: string
  ): Promise<ColumnIssueDetail[]> {
    // This would integrate with quality_issues table
    const query = `
      SELECT DISTINCT
        qi.column_name,
        qi.issue_type,
        qi.severity,
        qi.description,
        qi.affected_rows
      FROM quality_issues qi
      JOIN assets a ON a.id = qi.asset_id
      WHERE a.schema = $1
        AND a.table = $2
        AND qi.status = 'open'
      LIMIT 50
    `;

    try {
      const result = await this.pool.query(query, [schema, table]);

      const issues = await Promise.all(
        result.rows.map(async (row) => {
          const detail = await this.getColumnIssueDetails(
            schema,
            table,
            row.column_name,
            row.issue_type
          );
          return detail;
        })
      );

      return issues.filter(Boolean) as ColumnIssueDetail[];
    } catch (error) {
      console.error('Error getting table issues:', error);
      return [];
    }
  }
}
