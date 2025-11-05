// src/services/AILineageService.ts - AI-Powered Lineage Connection Suggestions
import { logger } from '@/utils/logger';
import { z } from 'zod';
import { DatabaseService } from './DatabaseService';

/* ──────────────────────────────────────────────────────────────────────────
 * Schemas & Types
 * ────────────────────────────────────────────────────────────────────────── */

export interface AIConnectionSuggestion {
  id: string;
  sourceTable: string;
  targetTable: string;
  confidence: number;
  reason: string;
  matchingColumns: Array<{
    source: string;
    target: string;
    similarity: number;
    similarityType: 'name' | 'type' | 'data_pattern' | 'cardinality';
  }>;
  suggestedJoinType: 'inner' | 'left' | 'right' | 'outer';
  metadata?: Record<string, any>;
}

interface TableMetadata {
  tableName: string;
  schemaName: string;
  databaseName: string;
  columns: ColumnMetadata[];
  rowCount?: number;
  sampleData?: any[];
}

interface ColumnMetadata {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  uniqueCount?: number;
  nullCount?: number;
}

const SuggestionRequestSchema = z.object({
  dataSourceId: z.string().uuid(),
  server: z.string().optional(),
  database: z.string().optional(),
  minConfidence: z.number().min(0).max(1).default(0.7),
  maxSuggestions: z.number().min(1).max(100).default(20),
  analyzeSampleData: z.boolean().default(false),
});

/* ──────────────────────────────────────────────────────────────────────────
 * AILineageService Class
 * ────────────────────────────────────────────────────────────────────────── */

export class AILineageService {
  private dbService: DatabaseService;

  constructor() {
    this.dbService = new DatabaseService();
  }

