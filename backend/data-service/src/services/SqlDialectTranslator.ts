// backend/data-service/src/services/SqlDialectTranslator.ts
// Translates SQL queries between different database dialects

import { logger } from '../utils/logger';

export type DatabaseDialect = 'postgres' | 'mssql' | 'mysql' | 'oracle' | 'mongodb';

export class SqlDialectTranslator {
  /**
   * Translate a SQL query from one dialect to another
   */
  static translate(
    sql: string,
    fromDialect: DatabaseDialect,
    toDialect: DatabaseDialect
  ): string {
    if (fromDialect === toDialect) {
      return sql;
    }

    logger.info(`Translating SQL from ${fromDialect} to ${toDialect}`);

    let translated = sql;

    // PostgreSQL → SQL Server
    if (fromDialect === 'postgres' && toDialect === 'mssql') {
      translated = this.postgresqlToMssql(sql);
    }
    // PostgreSQL → MySQL
    else if (fromDialect === 'postgres' && toDialect === 'mysql') {
      translated = this.postgresqlToMysql(sql);
    }
    // PostgreSQL → Oracle
    else if (fromDialect === 'postgres' && toDialect === 'oracle') {
      translated = this.postgresqlToOracle(sql);
    }
    // SQL Server → PostgreSQL
    else if (fromDialect === 'mssql' && toDialect === 'postgres') {
      translated = this.mssqlToPostgresql(sql);
    }
    // Add other combinations as needed
    else {
      logger.warn(`No translation available from ${fromDialect} to ${toDialect}, using original SQL`);
    }

    return translated;
  }

  /**
   * PostgreSQL → SQL Server
   */
  private static postgresqlToMssql(sql: string): string {
    let translated = sql;

    // 1. FILTER (WHERE ...) → CASE WHEN
    // PostgreSQL: COUNT(*) FILTER (WHERE column IS NULL)
    // SQL Server: SUM(CASE WHEN column IS NULL THEN 1 ELSE 0 END)
    translated = translated.replace(
      /COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+(.+?)\)/gi,
      'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)'
    );

    translated = translated.replace(
      /COUNT\((.+?)\)\s+FILTER\s*\(\s*WHERE\s+(.+?)\)/gi,
      'SUM(CASE WHEN $2 THEN 1 ELSE 0 END)'
    );

