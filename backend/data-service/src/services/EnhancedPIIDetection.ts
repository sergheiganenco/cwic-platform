/**
 * Enhanced PII Detection Service
 * Advanced PII detection with ML patterns, confidence scoring, and sensitivity levels
 */

import { Pool } from 'pg';

// PII Types and Sensitivity Levels
export enum PIIType {
  // High Sensitivity
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  TAX_ID = 'tax_id',
  BANK_ACCOUNT = 'bank_account',

  // Medium Sensitivity
  EMAIL = 'email',
  PHONE = 'phone',
  IP_ADDRESS = 'ip_address',
  MAC_ADDRESS = 'mac_address',

  // Low Sensitivity
  NAME = 'name',
  ADDRESS = 'address',
  ZIP_CODE = 'zip_code',
  DATE_OF_BIRTH = 'date_of_birth',
  AGE = 'age',

  // Identifiers
  USERNAME = 'username',
  EMPLOYEE_ID = 'employee_id',
  CUSTOMER_ID = 'customer_id',

  // Other
  GENERIC = 'generic'
}

export enum SensitivityLevel {
  CRITICAL = 'critical',  // Highly regulated (SSN, Credit Card)
  HIGH = 'high',          // Personal identifiers
  MEDIUM = 'medium',      // Contact information
  LOW = 'low'             // Non-sensitive identifiers
}

export interface PIIDetectionResult {
  columnName: string;
  piiType: PIIType | null;
  sensitivity: SensitivityLevel | null;
  confidence: number;  // 0-1
  patterns: PIIPattern[];
  sampleMatches: string[];
  recommendation: string;
  complianceFlags: string[];  // GDPR, HIPAA, PCI-DSS, etc.
}

interface PIIPattern {
  type: PIIType;
  regex: RegExp;
  validator?: (value: string) => boolean;
  sensitivity: SensitivityLevel;
  complianceFlags: string[];
  examples: string[];
}

export class EnhancedPIIDetection {
  private pool: Pool;
  private patterns: PIIPattern[];

  constructor(pool: Pool) {
    this.pool = pool;
    this.patterns = this.initializePatterns();
  }

  /**
   * Initialize comprehensive PII detection patterns
   */
  private initializePatterns(): PIIPattern[] {
    return [
      // CRITICAL SENSITIVITY
      {
        type: PIIType.SSN,
        regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/,
        validator: this.validateSSN,
        sensitivity: SensitivityLevel.CRITICAL,
        complianceFlags: ['PII', 'GDPR', 'CCPA', 'HIPAA'],
        examples: ['123-45-6789', '123456789']
      },
      {
        type: PIIType.CREDIT_CARD,
        regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/,
        validator: this.validateLuhn,
        sensitivity: SensitivityLevel.CRITICAL,
        complianceFlags: ['PCI-DSS', 'PII'],
        examples: ['4532-1234-5678-9010', '4532123456789010']
      },
      {
        type: PIIType.PASSPORT,
        regex: /\b[A-Z]{1,2}\d{6,9}\b/,
        sensitivity: SensitivityLevel.CRITICAL,
        complianceFlags: ['PII', 'GDPR'],
        examples: ['P123456789', 'AB1234567']
      },

      // HIGH SENSITIVITY
      {
        type: PIIType.DRIVERS_LICENSE,
        regex: /\b[A-Z]\d{7,8}\b|\b\d{8,9}\b/,
        sensitivity: SensitivityLevel.HIGH,
        complianceFlags: ['PII', 'GDPR'],
        examples: ['D1234567', '12345678']
      },
      {
        type: PIIType.BANK_ACCOUNT,
        regex: /\b\d{8,17}\b/,
        sensitivity: SensitivityLevel.HIGH,
        complianceFlags: ['PII', 'GDPR', 'PCI-DSS'],
        examples: ['12345678901234']
      },

      // MEDIUM SENSITIVITY
      {
        type: PIIType.EMAIL,
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        sensitivity: SensitivityLevel.MEDIUM,
        complianceFlags: ['PII', 'GDPR', 'CCPA'],
        examples: ['user@example.com', 'john.doe@company.co.uk']
      },
      {
        type: PIIType.PHONE,
        regex: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/,
        sensitivity: SensitivityLevel.MEDIUM,
        complianceFlags: ['PII', 'GDPR'],
        examples: ['+1-555-123-4567', '(555) 123-4567', '555.123.4567']
      },
      {
        type: PIIType.IP_ADDRESS,
        regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
        validator: this.validateIPv4,
        sensitivity: SensitivityLevel.MEDIUM,
        complianceFlags: ['PII', 'GDPR'],
        examples: ['192.168.1.1', '10.0.0.1']
      },
      {
        type: PIIType.MAC_ADDRESS,
        regex: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/,
        sensitivity: SensitivityLevel.MEDIUM,
        complianceFlags: ['PII'],
        examples: ['00:1A:2B:3C:4D:5E', '00-1A-2B-3C-4D-5E']
      },

      // LOW SENSITIVITY (detected by name patterns)
      {
        type: PIIType.NAME,
        regex: /^[A-Z][a-z]+\s[A-Z][a-z]+$/,
        sensitivity: SensitivityLevel.LOW,
        complianceFlags: ['PII'],
        examples: ['John Doe', 'Jane Smith']
      },
      {
        type: PIIType.DATE_OF_BIRTH,
        regex: /\b(0[1-9]|1[0-2])[/-](0[1-9]|[12]\d|3[01])[/-](\d{4}|\d{2})\b/,
        sensitivity: SensitivityLevel.LOW,
        complianceFlags: ['PII', 'HIPAA'],
        examples: ['01/15/1990', '12-25-85']
      },
      {
        type: PIIType.ZIP_CODE,
        regex: /\b\d{5}(-\d{4})?\b/,
        sensitivity: SensitivityLevel.LOW,
        complianceFlags: ['PII'],
        examples: ['12345', '12345-6789']
      }
    ];
  }

