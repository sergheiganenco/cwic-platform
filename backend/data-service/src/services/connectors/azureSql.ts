import { ConnectionPool, config as MSSQLConfig, Request } from 'mssql';
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

export interface AzureSqlConfig {
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  options?: {
    encrypt?: boolean;
    trustServerCertificate?: boolean;
    enableArithAbort?: boolean;
    connectionTimeout?: number;
    requestTimeout?: number;
  };
  pool?: {
    max?: number;
    min?: number;
    idleTimeoutMillis?: number;
  };
}

export class AzureSqlConnector extends BaseConnector {
  private pool: ConnectionPool | null = null;
  private config: AzureSqlConfig;

  constructor(conn: ConnectionConfig) {
    super('azure-sql', conn);
    this.config = this.parseConfig(conn);
  }

  /* ───────── config parsing ───────── */
  private parseConfig(c: ConnectionConfig): AzureSqlConfig {
    const anyC = c as any;
    const trustServerCertificate =
      typeof anyC.trustServerCertificate === 'boolean'
        ? anyC.trustServerCertificate
        : typeof c.ssl === 'object'
        ? (c.ssl as any)?.rejectUnauthorized === false
        : false;

    return {
      server: c.host ?? anyC.server ?? '',
      database: (c.database as string) ?? anyC.db ?? '',
      user: (c.username as string) ?? anyC.user ?? '',
      password: (c.password as string) ?? '',
      port: c.port ?? 1433,
      options: {
        encrypt: true, // Azure SQL requires encrypt
        trustServerCertificate,
        enableArithAbort: true,
        connectionTimeout: anyC.connectionTimeout ?? c.timeout ?? 30_000,
        requestTimeout: anyC.requestTimeout ?? c.timeout ?? 30_000,
      },
      pool: {
        max: anyC.maxConnections ?? 10,
        min: anyC.minConnections ?? 1,
        idleTimeoutMillis: anyC.idleTimeout ?? 30_000,
        ...(anyC.poolOptions ?? {}),
      },
    };
  }

  /* ───────── connect / disconnect ───────── */
  override async connect(): Promise<void> {
    try {
      if (this.pool?.connected) return;

      const poolConfig: MSSQLConfig = {
        server: this.config.server,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        port: this.config.port,
        options: this.config.options,
        pool: this.config.pool,
      };

      this.pool = new ConnectionPool(poolConfig);

      this.pool.on('error', (err: Error) => {
        logger.error('Azure SQL pool error:', err);
        this.emitConnectionEvent('error', err);
      });

      await this.pool.connect();

      (this as any).metrics.connected = true;
      this.emitConnectionEvent('connected', {
        server: this.config.server,
        database: this.config.database,
      });

      logger.info(`Connected to Azure SQL: ${this.config.server}/${this.config.database}`);
    } catch (error) {
      (this as any).metrics.connected = false;
      logger.error('Failed to connect to Azure SQL:', error);
      throw this.createConnectionError(error);
    }
  }

  override async disconnect(): Promise<void> {
    try {
      if (this.pool) {
        this.pool.removeAllListeners?.('error');
        await this.pool.close();
        this.pool = null;
        (this as any).metrics.connected = false;
        this.emitConnectionEvent('disconnected');
        logger.info('Disconnected from Azure SQL');
      }
    } catch (error) {
      logger.error('Error disconnecting from Azure SQL:', error);
      throw error;
    }
  }

