import { EventEmitter } from "events";
import type { ConnectionConfig } from "../../models/Connection";
import type { ConnectionTestResult } from "../../models/DataSource";

export interface ConnectorMetrics {
  type: string;
  connected: boolean;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageQueryTime: number;
  lastQueryAt?: Date;
  lastErrorAt?: Date;
  uptime: number;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  columns?: any;
  executionTime?: number;
  metadata?: any;
}

export interface SchemaInfo {
  schemas: Schema[];
  totalTables: number;
  totalViews: number;
  totalColumns: number;
}

export interface Schema {
  name: string;
  tables: Table[];
  views: View[];
}

export interface Table {
  name: string;
  schema: string;
  columns: Column[];
  primaryKeys: string[];
  foreignKeys: ForeignKey[];
  indexes: Index[];
  rowCount?: number;
  sizeBytes?: number;
  lastModified?: Date;
}

export interface View {
  name: string;
  schema: string;
  columns: Column[];
  definition?: string;
}

export interface Column {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  maxLength?: number;
  precision?: number;
  scale?: number;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyReference?: {
    table: string;
    column: string;
    schema?: string;
  };
  isUnique?: boolean;
  comment?: string;
}

export interface ForeignKey {
  name: string;
  column: string;
  referencedTable: string;
  referencedColumn: string;
  referencedSchema?: string;
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
  clustered?: boolean;
}

export abstract class BaseConnector<C extends ConnectionConfig = ConnectionConfig> extends EventEmitter {
  protected type: string;
  protected connectionConfig: C;
  protected metrics: ConnectorMetrics;
  protected startTime: Date;

  constructor(type: string, connectionConfig: C) {
    super();
    this.type = type;
    this.connectionConfig = connectionConfig;
    this.startTime = new Date();
    this.metrics = {
      type,
      connected: false,
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      averageQueryTime: 0,
      uptime: 0,
    };
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract executeQuery(query: string, params?: any[]): Promise<QueryResult>;
  abstract getSchema(): Promise<SchemaInfo>;

  // Optional lifecycle hook
  cleanup?(): Promise<void> | void;

  async validateQuery(query: string): Promise<{ valid: boolean; error?: string }> {
    try {
      await this.executeQuery(`EXPLAIN ${query}`);
      return { valid: true };
    } catch (error: any) {
      return { valid: false, error: error?.message ?? "Query validation failed" };
    }
  }

  async getTableStats(tableName: string, schemaName?: string): Promise<any> {
    return {
      tableName,
      schemaName,
      rowCount: 0,
      sizeBytes: 0,
      message: "Table statistics not available for this connector type",
    };
  }

  async getSampleData(tableName: string, schemaName?: string, limit = 100): Promise<QueryResult> {
    const full = schemaName ? `${schemaName}.${tableName}` : tableName;
    const q = `SELECT * FROM ${full} LIMIT ${limit}`;
    return this.executeQuery(q);
  }

  async getColumnDistinctValues(
    tableName: string,
    columnName: string,
    schemaName?: string,
    limit = 100
  ): Promise<any[]> {
    const full = schemaName ? `${schemaName}.${tableName}` : tableName;
    const q = `SELECT DISTINCT ${columnName} FROM ${full} LIMIT ${limit}`;
    const result = await this.executeQuery(q);
    return result.rows.map((r) => r[columnName]);
  }

  getMetrics(): ConnectorMetrics {
    return { ...this.metrics, uptime: Date.now() - this.startTime.getTime() };
  }

  protected updateQueryMetrics(executionTime: number, success: boolean): void {
    this.metrics.totalQueries++;
    if (success) {
      this.metrics.successfulQueries++;
      this.metrics.lastQueryAt = new Date();
      const totalTime =
        this.metrics.averageQueryTime * (this.metrics.successfulQueries - 1) + executionTime;
      this.metrics.averageQueryTime = totalTime / this.metrics.successfulQueries;
    } else {
      this.metrics.failedQueries++;
      this.metrics.lastErrorAt = new Date();
    }
  }

  protected async executeWithMetrics<T>(operation: () => Promise<T>): Promise<T> {
    const t0 = Date.now();
    let ok = false;
    try {
      const result = await operation();
      ok = true;
      return result;
    } finally {
      const dt = Date.now() - t0;
      this.updateQueryMetrics(dt, ok);
    }
  }

  protected emitConnectionEvent(event: "connected" | "disconnected" | "error", data?: any): void {
    this.emit(event, { connector: this.type, timestamp: new Date(), data });
  }

  async healthCheck(): Promise<{
    status: "healthy" | "unhealthy" | "degraded";
    latency?: number;
    error?: string;
    details?: any;
  }> {
    try {
      const r = await this.testConnection();
      if (r.success) {
        return {
          status: (r.responseTime ?? 0) > 5000 ? "degraded" : "healthy",
          latency: r.responseTime,
          details: r.details,
        };
      }
      return { status: "unhealthy", error: r.error, details: r.details };
    } catch (e: any) {
      return { status: "unhealthy", error: e?.message ?? "Health check failed" };
    }
  }

  getConnectionConfig(): C {
    const clone: any = { ...this.connectionConfig };
    if (clone.password) clone.password = "[REDACTED]";
    return clone as C;
  }

  updateConnectionConfig(patch: Partial<C>): void {
    this.connectionConfig = { ...this.connectionConfig, ...patch };
  }

  protected escapeIdentifier(identifier: string): string {
    return `"${String(identifier).replace(/"/g, '""')}"`;
  }
  protected escapeLiteral(literal: string): string {
    return `'${String(literal).replace(/'/g, "''")}'`;
  }

  protected parseConnectionString(cs: string): Record<string, string> {
    const out: Record<string, string> = {};
    cs.split(";").forEach((pair) => {
      const [k, v] = pair.split("=");
      if (k && v) out[k.trim().toLowerCase()] = v.trim();
    });
    return out;
  }

  async getPoolStats(): Promise<{ total: number; active: number; idle: number; waiting: number }> {
    return { total: 1, active: this.metrics.connected ? 1 : 0, idle: 0, waiting: 0 };
  }
}

export default BaseConnector;
