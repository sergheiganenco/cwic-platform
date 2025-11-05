// backend/data-service/src/services/SmartPIIDetectionService.ts
import { Pool } from 'pg';
import { DataContentAnalyzer, DataSample } from './DataContentAnalyzer';

/**
 * Smart PII Detection Service
 *
 * Uses context-aware analysis AND actual data content analysis to reduce false positives.
 * For example: "table_name" in audit_log is metadata, not PII
 *
 * Features:
 * - Analyzes table context (audit, config, metadata tables)
 * - Examines actual data content (not just column names!)
 * - Learns from manual corrections
 * - Stores training data for ML improvement
 */

export interface PIIDetectionResult {
  columnName: string;
  isPII: boolean;
  piiType: string | null;
  confidence: number; // 0-100
  reason: string;
  manualOverride?: boolean;
  trainingSource?: 'rule' | 'pattern' | 'manual' | 'ml';
}

export interface PIIContext {
  tableName: string;
  schemaName: string;
  databaseName: string;
  columnName: string;
  dataType: string;
  sampleValues?: any[];
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isNullable?: boolean;
}

// Module-level cache shared across all instances
let piiRulesCache: Map<string, any> | null = null;
let lastCacheUpdate: number = 0;
const CACHE_TTL = 60000; // 1 minute cache

export class SmartPIIDetectionService {
  private db: Pool;

  // Table types that typically contain metadata, not user PII
  private readonly METADATA_TABLE_PATTERNS = [
    /^(audit|log|system|config|migration|schema|metadata)_/i,
    /_(audit|log|history|tracking|metadata)$/i,
    /^(pg_|information_schema|sys_)/i,
  ];

  // Column names that are typically metadata fields
  private readonly METADATA_COLUMN_PATTERNS = [
    /^(table|column|schema|database|object)_name$/i,
    /^(entity|resource|type|category|status)_name$/i,
    /^(created|updated|modified|deleted)_(by|at|on)$/i,
    /^(old|new)_value$/i,
    /^change_(type|action|event)$/i,
    /^operation$/i,
    /^event_(type|name)$/i,
  ];

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Clear the PII rules cache (call this when rules are updated)
   */
  public static clearCache(): void {
    piiRulesCache = null;
    lastCacheUpdate = 0;
  }

  /**
   * Load enabled PII rules from database (with caching)
   */
  private async getEnabledPIIRules(): Promise<Map<string, any>> {
    const now = Date.now();

    // Return cached rules if still valid
    if (piiRulesCache && (now - lastCacheUpdate) < CACHE_TTL) {
      return piiRulesCache;
    }

    // Load from database
    const result = await this.db.query(`
      SELECT
        pii_type,
        display_name,
        column_name_hints,
        regex_pattern,
        sensitivity_level
      FROM pii_rule_definitions
      WHERE is_enabled = true
      ORDER BY pii_type
    `);

    const rulesMap = new Map();
    for (const row of result.rows) {
      // Build SMART column name pattern from hints with fuzzy matching
      // Matches: ip_address, actor_ip, start_ip_address, client_ip, etc.
      const hints = row.column_name_hints || [];
      const columnPattern = hints.length > 0
        ? new RegExp(hints.map(hint => `(${hint.replace(/_/g, '.*')})`).join('|'), 'i')
        : null;

      // Parse regex pattern
      let dataPattern = null;
      if (row.regex_pattern) {
        try {
          // Remove double escaping if present
          const cleanPattern = row.regex_pattern.replace(/\\\\/g, '\\');
          dataPattern = new RegExp(cleanPattern);
        } catch (e) {
          console.warn(`Invalid regex for ${row.pii_type}: ${row.regex_pattern}`);
        }
      }

      // Map sensitivity to confidence score
      const confidenceMap: any = {
        'critical': 99,
        'high': 90,
        'medium': 75,
        'low': 60
      };

      rulesMap.set(row.pii_type, {
        piiType: row.pii_type,
        displayName: row.display_name,
        pattern: columnPattern,
        dataPattern: dataPattern,
        confidence: confidenceMap[row.sensitivity_level] || 70,
      });
    }

    piiRulesCache = rulesMap;
    lastCacheUpdate = now;
    return rulesMap;
  }

