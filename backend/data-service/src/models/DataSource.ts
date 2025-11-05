/* ===========================================================================
 * DataSource models & helpers (canonical, production-ready)
 * =========================================================================== */

export type DataSourceType =
  | 'postgresql'
  | 'mysql'
  | 'mssql'
  | 'oracle'
  | 'mongodb'
  | 'redis'
  | 's3'
  | 'azure-blob'
  | 'gcs'
  | 'snowflake'
  | 'bigquery'
  | 'redshift'
  | 'databricks'
  | 'api'
  | 'file'
  | 'kafka'
  | 'elasticsearch';

export type DataSourceStatus =
  | 'pending'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'warning'
  | 'syncing'
  | 'testing'
  // back-compat / ops-friendly synonyms
  | 'active'
  | 'inactive';

/* ---------------------------------------------------------------------------
 * TLS / SSL
 * --------------------------------------------------------------------------- */
export interface ConnectionSecurity {
  enabled?: boolean;
  rejectUnauthorized?: boolean;
  ca?: string;
  cert?: string;
  key?: string;
  mode?: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
}

/* ---------------------------------------------------------------------------
 * Shared base for all connectors
 * --------------------------------------------------------------------------- */
export interface CommonConnectionFields {
  host?: string;
  port?: number;
  database?: string | number;
  username?: string; // Alias for 'user' - normalized by middleware
  user?: string;     // Canonical field (PostgreSQL, MySQL, etc. use 'user')
  password?: string;
  schema?: string;
  connectionString?: string;
  ssl?: boolean | ConnectionSecurity;

  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
}

/* ---------------------------------------------------------------------------
 * Per-connector configs (discriminated by `type`)
 * --------------------------------------------------------------------------- */
// Relational
export interface PostgreSQLConnection extends CommonConnectionFields { type: 'postgresql' }
export interface MySQLConnection     extends CommonConnectionFields { type: 'mysql' }
export interface MSSQLConnection     extends CommonConnectionFields { type: 'mssql' }
export interface OracleConnection    extends CommonConnectionFields { type: 'oracle' }
export interface RedshiftConnection  extends CommonConnectionFields { type: 'redshift' }
export interface DatabricksConnection extends CommonConnectionFields {
  type: 'databricks';
  httpPath?: string;
  token?: string;
}

// Doc/KV
export interface MongoDBConnection extends CommonConnectionFields { type: 'mongodb' }
export interface RedisConnection extends CommonConnectionFields {
  type: 'redis';
  cluster?: boolean;
  nodes?: Array<{ host: string; port: number }>;
}

// Object storage
export interface S3Connection extends CommonConnectionFields {
  type: 's3';
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  prefix?: string;
}
export interface AzureBlobConnection extends CommonConnectionFields {
  type: 'azure-blob';
  container?: string;
  accountName?: string;
  accountKey?: string;
  connectionString?: string; // Azure style
  prefix?: string;
}
export interface GCSConnection extends CommonConnectionFields {
  type: 'gcs';
  bucket?: string;
  serviceAccountKey?: string; // JSON
  prefix?: string;
}

// SaaS DW / Analytics
export interface SnowflakeConnection extends CommonConnectionFields {
  type: 'snowflake';
  warehouse?: string;
  role?: string;
}
export interface BigQueryConnection extends CommonConnectionFields {
  type: 'bigquery';
  projectId?: string;
  dataset?: string;
  location?: string;
  serviceAccountKey?: string; // JSON
}

// REST / File / Streaming / Search
export interface APIConnection extends CommonConnectionFields {
  type: 'api';
  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  authentication?: {
    type: 'basic' | 'bearer' | 'oauth2' | 'api-key';
    credentials: Record<string, string>;
  };
}
export interface FileConnection extends CommonConnectionFields {
  type: 'file';
  path?: string;
  format?: 'csv' | 'json' | 'parquet' | 'avro' | 'xml';
}
export interface KafkaConnection extends CommonConnectionFields {
  type: 'kafka';
  brokers?: string[];  // host:port
  topics?: string[];
  consumerGroup?: string;
  sasl?: {
    mechanism: 'plain' | 'scram-sha-256' | 'scram-sha-512';
    username: string;
    password: string;
  };
  ssl?: boolean | ConnectionSecurity;
}
export interface ElasticsearchConnection extends CommonConnectionFields { type: 'elasticsearch' }

/* ---------------------------------------------------------------------------
 * Canonical union
 * --------------------------------------------------------------------------- */