  /**
   * Generate AI-powered connection suggestions for tables without explicit foreign keys
   */
  async generateConnectionSuggestions(
    request: z.infer<typeof SuggestionRequestSchema>
  ): Promise<AIConnectionSuggestion[]> {
    const validatedRequest = SuggestionRequestSchema.parse(request);

    logger.info('Generating AI connection suggestions', validatedRequest);

    try {
      // 1. Get all tables in scope
      const tables = await this.getTablesMetadata(
        validatedRequest.dataSourceId,
        validatedRequest.server,
        validatedRequest.database
      );

      if (tables.length < 2) {
        logger.warn('Not enough tables to generate suggestions');
        return [];
      }

      // 2. Generate suggestions using multiple strategies
      const suggestions: AIConnectionSuggestion[] = [];

      // Strategy 1: Column name pattern matching
      const nameSuggestions = this.analyzeColumnNamePatterns(tables);
      suggestions.push(...nameSuggestions);

      // Strategy 2: Data type similarity
      const typeSuggestions = this.analyzeDataTypes(tables);
      suggestions.push(...typeSuggestions);

      // Strategy 3: Cardinality analysis (for FK-like relationships)
      const cardinalitySuggestions = await this.analyzeCardinality(tables);
      suggestions.push(...cardinalitySuggestions);

      // Strategy 4: Sample data analysis (if enabled)
      if (validatedRequest.analyzeSampleData) {
        const dataSuggestions = await this.analyzeSampleData(tables);
        suggestions.push(...dataSuggestions);
      }

      // 3. Merge and rank suggestions
      const mergedSuggestions = this.mergeDuplicateSuggestions(suggestions);

      // 4. Filter by confidence threshold
      const filteredSuggestions = mergedSuggestions
        .filter((s) => s.confidence >= validatedRequest.minConfidence)
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, validatedRequest.maxSuggestions);

      logger.info(`Generated ${filteredSuggestions.length} connection suggestions`);
      return filteredSuggestions;
    } catch (error) {
      logger.error('Failed to generate connection suggestions', error);
      throw error;
    }
  }

  /**
   * Get metadata for all tables in scope
   */
  private async getTablesMetadata(
    dataSourceId: string,
    server?: string,
    database?: string
  ): Promise<TableMetadata[]> {
    // TODO: Implement actual database query to fetch table metadata
    // This is a mock implementation for demonstration

    // In production, this would query:
    // 1. information_schema.tables
    // 2. information_schema.columns
    // 3. table statistics

    const mockTables: TableMetadata[] = [
      {
        tableName: 'customers',
        schemaName: 'public',
        databaseName: 'sales_db',
        rowCount: 15243,
        columns: [
          { name: 'customer_id', type: 'INTEGER', nullable: false, isPrimaryKey: true, uniqueCount: 15243 },
          { name: 'email', type: 'VARCHAR', nullable: false, uniqueCount: 15243 },
          { name: 'name', type: 'VARCHAR', nullable: false },
        ],
      },
      {
        tableName: 'orders',
        schemaName: 'public',
        databaseName: 'sales_db',
        rowCount: 45678,
        columns: [
          { name: 'order_id', type: 'INTEGER', nullable: false, isPrimaryKey: true },
          { name: 'customer_id', type: 'INTEGER', nullable: false, uniqueCount: 12456 },
          { name: 'order_date', type: 'TIMESTAMP', nullable: false },
        ],
      },
      {
        tableName: 'customer_analytics',
        schemaName: 'public',
        databaseName: 'analytics_db',
        rowCount: 15243,
        columns: [
          { name: 'cust_id', type: 'INTEGER', nullable: false, uniqueCount: 15243 },
          { name: 'lifetime_value', type: 'DECIMAL', nullable: false },
          { name: 'segment', type: 'VARCHAR', nullable: false },
        ],
      },
    ];

    return mockTables;
  }

  /**
   * Strategy 1: Analyze column name patterns
   */
  private analyzeColumnNamePatterns(tables: TableMetadata[]): AIConnectionSuggestion[] {
    const suggestions: AIConnectionSuggestion[] = [];

    // Common FK patterns
    const fkPatterns = [
      { pattern: /^(.+)_id$/, confidence: 0.9 },
      { pattern: /^id_(.+)$/, confidence: 0.85 },
      { pattern: /^(.+)_fk$/, confidence: 0.95 },
      { pattern: /^fk_(.+)$/, confidence: 0.95 },
      { pattern: /^(.+)_key$/, confidence: 0.8 },
    ];

    for (const sourceTable of tables) {
      for (const sourceCol of sourceTable.columns) {
        // Check if column matches FK pattern
        for (const { pattern, confidence } of fkPatterns) {
          const match = sourceCol.name.match(pattern);
          if (match) {
            const baseNameCol = match[1];

            // Find tables that might be referenced
            for (const targetTable of tables) {
              if (targetTable.tableName === sourceTable.tableName) continue;

              // Check if target table name matches
              const tableNameSimilarity = this.calculateStringSimilarity(
                baseNameCol.toLowerCase(),
                targetTable.tableName.toLowerCase()
              );

              // Check if target table has a matching PK
              const pkColumn = targetTable.columns.find((c) => c.isPrimaryKey);
              if (pkColumn && tableNameSimilarity > 0.6) {
                suggestions.push({
                  id: `${sourceTable.tableName}-${targetTable.tableName}-${Date.now()}`,
                  sourceTable: sourceTable.tableName,
                  targetTable: targetTable.tableName,
                  confidence: confidence * tableNameSimilarity,
                  reason: `Column '${sourceCol.name}' follows FK naming pattern and references table '${targetTable.tableName}'`,
                  matchingColumns: [
                    {
                      source: sourceCol.name,
                      target: pkColumn.name,
                      similarity: tableNameSimilarity,
                      similarityType: 'name',
                    },
                  ],
                  suggestedJoinType: sourceCol.nullable ? 'left' : 'inner',
                  metadata: {
                    pattern: pattern.toString(),
                    baseNameCol,
                  },
                });
              }
            }
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Strategy 2: Analyze data type compatibility
   */
  private analyzeDataTypes(tables: TableMetadata[]): AIConnectionSuggestion[] {
    const suggestions: AIConnectionSuggestion[] = [];

    for (const sourceTable of tables) {
      for (const targetTable of tables) {
        if (sourceTable.tableName === targetTable.tableName) continue;

        for (const sourceCol of sourceTable.columns) {
          for (const targetCol of targetTable.columns) {
            // Skip if not PK in target
            if (!targetCol.isPrimaryKey) continue;

            // Check data type compatibility
            const typeCompatible = this.areTypesCompatible(sourceCol.type, targetCol.type);
            if (!typeCompatible) continue;

            // Calculate name similarity
            const nameSimilarity = this.calculateStringSimilarity(
              sourceCol.name.toLowerCase(),
              targetCol.name.toLowerCase()
            );

            if (nameSimilarity > 0.7) {
              suggestions.push({
                id: `${sourceTable.tableName}-${targetTable.tableName}-${Date.now()}`,
                sourceTable: sourceTable.tableName,
                targetTable: targetTable.tableName,
                confidence: 0.75 * nameSimilarity,
                reason: `Columns '${sourceCol.name}' and '${targetCol.name}' have compatible types and similar names`,
                matchingColumns: [
                  {
                    source: sourceCol.name,
                    target: targetCol.name,
                    similarity: nameSimilarity,
                    similarityType: 'type',
                  },
                ],
                suggestedJoinType: sourceCol.nullable ? 'left' : 'inner',
              });
            }
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Strategy 3: Analyze cardinality relationships
   */
  private async analyzeCardinality(tables: TableMetadata[]): Promise<AIConnectionSuggestion[]> {
    const suggestions: AIConnectionSuggestion[] = [];

    for (const sourceTable of tables) {
      for (const targetTable of tables) {
        if (sourceTable.tableName === targetTable.tableName) continue;

        for (const sourceCol of sourceTable.columns) {
          for (const targetCol of targetTable.columns) {
            // Check if cardinality suggests FK relationship
            // Many-to-one: source.uniqueCount < source.rowCount && target.uniqueCount ≈ target.rowCount
            if (
              sourceCol.uniqueCount &&
              targetCol.uniqueCount &&
              sourceTable.rowCount &&
              targetTable.rowCount
            ) {
              const sourceUniqueness = sourceCol.uniqueCount / sourceTable.rowCount;
              const targetUniqueness = targetCol.uniqueCount / targetTable.rowCount;

              // Potential FK: source has duplicates, target is mostly unique
              if (sourceUniqueness < 0.9 && targetUniqueness > 0.95) {
                const confidence = 0.6 + (targetUniqueness - sourceUniqueness) * 0.3;

                suggestions.push({
                  id: `${sourceTable.tableName}-${targetTable.tableName}-${Date.now()}`,
                  sourceTable: sourceTable.tableName,
                  targetTable: targetTable.tableName,
                  confidence,
                  reason: `Cardinality analysis suggests many-to-one relationship (${sourceCol.uniqueCount} unique in ${sourceTable.rowCount} rows → ${targetCol.uniqueCount} unique in ${targetTable.rowCount} rows)`,
                  matchingColumns: [
                    {
                      source: sourceCol.name,
                      target: targetCol.name,
                      similarity: confidence,
                      similarityType: 'cardinality',
                    },
                  ],
                  suggestedJoinType: 'left',
                  metadata: {
                    sourceUniqueness,
                    targetUniqueness,
                  },
                });
              }
            }
          }
        }
      }
    }

    return suggestions;
  }

  /**
   * Strategy 4: Analyze sample data patterns
   */
  private async analyzeSampleData(tables: TableMetadata[]): Promise<AIConnectionSuggestion[]> {
    // TODO: Implement sample data analysis
    // This would:
    // 1. Query sample rows from each table
    // 2. Check for value overlaps
    // 3. Validate join success rates
    // 4. Analyze data distribution

    return [];
  }

  /**
   * Merge duplicate suggestions and average their confidence scores
   */
  private mergeDuplicateSuggestions(
    suggestions: AIConnectionSuggestion[]
  ): AIConnectionSuggestion[] {
    const map = new Map<string, AIConnectionSuggestion>();

    for (const suggestion of suggestions) {
      const key = `${suggestion.sourceTable}-${suggestion.targetTable}`;

      if (map.has(key)) {
        const existing = map.get(key)!;

        // Merge matching columns
        const mergedColumns = [...existing.matchingColumns];
        for (const newCol of suggestion.matchingColumns) {
          const exists = mergedColumns.some(
            (c) => c.source === newCol.source && c.target === newCol.target
          );
          if (!exists) {
            mergedColumns.push(newCol);
          }
        }

        // Average confidence scores
        const avgConfidence = (existing.confidence + suggestion.confidence) / 2;

        // Merge reasons
        const mergedReason = `${existing.reason}; ${suggestion.reason}`;

        map.set(key, {
          ...existing,
          confidence: Math.min(avgConfidence + 0.1, 1.0), // Boost for multiple signals
          reason: mergedReason,
          matchingColumns: mergedColumns,
        });
      } else {
        map.set(key, suggestion);
      }
    }

    return Array.from(map.values());
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance algorithm
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Check if two data types are compatible for joins
   */
  private areTypesCompatible(type1: string, type2: string): boolean {
    const normalizedType1 = type1.toUpperCase().replace(/\(.*\)/, '');
    const normalizedType2 = type2.toUpperCase().replace(/\(.*\)/, '');

    // Integer types
    const integerTypes = ['INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT'];
    if (
      integerTypes.some((t) => normalizedType1.includes(t)) &&
      integerTypes.some((t) => normalizedType2.includes(t))
    ) {
      return true;
    }

    // String types
    const stringTypes = ['VARCHAR', 'CHAR', 'TEXT', 'NVARCHAR', 'NCHAR'];
    if (
      stringTypes.some((t) => normalizedType1.includes(t)) &&
      stringTypes.some((t) => normalizedType2.includes(t))
    ) {
      return true;
    }

    // Exact match
    return normalizedType1 === normalizedType2;
  }

  /**
   * Get AI-powered lineage insights for a specific table
   */
  async getLineageInsights(
    tableName: string,
    dataSourceId: string
  ): Promise<{
    orphaned: boolean;
    missingFKs: number;
    potentialIssues: string[];
    optimizationSuggestions: string[];
  }> {
    // TODO: Implement comprehensive lineage insights

    return {
      orphaned: false,
      missingFKs: 3,
      potentialIssues: [
        'No foreign key constraints defined',
        'Column naming suggests relationships not captured in lineage',
      ],
      optimizationSuggestions: [
        'Add index on customer_id for better join performance',
        'Consider materialized view for frequently joined tables',
      ],
    };
  }
}

export default AILineageService;