  /**
   * Detect PII with context awareness AND actual data content analysis
   */
  async detectPII(context: PIIContext): Promise<PIIDetectionResult> {
    // 1. Check for manual overrides first (highest priority)
    const manualOverride = await this.getManualOverride(context);
    if (manualOverride) {
      return manualOverride;
    }

    // 2. If we have sample data, use content analysis (most accurate!)
    if (context.sampleValues && context.sampleValues.length > 0) {
      const samples: DataSample[] = context.sampleValues.map(value => ({
        value,
        type: context.dataType,
      }));

      const isMetadataTable = this.isMetadataTable(context);

      const contentAnalysis = await DataContentAnalyzer.analyzeContent(
        context.columnName,
        samples,
        {
          tableName: context.tableName,
          schemaName: context.schemaName,
          isMetadataTable,
        }
      );

      // Content analysis is highly reliable
      return {
        columnName: context.columnName,
        isPII: contentAnalysis.isPII,
        piiType: contentAnalysis.piiType,
        confidence: contentAnalysis.confidence,
        reason: contentAnalysis.reason,
        trainingSource: 'pattern',
      };
    }

    // 3. Fallback: Check if this is a metadata table/column context
    if (this.isMetadataContext(context)) {
      return {
        columnName: context.columnName,
        isPII: false,
        piiType: null,
        confidence: 85,
        reason: 'Metadata field in system/audit table (no data samples available)',
        trainingSource: 'rule',
      };
    }

    // 4. Check ML training data
    const mlPrediction = await this.getMLPrediction(context);
    if (mlPrediction && mlPrediction.confidence >= 80) {
      return mlPrediction;
    }

    // 5. Apply column name pattern-based detection (least reliable without data)
    const patternResult = await this.detectByPattern(context);
    if (patternResult) {
      return patternResult;
    }

    // 6. Default: not PII
    return {
      columnName: context.columnName,
      isPII: false,
      piiType: null,
      confidence: 70,
      reason: 'No PII patterns matched (recommend scanning with data samples)',
      trainingSource: 'rule',
    };
  }

  /**
   * Check if this is a metadata table
   */
  private isMetadataTable(context: PIIContext): boolean {
    const fullTableName = `${context.schemaName}.${context.tableName}`.toLowerCase();
    return this.METADATA_TABLE_PATTERNS.some((pattern) => pattern.test(fullTableName));
  }

  /**
   * Check if this is a metadata context (audit logs, system tables, etc.)
   */
  private isMetadataContext(context: PIIContext): boolean {
    const fullTableName = `${context.schemaName}.${context.tableName}`.toLowerCase();

    // Check if table matches metadata patterns
    const isMetadataTable = this.METADATA_TABLE_PATTERNS.some((pattern) =>
      pattern.test(fullTableName)
    );

    // Check if column matches metadata patterns
    const isMetadataColumn = this.METADATA_COLUMN_PATTERNS.some((pattern) =>
      pattern.test(context.columnName)
    );

    return isMetadataTable && isMetadataColumn;
  }

  /**
   * Pattern-based detection with data validation (using PII rules from database)
   */
  private async detectByPattern(context: PIIContext): Promise<PIIDetectionResult | null> {
    // Load enabled PII rules from database
    const piiRules = await this.getEnabledPIIRules();

    for (const [piiType, config] of piiRules.entries()) {
      // Check column name pattern
      if (!config.pattern || !config.pattern.test(context.columnName)) {
        continue;
      }

      let confidence = config.confidence;
      let reason = `Column name matches ${config.displayName} pattern`;

      // Validate with actual data if available
      if (context.sampleValues && context.sampleValues.length > 0 && config.dataPattern) {
        const matchCount = context.sampleValues.filter((val) => {
          if (val === null || val === undefined) return false;
          return config.dataPattern!.test(String(val));
        }).length;

        const matchRate = matchCount / context.sampleValues.length;

        if (matchRate < 0.3) {
          // Less than 30% match - probably not PII
          confidence = Math.min(confidence, 50);
          reason += `, but only ${Math.round(matchRate * 100)}% of data matches pattern`;
        } else {
          // Good match rate
          confidence = Math.min(100, confidence + matchRate * 10);
          reason += ` and ${Math.round(matchRate * 100)}% of data matches`;
        }
      }

      return {
        columnName: context.columnName,
        isPII: confidence >= 70,
        piiType,
        confidence,
        reason,
        trainingSource: 'pattern',
      };
    }

    return null;
  }