  /* ───────── basic ops ───────── */
  override async testConnection(): Promise<ConnectionTestResult> {
    const t0 = Date.now();
    try {
      await this.connect();
      const req = new Request(this.pool!);
      const result = await req.query('SELECT @@VERSION AS version, DB_NAME() AS database_name');
      return {
        success: true,
        responseTime: Date.now() - t0,
        details: {
          version: (result as any)?.recordset?.[0]?.version,
          serverInfo: {
            type: 'Azure SQL Database',
            database: (result as any)?.recordset?.[0]?.database_name,
            server: this.config.server,
          },
          capabilities: ['SQL', 'ACID', 'Transactions', 'Stored Procedures', 'Functions'],
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
      const req = new Request(this.pool!);

      if (params?.length) {
        params.forEach((p, i) => req.input(`p${i}`, p));
        let idx = 0;
        query = query.replace(/\?/g, () => `@p${idx++}`);
      }

      const r = await req.query(query);
      return {
        rows: (r as any).recordset ?? [],
        rowCount: (r as any).rowsAffected?.[0] ?? ((r as any).recordset?.length || 0),
        columns: (r as any).recordset?.columns || {},
      };
    });
  }

  /* ───────── schema & metadata ───────── */
  override async getSchema(): Promise<SchemaInfo> {
    await this.ensureConnected();

    const schemaQuery = `
      SELECT
        t.TABLE_SCHEMA,
        t.TABLE_NAME,
        t.TABLE_TYPE,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.IS_NULLABLE,
        c.COLUMN_DEFAULT,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
      FROM INFORMATION_SCHEMA.TABLES t
      LEFT JOIN INFORMATION_SCHEMA.COLUMNS c
        ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
      LEFT JOIN (
        SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
          ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
          AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA
         AND c.TABLE_NAME   = pk.TABLE_NAME
         AND c.COLUMN_NAME  = pk.COLUMN_NAME
      WHERE t.TABLE_TYPE IN ('BASE TABLE', 'VIEW')
      ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME, c.ORDINAL_POSITION
    `;

    // Query to fetch foreign key relationships
    const fkQuery = `
      SELECT
        fk.name AS FK_NAME,
        SCHEMA_NAME(fk.schema_id) AS FK_SCHEMA,
        OBJECT_NAME(fk.parent_object_id) AS FK_TABLE,
        COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS FK_COLUMN,
        SCHEMA_NAME(pk_tab.schema_id) AS PK_SCHEMA,
        OBJECT_NAME(fk.referenced_object_id) AS PK_TABLE,
        COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS PK_COLUMN
      FROM sys.foreign_keys fk
      INNER JOIN sys.foreign_key_columns fkc
        ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.tables pk_tab
        ON fk.referenced_object_id = pk_tab.object_id
      ORDER BY FK_SCHEMA, FK_TABLE, fk.name
    `;

    const [schemaRes, fkRes] = await Promise.all([
      this.executeQuery(schemaQuery),
      this.executeQuery(fkQuery)
    ]);

    return this.buildSchemaInfo(schemaRes.rows as any[], fkRes.rows as any[]);
  }

  private buildSchemaInfo(rows: any[], fkRows: any[] = []): SchemaInfo {
    const bySchema = new Map<string, { tables: Map<string, Table>; views: Map<string, View> }>();

    // Build tables and columns
    for (const r of rows) {
      const sName = r.TABLE_SCHEMA as string;
      const tName = r.TABLE_NAME as string;
      const isView = (r.TABLE_TYPE as string) === 'VIEW';

      if (!bySchema.has(sName)) bySchema.set(sName, { tables: new Map(), views: new Map() });
      const bucket = bySchema.get(sName)!;

      if (isView) {
        const vmap = bucket.views;
        if (!vmap.has(tName)) {
          vmap.set(tName, { name: tName, schema: sName, columns: [], definition: undefined });
        }
        if (r.COLUMN_NAME) {
          const col: Column = {
            name: r.COLUMN_NAME,
            dataType: r.DATA_TYPE,
            nullable: r.IS_NULLABLE === 'YES',
            defaultValue: r.COLUMN_DEFAULT ?? undefined,
            maxLength: r.CHARACTER_MAXIMUM_LENGTH ?? undefined,
            precision: r.NUMERIC_PRECISION ?? undefined,
            scale: r.NUMERIC_SCALE ?? undefined,
            isPrimaryKey: r.IS_PRIMARY_KEY === 1,
          };
          vmap.get(tName)!.columns.push(col);
        }
      } else {
        const tmap = bucket.tables;
        if (!tmap.has(tName)) {
          tmap.set(tName, { name: tName, schema: sName, columns: [], primaryKeys: [], foreignKeys: [], indexes: [] });
        }
        if (r.COLUMN_NAME) {
          const col: Column = {
            name: r.COLUMN_NAME,
            dataType: r.DATA_TYPE,
            nullable: r.IS_NULLABLE === 'YES',
            defaultValue: r.COLUMN_DEFAULT ?? undefined,
            maxLength: r.CHARACTER_MAXIMUM_LENGTH ?? undefined,
            precision: r.NUMERIC_PRECISION ?? undefined,
            scale: r.NUMERIC_SCALE ?? undefined,
            isPrimaryKey: r.IS_PRIMARY_KEY === 1,
          };
          const tbl = tmap.get(tName)!;
          tbl.columns.push(col);
          if (col.isPrimaryKey) tbl.primaryKeys.push(col.name);
        }
      }
    }

    // Add foreign key relationships
    for (const fk of fkRows) {
      const schema = fk.FK_SCHEMA as string;
      const table = fk.FK_TABLE as string;
      const column = fk.FK_COLUMN as string;
      const refSchema = fk.PK_SCHEMA as string;
      const refTable = fk.PK_TABLE as string;
      const refColumn = fk.PK_COLUMN as string;

      if (bySchema.has(schema)) {
        const bucket = bySchema.get(schema)!;
        if (bucket.tables.has(table)) {
          const tbl = bucket.tables.get(table)!;

          // Add to foreignKeys array
          tbl.foreignKeys.push({
            name: fk.FK_NAME,
            column: column,
            referencedTable: refTable,
            referencedColumn: refColumn,
            referencedSchema: refSchema,
          });

          // Mark column as foreign key
          const col = tbl.columns.find(c => c.name === column);
          if (col) {
            col.isForeignKey = true;
            col.foreignKeyReference = {
              table: refTable,
              column: refColumn,
              schema: refSchema,
            };
          }
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
      const req = new Request(this.pool!);
      await req.batch('SET PARSEONLY ON;');
      try {
        await req.query(query);
        await req.batch('SET PARSEONLY OFF;');
        return { valid: true };
      } catch (err: any) {
        await req.batch('SET PARSEONLY OFF;');
        return { valid: false, error: err?.message || 'Invalid query' };
      }
    } catch (e: any) {
      return { valid: false, error: e?.message || 'Connection error during validation' };
    }
  }

  override async getSampleData(tableName: string, schemaName: string = 'dbo', limit: number = 100): Promise<QueryResult> {
    await this.ensureConnected();
    const full = `${this.escapeIdentifier(schemaName)}.${this.escapeIdentifier(tableName)}`;
    const q = `SELECT TOP (${limit}) * FROM ${full}`;
    return this.executeQuery(q);
  }

  async getConnectionInfo(): Promise<any> {
    await this.ensureConnected();
    const q = `
      SELECT 
        @@VERSION AS version,
        @@SERVERNAME AS server_name,
        DB_NAME() AS database_name,
        SUSER_NAME() AS login_name,
        @@LANGUAGE AS language,
        GETDATE() AS server_time
    `;
    const r = await this.executeQuery(q);
    return (r.rows as any[])?.[0];
  }

  /* ───────── internals ───────── */
  private async ensureConnected(): Promise<void> {
    if (!this.pool || !this.pool.connected) await this.connect();
  }

  protected override escapeIdentifier(identifier: string): string {
    return `[${String(identifier).replace(/]/g, ']]')}]`;
  }

  private createConnectionError(error: any): Error {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return new Error(`Azure SQL connection error: ${message}`);
  }

  private createQueryError(error: any, query: string): Error {
    const message = error instanceof Error ? error.message : 'Query failed';
    return new Error(`Azure SQL query error: ${message} (Query: ${query.substring(0, 120)}...)`);
  }

  override getMetrics(): any {
    const p: any = this.pool as any;
    const poolStats = p?.pool ?? p;
    return {
      type: 'azure-sql',
      connected: !!this.pool?.connected,
      server: this.config.server,
      database: this.config.database,
      poolSize: poolStats?.size ?? 0,
      poolAvailable: poolStats?.available ?? 0,
      poolPending: poolStats?.pending ?? 0,
    };
  }
}

export default AzureSqlConnector;