export type ConnectionConfig =
  | PostgreSQLConnection
  | MySQLConnection
  | MSSQLConnection
  | OracleConnection
  | MongoDBConnection
  | RedisConnection
  | S3Connection
  | AzureBlobConnection
  | GCSConnection
  | SnowflakeConnection
  | BigQueryConnection
  | RedshiftConnection
  | DatabricksConnection
  | APIConnection
  | FileConnection
  | KafkaConnection
  | ElasticsearchConnection;

/* ---------------------------------------------------------------------------
 * Filters & pagination
 * --------------------------------------------------------------------------- */
export interface DataSourceFilters {
  status?: DataSourceStatus;
  type?: DataSourceType;
  search?: string;
  tags?: string[];
  createdBy?: string;              // ← added (fixes controller/service usage)
}

export type SortBy = 'updatedAt' | 'createdAt' | 'name' | 'status' | 'type';
export interface ListOptions {
  page?: number;
  limit?: number;
  filters?: DataSourceFilters;
  sortBy?: SortBy;
  sortOrder?: 'asc' | 'desc';
}

export interface ListOptions {
  page?: number;
  limit?: number;
  filters?: DataSourceFilters;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'type' | 'status';  // ← added
  sortOrder?: 'asc' | 'desc';                                        // ← added
}

/* ---------------------------------------------------------------------------
 * DataSource record
 * --------------------------------------------------------------------------- */
export interface DataSourceMetadata {
  version?: string;
  driver?: string;
  encoding?: string;
  timezone?: string;
  tableCount?: number;
  estimatedSize?: string;
  lastSchemaUpdate?: Date;
  customFields?: Record<string, any>;
}

export interface DataSource {
  id: string; // UUID string
  name: string;
  description?: string;
  type: DataSourceType;
  status: DataSourceStatus;
  connectionConfig: ConnectionConfig;
  tags: string[];
  metadata: DataSourceMetadata;

  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy?: string;
  deletedAt?: Date;

  lastTestAt?: Date;
  lastSyncAt?: Date;
  lastError?: string;

  publicId?: string | null;

  // optional live metrics
  responseTime?: number;
  availability?: number;

  // sync & ingestion scheduling
  syncEnabled?: boolean;
  syncSchedule?: string; // cron
  syncOptions?: {
    fullSync?: boolean;
    incrementalField?: string;
    batchSize?: number;
  };
}

/* ---------------------------------------------------------------------------
 * PostgreSQL DDL (idempotent)
 * --------------------------------------------------------------------------- */
export const createDataSourcesTable = `
  CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    connection_config JSONB NOT NULL,
    tags TEXT[] DEFAULT '{}',               -- TEXT[] (not JSONB)
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by VARCHAR(255),
    updated_by VARCHAR(255),
    deleted_at TIMESTAMPTZ,

    last_test_at TIMESTAMPTZ,
    last_tested_at TIMESTAMPTZ,             -- legacy tolerated (COALESCE)
    last_sync_at TIMESTAMPTZ,
    last_error TEXT,

    public_id VARCHAR(100),

    response_time INTEGER,
    availability DECIMAL(5,2),

    sync_enabled BOOLEAN DEFAULT false,
    sync_schedule VARCHAR(255),
    sync_options JSONB DEFAULT '{}'
  );

  CREATE INDEX IF NOT EXISTS idx_ds_type ON data_sources(type);
  CREATE INDEX IF NOT EXISTS idx_ds_status ON data_sources(status);
  CREATE INDEX IF NOT EXISTS idx_ds_created_by ON data_sources(created_by);
  CREATE INDEX IF NOT EXISTS idx_ds_deleted_at ON data_sources(deleted_at);
  CREATE INDEX IF NOT EXISTS idx_ds_last_sync ON data_sources(last_sync_at);
  CREATE INDEX IF NOT EXISTS idx_ds_updated_at ON data_sources(updated_at);

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = 'uq_data_sources_public_id'
    ) THEN
      CREATE UNIQUE INDEX uq_data_sources_public_id
        ON data_sources((public_id)) WHERE public_id IS NOT NULL;
    END IF;
  END $$;
`;

/* ---------------------------------------------------------------------------
 * Result & stats
 * --------------------------------------------------------------------------- */
export interface ConnectionTestResult {
  success: boolean;
  responseTime?: number;
  error?: string;
  details?: {
    version?: string;
    serverInfo?: Record<string, any>;
    capabilities?: string[];
  };
  testedAt: Date;
}

