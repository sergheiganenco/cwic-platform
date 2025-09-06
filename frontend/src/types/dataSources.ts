// src/types/dataSources.ts - Copy this entire file to replace your existing one

// Base data source types that match your backend
export type DataSourceType = 
  | 'postgresql' 
  | 'mysql' 
  | 'mssql' 
  | 'mongodb' 
  | 'redis'
  | 'snowflake'
  | 'bigquery'
  | 'redshift'
  | 'databricks'
  | 's3'
  | 'azure-blob'
  | 'gcs'
  | 'kafka'
  | 'api'
  | 'file'
  | 'ftp'
  | 'elasticsearch'
  | 'oracle' ;// If you decide to support Oracle in the future;

// Data source status
export type DataSourceStatus = 'active' | 'inactive' | 'pending' | 'error' | 'testing';

// Base connection configuration
export interface BaseConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
  timeout?: number;
  customOptions?: Record<string, any>;
}

// Specific connection configs
export interface PostgreSQLConfig extends BaseConnectionConfig {
  sslmode?: 'disable' | 'require' | 'verify-ca' | 'verify-full';
  schema?: string;
  connectTimeout?: number;
}

export interface MySQLConfig extends BaseConnectionConfig {
  charset?: string;
  timezone?: string;
}

export interface SQLServerConfig extends BaseConnectionConfig {
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  server?: string;
}

export interface MongoDBConfig {
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  authSource?: string;
  replicaSet?: string;
  ssl?: boolean;
  customOptions?: Record<string, any>;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  ssl?: boolean;
  keyPrefix?: string;
  customOptions?: Record<string, any>;
}

export interface SnowflakeConfig {
  host: string;
  database: string;
  warehouse: string;
  schema?: string;
  username: string;
  password: string;
  role?: string;
  customOptions?: Record<string, any>;
}

export interface BigQueryConfig {
  serviceAccountKey: string;
  projectId: string;
  location?: string;
  customOptions?: Record<string, any>;
}

export interface S3Config {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  prefix?: string;
  customOptions?: Record<string, any>;
}

export interface AzureBlobConfig {
  accountName: string;
  accountKey: string;
  containerName: string;
  prefix?: string;
  endpoint?: string;
  customOptions?: Record<string, any>;
}

export interface GCSConfig {
  serviceAccountKey: string;
  bucketName: string;
  prefix?: string;
  projectId?: string;
  customOptions?: Record<string, any>;
}

export interface KafkaConfig {
  brokers: string[] | string;
  consumerGroup?: string;
  securityProtocol?: 'PLAINTEXT' | 'SASL_PLAINTEXT' | 'SASL_SSL' | 'SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512';
  saslUsername?: string;
  saslPassword?: string;
  topics?: string[];
  customOptions?: Record<string, any>;
}

export interface APIConfig {
  baseUrl: string;
  authType?: 'none' | 'api-key' | 'bearer' | 'basic' | 'oauth2';
  apiKey?: string;
  apiKeyHeader?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  timeout?: number;
  rateLimit?: number;
  customOptions?: Record<string, any>;
}

export interface FileConfig {
  path: string;
  format: 'csv' | 'json' | 'jsonl' | 'parquet' | 'xlsx' | 'xml' | 'txt';
  encoding?: 'utf-8' | 'utf-16' | 'latin1' | 'ascii';
  delimiter?: string;
  hasHeader?: boolean;
  recursive?: boolean;
  customOptions?: Record<string, any>;
}

export interface FTPConfig {
  host: string;
  port?: number;
  username: string;
  password: string;
  protocol: 'ftp' | 'sftp' | 'ftps';
  path?: string;
  passive?: boolean;
  customOptions?: Record<string, any>;
}

export interface ElasticsearchConfig extends BaseConnectionConfig {
  apiKey?: string;
  cloudId?: string;
  index?: string;
}

export interface DatabricksConfig {
  host: string;
  httpPath: string;
  accessToken: string;
  catalog?: string;
  schema?: string;
  customOptions?: Record<string, any>;
}

export interface RedshiftConfig extends BaseConnectionConfig {
  schema?: string;
}

// Union type for all connection configurations
export type ConnectionConfig = 
  | PostgreSQLConfig
  | MySQLConfig
  | SQLServerConfig
  | MongoDBConfig
  | RedisConfig
  | SnowflakeConfig
  | BigQueryConfig
  | S3Config
  | AzureBlobConfig
  | GCSConfig
  | KafkaConfig
  | APIConfig
  | FileConfig
  | FTPConfig
  | ElasticsearchConfig
  | DatabricksConfig
  | RedshiftConfig
  | BaseConnectionConfig;

// Type guards for connection configs
export function isS3Config(config: ConnectionConfig): config is S3Config {
  return 'accessKeyId' in config && 'secretAccessKey' in config && 'bucket' in config;
}

export function isAPIConfig(config: ConnectionConfig): config is APIConfig {
  return 'baseUrl' in config;
}

