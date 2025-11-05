// backend/data-service/src/services/DataContentAnalyzer.ts

/**
 * Data Content Analyzer
 *
 * Analyzes actual data content to determine if a column contains PII
 * Much smarter than just looking at column names
 */

export interface DataSample {
  value: any;
  type: string;
}

export interface ContentAnalysisResult {
  isPII: boolean;
  piiType: string | null;
  confidence: number;
  sampleMatches: number;
  totalSamples: number;
  reason: string;
  distinctValueCount?: number;
  averageLength?: number;
  patterns: string[];
}

export class DataContentAnalyzer {
  private static readonly MIN_SAMPLES = 10;
  private static readonly PII_THRESHOLD = 0.7; // 70% of samples must match to be considered PII

  /**
   * Analyze actual data content to detect PII
   */
  static async analyzeContent(
    columnName: string,
    samples: DataSample[],
    context: {
      tableName: string;
      schemaName: string;
      isMetadataTable: boolean;
    }
  ): Promise<ContentAnalysisResult> {
    if (!samples || samples.length === 0) {
      return {
        isPII: false,
        piiType: null,
        confidence: 0,
        sampleMatches: 0,
        totalSamples: 0,
        reason: 'No data samples available',
        patterns: [],
      };
    }

    // Filter out null/undefined values
    const validSamples = samples.filter(s => s.value !== null && s.value !== undefined);

    if (validSamples.length === 0) {
      return {
        isPII: false,
        piiType: null,
        confidence: 0,
        sampleMatches: 0,
        totalSamples: samples.length,
        reason: 'All samples are null',
        patterns: [],
      };
    }

    // Calculate distinct values
    const distinctValues = new Set(validSamples.map(s => String(s.value)));
    const distinctCount = distinctValues.size;
    const distinctRatio = distinctCount / validSamples.length;

    // Calculate average length for string values
    const stringValues = validSamples.filter(s => typeof s.value === 'string').map(s => String(s.value));
    const avgLength = stringValues.length > 0
      ? stringValues.reduce((sum, val) => sum + val.length, 0) / stringValues.length
      : 0;

    // Special case: Metadata table with metadata column
    if (context.isMetadataTable && this.isMetadataColumnName(columnName)) {
      const metadataAnalysis = this.analyzeMetadataContent(validSamples, columnName, context.tableName);
      if (!metadataAnalysis.isPII) {
        return metadataAnalysis;
      }
    }

    // Run pattern-based analysis on actual data
    const patternResults = [
      this.analyzeEmailPattern(validSamples),
      this.analyzePhonePattern(validSamples),
      this.analyzeSSNPattern(validSamples),
      this.analyzeCreditCardPattern(validSamples),
      this.analyzeNamePattern(validSamples, columnName, distinctRatio),
      this.analyzeIPAddressPattern(validSamples),
      this.analyzeDateOfBirthPattern(validSamples),
    ];

    // Find the best match
    const bestMatch = patternResults
      .filter(r => r.matchRate >= this.PII_THRESHOLD)
      .sort((a, b) => b.confidence - a.confidence)[0];

    if (bestMatch) {
      return {
        isPII: true,
        piiType: bestMatch.piiType,
        confidence: bestMatch.confidence,
        sampleMatches: bestMatch.matches,
        totalSamples: validSamples.length,
        reason: bestMatch.reason,
        distinctValueCount: distinctCount,
        averageLength: avgLength,
        patterns: bestMatch.patterns,
      };
    }

    // No PII detected
    return {
      isPII: false,
      piiType: null,
      confidence: 80,
      sampleMatches: 0,
      totalSamples: validSamples.length,
      reason: 'Data content does not match any PII patterns',
      distinctValueCount: distinctCount,
      averageLength: avgLength,
      patterns: [],
    };
  }

  /**
   * Check if column name indicates metadata
   */
  private static isMetadataColumnName(columnName: string): boolean {
    const metadataPatterns = [
      /^(table|column|schema|database|object)_name$/i,
      /^(entity|resource|type|category|status)_name$/i,
      /^(old|new)_value$/i,
      /^(change|event)_(type|action|name)$/i,
    ];
    return metadataPatterns.some(pattern => pattern.test(columnName));
  }

