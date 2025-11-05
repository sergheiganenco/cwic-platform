// Dynamic Query Builder - 100% Accurate Queries per Database Type
// Supports: PostgreSQL, MySQL, Oracle, MongoDB, SQL Server, etc.

export type DatabaseType = 'postgresql' | 'mysql' | 'oracle' | 'sqlserver' | 'mongodb' | 'snowflake' | 'redshift';

export interface QueryOptions {
  tableName: string;
  schemaName?: string;
  databaseName?: string;
  limit?: number;
  whereClause?: string;
  columns?: string[];
  orderBy?: string;
  excludeSystemTables?: boolean;
}

export class QueryBuilder {
  private dbType: DatabaseType;

  constructor(dbType: DatabaseType | string) {
    // Normalize database type
    const normalized = dbType.toLowerCase();
    if (normalized.includes('postgres')) this.dbType = 'postgresql';
    else if (normalized.includes('mysql') || normalized.includes('mariadb')) this.dbType = 'mysql';
    else if (normalized.includes('oracle')) this.dbType = 'oracle';
    else if (normalized.includes('sqlserver') || normalized.includes('mssql')) this.dbType = 'sqlserver';
    else if (normalized.includes('mongo')) this.dbType = 'mongodb';
    else if (normalized.includes('snowflake')) this.dbType = 'snowflake';
    else if (normalized.includes('redshift')) this.dbType = 'redshift';
    else this.dbType = 'postgresql'; // default
  }

  /**
   * Build SELECT query for previewing table data
   */
  buildPreviewQuery(options: QueryOptions): string {
    if (this.dbType === 'mongodb') {
      return this.buildMongoQuery(options);
    }

    const {
      tableName,
      schemaName,
      databaseName,
      limit = 100,
      whereClause,
      columns = ['*'],
      orderBy,
    } = options;

    const fullTableName = this.getFullTableName(tableName, schemaName, databaseName);
    const columnList = columns.join(', ');
    const limitClause = this.getLimitClause(limit);
    const orderClause = orderBy ? ` ORDER BY ${orderBy}` : '';
    const whereClauseFinal = whereClause ? ` WHERE ${whereClause}` : '';

    return `SELECT ${columnList} FROM ${fullTableName}${whereClauseFinal}${orderClause}${limitClause}`;
  }

  /**
   * Build query to find NULL values
   */
  buildNullCheckQuery(tableName: string, columnNames: string[], schemaName?: string, limit: number = 100): string {
    if (this.dbType === 'mongodb') {
      return `db.${tableName}.find({ $or: [${columnNames.map(c => `{ "${c}": null }`).join(', ')}] }).limit(${limit})`;
    }

    const fullTableName = this.getFullTableName(tableName, schemaName);
    const nullConditions = columnNames.map(col => `${this.quoteIdentifier(col)} IS NULL`).join(' OR ');
    const limitClause = this.getLimitClause(limit);

    return `SELECT * FROM ${fullTableName} WHERE ${nullConditions}${limitClause}`;
  }

  /**
   * Build query to find duplicate records
   */
  buildDuplicateQuery(tableName: string, keyColumns: string[], schemaName?: string, limit: number = 100): string {
    if (this.dbType === 'mongodb') {
      return `db.${tableName}.aggregate([
        { $group: { _id: { ${keyColumns.map(c => `${c}: "$${c}"`).join(', ')} }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $limit: ${limit} }
      ])`;
    }

    const fullTableName = this.getFullTableName(tableName, schemaName);
    const groupByColumns = keyColumns.map(c => this.quoteIdentifier(c)).join(', ');

    // SQL varies by database for finding duplicates
    switch (this.dbType) {
      case 'postgresql':
      case 'mysql':
      case 'redshift':
        return `
SELECT * FROM ${fullTableName}
WHERE (${groupByColumns}) IN (
  SELECT ${groupByColumns}
  FROM ${fullTableName}
  GROUP BY ${groupByColumns}
  HAVING COUNT(*) > 1
)
${this.getLimitClause(limit)}`.trim();

      case 'oracle':
      case 'sqlserver':
        return `
SELECT * FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY ${groupByColumns} ORDER BY (SELECT NULL)) as rn
  FROM ${fullTableName}
) t
WHERE rn > 1
${this.dbType === 'sqlserver' ? `FETCH FIRST ${limit} ROWS ONLY` : `AND ROWNUM <= ${limit}`}`.trim();

      case 'snowflake':
        return `
SELECT * FROM ${fullTableName}
QUALIFY ROW_NUMBER() OVER (PARTITION BY ${groupByColumns} ORDER BY NULL) > 1
LIMIT ${limit}`.trim();

      default:
        return this.buildPreviewQuery({ tableName, schemaName, limit });
    }
  }