export interface DataSourceStats {
  dataSourceId: string;
  totalTables: number;
  totalColumns: number;
  totalRows: number;
  estimatedSize: string;
  lastUpdated: Date;
  tableStats: TableStats[];
}
export interface TableStats {
  name: string;
  schema?: string;
  rowCount: number;
  columnCount: number;
  sizeBytes: number;
  lastModified?: Date;
}

/* ---------------------------------------------------------------------------
 * Helpers
 * --------------------------------------------------------------------------- */
export function validateDataSourceType(s: string): s is DataSourceType {
  const all: readonly DataSourceType[] = [
    'postgresql','mysql','mssql','oracle','mongodb','redis',
    's3','azure-blob','gcs','snowflake','bigquery','redshift',
    'databricks','api','file','kafka','elasticsearch',
  ];
  return (all as readonly string[]).includes(s);
}

export function validateDataSourceStatus(s: string): s is DataSourceStatus {
  const all: readonly DataSourceStatus[] = [
    'pending','connected','disconnected','error','warning','syncing','testing','active','inactive',
  ];
  return (all as readonly string[]).includes(s);
}

/** Map common aliases to canonical types */
export function normalizeDataSourceType(t: string): DataSourceType {
  const x = (t || '').toLowerCase();
  if (x === 'azure_sql' || x === 'azure-sql' || x === 'sqlserver' || x === 'sql-server') return 'mssql';
  return validateDataSourceType(x) ? (x as DataSourceType) : (x as DataSourceType);
}

export function getDefaultPort(type: DataSourceType): number | undefined {
  switch (type) {
    case 'postgresql': return 5432;
    case 'mysql': return 3306;
    case 'mssql': return 1433;
    case 'oracle': return 1521;
    case 'mongodb': return 27017;
    case 'redis': return 6379;
    case 'elasticsearch': return 9200;
    default: return undefined;
  }
}

/** Strong validation per connector (narrow, then read special props). */
export function validateConnectionConfig(type: DataSourceType, cfg: Partial<ConnectionConfig>): string[] {
  const errors: string[] = [];
  const t = normalizeDataSourceType(type);
  const need = (ok: boolean, msg: string) => { if (!ok) errors.push(msg); };

  switch (t) {
    case 'postgresql':
    case 'mysql':
    case 'mssql':
    case 'oracle':
    case 'redshift':
    case 'databricks': {
      need(!!(cfg.connectionString || cfg.host), 'Host or connection string is required');
      need(!!(cfg.connectionString || (cfg as any).database), 'Database is required');
      break;
    }

    case 'mongodb': {
      need(!!(cfg.connectionString || cfg.host), 'Host or connection string is required');
      break;
    }

    case 'redis': {
      const rc = cfg as any;
      if (!rc.cluster) {
        need(!!(rc.host || rc.connectionString), 'Host or connection string is required');
      } else {
        need(Array.isArray(rc.nodes) && rc.nodes.length > 0, 'At least one cluster node is required');
      }
      break;
    }

    case 's3': {
      const sc = cfg as any;
      need(!!sc.bucket, 'Bucket is required');
      need(!!sc.region, 'Region is required');
      break;
    }

    case 'azure-blob': {
      const ac = cfg as any;
      need(!!ac.container, 'Container is required');
      break;
    }

    case 'gcs': {
      const gc = cfg as any;
      need(!!gc.bucket, 'Bucket is required');
      break;
    }

    case 'snowflake': {
      const sn = cfg as any;
      need(!!sn.host, 'Account URL/host is required');
      need(!!sn.username, 'Username is required');
      need(!!sn.database, 'Database is required');
      break;
    }

    case 'bigquery': {
      const bq = cfg as any;
      need(!!bq.serviceAccountKey, 'Service account key is required');
      break;
    }

    case 'api': {
      const api = cfg as any;
      need(!!api.baseUrl, 'Base URL is required');
      if (api.baseUrl) {
        try { new URL(api.baseUrl); } catch { errors.push('Base URL must be a valid URL'); }
      }
      break;
    }

    case 'file': {
      const fc = cfg as any;
      need(!!fc.path, 'File path is required');
      break;
    }

    case 'kafka': {
      const kc = cfg as any;
      need(Array.isArray(kc.brokers) && kc.brokers.length > 0, 'At least one broker is required');
      break;
    }

    case 'elasticsearch': {
      need(!!(cfg.host || cfg.connectionString), 'Host or connection string is required');
      break;
    }
  }

  if (cfg.port !== undefined && (cfg.port < 1 || cfg.port > 65535)) {
    errors.push('Port must be between 1 and 65535');
  }
  return errors;
}