  /**
   * Analyze content in metadata context
   * For example: table_name should contain database table names, not person names
   */
  private static analyzeMetadataContent(
    samples: DataSample[],
    columnName: string,
    tableName: string
  ): ContentAnalysisResult {
    const values = samples.map(s => String(s.value).toLowerCase());

    // Keywords that indicate metadata, not PII
    const metadataKeywords = [
      // Database objects
      'table', 'column', 'schema', 'database', 'index', 'view', 'trigger', 'procedure',
      // Common table names
      'users', 'customers', 'orders', 'products', 'invoices', 'payments', 'audit', 'log',
      // Actions/operations
      'insert', 'update', 'delete', 'select', 'create', 'drop', 'alter',
      // System tables
      'pg_', 'sys_', 'information_schema', 'mysql', 'performance_schema',
    ];

    // Check if values contain metadata keywords
    let metadataMatches = 0;
    const matchedKeywords: string[] = [];

    for (const value of values) {
      for (const keyword of metadataKeywords) {
        if (value.includes(keyword)) {
          metadataMatches++;
          if (!matchedKeywords.includes(keyword)) {
            matchedKeywords.push(keyword);
          }
          break;
        }
      }
    }

    const metadataMatchRate = metadataMatches / values.length;

    // If >50% of values contain metadata keywords, it's NOT PII
    if (metadataMatchRate > 0.5) {
      return {
        isPII: false,
        piiType: null,
        confidence: 90,
        sampleMatches: 0,
        totalSamples: samples.length,
        reason: `Metadata field in ${tableName}: ${metadataMatchRate * 100}% of values contain metadata keywords (${matchedKeywords.join(', ')})`,
        patterns: matchedKeywords,
      };
    }

    // Check if values look like database identifiers (snake_case, camelCase)
    const identifierPattern = /^[a-z_]+[a-z0-9_]*$/i;
    const identifierMatches = values.filter(v => identifierPattern.test(v)).length;
    const identifierMatchRate = identifierMatches / values.length;

    if (identifierMatchRate > 0.7) {
      return {
        isPII: false,
        piiType: null,
        confidence: 85,
        sampleMatches: 0,
        totalSamples: samples.length,
        reason: `Metadata field: ${identifierMatchRate * 100}% of values are database identifiers`,
        patterns: ['database_identifier'],
      };
    }

    // Otherwise, continue with normal PII detection
    return {
      isPII: true, // Signal to continue analysis
      piiType: null,
      confidence: 0,
      sampleMatches: 0,
      totalSamples: samples.length,
      reason: '',
      patterns: [],
    };
  }

  /**
   * Email pattern analysis
   */
  private static analyzeEmailPattern(samples: DataSample[]): {
    piiType: string;
    matchRate: number;
    matches: number;
    confidence: number;
    reason: string;
    patterns: string[];
  } {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const matches = samples.filter(s => {
      const value = String(s.value);
      return emailPattern.test(value);
    }).length;

    const matchRate = matches / samples.length;

    return {
      piiType: 'EMAIL',
      matchRate,
      matches,
      confidence: matchRate >= 0.9 ? 99 : matchRate >= 0.7 ? 85 : 70,
      reason: `${Math.round(matchRate * 100)}% of values match email pattern`,
      patterns: ['email_format'],
    };
  }

