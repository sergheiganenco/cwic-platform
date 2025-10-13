// SQL Lineage Parser - Automatic lineage extraction from SQL queries
import { logger } from '@/utils/logger';

/**
 * SQL Parser for extracting lineage from SQL queries
 * Supports: PostgreSQL, SQL Server, MySQL, BigQuery
 */

export interface ParsedTable {
  schema?: string;
  table: string;
  alias?: string;
  type: 'source' | 'target';
}

export interface ParsedColumn {
  name: string;
  sourceTable?: string;
  expression?: string;
  alias?: string;
  transformationType: 'direct' | 'calculated' | 'aggregated' | 'casted' | 'concatenated' | 'derived';
}

export interface ColumnLineage {
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  transformation: string;
  transformationType: string;
  confidence: number;
}

export interface ParsedLineage {
  tables: ParsedTable[];
  columns: ParsedColumn[];
  columnLineage: ColumnLineage[];
  joins: Array<{
    leftTable: string;
    rightTable: string;
    condition: string;
  }>;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'CREATE' | 'DELETE' | 'MERGE';
  confidence: number;
}

export class SQLLineageParser {
  /**
   * Parse SQL query and extract lineage information
   */
  static parseSQL(sql: string, dialect: 'postgres' | 'sqlserver' | 'mysql' | 'bigquery' = 'postgres'): ParsedLineage {
    try {
      const normalizedSQL = this.normalizeSQL(sql);
      const queryType = this.detectQueryType(normalizedSQL);

      const tables = this.extractTables(normalizedSQL, queryType);
      const columns = this.extractColumns(normalizedSQL, queryType);
      const joins = this.extractJoins(normalizedSQL);
      const columnLineage = this.buildColumnLineage(tables, columns, joins, normalizedSQL);

      return {
        tables,
        columns,
        columnLineage,
        joins,
        queryType,
        confidence: this.calculateConfidence(normalizedSQL),
      };
    } catch (error) {
      logger.error('SQL parsing error:', error);
      return {
        tables: [],
        columns: [],
        columnLineage: [],
        joins: [],
        queryType: 'SELECT',
        confidence: 0,
      };
    }
  }