/* ---------------------------------------------------------------------------
 * UI helpers
 * --------------------------------------------------------------------------- */
export function getDataSourceDisplayName(type: DataSourceType): string {
  const t = normalizeDataSourceType(type);
  const display: Record<DataSourceType, string> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mssql: 'SQL Server',
    oracle: 'Oracle',
    mongodb: 'MongoDB',
    redis: 'Redis',
    s3: 'Amazon S3',
    'azure-blob': 'Azure Blob Storage',
    gcs: 'Google Cloud Storage',
    snowflake: 'Snowflake',
    bigquery: 'Google BigQuery',
    redshift: 'Amazon Redshift',
    databricks: 'Databricks',
    api: 'REST API',
    file: 'File System',
    kafka: 'Apache Kafka',
    elasticsearch: 'Elasticsearch',
  };
  return display[t] || t;
}

export function getDataSourceIcon(type: DataSourceType): string {
  const t = normalizeDataSourceType(type);
  const icons: Record<DataSourceType, string> = {
    postgresql: '🐘',
    mysql: '🐬',
    mssql: '🏢',
    oracle: '🏛️',
    mongodb: '🍃',
    redis: '📦',
    s3: '☁️',
    'azure-blob': '☁️',
    gcs: '☁️',
    snowflake: '❄️',
    bigquery: '📊',
    redshift: '📊',
    databricks: '🧱',
    api: '🔌',
    file: '📁',
    kafka: '🚀',
    elasticsearch: '🔍',
  };
  return icons[t] || '💾';
}

export function getStatusColor(status: DataSourceStatus): string {
  const colors: Record<DataSourceStatus, string> = {
    pending: '#fbbf24',
    connected: '#10b981',
    disconnected: '#6b7280',
    error: '#ef4444',
    warning: '#f59e0b',
    syncing: '#3b82f6',
    testing: '#8b5cf6',
    active: '#10b981',    // synonym of connected
    inactive: '#6b7280',  // synonym of disconnected
  };
  return colors[status];
}

/* ---------------------------------------------------------------------------
 * Safe creation template for UI flows
 * --------------------------------------------------------------------------- */
export type NewDataSourceTemplate =
  Partial<Omit<DataSource, 'connectionConfig'>> & {
    connectionConfig: Partial<ConnectionConfig>;
  };

export function createDataSourceTemplate(kind: DataSourceType): NewDataSourceTemplate {
  const t = normalizeDataSourceType(kind);
  return {
    type: t,
    status: 'pending',
    tags: [],
    metadata: {},
    connectionConfig: {
      port: getDefaultPort(t),
      timeout: 30_000,
      maxConnections: 10,
      retryAttempts: 3,
    },
    syncEnabled: false,
    syncOptions: {
      fullSync: true,
      batchSize: 1000,
    },
  };
}

/* ---------------------------------------------------------------------------
 * Type guards
 * --------------------------------------------------------------------------- */
export const isAPIConfig = (c: Partial<ConnectionConfig>): c is APIConnection =>
  (c as APIConnection).type === 'api' || typeof (c as APIConnection).baseUrl === 'string';

export const isS3Config = (c: Partial<ConnectionConfig>): c is S3Connection =>
  (c as S3Connection).type === 's3' || !!(c as S3Connection).accessKeyId || !!(c as S3Connection).secretAccessKey;

export const isSnowflakeConfig = (c: Partial<ConnectionConfig>): c is SnowflakeConnection =>
  (c as SnowflakeConnection).type === 'snowflake';

export const isBigQueryConfig = (c: Partial<ConnectionConfig>): c is BigQueryConnection =>
  (c as BigQueryConnection).type === 'bigquery' || typeof (c as BigQueryConnection).serviceAccountKey === 'string';

/* ---------------------------------------------------------------------------
 * Back-compat type aliases (old names used elsewhere)
 * --------------------------------------------------------------------------- */
export type APIConfig        = APIConnection;
export type BigQueryConfig   = BigQueryConnection;
export type S3Config         = S3Connection;
export type SnowflakeConfig  = SnowflakeConnection;
// For places that refer to "AzureSQLConnection", use MSSQL config
export type AzureSQLConnection = MSSQLConnection;