  /**
   * Get manual override from database
   */
  private async getManualOverride(context: PIIContext): Promise<PIIDetectionResult | null> {
    try {
      const result = await this.db.query(
        `SELECT is_pii, pii_type, confidence, reason, created_at
         FROM pii_training_data
         WHERE database_name = $1
           AND schema_name = $2
           AND table_name = $3
           AND column_name = $4
           AND training_source = 'manual'
         ORDER BY created_at DESC
         LIMIT 1`,
        [context.databaseName, context.schemaName, context.tableName, context.columnName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        columnName: context.columnName,
        isPII: row.is_pii,
        piiType: row.pii_type,
        confidence: row.confidence || 100,
        reason: row.reason || 'Manual override',
        manualOverride: true,
        trainingSource: 'manual',
      };
    } catch (error) {
      console.error('[SmartPIIDetection] Error fetching manual override:', error);
      return null;
    }
  }

  /**
   * Get ML prediction from training data
   */
  private async getMLPrediction(context: PIIContext): Promise<PIIDetectionResult | null> {
    try {
      // Look for similar columns in training data
      const result = await this.db.query(
        `SELECT is_pii, pii_type, AVG(confidence) as avg_confidence, COUNT(*) as sample_count
         FROM pii_training_data
         WHERE column_name = $1
           AND data_type = $2
           AND training_source IN ('manual', 'pattern')
         GROUP BY is_pii, pii_type
         HAVING COUNT(*) >= 3
         ORDER BY COUNT(*) DESC, AVG(confidence) DESC
         LIMIT 1`,
        [context.columnName, context.dataType]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        columnName: context.columnName,
        isPII: row.is_pii,
        piiType: row.pii_type,
        confidence: Math.min(95, row.avg_confidence),
        reason: `Learned from ${row.sample_count} similar columns`,
        trainingSource: 'ml',
      };
    } catch (error) {
      console.error('[SmartPIIDetection] Error fetching ML prediction:', error);
      return null;
    }
  }

  /**
   * Store manual PII classification for training
   */
  async storeManualClassification(
    context: PIIContext,
    isPII: boolean,
    piiType: string | null,
    userId: string,
    reason?: string
  ): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO pii_training_data (
          database_name, schema_name, table_name, column_name, data_type,
          is_pii, pii_type, confidence, reason, training_source, trained_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (database_name, schema_name, table_name, column_name, training_source)
        DO UPDATE SET
          is_pii = EXCLUDED.is_pii,
          pii_type = EXCLUDED.pii_type,
          confidence = EXCLUDED.confidence,
          reason = EXCLUDED.reason,
          trained_by = EXCLUDED.trained_by,
          created_at = NOW()`,
        [
          context.databaseName,
          context.schemaName,
          context.tableName,
          context.columnName,
          context.dataType,
          isPII,
          piiType,
          100, // Manual classifications have 100% confidence
          reason || `Manual classification by user`,
          'manual',
          userId,
        ]
      );

      console.log('[SmartPIIDetection] Stored manual classification:', {
        column: `${context.schemaName}.${context.tableName}.${context.columnName}`,
        isPII,
        piiType,
      });
    } catch (error) {
      console.error('[SmartPIIDetection] Error storing manual classification:', error);
      throw error;
    }
  }

  /**
   * Batch detect PII for multiple columns
   */
  async batchDetectPII(contexts: PIIContext[]): Promise<PIIDetectionResult[]> {
    const results: PIIDetectionResult[] = [];

    for (const context of contexts) {
      const result = await this.detectPII(context);
      results.push(result);
    }

    return results;
  }

  /**
   * Get PII detection statistics
   */
  async getDetectionStats(dataSourceId: string): Promise<{
    totalColumns: number;
    piiColumns: number;
    manualOverrides: number;
    topPIITypes: Array<{ piiType: string; count: number }>;
  }> {
    try {
      const statsResult = await this.db.query(
        `SELECT
          COUNT(DISTINCT column_name) as total_columns,
          COUNT(DISTINCT CASE WHEN is_pii THEN column_name END) as pii_columns,
          COUNT(DISTINCT CASE WHEN training_source = 'manual' THEN column_name END) as manual_overrides
         FROM pii_training_data
         WHERE data_source_id = $1`,
        [dataSourceId]
      );

      const typeResult = await this.db.query(
        `SELECT pii_type, COUNT(*) as count
         FROM pii_training_data
         WHERE data_source_id = $1
           AND is_pii = true
           AND pii_type IS NOT NULL
         GROUP BY pii_type
         ORDER BY count DESC
         LIMIT 10`,
        [dataSourceId]
      );

      return {
        totalColumns: parseInt(statsResult.rows[0]?.total_columns || '0'),
        piiColumns: parseInt(statsResult.rows[0]?.pii_columns || '0'),
        manualOverrides: parseInt(statsResult.rows[0]?.manual_overrides || '0'),
        topPIITypes: typeResult.rows.map((row) => ({
          piiType: row.pii_type,
          count: parseInt(row.count),
        })),
      };
    } catch (error) {
      console.error('[SmartPIIDetection] Error fetching stats:', error);
      return {
        totalColumns: 0,
        piiColumns: 0,
        manualOverrides: 0,
        topPIITypes: [],
      };
    }
  }
}
