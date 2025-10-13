import { randomUUID } from 'node:crypto';
import {
  ConnectionConfig,
  DataSource,
  DataSourceFilters,
  DataSourceStatus,
  DataSourceType,
} from '../models/DataSource';
import { logger } from '../utils/logger';
import { decryptConfig, encryptConfig, isEncryptedConfig, maskSecrets } from '../utils/secrets';
import { ConnectionTestService } from './ConnectionTestService';
import { DatabaseService } from './DatabaseService';

export interface PaginatedDataSources {
  dataSources: DataSource[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DataSourceListOptions {
  page: number;
  limit: number;
  filters: DataSourceFilters;
  sortBy?: 'updatedAt' | 'createdAt' | 'name' | 'status' | 'type';
  sortOrder?: 'asc' | 'desc';
}

export interface HealthSummary {
  total: number;
  healthy: number;
  warning: number;
  error: number;
  lastUpdated: Date;
}

export interface SchemaInfo {
  tables: TableInfo[];
  views: ViewInfo[];
  totalTables: number;
  totalColumns: number;
  estimatedSize: string;
}

export interface TableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: { table: string; column: string };
  defaultValue?: string;
}

export interface ViewInfo { name: string; schema?: string; definition: string; }
export interface IndexInfo { name: string; columns: string[]; unique: boolean; type: string; }

export interface ConstraintInfo {
  name: string;
  type: 'PRIMARY_KEY' | 'FOREIGN_KEY' | 'UNIQUE' | 'CHECK';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

export interface SyncResult {
  syncId: string;
  status: 'started' | 'completed' | 'failed';
  tablesScanned: number;
  newTables: number;
  updatedTables: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}

const SORT_MAP: Record<NonNullable<DataSourceListOptions['sortBy']>, string> = {
  updatedAt: 'updated_at',
  createdAt: 'created_at',
  name: 'name',
  status: 'status',
  type: 'type',
};

const normalizeType = (t?: string): DataSourceType | undefined => {
  if (!t) return undefined;
  const x = String(t).toLowerCase();
  if (x === 'postgres') return 'postgresql';
  if (['azure_sql', 'azure-sql', 'sqlserver', 'sql-server'].includes(x)) return 'mssql' as DataSourceType;
  return x as DataSourceType;
};

export class DataSourceService {
  private db = new DatabaseService();
  private tester = new ConnectionTestService();

  private makePublicId(): string {
    return `ds_${Date.now()}_${randomUUID().slice(0, 8)}`;
  }

  private coerceJSON<T>(val: any, fallback: T): T {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'string') {
      try { return JSON.parse(val) as T; } catch { return fallback; }
    }
    return (typeof val === 'object') ? (val as T) : fallback;
  }