    // 2. Double quotes → Square brackets for identifiers
    // PostgreSQL: "table_name"."column_name"
    // SQL Server: [table_name].[column_name]
    translated = translated.replace(/"([^"]+)"/g, '[$1]');

    // 3. BOOLEAN type → BIT
    // PostgreSQL: column::BOOLEAN
    // SQL Server: CAST(column AS BIT)
    translated = translated.replace(/::BOOLEAN/gi, ' AS BIT');
    translated = translated.replace(/::boolean/g, ' AS BIT');

    // 4. String concatenation
    // PostgreSQL: 'string' || column
    // SQL Server: 'string' + column
    translated = translated.replace(/\|\|/g, '+');

    // 5. LIMIT/OFFSET → TOP/OFFSET-FETCH
    // PostgreSQL: LIMIT 10 OFFSET 5
    // SQL Server: OFFSET 5 ROWS FETCH NEXT 10 ROWS ONLY
    const limitMatch = translated.match(/LIMIT\s+(\d+)(?:\s+OFFSET\s+(\d+))?/i);
    if (limitMatch) {
      const limit = limitMatch[1];
      const offset = limitMatch[2] || '0';

      if (offset === '0') {
        // Simple LIMIT → TOP
        translated = translated.replace(/LIMIT\s+\d+/i, `TOP ${limit}`);
        translated = translated.replace(/SELECT\s+/i, `SELECT TOP ${limit} `);
      } else {
        // LIMIT with OFFSET → OFFSET-FETCH
        translated = translated.replace(/LIMIT\s+\d+\s+OFFSET\s+\d+/i,
          `OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY`);
      }
    }

    // 6. NULLIF → NULLIF (same syntax, but check for edge cases)
    // Already compatible

    // 7. Regex operators
    // PostgreSQL: column ~ 'pattern'
    // SQL Server: column LIKE 'pattern' (approximate, may need adjustment)
    translated = translated.replace(/(\w+)\s+~\s+'([^']+)'/g, "$1 LIKE '%$2%'");
    translated = translated.replace(/(\w+)\s+!~\s+'([^']+)'/g, "$1 NOT LIKE '%$2%'");

    // 8. CURRENT_TIMESTAMP compatibility
    // Already compatible

    return translated;
  }

  /**
   * PostgreSQL → MySQL
   */
  private static postgresqlToMysql(sql: string): string {
    let translated = sql;

    // 1. FILTER (WHERE ...) → Not directly supported, use SUM(CASE...)
    translated = translated.replace(
      /COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+(.+?)\)/gi,
      'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)'
    );

    // 2. Double quotes → Backticks for identifiers
    // PostgreSQL: "table_name"
    // MySQL: `table_name`
    translated = translated.replace(/"([^"]+)"/g, '`$1`');

    // 3. String concatenation
    // PostgreSQL: 'string' || column
    // MySQL: CONCAT('string', column)
    const concatMatches = translated.match(/'[^']+'\s*\|\|\s*\w+/g);
    if (concatMatches) {
      concatMatches.forEach(match => {
        const parts = match.split('||').map(p => p.trim());
        translated = translated.replace(match, `CONCAT(${parts.join(', ')})`);
      });
    }

    // 4. BOOLEAN → TINYINT
    translated = translated.replace(/::BOOLEAN/gi, ' AS UNSIGNED');

    return translated;
  }

  /**
   * PostgreSQL → Oracle
   */
  private static postgresqlToOracle(sql: string): string {
    let translated = sql;

    // 1. FILTER (WHERE ...) → Not supported, use SUM(CASE...)
    translated = translated.replace(
      /COUNT\(\*\)\s+FILTER\s*\(\s*WHERE\s+(.+?)\)/gi,
      'SUM(CASE WHEN $1 THEN 1 ELSE 0 END)'
    );

    // 2. LIMIT → ROWNUM or FETCH FIRST
    const limitMatch = translated.match(/LIMIT\s+(\d+)/i);
    if (limitMatch) {
      const limit = limitMatch[1];
      translated = translated.replace(/LIMIT\s+\d+/i, `FETCH FIRST ${limit} ROWS ONLY`);
    }

    // 3. OFFSET → ROW_NUMBER() in subquery
    // This is complex and may need manual adjustment

    // 4. String concatenation
    // PostgreSQL: 'string' || column
    // Oracle: 'string' || column (same!)
    // Already compatible

    return translated;
  }

  /**
   * SQL Server → PostgreSQL
   */
  private static mssqlToPostgresql(sql: string): string {
    let translated = sql;

    // 1. Square brackets → Double quotes for identifiers
    // SQL Server: [table_name].[column_name]
    // PostgreSQL: "table_name"."column_name"
    translated = translated.replace(/\[([^\]]+)\]/g, '"$1"');

    // 2. TOP → LIMIT
    // SQL Server: SELECT TOP 10 * FROM table
    // PostgreSQL: SELECT * FROM table LIMIT 10
    const topMatch = translated.match(/SELECT\s+TOP\s+(\d+)\s+/i);
    if (topMatch) {
      const limit = topMatch[1];
      translated = translated.replace(/SELECT\s+TOP\s+\d+\s+/i, 'SELECT ');
      translated += ` LIMIT ${limit}`;
    }

    // 3. String concatenation
    // SQL Server: 'string' + column
    // PostgreSQL: 'string' || column
    translated = translated.replace(/\s\+\s/g, ' || ');

    // 4. GETDATE() → CURRENT_TIMESTAMP
    translated = translated.replace(/GETDATE\(\)/gi, 'CURRENT_TIMESTAMP');

    // 5. LEN() → LENGTH()
    translated = translated.replace(/LEN\(/gi, 'LENGTH(');

    return translated;
  }

  /**
   * Get the dialect name for a database type
   */
  static getDialectForType(dbType: string): DatabaseDialect {
    const typeMap: Record<string, DatabaseDialect> = {
      'postgresql': 'postgres',
      'postgres': 'postgres',
      'mssql': 'mssql',
      'sqlserver': 'mssql',
      'mysql': 'mysql',
      'mariadb': 'mysql',
      'oracle': 'oracle',
      'mongodb': 'mongodb',
      'mongo': 'mongodb'
    };

    const normalized = dbType.toLowerCase();
    return typeMap[normalized] || 'postgres'; // Default to postgres
  }

  /**
   * Check if a SQL query is dialect-specific
   */
  static needsTranslation(sql: string, fromDialect: DatabaseDialect, toDialect: DatabaseDialect): boolean {
    if (fromDialect === toDialect) {
      return false;
    }

    // Check for PostgreSQL-specific syntax
    if (fromDialect === 'postgres') {
      const pgSpecific = [
        /FILTER\s*\(\s*WHERE/i,
        /::/,  // Type casting
        /~\s*'/, // Regex operator
        /"[^"]+"/  // Double-quoted identifiers
      ];

      return pgSpecific.some(pattern => pattern.test(sql));
    }

    // Check for SQL Server-specific syntax
    if (fromDialect === 'mssql') {
      const mssqlSpecific = [
        /\[[^\]]+\]/,  // Square brackets
        /TOP\s+\d+/i,
        /GETDATE\(\)/i,
        /\s\+\s/  // String concatenation with +
      ];

      return mssqlSpecific.some(pattern => pattern.test(sql));
    }

    return true; // Assume translation needed if uncertain
  }
}
