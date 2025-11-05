/**
 * Row-Level Lineage Trace Service
 * Provides evidence-based lineage tracking with sample pairs, confidence scoring,
 * and validation capabilities
 */
import { DatabaseService } from './DatabaseService';
import { logger } from '@/utils/logger';
import { z } from 'zod';

/* ──────────────────────────────────────────────────────────────────────────
 * Schemas & Types
 * ────────────────────────────────────────────────────────────────────────── */

const SamplePairSchema = z.object({
  sourceRowHash: z.string(),
  targetRowHash: z.string(),
  sourceValues: z.record(z.string(), z.any()),
  targetValues: z.record(z.string(), z.any()),
  matchedAt: z.string(),
  confidence: z.number().min(0).max(1),
});

const TraceEvidenceSchema = z.object({
  edgeId: z.string(),
  sourceTable: z.string(),
  targetTable: z.string(),
  coveragePct: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  samplePairs: z.array(SamplePairSchema),
  evidenceSources: z.array(z.enum(['query_log', 'sql_parse', 'dbt_manifest', 'fingerprint', 'manual'])),
  timeWindow: z.object({
    start: z.string(),
    end: z.string(),
  }),
  metadata: z.record(z.string(), z.any()).optional(),
});

const ValidationResultSchema = z.object({
  isValid: z.boolean(),
  matchedRows: z.number(),
  totalRows: z.number(),
  confidence: z.number(),
  discrepancies: z.array(z.object({
    issue: z.string(),
    affectedRows: z.number(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  executionTime: z.number(),
});

export type SamplePair = z.infer<typeof SamplePairSchema>;
export type TraceEvidence = z.infer<typeof TraceEvidenceSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/* ──────────────────────────────────────────────────────────────────────────
 * Service
 * ────────────────────────────────────────────────────────────────────────── */

export class TraceService {
  private db = new DatabaseService();

  /**
   * Get trace evidence for an edge with sample row pairs
   */
  async getTraceEvidence(
    edgeId: string,
    options: {
      sampleSize?: number;
      maskPII?: boolean;
      timeWindowDays?: number;
    } = {}
  ): Promise<TraceEvidence> {
    const { sampleSize = 10, maskPII = true, timeWindowDays = 30 } = options;

    try {
      // Get edge details from lineage_edges table
      const edgeQuery = `
        SELECT
          le.id,
          le.from_id,
          le.to_id,
          le.confidence_score,
          le.metadata,
          source_node.table_name as source_table,
          source_node.schema_name as source_schema,
          target_node.table_name as target_table,
          target_node.schema_name as target_schema
        FROM lineage_edges le
        JOIN lineage_nodes source_node ON le.from_id = source_node.id
        JOIN lineage_nodes target_node ON le.to_id = target_node.id
        WHERE le.id = $1 AND le.deleted_at IS NULL
      `;

      const edgeResult = await this.db.query(edgeQuery, [edgeId]) as any;

      if (!edgeResult.rows || edgeResult.rows.length === 0) {
        throw new Error(`Edge ${edgeId} not found`);
      }

      const edge = edgeResult.rows[0];

      // Get sample pairs from trace evidence table (if exists)
      const samplePairs = await this.getSamplePairs(
        edge.source_table,
        edge.target_table,
        sampleSize,
        maskPII
      );

      // Calculate coverage from query logs or heuristics
      const coveragePct = await this.calculateCoverage(
        edge.source_table,
        edge.target_table,
        timeWindowDays
      );

      // Determine evidence sources
      const evidenceSources = await this.getEvidenceSources(
        edge.source_table,
        edge.target_table
      );

      const timeWindow = {
        start: new Date(Date.now() - timeWindowDays * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      };

      const evidence: TraceEvidence = {
        edgeId,
        sourceTable: edge.source_table,
        targetTable: edge.target_table,
        coveragePct,
        confidence: edge.confidence_score || 0.8,
        samplePairs,
        evidenceSources,
        timeWindow,
        metadata: edge.metadata || {},
      };

      logger.info('Trace evidence retrieved', {
        edgeId,
        sampleCount: samplePairs.length,
        coverage: coveragePct,
        confidence: evidence.confidence,
      });

      return evidence;
    } catch (error) {
      logger.error('Failed to get trace evidence', { error, edgeId });
      throw error;
    }
  }

  /**
   * Validate a join between two tables by running a validation query
   */
  async validateJoin(
    sourceTable: string,
    targetTable: string,
    joinColumn: string
  ): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Run validation query to check join integrity
      const validationQuery = `
        WITH source_counts AS (
          SELECT COUNT(*) as total_source
          FROM ${sourceTable}
        ),
        target_counts AS (
          SELECT COUNT(*) as total_target
          FROM ${targetTable}
        ),
        matched_counts AS (
          SELECT COUNT(DISTINCT s.${joinColumn}) as matched
          FROM ${sourceTable} s
          INNER JOIN ${targetTable} t ON s.${joinColumn} = t.${joinColumn}
        )
        SELECT
          sc.total_source,
          tc.total_target,
          mc.matched,
          ROUND(mc.matched::numeric / NULLIF(sc.total_source, 0) * 100, 2) as match_pct
        FROM source_counts sc, target_counts tc, matched_counts mc
      `;

      const result = await this.db.query(validationQuery) as any;
      const stats = result.rows[0];

      const matchedRows = parseInt(stats.matched) || 0;
      const totalRows = parseInt(stats.total_source) || 0;
      const matchPct = parseFloat(stats.match_pct) || 0;
      const confidence = matchPct / 100;

      // Detect discrepancies
      const discrepancies: any[] = [];

      if (matchPct < 95) {
        discrepancies.push({
          issue: `Only ${matchPct.toFixed(2)}% of source rows have matching targets`,
          affectedRows: totalRows - matchedRows,
          severity: matchPct < 50 ? 'critical' : matchPct < 80 ? 'high' : 'medium',
        });
      }

      const executionTime = Date.now() - startTime;

      const validationResult: ValidationResult = {
        isValid: matchPct >= 95,
        matchedRows,
        totalRows,
        confidence,
        discrepancies,
        executionTime,
      };

      logger.info('Join validation completed', {
        sourceTable,
        targetTable,
        joinColumn,
        isValid: validationResult.isValid,
        confidence,
      });

      return validationResult;
    } catch (error) {
      logger.error('Failed to validate join', { error, sourceTable, targetTable });
      throw error;
    }
  }

  /**
   * Get sample row pairs showing source-to-target mapping
   */
  private async getSamplePairs(
    sourceTable: string,
    targetTable: string,
    limit: number,
    maskPII: boolean
  ): Promise<SamplePair[]> {
    try {
      // Try to find common join columns from catalog
      const joinColumnsQuery = `
        SELECT DISTINCT
          cc.column_name,
          cc.referenced_column
        FROM catalog_columns cc
        WHERE cc.table_name = $1
          AND cc.referenced_table = $2
          AND cc.is_foreign_key = true
        LIMIT 1
      `;

      const joinResult = await this.db.query(joinColumnsQuery, [sourceTable, targetTable]) as any;

      if (!joinResult.rows || joinResult.rows.length === 0) {
        // No explicit foreign key found, return empty samples
        return [];
      }

      const joinColumn = joinResult.rows[0].column_name;
      const referencedColumn = joinResult.rows[0].referenced_column || joinColumn;

      // Get sample pairs
      const sampleQuery = `
        SELECT
          s.*,
          t.*
        FROM ${sourceTable} s
        INNER JOIN ${targetTable} t ON s.${joinColumn} = t.${referencedColumn}
        LIMIT $1
      `;

      const samplesResult = await this.db.query(sampleQuery, [limit]) as any;
      const rows = samplesResult.rows || [];

      // Convert to sample pairs with masking
      const samplePairs: SamplePair[] = rows.map((row: any) => {
        const sourceValues: any = {};
        const targetValues: any = {};

        // Split row into source and target (simplified - in production, use table aliases)
        Object.keys(row).forEach((key) => {
          const value = maskPII ? this.maskValue(key, row[key]) : row[key];

          // Simple heuristic: columns prefixed with table name go to respective sides
          if (key.toLowerCase().includes(sourceTable.toLowerCase())) {
            sourceValues[key] = value;
          } else {
            targetValues[key] = value;
          }
        });

        return {
          sourceRowHash: this.hashObject(sourceValues),
          targetRowHash: this.hashObject(targetValues),
          sourceValues,
          targetValues,
          matchedAt: new Date().toISOString(),
          confidence: 0.95,
        };
      });

      return samplePairs;
    } catch (error) {
      logger.error('Failed to get sample pairs', { error, sourceTable, targetTable });
      return [];
    }
  }

  /**
   * Calculate coverage percentage based on row counts
   */
  private async calculateCoverage(
    sourceTable: string,
    targetTable: string,
    timeWindowDays: number
  ): Promise<number> {
    try {
      // Simplified coverage calculation
      // In production, this would analyze query logs and actual data flow

      const coverageQuery = `
        SELECT
          (SELECT COUNT(*) FROM ${sourceTable}) as source_count,
          (SELECT COUNT(*) FROM ${targetTable}) as target_count
      `;

      const result = await this.db.query(coverageQuery) as any;
      const sourceCount = parseInt(result.rows[0]?.source_count) || 0;
      const targetCount = parseInt(result.rows[0]?.target_count) || 0;

      if (sourceCount === 0) return 0;

      // Estimate coverage (in production, analyze actual data flow)
      const coveragePct = Math.min(100, (targetCount / sourceCount) * 100);

      return Math.round(coveragePct * 100) / 100;
    } catch (error) {
      logger.error('Failed to calculate coverage', { error, sourceTable, targetTable });
      return 0;
    }
  }

  /**
   * Determine evidence sources for lineage
   */
  private async getEvidenceSources(
    sourceTable: string,
    targetTable: string
  ): Promise<Array<'query_log' | 'sql_parse' | 'dbt_manifest' | 'fingerprint' | 'manual'>> {
    const sources: Array<'query_log' | 'sql_parse' | 'dbt_manifest' | 'fingerprint' | 'manual'> = [];

    // Check for foreign key constraint (sql_parse evidence)
    const fkQuery = `
      SELECT 1 FROM catalog_columns
      WHERE table_name = $1
        AND referenced_table = $2
        AND is_foreign_key = true
      LIMIT 1
    `;

    const fkResult = await this.db.query(fkQuery, [sourceTable, targetTable]) as any;
    if (fkResult.rows && fkResult.rows.length > 0) {
      sources.push('sql_parse');
    }

    // In production, check for:
    // - Query logs (query_log)
    // - dbt manifest files (dbt_manifest)
    // - Fingerprinting evidence (fingerprint)
    // - Manual confirmations (manual)

    // For now, add fingerprint as a default method
    sources.push('fingerprint');

    return sources;
  }

  /**
   * Mask PII values for display
   */
  private maskValue(columnName: string, value: any): any {
    if (value === null || value === undefined) return value;

    const piiPatterns = [
      /email/i,
      /phone/i,
      /ssn/i,
      /credit.*card/i,
      /password/i,
      /address/i,
    ];

    const shouldMask = piiPatterns.some((pattern) => pattern.test(columnName));

    if (!shouldMask) return value;

    // Mask the value
    if (typeof value === 'string') {
      if (value.length <= 4) return '***';
      return value.substring(0, 2) + '***' + value.substring(value.length - 2);
    }

    return '***';
  }

  /**
   * Hash an object to create a fingerprint
   */
  private hashObject(obj: any): string {
    const crypto = require('crypto');
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  /**
   * Analyze SQL query to extract lineage information
   */
  async analyzeSQL(
    query: string,
    dialect: 'postgresql' | 'mssql' | 'bigquery' | 'snowflake' = 'postgresql'
  ): Promise<{
    tables: Array<{ name: string; type: 'source' | 'target' }>;
    columns: Array<{ table: string; column: string; expression?: string }>;
    joins: Array<{ left: string; right: string; condition: string }>;
    confidence: number;
  }> {
    try {
      // Simplified SQL parsing - in production, use a proper SQL parser like node-sql-parser
      const tableRegex = /FROM\s+([a-zA-Z0-9_]+)|JOIN\s+([a-zA-Z0-9_]+)|INTO\s+([a-zA-Z0-9_]+)/gi;
      const tables: Array<{ name: string; type: 'source' | 'target' }> = [];
      const tablesSet = new Set<string>();

      let match;
      while ((match = tableRegex.exec(query)) !== null) {
        const tableName = match[1] || match[2] || match[3];
        if (tableName && !tablesSet.has(tableName.toLowerCase())) {
          tablesSet.add(tableName.toLowerCase());
          tables.push({
            name: tableName,
            type: match[3] ? 'target' : 'source',
          });
        }
      }

      // Extract column references
      const columnRegex = /([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g;
      const columns: Array<{ table: string; column: string }> = [];
      const columnsSet = new Set<string>();

      while ((match = columnRegex.exec(query)) !== null) {
        const key = `${match[1]}.${match[2]}`;
        if (!columnsSet.has(key.toLowerCase())) {
          columnsSet.add(key.toLowerCase());
          columns.push({
            table: match[1],
            column: match[2],
          });
        }
      }

      // Extract joins
      const joinRegex = /JOIN\s+([a-zA-Z0-9_]+)\s+ON\s+(.+?)(?:WHERE|GROUP|ORDER|LIMIT|;|$)/gi;
      const joins: Array<{ left: string; right: string; condition: string }> = [];

      while ((match = joinRegex.exec(query)) !== null) {
        joins.push({
          left: tables[0]?.name || '',
          right: match[1],
          condition: match[2].trim(),
        });
      }

      // Confidence based on how much we could parse
      const confidence = Math.min(
        1.0,
        (tables.length * 0.3 + columns.length * 0.01 + joins.length * 0.2)
      );

      logger.info('SQL analysis completed', {
        tablesFound: tables.length,
        columnsFound: columns.length,
        joinsFound: joins.length,
        confidence,
      });

      return { tables, columns, joins, confidence };
    } catch (error) {
      logger.error('Failed to analyze SQL', { error, query });
      return { tables: [], columns: [], joins: [], confidence: 0 };
    }
  }
}

export const traceService = new TraceService();