export function isSnowflakeConfig(config: ConnectionConfig): config is SnowflakeConfig {
  return 'warehouse' in config;
}

export function isBigQueryConfig(config: ConnectionConfig): config is BigQueryConfig {
  return 'serviceAccountKey' in config && 'projectId' in config;
}

export function isMongoDBConfig(config: ConnectionConfig): config is MongoDBConfig {
  return 'connectionString' in config || ('host' in config && 'database' in config);
}

export function isKafkaConfig(config: ConnectionConfig): config is KafkaConfig {
  return 'brokers' in config;
}

export function isDatabricksConfig(config: ConnectionConfig): config is DatabricksConfig {
  return 'httpPath' in config && 'accessToken' in config;
}

// Main DataSource interface
export interface DataSource {
  id: string;
  name: string;
  description?: string;
  type: DataSourceType;
  status: DataSourceStatus;
  connectionConfig: ConnectionConfig;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  lastTestedAt?: string;
  lastSyncAt?: string;
  healthStatus?: {
    status: 'healthy' | 'degraded' | 'down' | 'unknown';
    lastChecked: string;
    responseTime?: number;
    message?: string;
  };
  syncStatus?: {
    status: 'idle' | 'syncing' | 'completed' | 'failed';
    lastSync?: string;
    nextSync?: string;
    tablesCount?: number;
    errors?: string[];
  };
  usage?: {
    queriesCount: number;
    lastUsed?: string;
    avgResponseTime?: number;
  };
}

// Paginated response for data sources
export interface PaginatedDataSources {
  data: DataSource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  filters?: {
    status?: string;
    type?: string;
    tags?: string[];
  };
}

// Data source creation payload
export interface CreateDataSourcePayload {
  name: string;
  description?: string;
  type: DataSourceType;
  connectionConfig: ConnectionConfig;
  tags?: string[];
  metadata?: Record<string, any>;
}

// Data source update payload
export interface UpdateDataSourcePayload {
  name?: string;
  description?: string;
  connectionConfig?: Partial<ConnectionConfig>;
  tags?: string[];
  metadata?: Record<string, any>;
  status?: DataSourceStatus;
}

// Connection test result
export interface ConnectionTestResult {
  success?: boolean;
  message?: string;
  connectionStatus?: 'connected' | 'failed' | 'unknown';
  testedAt?: string;
  responseTimeMs?: number;
  // allow server-specific extras
  [k: string]: any;
}

// Sync operation result
export interface SyncResult {
  syncId: string;                               // always filled by our normalizer
  status: 'queued' | 'started' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  tablesScanned?: number;
  newTables?: number;
  updatedTables?: number;
  errors?: string[];
  message?: string;
  // allow extras
  [k: string]: any;
}

// Data source metrics
export interface DataSourceMetrics {
  totalConnections: number;
  activeConnections: number;
  connectionsByType: Record<DataSourceType, number>;
  connectionsByStatus: Record<DataSourceStatus, number>;
  healthyConnections: number;
  recentActivity: {
    date: string;
    connections: number;
    queries: number;
  }[];
  topConnections: {
    id: string;
    name: string;
    type: DataSourceType;
    queryCount: number;
  }[];
}

// Asset types (keep original names to avoid conflicts)
export interface Asset {
  id: string;
  name: string;
  type: 'table' | 'view' | 'procedure' | 'function' | 'schema';
  dataSourceId: string;
  schemaName?: string;
  tableName?: string;
  description?: string;
  columns: Column[];
  tags: string[];
  status: 'active' | 'inactive' | 'deprecated';
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  description?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  metadata?: Record<string, any>;
}

// Data lineage
export interface AssetLineage {
  upstream: Asset[];
  downstream: Asset[];
  relationships: {
    id: string;
    upstreamAssetId: string;
    downstreamAssetId: string;
    type: string;
    description?: string;
  }[];
}

// Data quality
export interface DataQualityRule {
  id: string;
  assetId: string;
  name: string;
  type: 'not_null' | 'unique' | 'range' | 'pattern' | 'custom';
  configuration: Record<string, any>;
  status: 'active' | 'inactive';
  lastRunAt?: string;
  lastResult?: {
    passed: boolean;
    score: number;
    message?: string;
    details?: Record<string, any>;
  };
}

// Search and filtering
export interface DataSourceFilters {
  search?: string;
  types?: DataSourceType[];
  statuses?: DataSourceStatus[];
  tags?: string[];
  createdBy?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface AssetFilters {
  search?: string;
  types?: Asset['type'][];
  dataSourceIds?: string[];
  tags?: string[];
  schemas?: string[];
}

// Event types for real-time updates
export interface DataSourceEvent {
  type: 'created' | 'updated' | 'deleted' | 'tested' | 'synced';
  dataSourceId: string;
  timestamp: string;
  data?: Partial<DataSource>;
  user?: string;
}

// Webhook configuration
export interface WebhookConfig {
  id: string;
  url: string;
  events: DataSourceEvent['type'][];
  secret?: string;
  active: boolean;
  createdAt: string;
  lastTriggered?: string;
}