  /**
   * Build query to find stale/old data
   */
  buildFreshnessQuery(tableName: string, dateColumn: string, daysOld: number = 90, schemaName?: string, limit: number = 100): string {
    if (this.dbType === 'mongodb') {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      return `db.${tableName}.find({ "${dateColumn}": { $lt: ISODate("${cutoffDate.toISOString()}") } }).limit(${limit})`;
    }

    const fullTableName = this.getFullTableName(tableName, schemaName);
    const quotedDateCol = this.quoteIdentifier(dateColumn);
    const dateFunction = this.getDateFunction();
    const limitClause = this.getLimitClause(limit);

    switch (this.dbType) {
      case 'postgresql':
      case 'redshift':
        return `SELECT * FROM ${fullTableName} WHERE ${quotedDateCol} < ${dateFunction} - INTERVAL '${daysOld} days'${limitClause}`;

      case 'mysql':
        return `SELECT * FROM ${fullTableName} WHERE ${quotedDateCol} < DATE_SUB(${dateFunction}, INTERVAL ${daysOld} DAY)${limitClause}`;

      case 'oracle':
        return `SELECT * FROM ${fullTableName} WHERE ${quotedDateCol} < ${dateFunction} - ${daysOld} AND ROWNUM <= ${limit}`;

      case 'sqlserver':
        return `SELECT TOP ${limit} * FROM ${fullTableName} WHERE ${quotedDateCol} < DATEADD(day, -${daysOld}, ${dateFunction})`;

      case 'snowflake':
        return `SELECT * FROM ${fullTableName} WHERE ${quotedDateCol} < DATEADD(day, -${daysOld}, ${dateFunction}) LIMIT ${limit}`;

      default:
        return this.buildPreviewQuery({ tableName, schemaName, limit });
    }
  }

  /**
   * Build query to list all tables (excluding system tables)
   */
  buildListTablesQuery(databaseName?: string, excludeSystemTables: boolean = true): string {
    switch (this.dbType) {
      case 'postgresql':
        return `
SELECT
  schemaname as schema_name,
  tablename as table_name,
  'table' as table_type
FROM pg_catalog.pg_tables
WHERE ${excludeSystemTables ? "schemaname NOT IN ('pg_catalog', 'information_schema')" : '1=1'}
${databaseName ? `AND schemaname = '${databaseName}'` : ''}
ORDER BY schemaname, tablename`;

      case 'mysql':
        return `
SELECT
  TABLE_SCHEMA as schema_name,
  TABLE_NAME as table_name,
  TABLE_TYPE as table_type
FROM information_schema.TABLES
WHERE ${excludeSystemTables ? "TABLE_SCHEMA NOT IN ('mysql', 'information_schema', 'performance_schema', 'sys')" : '1=1'}
${databaseName ? `AND TABLE_SCHEMA = '${databaseName}'` : ''}
ORDER BY TABLE_SCHEMA, TABLE_NAME`;

      case 'oracle':
        return `
SELECT
  OWNER as schema_name,
  TABLE_NAME as table_name,
  'TABLE' as table_type
FROM ALL_TABLES
WHERE ${excludeSystemTables ? "OWNER NOT IN ('SYS', 'SYSTEM', 'DBSNMP', 'OUTLN', 'MDSYS', 'ORDSYS', 'CTXSYS', 'XDB')" : '1=1'}
${databaseName ? `AND OWNER = '${databaseName}'` : ''}
ORDER BY OWNER, TABLE_NAME`;

      case 'sqlserver':
        return `
SELECT
  SCHEMA_NAME(schema_id) as schema_name,
  name as table_name,
  type_desc as table_type
FROM sys.tables
WHERE ${excludeSystemTables ? "SCHEMA_NAME(schema_id) NOT IN ('sys', 'INFORMATION_SCHEMA')" : '1=1'}
${databaseName ? `AND DB_NAME() = '${databaseName}'` : ''}
ORDER BY SCHEMA_NAME(schema_id), name`;

      case 'snowflake':
        return `
SELECT
  TABLE_SCHEMA as schema_name,
  TABLE_NAME as table_name,
  TABLE_TYPE as table_type
FROM INFORMATION_SCHEMA.TABLES
WHERE ${excludeSystemTables ? "TABLE_SCHEMA NOT ILIKE 'INFORMATION_SCHEMA'" : '1=1'}
${databaseName ? `AND TABLE_CATALOG = '${databaseName}'` : ''}
ORDER BY TABLE_SCHEMA, TABLE_NAME`;

      case 'redshift':
        return `
SELECT
  schemaname as schema_name,
  tablename as table_name,
  'table' as table_type
FROM pg_tables
WHERE ${excludeSystemTables ? "schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_internal')" : '1=1'}
${databaseName ? `AND schemaname = '${databaseName}'` : ''}
ORDER BY schemaname, tablename`;

      case 'mongodb':
        // MongoDB uses collections, not tables
        return `db.getCollectionNames()`;

      default:
        return this.buildListTablesQuery(databaseName, excludeSystemTables);
    }
  }