  private coerceStringArray(val: any): string[] {
    if (Array.isArray(val)) return val.map(String);
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        if (/^\{.*\}$/.test(val)) {
          return val
            .slice(1, -1)
            .split(',')
            .map((s) => s.replace(/^"(.*)"$/, '$1'))
            .filter(Boolean);
        }
      }
    }
    return [];
  }

  private encryptConnectionConfig(config: ConnectionConfig): string {
    return JSON.stringify(encryptConfig(config));
  }

  private decryptConnectionConfig(raw: any, fallbackType?: DataSourceType): ConnectionConfig {
    const parsed = this.coerceJSON(raw, {});

    if (isEncryptedConfig(parsed)) {
      return decryptConfig<ConnectionConfig>(parsed);
    }

    if (parsed && typeof parsed === 'object') {
      return parsed as ConnectionConfig;
    }

    return { type: (fallbackType as any) ?? 'api' } as ConnectionConfig;
  }

  private maskConnectionConfig(config: ConnectionConfig): ConnectionConfig {
    return maskSecrets(config) as ConnectionConfig;
  }

  private toConnectionConfig(raw: any, fallbackType?: DataSourceType): ConnectionConfig {
    try {
      return this.decryptConnectionConfig(raw, fallbackType);
    } catch (error) {
      logger.error('Failed to parse connection config', { error: (error as Error).message });
      throw error;
    }
  }

  private mapRowToDataSource(row: any): DataSource {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      type: row.type,
      status: row.status,
      connectionConfig: this.toConnectionConfig(row.connection_config, row.type),
      tags: this.coerceStringArray(row.tags),
      metadata: this.coerceJSON(row.metadata, {}),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by ?? null,
      updatedBy: row.updated_by ?? null,
      lastTestAt: row.last_test_at ?? row.last_tested_at ?? null,
      lastSyncAt: row.last_sync_at ?? null,
      lastError: row.last_error ?? null,
      publicId: row.public_id ?? null,
    } as DataSource;
  }

  /* ============================== CRUD + List ============================== */

  async getAllDataSources(options: DataSourceListOptions): Promise<PaginatedDataSources> {
    try {
      const { page, limit, filters, sortBy = 'updatedAt', sortOrder = 'desc' } = options;
      const offset = (page - 1) * limit;

      let where = 'WHERE deleted_at IS NULL';
      const params: any[] = [];
      let i = 1;

      if (filters.status) { where += ` AND status = $${i++}`; params.push(filters.status); }
      if (filters.type)   { where += ` AND type = $${i++}`; params.push(filters.type); }
      if (filters.createdBy) { where += ` AND created_by = $${i++}`; params.push(filters.createdBy); }
      if (filters.search) {
        where += ` AND (name ILIKE $${i} OR description ILIKE $${i})`;
        params.push(`%${filters.search}%`); i++;
      }

      const countSQL = `SELECT COUNT(*)::int AS total FROM data_sources ${where}`;
      const { rows: countRows } = await this.db.query(countSQL, params);
      const total = countRows[0]?.total ?? 0;

      const orderBy = SORT_MAP[sortBy] ?? 'updated_at';
      const orderDir = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const dataSQL = `
        SELECT
          id, name, description, type, status,
          connection_config, tags, metadata,
          created_at, updated_at, created_by, updated_by,
          COALESCE(last_test_at, last_tested_at) AS last_test_at,
          last_sync_at, last_error, public_id
        FROM data_sources
        ${where}
        ORDER BY ${orderBy} ${orderDir}
        LIMIT $${i++} OFFSET $${i++}
      `;
      const { rows } = await this.db.query(dataSQL, [...params, limit, offset]);
      const dataSources = rows.map((r) => this.mapRowToDataSource(r));

      return { dataSources, total, page, limit, totalPages: Math.ceil(total / limit) };
    } catch (error) {
      logger.error('DataSourceService.getAllDataSources failed:', error);
      throw error;
    }
  }

  async getDataSourceById(id: string): Promise<DataSource | null> {
    try {
      const sql = `
        SELECT
          id, name, description, type, status,
          connection_config, tags, metadata,
          created_at, updated_at, created_by, updated_by,
          COALESCE(last_test_at, last_tested_at) AS last_test_at,
          last_sync_at, last_error, public_id
        FROM data_sources
        WHERE id = $1 AND deleted_at IS NULL
      `;
      const { rows } = await this.db.query(sql, [id]);
      if (rows.length === 0) return null;
      return this.mapRowToDataSource(rows[0]);
    } catch (error) {
      logger.error('DataSourceService.getDataSourceById failed:', error);
      throw error;
    }
  }

  async createDataSource(data: Partial<DataSource>): Promise<DataSource> {
    try {
      const now = new Date();
      const publicId = this.makePublicId();

      const connectionCfg: ConnectionConfig =
        data.connectionConfig && typeof (data.connectionConfig as any) === 'object'
          ? (data.connectionConfig as ConnectionConfig)
          : this.toConnectionConfig(null, data.type as DataSourceType);

      const sql = `
        INSERT INTO data_sources (
          name, description, type, status,
          connection_config, tags, metadata,
          created_at, updated_at, created_by, public_id,
          last_test_at, last_sync_at, last_error
        )
        VALUES (
          $1, $2, $3, $4,
          $5::jsonb, $6::text[], $7::jsonb,
          $8, $9, $10, $11,
          $12, $13, $14
        )
        RETURNING
          id, name, description, type, status,
          connection_config, tags, metadata,
          created_at, updated_at, created_by, updated_by,
          COALESCE(last_test_at, last_tested_at) AS last_test_at,
          last_sync_at, last_error, public_id
      `;

      const params: any[] = [
        data.name!,
        data.description ?? null,
        normalizeType(data.type) ?? data.type!,
        data.status ?? ('pending' as DataSourceStatus),
        this.encryptConnectionConfig(connectionCfg),
        Array.isArray(data.tags) ? data.tags : [],
        JSON.stringify(data.metadata ?? {}),
        now,
        now,
        data.createdBy ?? null,
        publicId,
        data.lastTestAt ?? null,
        data.lastSyncAt ?? null,
        data.lastError ?? null,
      ];

      const { rows } = await this.db.query(sql, params);
      return this.mapRowToDataSource(rows[0]);
    } catch (error) {
      logger.error('DataSourceService.createDataSource failed:', error);
      throw error;
    }
  }

  async updateDataSource(id: string, patch: Partial<DataSource>): Promise<DataSource | null> {
    try {
      const existing = await this.getDataSourceById(id);
      if (!existing) return null;

      const sets: string[] = [];
      const params: any[] = [];
      let i = 1;
      const push = (frag: string, val: any) => { sets.push(frag); params.push(val); };

      if (patch.name !== undefined)        push(`name = $${i++}`, patch.name);
      if (patch.description !== undefined) push(`description = $${i++}`, patch.description);
      if (patch.type !== undefined)        push(`type = $${i++}`, normalizeType(patch.type) ?? patch.type);
      if (patch.status !== undefined)      push(`status = $${i++}`, patch.status);
      if (patch.connectionConfig !== undefined) {
        const cfg = this.toConnectionConfig(patch.connectionConfig, (patch.type as any) ?? existing.type);
        push(`connection_config = $${i++}::jsonb`, this.encryptConnectionConfig(cfg));
      }
      if (patch.tags !== undefined)        push(`tags = $${i++}::text[]`, Array.isArray(patch.tags) ? patch.tags : []);
      if (patch.metadata !== undefined)    push(`metadata = $${i++}::jsonb`, JSON.stringify(patch.metadata ?? {}));
      if (patch.lastTestAt !== undefined)  push(`last_test_at = $${i++}`, patch.lastTestAt);
      if (patch.lastSyncAt !== undefined)  push(`last_sync_at = $${i++}`, patch.lastSyncAt);
      if (patch.lastError !== undefined)   push(`last_error = $${i++}`, patch.lastError);
      if ((patch as any).updatedBy !== undefined)   push(`updated_by = $${i++}`, (patch as any).updatedBy ?? null);

      push(`updated_at = $${i++}`, new Date());
      params.push(id);

      const sql = `
        UPDATE data_sources
        SET ${sets.join(', ')}
        WHERE id = $${i} AND deleted_at IS NULL
        RETURNING
          id, name, description, type, status,
          connection_config, tags, metadata,
          created_at, updated_at, created_by, updated_by,
          COALESCE(last_test_at, last_tested_at) AS last_test_at,
          last_sync_at, last_error, public_id
      `;
      const { rows } = await this.db.query(sql, params);
      if (rows.length === 0) return null;
      return this.mapRowToDataSource(rows[0]);
    } catch (error) {
      logger.error('DataSourceService.updateDataSource failed:', error);
      throw error;
    }
  }

  async deleteDataSource(id: string): Promise<boolean> {
    try {
      const sql = `UPDATE data_sources SET deleted_at = $1 WHERE id = $2 AND deleted_at IS NULL`;
      const { rowCount } = await this.db.query(sql, [new Date(), id]);
      return (rowCount ?? 0) > 0;
    } catch (error) {
      logger.error('DataSourceService.deleteDataSource failed:', error);
      throw error;
    }
  }

  public sanitizeDataSource(ds: DataSource): DataSource {
    return {
      ...ds,
      connectionConfig: this.maskConnectionConfig(ds.connectionConfig),
    };
  }

  public sanitizeDataSources(list: DataSource[]): DataSource[] {
    return list.map((item) => this.sanitizeDataSource(item));
  }

  /* ============================== Health & Schema ============================== */

  async getHealthSummary(): Promise<HealthSummary> {
    try {
      const sql = `
        SELECT
          COUNT(*)::int AS total,
          COUNT(CASE WHEN status IN ('active','connected') THEN 1 END)::int AS healthy,
          COUNT(CASE WHEN status IN ('warning','pending','testing','syncing') THEN 1 END)::int AS warning,
          COUNT(CASE WHEN status IN ('error','inactive','disconnected') THEN 1 END)::int AS error
        FROM data_sources
        WHERE deleted_at IS NULL
      `;
      const { rows } = await this.db.query(sql);
      const row = rows[0] || { total: 0, healthy: 0, warning: 0, error: 0 };
      return { ...row, lastUpdated: new Date() } as HealthSummary;
    } catch (error) {
      logger.error('DataSourceService.getHealthSummary failed:', error);
      throw error;
    }
  }

  async getDataSourceSchema(_id: string): Promise<SchemaInfo> {
    // Keep your sample; wire to connector-specific logic later
    return {
      tables: [{
        name: 'users',
        schema: 'public',
        rowCount: 10000,
        columns: [
          { name: 'id', type: 'bigint', nullable: false, primaryKey: true },
          { name: 'email', type: 'varchar', nullable: false, primaryKey: false },
          { name: 'created_at', type: 'timestamp', nullable: false, primaryKey: false },
        ],
        indexes: [
          { name: 'users_pkey', columns: ['id'], unique: true, type: 'btree' },
          { name: 'users_email_idx', columns: ['email'], unique: true, type: 'btree' },
        ],
        constraints: [{ name: 'users_pkey', type: 'PRIMARY_KEY', columns: ['id'] }],
      }],
      views: [],
      totalTables: 1,
      totalColumns: 3,
      estimatedSize: '125MB',
    };
  }

  /* ============================== Sync & Status ============================== */

  async syncDataSource(id: string, _options: { force?: boolean } = {}): Promise<SyncResult> {
    const syncId = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    await this.updateDataSource(id, { lastSyncAt: new Date(), status: 'connected' as any });
    return {
      syncId,
      status: 'completed',
      tablesScanned: 15,
      newTables: 2,
      updatedTables: 3,
      errors: [],
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  /**
   * Optional status poller. If you later persist sync runs, fetch the actual
   * row here. For now, return a simple completed status.
   */
  async getSyncStatus(_id: string): Promise<Partial<SyncResult>> {
    return {
      syncId: `sync_${Date.now()}`,
      status: 'completed',
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  /* ============================== Databases listing ============================== */

  /**
   * List databases for an existing data source (server-level discovery).
   * Uses the same discovery engine as the controller’s preview endpoint,
   * but with the persisted config.
   */
  async listDatabases(id: string): Promise<Array<{ name: string }>> {
    const ds = await this.getDataSourceById(id);
    if (!ds) return [];
    const type = normalizeType(ds.type) ?? ds.type;
    try {
      return await this.tester.discoverDatabasesFromConfig(type, ds.connectionConfig);
    } catch (err) {
      logger.warn(`listDatabases failed for ${id}: ${(err as Error)?.message}`);
      return [];
    }
  }
}