  /**
   * Normalize SQL for easier parsing
   */
  private static normalizeSQL(sql: string): string {
    return sql
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Detect query type
   */
  private static detectQueryType(sql: string): ParsedLineage['queryType'] {
    const upperSQL = sql.toUpperCase();
    if (upperSQL.startsWith('SELECT')) return 'SELECT';
    if (upperSQL.startsWith('INSERT')) return 'INSERT';
    if (upperSQL.startsWith('UPDATE')) return 'UPDATE';
    if (upperSQL.startsWith('CREATE')) return 'CREATE';
    if (upperSQL.startsWith('DELETE')) return 'DELETE';
    if (upperSQL.startsWith('MERGE')) return 'MERGE';
    return 'SELECT';
  }

  /**
   * Extract tables from SQL
   */
  private static extractTables(sql: string, queryType: ParsedLineage['queryType']): ParsedTable[] {
    const tables: ParsedTable[] = [];

    // Extract INSERT/UPDATE/CREATE target tables
    if (queryType === 'INSERT' || queryType === 'UPDATE' || queryType === 'CREATE') {
      const targetMatch = sql.match(/(?:INSERT INTO|UPDATE|CREATE TABLE)\s+(?:(\w+)\.)?(\w+)/i);
      if (targetMatch) {
        tables.push({
          schema: targetMatch[1],
          table: targetMatch[2],
          type: 'target',
        });
      }
    }

    // Extract FROM clause tables
    const fromMatch = sql.match(/FROM\s+([\s\S]+?)(?:WHERE|GROUP BY|ORDER BY|LIMIT|JOIN|;|$)/i);
    if (fromMatch) {
      const fromClause = fromMatch[1];
      const tableMatches = fromClause.matchAll(/(?:(\w+)\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi);

      for (const match of tableMatches) {
        tables.push({
          schema: match[1],
          table: match[2],
          alias: match[3],
          type: 'source',
        });
      }
    }

    // Extract JOIN tables
    const joinMatches = sql.matchAll(/JOIN\s+(?:(\w+)\.)?(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi);
    for (const match of joinMatches) {
      tables.push({
        schema: match[1],
        table: match[2],
        alias: match[3],
        type: 'source',
      });
    }

    return tables;
  }

  /**
   * Extract columns from SELECT clause
   */
  private static extractColumns(sql: string, queryType: ParsedLineage['queryType']): ParsedColumn[] {
    const columns: ParsedColumn[] = [];

    if (queryType !== 'SELECT' && queryType !== 'INSERT' && queryType !== 'CREATE') {
      return columns;
    }

    const selectMatch = sql.match(/SELECT\s+([\s\S]+?)\s+FROM/i);
    if (!selectMatch) return columns;

    const selectClause = selectMatch[1];

    // Handle SELECT *
    if (selectClause.trim() === '*') {
      columns.push({
        name: '*',
        transformationType: 'direct',
      });
      return columns;
    }

    // Split by comma (simple approach - doesn't handle nested functions well)
    const columnExpressions = this.splitByComma(selectClause);

    for (const expr of columnExpressions) {
      const column = this.parseColumnExpression(expr.trim());
      if (column) {
        columns.push(column);
      }
    }

    return columns;
  }

  /**
   * Parse individual column expression
   */
  private static parseColumnExpression(expr: string): ParsedColumn | null {
    // Handle aliases (AS keyword or space)
    const aliasMatch = expr.match(/^(.+?)\s+(?:AS\s+)?(\w+)$/i);
    const expression = aliasMatch ? aliasMatch[1].trim() : expr;
    const alias = aliasMatch ? aliasMatch[2] : undefined;

    // Detect transformation type
    const transformationType = this.detectTransformationType(expression);

    // Extract source table and column
    const tableColumnMatch = expression.match(/^(\w+)\.(\w+)$/);
    const sourceTable = tableColumnMatch ? tableColumnMatch[1] : undefined;
    const columnName = tableColumnMatch ? tableColumnMatch[2] : (alias || expression);

    return {
      name: columnName,
      sourceTable,
      expression: expression !== columnName ? expression : undefined,
      alias,
      transformationType,
    };
  }

  /**
   * Detect transformation type from expression
   */
  private static detectTransformationType(expr: string): ParsedColumn['transformationType'] {
    const upperExpr = expr.toUpperCase();

    // Aggregation functions
    if (/\b(SUM|COUNT|AVG|MIN|MAX|GROUP_CONCAT|STRING_AGG)\b/.test(upperExpr)) {
      return 'aggregated';
    }

    // Type casting
    if (/\bCAST\b|\:\:|\bCONVERT\b/.test(upperExpr)) {
      return 'casted';
    }

    // String concatenation
    if (/\|\||CONCAT/.test(upperExpr)) {
      return 'concatenated';
    }

    // Mathematical operations or functions
    if (/[\+\-\*\/]|ROUND|FLOOR|CEIL|ABS|POWER/.test(upperExpr)) {
      return 'calculated';
    }

    // String functions
    if (/LOWER|UPPER|TRIM|SUBSTRING|LEFT|RIGHT|REPLACE/.test(upperExpr)) {
      return 'calculated';
    }

    // CASE statements
    if (/\bCASE\b/.test(upperExpr)) {
      return 'derived';
    }

    // Simple column reference
    if (/^\w+\.\w+$/.test(expr) || /^\w+$/.test(expr)) {
      return 'direct';
    }

    return 'derived';
  }

  /**
   * Extract JOIN conditions
   */
  private static extractJoins(sql: string): ParsedLineage['joins'] {
    const joins: ParsedLineage['joins'] = [];

    const joinMatches = sql.matchAll(/JOIN\s+(\w+)\s+(?:AS\s+)?(\w+)?\s+ON\s+([\s\S]+?)(?=\s+(?:LEFT|RIGHT|INNER|JOIN|WHERE|GROUP BY|ORDER BY|;|$))/gi);

    for (const match of joinMatches) {
      const rightTable = match[2] || match[1];
      const condition = match[3].trim();

      // Extract left table from condition (simple approach)
      const conditionMatch = condition.match(/(\w+)\./);
      const leftTable = conditionMatch ? conditionMatch[1] : '';

      joins.push({
        leftTable,
        rightTable,
        condition,
      });
    }

    return joins;
  }

  /**
   * Build column-level lineage
   */
  private static buildColumnLineage(
    tables: ParsedTable[],
    columns: ParsedColumn[],
    joins: ParsedLineage['joins'],
    sql: string
  ): ColumnLineage[] {
    const lineage: ColumnLineage[] = [];
    const targetTable = tables.find(t => t.type === 'target');

    if (!targetTable) return lineage;

    for (const column of columns) {
      if (column.name === '*') {
        // Handle SELECT * - create lineage for all source tables
        const sourceTables = tables.filter(t => t.type === 'source');
        for (const sourceTable of sourceTables) {
          lineage.push({
            sourceTable: sourceTable.table,
            sourceColumn: '*',
            targetTable: targetTable.table,
            targetColumn: '*',
            transformation: 'SELECT * FROM ' + sourceTable.table,
            transformationType: 'direct',
            confidence: 0.8,
          });
        }
        continue;
      }

      // Determine source table
      let sourceTable = column.sourceTable;
      if (!sourceTable && tables.length === 2) {
        // If only one source table, assume it's from there
        const source = tables.find(t => t.type === 'source');
        sourceTable = source?.table;
      }

      if (sourceTable) {
        lineage.push({
          sourceTable,
          sourceColumn: column.name,
          targetTable: targetTable.table,
          targetColumn: column.alias || column.name,
          transformation: column.expression || column.name,
          transformationType: column.transformationType,
          confidence: this.calculateColumnConfidence(column),
        });
      }
    }

    return lineage;
  }

  /**
   * Calculate confidence score for column lineage
   */
  private static calculateColumnConfidence(column: ParsedColumn): number {
    if (column.transformationType === 'direct') return 0.95;
    if (column.transformationType === 'calculated') return 0.85;
    if (column.transformationType === 'aggregated') return 0.80;
    if (column.transformationType === 'casted') return 0.90;
    if (column.transformationType === 'concatenated') return 0.85;
    return 0.70; // derived
  }

  /**
   * Calculate overall confidence score for the parse
   */
  private static calculateConfidence(sql: string): number {
    let confidence = 1.0;

    // Lower confidence for complex queries
    const complexity = (sql.match(/JOIN/gi) || []).length;
    confidence -= complexity * 0.05;

    // Lower confidence for subqueries
    const subqueries = (sql.match(/\(\s*SELECT/gi) || []).length;
    confidence -= subqueries * 0.10;

    // Lower confidence for CTEs
    const ctes = (sql.match(/WITH\s+\w+\s+AS/gi) || []).length;
    confidence -= ctes * 0.05;

    return Math.max(0.5, Math.min(1.0, confidence));
  }

  /**
   * Split string by comma, respecting parentheses
   */
  private static splitByComma(str: string): string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Extract lineage from common ETL patterns
   */
  static extractLineageFromETL(queries: string[]): ColumnLineage[] {
    const allLineage: ColumnLineage[] = [];

    for (const query of queries) {
      const parsed = this.parseSQL(query);
      allLineage.push(...parsed.columnLineage);
    }

    // Merge and deduplicate
    return this.mergeLineage(allLineage);
  }

  /**
   * Merge duplicate lineage entries
   */
  private static mergeLineage(lineage: ColumnLineage[]): ColumnLineage[] {
    const merged = new Map<string, ColumnLineage>();

    for (const entry of lineage) {
      const key = `${entry.sourceTable}.${entry.sourceColumn}->${entry.targetTable}.${entry.targetColumn}`;

      if (merged.has(key)) {
        const existing = merged.get(key)!;
        // Keep the entry with higher confidence
        if (entry.confidence > existing.confidence) {
          merged.set(key, entry);
        }
      } else {
        merged.set(key, entry);
      }
    }

    return Array.from(merged.values());
  }

  /**
   * Parse dbt model file
   */
  static parseDbtModel(modelSQL: string, modelName: string): ParsedLineage {
    // Remove dbt Jinja syntax for basic parsing
    const cleanedSQL = modelSQL
      .replace(/\{\{[^}]+\}\}/g, '') // Remove {{ ref(...) }} and {{ config(...) }}
      .replace(/\{%[^%]+%\}/g, ''); // Remove {% ... %}

    const parsed = this.parseSQL(cleanedSQL);

    // Set target table as the model name
    parsed.tables.push({
      table: modelName,
      type: 'target',
    });

    return parsed;
  }
}

export default SQLLineageParser;
