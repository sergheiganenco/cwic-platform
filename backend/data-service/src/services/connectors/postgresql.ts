import { Pool, PoolConfig, QueryResult as PgQueryResult } from 'pg';
import type { ConnectionConfig, ConnectionTestResult } from '../../models/Connection';
import { logger } from '../../utils/logger';
import {
  BaseConnector,
  type Column,
  type QueryResult,
  type Schema,
  type SchemaInfo,
  type Table,
  type View,
} from './base';

export interface PostgreSQLConfig {
  host: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  ssl?: boolean | { rejectUnauthorized?: boolean; ca?: string; cert?: string; key?: string };
  connectionTimeoutMillis?: number;
  query_timeout?: number;
  statement_timeout?: number;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionString?: string;
}

export class PostgreSQLConnector extends BaseConnector {
  private pool: Pool | null = null;
  private config: PostgreSQLConfig;

  constructor(conn: ConnectionConfig) {
    super('postgresql', conn);
    this.config = this.parseConfig(conn);
  }

  /* ───────── config parsing ───────── */
  private parseConfig(c: ConnectionConfig): PostgreSQLConfig {
    const anyC = c as any;

    // Support both connection string and individual params
    if (anyC.connectionString) {
      return {
        connectionString: anyC.connectionString,
        host: '',
        database: '',
        user: '',
        password: '',
        max: anyC.maxConnections ?? 10,
        min: anyC.minConnections ?? 1,
        idleTimeoutMillis: anyC.idleTimeout ?? 30_000,
        connectionTimeoutMillis: anyC.connectionTimeout ?? c.timeout ?? 30_000,
        statement_timeout: anyC.statementTimeout ?? 60_000,
      };
    }

    // For server-level connections (scope: 'server'), determine which database to connect to:
    // 1. If databases array exists, use the first one
    // 2. Otherwise use 'postgres' as the default administrative database
    // 3. For regular connections, use the specified database or empty string
    let databaseName: string;
    const scope = anyC.scope ?? (anyC as any).connectionScope;
    const databases = anyC.databases ?? (anyC as any).databaseList;

    if (scope === 'server') {
      if (Array.isArray(databases) && databases.length > 0) {
        databaseName = String(databases[0]);
      } else {
        databaseName = 'postgres'; // Default PostgreSQL admin database
      }
    } else {
      databaseName = (c.database as string) ?? anyC.db ?? anyC.database ?? '';
    }

    // Fallback: if still empty, try anyC.database or default to 'postgres'
    if (!databaseName) {
      databaseName = anyC.database ?? 'postgres';
    }

    return {
      host: c.host ?? 'localhost',
      database: databaseName,
      // Support both 'user' and 'username' fields
      // Check typed field first (c.username), then anyC for both variants
      user: (c.username as string) ?? anyC.user ?? anyC.username ?? '',
      password: (c.password as string) ?? '',
      port: c.port ?? 5432,
      ssl: c.ssl ?? false,
      max: anyC.maxConnections ?? 10,
      min: anyC.minConnections ?? 1,
      idleTimeoutMillis: anyC.idleTimeout ?? 30_000,
      connectionTimeoutMillis: anyC.connectionTimeout ?? c.timeout ?? 30_000,
      statement_timeout: anyC.statementTimeout ?? 60_000,
    };
  }

  /* ───────── connect / disconnect ───────── */
  override async connect(): Promise<void> {
    try {
      if (this.pool) return;

      const poolConfig: PoolConfig = this.config.connectionString
        ? { connectionString: this.config.connectionString }
        : {
            host: this.config.host,
            database: this.config.database,
            user: this.config.user,
            password: this.config.password,
            port: this.config.port,
            ssl: this.config.ssl,
          };

      // Add pool settings
      Object.assign(poolConfig, {
        max: this.config.max,
        min: this.config.min,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        query_timeout: this.config.query_timeout,
        statement_timeout: this.config.statement_timeout,
      });

      this.pool = new Pool(poolConfig);

      this.pool.on('error', (err: Error) => {
        logger.error('PostgreSQL pool error:', err);
        this.emitConnectionEvent('error', err);
      });

      // Test connection
      const client = await this.pool.connect();
      client.release();

      (this as any).metrics.connected = true;
      this.emitConnectionEvent('connected', {
        host: this.config.host || 'via connection string',
        database: this.config.database,
      });

      logger.info(`Connected to PostgreSQL: ${this.config.host || 'connection string'}/${this.config.database}`);
    } catch (error) {
      (this as any).metrics.connected = false;
      logger.error('Failed to connect to PostgreSQL:', error);
      throw this.createConnectionError(error);
    }
  }