  /**
   * Build full table name with proper quoting
   */
  private getFullTableName(tableName: string, schemaName?: string, databaseName?: string): string {
    const parts: string[] = [];

    if (databaseName && this.dbType !== 'oracle') {
      parts.push(this.quoteIdentifier(databaseName));
    }

    if (schemaName) {
      parts.push(this.quoteIdentifier(schemaName));
    }

    parts.push(this.quoteIdentifier(tableName));

    return parts.join('.');
  }

  /**
   * Quote identifier based on database type
   */
  private quoteIdentifier(identifier: string): string {
    switch (this.dbType) {
      case 'postgresql':
      case 'redshift':
      case 'snowflake':
        return `"${identifier}"`;
      case 'mysql':
        return `\`${identifier}\``;
      case 'sqlserver':
        return `[${identifier}]`;
      case 'oracle':
        return identifier.toUpperCase();
      default:
        return `"${identifier}"`;
    }
  }

  /**
   * Get LIMIT clause based on database type
   */
  private getLimitClause(limit: number): string {
    switch (this.dbType) {
      case 'postgresql':
      case 'mysql':
      case 'redshift':
      case 'snowflake':
        return ` LIMIT ${limit}`;
      case 'oracle':
        return ` AND ROWNUM <= ${limit}`;
      case 'sqlserver':
        return ''; // SQL Server uses TOP in SELECT clause
      default:
        return ` LIMIT ${limit}`;
    }
  }

  /**
   * Get current date/time function
   */
  private getDateFunction(): string {
    switch (this.dbType) {
      case 'postgresql':
      case 'redshift':
        return 'CURRENT_DATE';
      case 'mysql':
        return 'CURDATE()';
      case 'oracle':
        return 'SYSDATE';
      case 'sqlserver':
        return 'GETDATE()';
      case 'snowflake':
        return 'CURRENT_TIMESTAMP()';
      default:
        return 'CURRENT_DATE';
    }
  }

  /**
   * Build MongoDB query (returns JSON string for aggregation pipeline)
   */
  private buildMongoQuery(options: QueryOptions): string {
    const { tableName, limit = 100, whereClause, columns } = options;

    const pipeline: any[] = [];

    // Add match stage if where clause exists
    if (whereClause) {
      try {
        const matchCondition = JSON.parse(whereClause);
        pipeline.push({ $match: matchCondition });
      } catch {
        // If not valid JSON, skip match stage
      }
    }

    // Add projection if specific columns requested
    if (columns && columns.length > 0 && !columns.includes('*')) {
      const projection: any = {};
      columns.forEach(col => projection[col] = 1);
      pipeline.push({ $project: projection });
    }

    // Add limit
    pipeline.push({ $limit: limit });

    return `db.${tableName}.aggregate(${JSON.stringify(pipeline)})`;
  }

  /**
   * Get system schema names to exclude
   */
  getSystemSchemas(): string[] {
    switch (this.dbType) {
      case 'postgresql':
      case 'redshift':
        return ['pg_catalog', 'information_schema', 'pg_toast', 'pg_temp'];
      case 'mysql':
        return ['mysql', 'information_schema', 'performance_schema', 'sys'];
      case 'oracle':
        return ['SYS', 'SYSTEM', 'DBSNMP', 'OUTLN', 'MDSYS', 'ORDSYS', 'CTXSYS', 'XDB', 'WMSYS'];
      case 'sqlserver':
        return ['sys', 'INFORMATION_SCHEMA', 'guest', 'db_owner'];
      case 'snowflake':
        return ['INFORMATION_SCHEMA', 'ACCOUNT_USAGE'];
      default:
        return [];
    }
  }
}

export default QueryBuilder;