  /**
   * Phone number pattern analysis
   */
  private static analyzePhonePattern(samples: DataSample[]): {
    piiType: string;
    matchRate: number;
    matches: number;
    confidence: number;
    reason: string;
    patterns: string[];
  } {
    const phonePatterns = [
      /^\+?1?\s?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})$/, // US format
      /^\+?(\d{1,3})?[\s.-]?\(?(\d{2,4})\)?[\s.-]?(\d{3,4})[\s.-]?(\d{4})$/, // International
      /^\d{10,15}$/, // Just digits
    ];

    const matches = samples.filter(s => {
      const value = String(s.value).trim();
      return phonePatterns.some(pattern => pattern.test(value));
    }).length;

    const matchRate = matches / samples.length;

    return {
      piiType: 'PHONE',
      matchRate,
      matches,
      confidence: matchRate >= 0.9 ? 95 : matchRate >= 0.7 ? 80 : 70,
      reason: `${Math.round(matchRate * 100)}% of values match phone number patterns`,
      patterns: ['phone_format'],
    };
  }

  /**
   * SSN pattern analysis
   */
  private static analyzeSSNPattern(samples: DataSample[]): {
    piiType: string;
    matchRate: number;
    matches: number;
    confidence: number;
    reason: string;
    patterns: string[];
  } {
    const ssnPattern = /^\d{3}-?\d{2}-?\d{4}$/;
    const matches = samples.filter(s => ssnPattern.test(String(s.value))).length;
    const matchRate = matches / samples.length;

    return {
      piiType: 'SSN',
      matchRate,
      matches,
      confidence: matchRate >= 0.9 ? 99 : matchRate >= 0.7 ? 90 : 75,
      reason: `${Math.round(matchRate * 100)}% of values match SSN pattern`,
      patterns: ['ssn_format'],
    };
  }

  /**
   * Credit card pattern analysis
   */
  private static analyzeCreditCardPattern(samples: DataSample[]): {
    piiType: string;
    matchRate: number;
    matches: number;
    confidence: number;
    reason: string;
    patterns: string[];
  } {
    const ccPattern = /^\d{13,19}$/;
    const matches = samples.filter(s => {
      const value = String(s.value).replace(/[\s-]/g, '');
      return ccPattern.test(value);
    }).length;

    const matchRate = matches / samples.length;

    return {
      piiType: 'CREDIT_CARD',
      matchRate,
      matches,
      confidence: matchRate >= 0.9 ? 95 : matchRate >= 0.7 ? 85 : 70,
      reason: `${Math.round(matchRate * 100)}% of values match credit card format`,
      patterns: ['credit_card_format'],
    };
  }

  /**
   * Name pattern analysis - SMART VERSION
   * Distinguishes between person names and metadata names
   */
  private static analyzeNamePattern(
    samples: DataSample[],
    columnName: string,
    distinctRatio: number
  ): {
    piiType: string;
    matchRate: number;
    matches: number;
    confidence: number;
    reason: string;
    patterns: string[];
  } {
    // Person name pattern: alphabetic with spaces, hyphens, apostrophes
    const personNamePattern = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/;

    // Metadata name pattern: lowercase with underscores (database naming)
    const metadataPattern = /^[a-z_]+[a-z0-9_]*$/;

    let personNameMatches = 0;
    let metadataMatches = 0;

    for (const sample of samples) {
      const value = String(sample.value).trim();

      if (personNamePattern.test(value)) {
        personNameMatches++;
      } else if (metadataPattern.test(value)) {
        metadataMatches++;
      }
    }

    const personMatchRate = personNameMatches / samples.length;
    const metadataMatchRate = metadataMatches / samples.length;

    // If metadata pattern dominates, it's NOT a person name
    if (metadataMatchRate > personMatchRate && metadataMatchRate > 0.5) {
      return {
        piiType: 'NAME',
        matchRate: 0, // Force no match
        matches: 0,
        confidence: 0,
        reason: `Values match metadata pattern (${Math.round(metadataMatchRate * 100)}%), not person names`,
        patterns: ['metadata_naming'],
      };
    }

    // High distinct ratio + person name pattern = likely person names
    const isLikelyPersonName = personMatchRate > 0.6 && distinctRatio > 0.8;

    return {
      piiType: 'NAME',
      matchRate: isLikelyPersonName ? personMatchRate : 0,
      matches: personNameMatches,
      confidence: isLikelyPersonName ? 85 : 0,
      reason: isLikelyPersonName
        ? `${Math.round(personMatchRate * 100)}% match person name pattern with high diversity`
        : 'Does not match person name characteristics',
      patterns: isLikelyPersonName ? ['person_name'] : [],
    };
  }

  /**
   * IP Address pattern analysis
   */
  private static analyzeIPAddressPattern(samples: DataSample[]): {
    piiType: string;
    matchRate: number;
    matches: number;
    confidence: number;
    reason: string;
    patterns: string[];
  } {
    const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Pattern = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;

    const matches = samples.filter(s => {
      const value = String(s.value);
      return ipv4Pattern.test(value) || ipv6Pattern.test(value);
    }).length;

    const matchRate = matches / samples.length;

    return {
      piiType: 'IP_ADDRESS',
      matchRate,
      matches,
      confidence: matchRate >= 0.9 ? 90 : matchRate >= 0.7 ? 75 : 60,
      reason: `${Math.round(matchRate * 100)}% of values match IP address format`,
      patterns: ['ip_format'],
    };
  }

  /**
   * Date of Birth pattern analysis
   */
  private static analyzeDateOfBirthPattern(samples: DataSample[]): {
    piiType: string;
    matchRate: number;
    matches: number;
    confidence: number;
    reason: string;
    patterns: string[];
  } {
    const currentYear = new Date().getFullYear();
    const matches = samples.filter(s => {
      try {
        const date = new Date(s.value);
        const year = date.getFullYear();
        // DOB should be between 1900 and current year - 18
        return year >= 1900 && year <= currentYear - 18;
      } catch {
        return false;
      }
    }).length;

    const matchRate = matches / samples.length;

    return {
      piiType: 'DOB',
      matchRate,
      matches,
      confidence: matchRate >= 0.9 ? 90 : matchRate >= 0.7 ? 80 : 65,
      reason: `${Math.round(matchRate * 100)}% of values are valid birth dates`,
      patterns: ['date_of_birth'],
    };
  }
}