  /**
   * Detect PII in a specific column
   */
  public async detectPIIInColumn(
    dataSourceId: string,
    schema: string,
    table: string,
    column: string,
    sampleSize: number = 100
  ): Promise<PIIDetectionResult> {
    try {
      // Get column metadata
      const columnInfo = await this.getColumnMetadata(dataSourceId, schema, table, column);

      // Sample data from the column
      const samples = await this.sampleColumnData(dataSourceId, schema, table, column, sampleSize);

      // Detect PII patterns
      const detections = this.detectPatterns(column, samples, columnInfo);

      // Calculate confidence and select best match
      const bestMatch = this.selectBestMatch(detections);

      return bestMatch;
    } catch (error: any) {
      console.error('Error detecting PII:', error);
      return {
        columnName: column,
        piiType: null,
        sensitivity: null,
        confidence: 0,
        patterns: [],
        sampleMatches: [],
        recommendation: 'Unable to analyze column',
        complianceFlags: []
      };
    }
  }

  /**
   * Detect PII in all columns of a table
   */
  public async detectPIIInTable(
    dataSourceId: string,
    schema: string,
    table: string
  ): Promise<PIIDetectionResult[]> {
    try {
      // Get all columns
      const columns = await this.getTableColumns(dataSourceId, schema, table);

      // Detect PII in each column (parallel)
      const results = await Promise.all(
        columns.map(col => this.detectPIIInColumn(dataSourceId, schema, table, col))
      );

      return results.filter(r => r.piiType !== null);
    } catch (error: any) {
      console.error('Error detecting PII in table:', error);
      return [];
    }
  }

  /**
   * Get column metadata
   */
  private async getColumnMetadata(
    dataSourceId: string,
    schema: string,
    table: string,
    column: string
  ): Promise<any> {
    const query = `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
        AND column_name = $3
      LIMIT 1
    `;

    const result = await this.pool.query(query, [schema, table, column]);
    return result.rows[0] || {};
  }

  /**
   * Sample data from a column
   */
  private async sampleColumnData(
    dataSourceId: string,
    schema: string,
    table: string,
    column: string,
    sampleSize: number
  ): Promise<string[]> {
    // TODO: Get connection details for data source and query actual data
    // For now, return empty array
    // In production, this would query the actual data source

    const query = `
      SELECT DISTINCT "${column}"
      FROM "${schema}"."${table}"
      WHERE "${column}" IS NOT NULL
      LIMIT $1
    `;

    try {
      const result = await this.pool.query(query, [sampleSize]);
      return result.rows.map(row => String(row[column])).filter(Boolean);
    } catch (error) {
      console.warn('Could not sample data:', error);
      return [];
    }
  }