  override async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        this.pool.removeAllListeners?.('error');
        await this.pool.end();
        this.pool = null;
        (this as any).metrics.connected = false;
        this.emitConnectionEvent('disconnected');
        logger.info('Disconnected from PostgreSQL');
      }
    } catch (error) {
      logger.error('Error disconnecting from PostgreSQL:', error);
      throw error;
    }
  }

  /* ───────── basic ops ───────── */
  override async testConnection(): Promise<ConnectionTestResult> {
    const t0 = Date.now();
    try {
      await this.connect();
      const result = await this.pool!.query(`
        SELECT version() AS version,
               current_database() AS database_name,
               current_user AS current_user,
               inet_server_addr() AS server_address,
               inet_server_port() AS server_port
      `);

      return {
        success: true,
        responseTime: Date.now() - t0,
        details: {
          version: result.rows[0]?.version,
          serverInfo: {
            type: 'PostgreSQL',
            database: result.rows[0]?.database_name,
            host: this.config.host || 'via connection string',
            port: result.rows[0]?.server_port,
            user: result.rows[0]?.current_user,
          },
          capabilities: ['SQL', 'ACID', 'JSONB', 'Arrays', 'Full-text search', 'Transactions', 'Triggers', 'Functions', 'Views', 'Materialized Views'],
        },
        testedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        responseTime: Date.now() - t0,
        error: error?.message || 'Unknown error',
        testedAt: new Date(),
      };
    }
  }

  override async executeQuery(query: string, params?: any[]): Promise<QueryResult> {
    return this.executeWithMetrics(async () => {
      await this.ensureConnected();

      const result: PgQueryResult = await this.pool!.query(query, params);

      return {
        rows: result.rows ?? [],
        rowCount: result.rowCount ?? 0,
        columns: result.fields?.reduce((acc, field) => {
          acc[field.name] = {
            dataTypeID: field.dataTypeID,
            dataTypeSize: field.dataTypeSize,
            dataTypeModifier: field.dataTypeModifier,
          };
          return acc;
        }, {} as any) ?? {},
      };
    });
  }

  /* ───────── schema & metadata ───────── */
  override async getSchema(): Promise<SchemaInfo> {
    await this.ensureConnected();

    const schemaQuery = `
      SELECT
        n.nspname AS table_schema,
        c.relname AS table_name,
        CASE c.relkind
          WHEN 'r' THEN 'BASE TABLE'
          WHEN 'v' THEN 'VIEW'
          WHEN 'm' THEN 'MATERIALIZED VIEW'
        END AS table_type,
        a.attname AS column_name,
        pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
        NOT a.attnotnull AS is_nullable,
        pg_get_expr(d.adbin, d.adrelid) AS column_default,
        CASE
          WHEN a.atttypid IN (1042, 1043) THEN a.atttypmod - 4
          ELSE NULL
        END AS character_maximum_length,
        CASE
          WHEN a.atttypid IN (1700) THEN ((a.atttypmod - 4) >> 16) & 65535
          ELSE NULL
        END AS numeric_precision,
        CASE
          WHEN a.atttypid IN (1700) THEN (a.atttypmod - 4) & 65535
          ELSE NULL
        END AS numeric_scale,
        EXISTS (
          SELECT 1 FROM pg_constraint con
          WHERE con.conrelid = c.oid
          AND con.contype = 'p'
          AND a.attnum = ANY(con.conkey)
        ) AS is_primary_key
      FROM pg_catalog.pg_class c
      INNER JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      INNER JOIN pg_catalog.pg_attribute a ON a.attrelid = c.oid
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
      WHERE c.relkind IN ('r', 'v', 'm')
        AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
        AND a.attnum > 0
        AND NOT a.attisdropped
      ORDER BY n.nspname, c.relname, a.attnum
    `;

    const res = await this.executeQuery(schemaQuery);
    return this.buildSchemaInfo(res.rows as any[]);
  }

  private buildSchemaInfo(rows: any[]): SchemaInfo {
    const bySchema = new Map<string, { tables: Map<string, Table>; views: Map<string, View> }>();

    for (const r of rows) {
      const sName = r.table_schema as string;
      const tName = r.table_name as string;
      const tableType = r.table_type as string;
      const isView = tableType === 'VIEW' || tableType === 'MATERIALIZED VIEW';

      if (!bySchema.has(sName)) bySchema.set(sName, { tables: new Map(), views: new Map() });
      const bucket = bySchema.get(sName)!;

      if (isView) {
        const vmap = bucket.views;
        if (!vmap.has(tName)) {
          vmap.set(tName, {
            name: tName,
            schema: sName,
            columns: [],
            definition: undefined,
            isMaterialized: tableType === 'MATERIALIZED VIEW'
          } as any);
        }
        if (r.column_name) {
          const col: Column = {
            name: r.column_name,
            dataType: r.data_type,
            nullable: r.is_nullable,
            defaultValue: r.column_default ?? undefined,
            maxLength: r.character_maximum_length ?? undefined,
            precision: r.numeric_precision ?? undefined,
            scale: r.numeric_scale ?? undefined,
            isPrimaryKey: r.is_primary_key,
          };
          vmap.get(tName)!.columns.push(col);
        }
      } else {
        const tmap = bucket.tables;
        if (!tmap.has(tName)) {
          tmap.set(tName, {
            name: tName,
            schema: sName,
            columns: [],
            primaryKeys: [],
            foreignKeys: [],
            indexes: []
          });
        }
        if (r.column_name) {
          const col: Column = {
            name: r.column_name,
            dataType: r.data_type,
            nullable: r.is_nullable,
            defaultValue: r.column_default ?? undefined,
            maxLength: r.character_maximum_length ?? undefined,
            precision: r.numeric_precision ?? undefined,
            scale: r.numeric_scale ?? undefined,
            isPrimaryKey: r.is_primary_key,
          };
          const tbl = tmap.get(tName)!;
          tbl.columns.push(col);
          if (col.isPrimaryKey) tbl.primaryKeys.push(col.name);
        }
      }
    }

    const schemas: Schema[] = [];
    let totalTables = 0;
    let totalViews = 0;
    let totalColumns = 0;

    for (const [name, { tables, views }] of bySchema) {
      const tablesArr = Array.from(tables.values());
      const viewsArr = Array.from(views.values());
      totalTables += tablesArr.length;
      totalViews += viewsArr.length;
      totalColumns +=
        tablesArr.reduce((n, t) => n + t.columns.length, 0) +
        viewsArr.reduce((n, v) => n + v.columns.length, 0);
      schemas.push({ name, tables: tablesArr, views: viewsArr });
    }

    return { schemas, totalTables, totalViews, totalColumns };
  }

  override async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.ensureConnected();
      // Use EXPLAIN to validate without executing
      const explainQuery = `EXPLAIN (FORMAT JSON, ANALYZE FALSE) ${query}`;
      await this.pool!.query(explainQuery);
      return { valid: true };
    } catch (e: any) {
      // Check if it's a syntax error
      const errorMessage = e?.message || 'Invalid query';
      return { valid: false, error: errorMessage };
    }
  }

  override async getSampleData(tableName: string, schemaName: string = 'public', limit: number = 100): Promise<QueryResult> {
    await this.ensureConnected();
    const full = `${this.escapeIdentifier(schemaName)}.${this.escapeIdentifier(tableName)}`;
    const q = `SELECT * FROM ${full} LIMIT $1`;
    return this.executeQuery(q, [limit]);
  }

  async getConnectionInfo(): Promise<any> {
    await this.ensureConnected();
    const q = `
      SELECT
        version() AS version,
        current_database() AS database_name,
        current_user AS current_user,
        current_schema() AS current_schema,
        inet_server_addr() AS server_address,
        inet_server_port() AS server_port,
        pg_backend_pid() AS backend_pid,
        pg_postmaster_start_time() AS server_start_time,
        now() AS current_time
    `;
    const r = await this.executeQuery(q);
    return r.rows[0];
  }

  async listDatabases(): Promise<string[]> {
    await this.ensureConnected();
    const q = `
      SELECT datname
      FROM pg_database
      WHERE datistemplate = false
      ORDER BY datname
    `;
    const r = await this.executeQuery(q);
    return r.rows.map((row: any) => row.datname);
  }

  /* ───────── internals ───────── */
  private async ensureConnected(): Promise<void> {
    if (!this.pool) await this.connect();
  }

  protected override escapeIdentifier(identifier: string): string {
    // PostgreSQL uses double quotes for identifiers
    return `"${String(identifier).replace(/"/g, '""')}"`;
  }

  private createConnectionError(error: any): Error {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return new Error(`PostgreSQL connection error: ${message}`);
  }

  override getMetrics(): any {
    const poolMetrics = this.pool ? {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    } : {};

    return {
      type: 'postgresql',
      connected: !!this.pool,
      host: this.config.host || 'via connection string',
      database: this.config.database,
      ...poolMetrics,
    };
  }
}

export default PostgreSQLConnector;