  /**
   * Get all columns in a table
   */
  private async getTableColumns(
    dataSourceId: string,
    schema: string,
    table: string
  ): Promise<string[]> {
    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = $2
      ORDER BY ordinal_position
    `;

    const result = await this.pool.query(query, [schema, table]);
    return result.rows.map(row => row.column_name);
  }

  /**
   * Detect PII patterns in samples
   */
  private detectPatterns(
    columnName: string,
    samples: string[],
    columnInfo: any
  ): Array<{pattern: PIIPattern, matches: string[], confidence: number}> {
    const detections: Array<{pattern: PIIPattern, matches: string[], confidence: number}> = [];

    // Check column name for hints
    const nameHints = this.getNameHints(columnName);

    for (const pattern of this.patterns) {
      const matches: string[] = [];

      // Test samples against pattern
      for (const sample of samples) {
        if (!sample) continue;

        const trimmed = String(sample).trim();
        if (pattern.regex.test(trimmed)) {
          // Additional validation if provided
          if (pattern.validator && !pattern.validator(trimmed)) {
            continue;
          }
          matches.push(trimmed);
        }
      }

      if (matches.length > 0) {
        // Calculate confidence based on match rate and name hints
        const matchRate = matches.length / Math.max(samples.length, 1);
        const nameBonus = nameHints.includes(pattern.type) ? 0.3 : 0;
        const confidence = Math.min(matchRate * 0.7 + nameBonus, 1.0);

        detections.push({
          pattern,
          matches: matches.slice(0, 5),  // Keep first 5 matches
          confidence
        });
      }
    }

    return detections.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get PII type hints from column name
   */
  private getNameHints(columnName: string): PIIType[] {
    const hints: PIIType[] = [];
    const lower = columnName.toLowerCase();

    const hintMap: {[key: string]: PIIType} = {
      'ssn': PIIType.SSN,
      'social_security': PIIType.SSN,
      'email': PIIType.EMAIL,
      'mail': PIIType.EMAIL,
      'phone': PIIType.PHONE,
      'tel': PIIType.PHONE,
      'mobile': PIIType.PHONE,
      'credit_card': PIIType.CREDIT_CARD,
      'card_number': PIIType.CREDIT_CARD,
      'passport': PIIType.PASSPORT,
      'license': PIIType.DRIVERS_LICENSE,
      'ip_address': PIIType.IP_ADDRESS,
      'ip': PIIType.IP_ADDRESS,
      'mac_address': PIIType.MAC_ADDRESS,
      'mac': PIIType.MAC_ADDRESS,
      'name': PIIType.NAME,
      'first_name': PIIType.NAME,
      'last_name': PIIType.NAME,
      'full_name': PIIType.NAME,
      'address': PIIType.ADDRESS,
      'street': PIIType.ADDRESS,
      'city': PIIType.ADDRESS,
      'zip': PIIType.ZIP_CODE,
      'postal': PIIType.ZIP_CODE,
      'dob': PIIType.DATE_OF_BIRTH,
      'birth_date': PIIType.DATE_OF_BIRTH,
      'birthdate': PIIType.DATE_OF_BIRTH,
    };

    for (const [key, type] of Object.entries(hintMap)) {
      if (lower.includes(key)) {
        hints.push(type);
      }
    }

    return hints;
  }

  /**
   * Select best matching PII pattern
   */
  private selectBestMatch(
    detections: Array<{pattern: PIIPattern, matches: string[], confidence: number}>
  ): PIIDetectionResult {
    if (detections.length === 0) {
      return {
        columnName: '',
        piiType: null,
        sensitivity: null,
        confidence: 0,
        patterns: [],
        sampleMatches: [],
        recommendation: 'No PII detected',
        complianceFlags: []
      };
    }

    const best = detections[0];

    return {
      columnName: '',
      piiType: best.pattern.type,
      sensitivity: best.pattern.sensitivity,
      confidence: best.confidence,
      patterns: detections.map(d => d.pattern),
      sampleMatches: best.matches,
      recommendation: this.getRecommendation(best.pattern, best.confidence),
      complianceFlags: best.pattern.complianceFlags
    };
  }

  /**
   * Get recommendation based on PII detection
   */
  private getRecommendation(pattern: PIIPattern, confidence: number): string {
    if (confidence < 0.5) {
      return `Low confidence (${(confidence * 100).toFixed(0)}%). Consider manual review.`;
    }

    const recommendations: {[key in SensitivityLevel]: string} = {
      [SensitivityLevel.CRITICAL]: `⚠️ CRITICAL: Encrypt this column immediately. ${pattern.complianceFlags.join(', ')} compliance required.`,
      [SensitivityLevel.HIGH]: `⚠️ HIGH: Implement access controls and consider encryption. ${pattern.complianceFlags.join(', ')} compliance may apply.`,
      [SensitivityLevel.MEDIUM]: `⚠️ MEDIUM: Implement access logging and consider masking. ${pattern.complianceFlags.join(', ')} compliance recommended.`,
      [SensitivityLevel.LOW]: `ℹ️ LOW: Monitor access and consider redaction in logs. Basic ${pattern.complianceFlags.join(', ')} compliance.`
    };

    return recommendations[pattern.sensitivity] || 'Review and classify this data.';
  }

  // Validation functions
  private validateSSN(ssn: string): boolean {
    const cleaned = ssn.replace(/[-\s]/g, '');
    if (cleaned.length !== 9) return false;

    // Invalid SSN patterns
    if (cleaned === '000000000') return false;
    if (cleaned.startsWith('000')) return false;
    if (cleaned.substring(3, 5) === '00') return false;
    if (cleaned.substring(5) === '0000') return false;

    return true;
  }

  private validateLuhn(cardNumber: string): boolean {
    const cleaned = cardNumber.replace(/[-\s]/g, '');
    if (!/^\d{13,19}$/.test(cleaned)) return false;

    let sum = 0;
    let isEven = false;

    for (let i = cleaned.length - 1; i >= 0; i--) {
      let digit = parseInt(cleaned[i]);

      if (isEven) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  }

  private validateIPv4(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;

    return parts.every(part => {
      const num = parseInt(part);
      return num >= 0 && num <= 255;
    });
  }
}
