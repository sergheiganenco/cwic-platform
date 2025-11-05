// src/types/dataSources.ts

// ----------------------------- Core Types ------------------------------

export type DataSourceType =
  // Relational Databases
  | 'postgresql'
  | 'mysql'
  | 'mssql'
  | 'oracle'
  | 'sqlite'
  | 'mariadb'
  
  // NoSQL Databases
  | 'mongodb'
  | 'redis'
  | 'cassandra'
  | 'couchdb'
  | 'dynamodb'
  | 'neo4j'
  
  // Cloud Data Warehouses
  | 'snowflake'
  | 'bigquery'
  | 'redshift'
  | 'databricks'
  | 'synapse'
  | 'clickhouse'
  
  // Cloud Storage
  | 's3'
  | 'azure-blob'
  | 'gcs'
  | 'hdfs'
  | 'minio'
  
  // Streaming & Messaging
  | 'kafka'
  | 'kinesis'
  | 'pubsub'
  | 'eventhub'
  | 'pulsar'
  | 'rabbitmq'
  
  // Search & Analytics
  | 'elasticsearch'
  | 'opensearch'
  | 'solr'
  | 'splunk'
  
  // Time Series
  | 'influxdb'
  | 'prometheus'
  | 'timescaledb'
  
  // APIs & Web Services
  | 'api'
  | 'graphql'
  | 'soap'
  | 'webhook'
  
  // File Systems
  | 'file'
  | 'ftp'
  | 'sftp'
  
  // Business Applications
  | 'salesforce'
  | 'hubspot'
  | 'zendesk'
  | 'jira'
  | 'confluence'
  | 'sharepoint'
  | 'github'
  | 'gitlab'
  | 'slack'
  | 'teams';

export type DataSourceStatus = 
  | 'active' 
  | 'inactive' 
  | 'pending' 
  | 'error' 
  | 'testing'
  | 'syncing'
  | 'maintenance'
  | 'deprecated';

export type ConnectionScope = 
  | 'server'     // Connect to entire server (PostgreSQL, MySQL)
  | 'cluster'    // Connect to cluster (MongoDB, Kafka, Elasticsearch)
  | 'database'   // Connect to specific database only
  | 'schema'     // Connect to specific schema
  | 'instance'   // Connect to instance (SQL Server)
  | 'workspace'  // Connect to workspace (Databricks, Slack)
  | 'project'    // Connect to project (BigQuery, GCP)
  | 'account'    // Connect to account (Snowflake)
  | 'tenant'     // Connect to tenant (Azure services)
  | 'org';       // Connect to organization (GitHub, Salesforce)

export type DiscoveryMode = 
  | 'auto'       // Automatic discovery on connection
  | 'manual'     // Manual selection only
  | 'scheduled'  // Scheduled discovery
  | 'guided'     // User-guided discovery
  | 'streaming'  // Real-time streaming discovery
  | 'disabled';  // No discovery

export type AuthType = 
  | 'username_password'
  | 'api_key'
  | 'bearer_token'
  | 'oauth2'
  | 'oauth1'
  | 'basic_auth'
  | 'service_account'
  | 'certificate'
  | 'kerberos'
  | 'ldap'
  | 'saml'
  | 'aws_iam'
  | 'azure_ad'
  | 'google_service_account'
  | 'ssh_key'
  | 'none';

export type SSLMode = 
  | 'disable'
  | 'allow'
  | 'prefer'
  | 'require'
  | 'verify-ca'
  | 'verify-full';

export type HealthStatus = 
  | 'healthy'
  | 'degraded'
  | 'down'
  | 'unknown'
  | 'warning';

export type SyncStatus = 
  | 'idle'
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'paused';

// ----------------------------- Base Configs ------------------------------

export interface BaseConnectionConfig {
  // Connection details
  host?: string;
  port?: number;
  database?: string;
  schema?: string;
  connectionString?: string;
  
  // Authentication
  username?: string;
  password?: string;
  authType?: AuthType;
  
  // Security
  ssl?: boolean;
  sslMode?: SSLMode;
  sslCert?: string;
  sslKey?: string;
  sslCa?: string;
  
  // Connection behavior
  timeout?: number;
  connectTimeout?: number;
  queryTimeout?: number;
  maxConnections?: number;
  minConnections?: number;
  idleTimeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  
  // Discovery settings
  scope?: ConnectionScope;
  discoveryMode?: DiscoveryMode;
  includedDatabases?: string[];
  excludedDatabases?: string[];
  includedSchemas?: string[];
  excludedSchemas?: string[];
  includedTables?: string[];
  excludedTables?: string[];
  
  // Performance & optimization
  batchSize?: number;
  parallelism?: number;
  compressionEnabled?: boolean;
  cacheTTL?: number;
  
  // Monitoring & logging
  enableMetrics?: boolean;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Custom properties
  customOptions?: Record<string, any>;
  tags?: string[];
  metadata?: Record<string, any>;
}

// ------------------------ Database-Specific Configs ----------------------

export interface PostgreSQLConfig extends BaseConnectionConfig {
  // PostgreSQL specific
  applicationName?: string;
  searchPath?: string[];
  timezone?: string;
  
  // Connection pooling
  poolSize?: number;
  poolIdleTimeout?: number;
  poolLifetime?: number;
  
  // Advanced settings
  preparedStatements?: boolean;
  binaryResults?: boolean;
  clientEncoding?: string;
  
  // Extensions
  extensions?: string[];
}

export interface MySQLConfig extends BaseConnectionConfig {
  charset?: string;
  collation?: string;
  timezone?: string;
  socketPath?: string;
  
  // MySQL specific options
  multipleStatements?: boolean;
  acquireTimeout?: number;
  reconnect?: boolean;
  bigNumberStrings?: boolean;
  supportBigNumbers?: boolean;
  dateStrings?: boolean;
}

export interface SQLServerConfig extends BaseConnectionConfig {
  // SQL Server specific
  instance?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  enableArithAbort?: boolean;
  
  // Connection options
  connectionIsolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  requestTimeout?: number;
  cancelTimeout?: number;
  
  // Authentication
  domain?: string;
  integratedSecurity?: boolean;
}

export interface OracleConfig extends BaseConnectionConfig {
  // Oracle specific
  serviceName?: string;
  sid?: string;
  tnsAdmin?: string;
  walletLocation?: string;
  connectString?: string;
  
  // Connection options
  privilege?: 'NORMAL' | 'SYSDBA' | 'SYSOPER';
  edition?: string;
  events?: boolean;
  
  // Performance
  prefetchRows?: number;
  stmtCacheSize?: number;
}

export interface MongoDBConfig extends BaseConnectionConfig {
  // MongoDB connection
  connectionString?: string;
  uri?: string;
  
  // Replica set & sharding
  replicaSet?: string;
  readPreference?: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred' | 'nearest';
  authSource?: string;
  authMechanism?: 'SCRAM-SHA-1' | 'SCRAM-SHA-256' | 'MONGODB-CR' | 'PLAIN' | 'GSSAPI';
  
  // Performance options
  maxPoolSize?: number;
  minPoolSize?: number;
  maxIdleTimeMS?: number;
  waitQueueTimeoutMS?: number;
  
  // Write concern
  writeConcern?: {
    w?: number | string;
    j?: boolean;
    wtimeout?: number;
  };
  
  // Read concern
  readConcern?: 'local' | 'available' | 'majority' | 'linearizable' | 'snapshot';
}

export interface RedisConfig extends BaseConnectionConfig {
  // Redis specific
  keyPrefix?: string;
  db?: number;
  family?: 4 | 6;
  keepAlive?: boolean;
  
  // Cluster mode
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
  retryDelayOnFailover?: number;
  enableOfflineQueue?: boolean;
  
  // Sentinel
  sentinels?: Array<{ host: string; port: number }>;
  name?: string;
  role?: 'master' | 'slave';
  
  // Advanced
  lazyConnect?: boolean;
  readonly?: boolean;
}

// ------------------------ Cloud Warehouse Configs ----------------------

export interface SnowflakeConfig extends BaseConnectionConfig {
  // Snowflake specific
  account: string;
  warehouse: string;
  role?: string;
  authenticator?: 'snowflake' | 'oauth' | 'external_browser' | 'key_pair';
  
  // Key pair authentication
  privateKey?: string;
  privateKeyPath?: string;
  privateKeyPassphrase?: string;
  
  // Session parameters
  sessionParameters?: Record<string, string | number | boolean>;
  clientSessionKeepAlive?: boolean;
  clientSessionKeepAliveHeartbeatFrequency?: number;
  
  // Performance
  arrayBindingThreshold?: number;
  fetchAsString?: string[];
}

export interface BigQueryConfig extends BaseConnectionConfig {
  // Required
  projectId: string;
  
  // Authentication
  serviceAccountKey?: string;
  serviceAccountPath?: string;
  
  // Optional settings
  location?: string;
  datasetId?: string;
  maximumBytesProcessed?: number;
  useLegacySql?: boolean;
  
  // Performance
  maxResults?: number;
  timeoutMs?: number;
  useQueryCache?: boolean;
  dryRun?: boolean;
  
  // Labels and metadata
  labels?: Record<string, string>;
  jobId?: string;
  jobIdPrefix?: string;
}

export interface RedshiftConfig extends BaseConnectionConfig {
  // Redshift specific
  clusterIdentifier?: string;
  region?: string;
  
  // IAM authentication
  iamRole?: string;
  temporaryCredentials?: boolean;
  
  // SSL options
  sslRootCert?: string;
  
  // Connection options
  loadBalancing?: boolean;
  loginTimeout?: number;
}

export interface DatabricksConfig extends BaseConnectionConfig {
  // Required
  httpPath: string;
  accessToken?: string;
  
  // Optional
  catalog?: string;
  clusterId?: string;
  
  // HTTP options
  httpHeaders?: Record<string, string>;
  userAgentEntry?: string;
  
  // Connection options
  connTimeout?: number;
  socketTimeout?: number;
  maxRetryCount?: number;
  retryInterval?: number;
}

// ------------------------ Cloud Storage Configs -------------------------

export interface S3Config extends BaseConnectionConfig {
  // AWS S3
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  
  // S3 specific
  bucket: string;
  region: string;
  prefix?: string;
  
  // Advanced options
  endpoint?: string;
  s3ForcePathStyle?: boolean;
  s3BucketEndpoint?: boolean;
  signatureVersion?: 'v2' | 'v4';
  
  // Performance
  partSize?: number;
  maxConcurrency?: number;
  maxUploadParts?: number;
  
  // Server-side encryption
  serverSideEncryption?: 'AES256' | 'aws:kms';
  kmsKeyId?: string;
}

export interface AzureBlobConfig extends BaseConnectionConfig {
  // Azure Blob Storage
  accountName: string;
  accountKey?: string;
  sasToken?: string;
  connectionString?: string;
  
  // Container
  containerName: string;
  prefix?: string;
  
  // Advanced
  endpoint?: string;
  storageEndpoint?: string;
  
  // Performance
  blockSize?: number;
  maxConcurrency?: number;
  
  // Authentication
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
}

export interface GCSConfig extends BaseConnectionConfig {
  // Google Cloud Storage
  projectId: string;
  bucketName: string;
  serviceAccountKey?: string;
  serviceAccountPath?: string;
  
  // Options
  prefix?: string;
  location?: string;
  storageClass?: 'STANDARD' | 'NEARLINE' | 'COLDLINE' | 'ARCHIVE';
  
  // Performance
  chunkSize?: number;
  maxConcurrency?: number;
  
  // Metadata
  metadata?: Record<string, string>;
}

// ------------------------ Streaming Configs ------------------------------

export interface KafkaConfig extends BaseConnectionConfig {
  // Kafka connection
  brokers: string[] | string;
  clientId?: string;
  
  // Security
  securityProtocol?: 'PLAINTEXT' | 'SASL_PLAINTEXT' | 'SASL_SSL' | 'SSL';
  saslMechanism?: 'PLAIN' | 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'GSSAPI' | 'OAUTHBEARER';
  saslUsername?: string;
  saslPassword?: string;
  
  // SSL
  sslCaLocation?: string;
  sslCertificateLocation?: string;
  sslKeyLocation?: string;
  sslKeyPassword?: string;
  
  // Consumer/Producer
  consumerGroup?: string;
  topics?: string[];
  autoOffsetReset?: 'earliest' | 'latest' | 'none';
  enableAutoCommit?: boolean;
  sessionTimeoutMs?: number;
  heartbeatIntervalMs?: number;
  maxPollRecords?: number;
  
  // Schema Registry
  schemaRegistryUrl?: string;
  schemaRegistryAuth?: {
    username: string;
    password: string;
  };
}

// ------------------------ API Configs ------------------------------------

export interface APIConfig extends BaseConnectionConfig {
  // Required
  baseUrl: string;
  
  // Authentication
  apiKey?: string;
  apiKeyHeader?: string;
  bearerToken?: string;
  clientId?: string;
  clientSecret?: string;
  
  // OAuth
  oauthTokenUrl?: string;
  oauthScope?: string[];
  refreshToken?: string;
  
  // HTTP options
  httpMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  requestBody?: string;
  
  // Rate limiting
  rateLimit?: number;
  rateLimitPeriod?: number;
  
  // Retry logic
  maxRetries?: number;
  retryBackoff?: 'fixed' | 'exponential' | 'linear';
  
  // Response handling
  responseFormat?: 'json' | 'xml' | 'csv' | 'text';
  dataPath?: string; // JSON path to extract data
  paginationType?: 'offset' | 'cursor' | 'page' | 'none';
  paginationParams?: Record<string, string>;
  
  // Validation
  validateResponse?: boolean;
  schema?: string; // JSON schema for validation
}

// ------------------------ File System Configs ----------------------------

export interface FileConfig extends BaseConnectionConfig {
  // File path
  path: string;
  pattern?: string; // File pattern/glob
  
  // File format
  format: 'csv' | 'json' | 'jsonl' | 'parquet' | 'avro' | 'orc' | 'xlsx' | 'xml' | 'txt' | 'yaml';
  encoding?: 'utf-8' | 'utf-16' | 'latin1' | 'ascii' | 'cp1252';
  
  // CSV specific
  delimiter?: string;
  quoteChar?: string;
  escapeChar?: string;
  hasHeader?: boolean;
  skipRows?: number;
  
  // JSON specific
  jsonPath?: string;
  multiline?: boolean;
  
  // General options
  recursive?: boolean;
  followSymlinks?: boolean;
  includeHidden?: boolean;
  
  // Compression
  compression?: 'gzip' | 'bzip2' | 'xz' | 'lz4' | 'snappy' | 'none';
  
  // Performance
  bufferSize?: number;
  maxFileSize?: number;
  
  // Monitoring
  watchForChanges?: boolean;
  pollInterval?: number;
}

export interface FTPConfig extends BaseConnectionConfig {
  // FTP/SFTP
  protocol: 'ftp' | 'sftp' | 'ftps';
  
  // Connection details
  remotePath?: string;
  passive?: boolean;
  
  // SFTP specific
  privateKeyPath?: string;
  privateKey?: string;
  passphrase?: string;
  hostKeyAlgorithms?: string[];
  
  // Performance
  maxConnections?: number;
  keepAlive?: boolean;
  keepAliveInterval?: number;
  
  // Transfer options
  transferMode?: 'ascii' | 'binary';
  resumeSupport?: boolean;
}

// ------------------------ Search Engine Configs -------------------------

export interface ElasticsearchConfig extends BaseConnectionConfig {
  // Elasticsearch/OpenSearch
  nodes?: string[];
  
  // Cloud
  cloudId?: string;
  apiKey?: string;
  
  // Authentication
  httpAuth?: { username: string; password: string };
  
  // SSL
  ca?: string | ArrayBuffer;
  cert?: string | ArrayBuffer;
  key?: string | ArrayBuffer;
  
  // Connection options
  maxRetries?: number;
  requestTimeout?: number;
  pingTimeout?: number;
  sniffOnStart?: boolean;
  sniffInterval?: number;
  
  // Index settings
  index?: string;
  type?: string;
  
  // Performance
  scrollDuration?: string;
  scrollSize?: number;
  bulkSize?: number;
}

// ------------------------ Business App Configs ---------------------------

export interface SalesforceConfig extends BaseConnectionConfig {
  // Salesforce connection
  loginUrl?: string;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  
  // API options
  apiVersion?: string;
  isSandbox?: boolean;
  
  // Object selection
  objects?: string[];
  customObjects?: boolean;
  
  // Performance
  batchSize?: number;
  maxRetries?: number;
  
  // Advanced
  bulkApiEnabled?: boolean;
  streamingApiEnabled?: boolean;
}

// ------------------------------- Unions --------------------------------

export type ConnectionConfig =
  | PostgreSQLConfig
  | MySQLConfig
  | SQLServerConfig
  | OracleConfig
  | MongoDBConfig
  | RedisConfig
  | SnowflakeConfig
  | BigQueryConfig
  | RedshiftConfig
  | DatabricksConfig
  | S3Config
  | AzureBlobConfig
  | GCSConfig
  | KafkaConfig
  | APIConfig
  | FileConfig
  | FTPConfig
  | ElasticsearchConfig
  | SalesforceConfig
  | BaseConnectionConfig;

// ------------------------------- Type Guards ---------------------------

export function isPostgreSQLConfig(config: ConnectionConfig): config is PostgreSQLConfig {
  return 'applicationName' in config || ('host' in config && 'database' in config && 'searchPath' in config);
}

export function isMySQLConfig(config: ConnectionConfig): config is MySQLConfig {
  return 'charset' in config || 'socketPath' in config;
}

export function isSQLServerConfig(config: ConnectionConfig): config is SQLServerConfig {
  return 'instance' in config || 'encrypt' in config || 'trustServerCertificate' in config;
}

export function isOracleConfig(config: ConnectionConfig): config is OracleConfig {
  return 'serviceName' in config || 'sid' in config || 'tnsAdmin' in config;
}

export function isMongoDBConfig(config: ConnectionConfig): config is MongoDBConfig {
  return 'connectionString' in config || 'uri' in config || 'replicaSet' in config;
}

export function isRedisConfig(config: ConnectionConfig): config is RedisConfig {
  return 'keyPrefix' in config || 'db' in config || 'sentinels' in config;
}

export function isSnowflakeConfig(config: ConnectionConfig): config is SnowflakeConfig {
  return 'account' in config && 'warehouse' in config;
}

export function isBigQueryConfig(config: ConnectionConfig): config is BigQueryConfig {
  return 'projectId' in config && ('serviceAccountKey' in config || 'serviceAccountPath' in config);
}

export function isS3Config(config: ConnectionConfig): config is S3Config {
  return 'bucket' in config && 'region' in config && ('accessKeyId' in config || 'sessionToken' in config);
}

export function isAzureBlobConfig(config: ConnectionConfig): config is AzureBlobConfig {
  return 'accountName' in config && 'containerName' in config;
}

export function isGCSConfig(config: ConnectionConfig): config is GCSConfig {
  return 'bucketName' in config && ('serviceAccountKey' in config || 'serviceAccountPath' in config);
}

export function isKafkaConfig(config: ConnectionConfig): config is KafkaConfig {
  return 'brokers' in config;
}

export function isAPIConfig(config: ConnectionConfig): config is APIConfig {
  return 'baseUrl' in config;
}

export function isFileConfig(config: ConnectionConfig): config is FileConfig {
  return 'path' in config && 'format' in config;
}

export function isFTPConfig(config: ConnectionConfig): config is FTPConfig {
  return 'protocol' in config && ['ftp', 'sftp', 'ftps'].includes((config as any).protocol);
}

export function isElasticsearchConfig(config: ConnectionConfig): config is ElasticsearchConfig {
  return 'nodes' in config || 'cloudId' in config || 'index' in config;
}

export function isDatabricksConfig(config: ConnectionConfig): config is DatabricksConfig {
  return 'httpPath' in config && 'accessToken' in config;
}

export function isSalesforceConfig(config: ConnectionConfig): config is SalesforceConfig {
  return 'loginUrl' in config || 'clientId' in config || 'apiVersion' in config;
}

// --------------------------- Enhanced Entities -------------------------

export interface DiscoveryResult {
  id: string;
  dataSourceId: string;
  discoveredAt: string;
  scope: ConnectionScope;
  
  // Discovered assets
  databases?: DatabaseInfo[];
  schemas?: SchemaInfo[];
  tables?: TableInfo[];
  views?: ViewInfo[];
  functions?: FunctionInfo[];
  procedures?: ProcedureInfo[];
  
  // Metadata
  totalAssets: number;
  metadata: Record<string, any>;
  errors?: string[];
}

export interface DatabaseInfo {
  name: string;
  size?: number;
  sizeFormatted?: string;
  schemaCount?: number;
  tableCount?: number;
  viewCount?: number;
  created?: string;
  lastModified?: string;
  charset?: string;
  collation?: string;
  owner?: string;
  metadata?: Record<string, any>;
}

export interface SchemaInfo {
  name: string;
  database?: string;
  tableCount?: number;
  viewCount?: number;
  functionCount?: number;
  procedureCount?: number;
  created?: string;
  lastModified?: string;
  owner?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface TableInfo {
  name: string;
  database?: string;
  schema?: string;
  type: 'table' | 'view' | 'materialized_view';
  rowCount?: number;
  size?: number;
  sizeFormatted?: string;
  columnCount?: number;
  created?: string;
  lastModified?: string;
  lastAnalyzed?: string;
  owner?: string;
  description?: string;
  columns?: ColumnInfo[];
  indexes?: IndexInfo[];
  constraints?: ConstraintInfo[];
  partitions?: PartitionInfo[];
  metadata?: Record<string, any>;
}

export interface ViewInfo extends Omit<TableInfo, 'type'> {
  type: 'view' | 'materialized_view';
  definition?: string;
  isUpdatable?: boolean;
  checkOption?: string;
  dependencies?: string[];
}

export interface ColumnInfo {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
  position: number;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  description?: string;
  tags?: string[];
  
  // Data quality metrics
  distinctCount?: number;
  nullCount?: number;
  minValue?: any;
  maxValue?: any;
  avgLength?: number;
  
  // Classification
  dataClassification?: 'public' | 'internal' | 'confidential' | 'restricted';
  piiType?: 'none' | 'direct' | 'quasi' | 'sensitive';
  
  metadata?: Record<string, any>;
}

export interface IndexInfo {
  name: string;
  type: 'btree' | 'hash' | 'gin' | 'gist' | 'spgist' | 'brin' | 'clustered' | 'nonclustered';
  columns: string[];
  isUnique: boolean;
  isPrimary?: boolean;
  size?: number;
  created?: string;
  metadata?: Record<string, any>;
}

export interface ConstraintInfo {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'not_null';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
  definition?: string;
  metadata?: Record<string, any>;
}

export interface PartitionInfo {
  name: string;
  type: 'range' | 'list' | 'hash';
  column: string;
  value?: any;
  rowCount?: number;
  size?: number;
  metadata?: Record<string, any>;
}

export interface FunctionInfo {
  name: string;
  database?: string;
  schema?: string;
  returnType: string;
  parameters?: ParameterInfo[];
  language?: string;
  definition?: string;
  created?: string;
  lastModified?: string;
  owner?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ProcedureInfo {
  name: string;
  database?: string;
  schema?: string;
  parameters?: ParameterInfo[];
  language?: string;
  definition?: string;
  created?: string;
  lastModified?: string;
  owner?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface ParameterInfo {
  name: string;
  dataType: string;
  direction: 'in' | 'out' | 'inout';
  defaultValue?: any;
  position: number;
  metadata?: Record<string, any>;
}

// Enhanced DataSource with comprehensive metadata
export interface DataSource {
  id: string;
  name: string;
  description?: string;
  type: DataSourceType;
  status: DataSourceStatus;
  connectionConfig: ConnectionConfig;
  
  // Organization
  tags: string[];
  labels?: Record<string, string>;
  owner?: string;
  team?: string;
  environment?: 'development' | 'staging' | 'production' | 'test';
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  lastTestAt?: string;
  lastSyncAt?: string;
  lastAccessedAt?: string;
  
  // Health & Performance
  healthStatus?: {
    status: HealthStatus;
    lastChecked: string;
    responseTime?: number;
    uptime?: number;
    message?: string;
    details?: Record<string, any>;
  };
  
  // Sync information
  syncStatus?: {
    status: SyncStatus;
    lastSync?: string;
    nextSync?: string;
    duration?: number;
    assetsDiscovered?: number;
    assetsUpdated?: number;
    errors?: string[];
    progress?: number;
  };
  
  // Usage analytics
  usage?: {
    queriesCount: number;
    lastUsed?: string;
    avgResponseTime?: number;
    uniqueUsers?: number;
    dataVolume?: number;
    errorRate?: number;
  };
  
  // Discovery results
  discovery?: {
    lastDiscovery?: string;
    databaseCount?: number;
    schemaCount?: number;
    tableCount?: number;
    columnCount?: number;
    totalSize?: number;
    coverage?: number; // percentage of assets cataloged
  };
  
  // Data governance
  governance?: {
    dataOwner?: string;
    steward?: string;
    retention?: string;
    classification?: 'public' | 'internal' | 'confidential' | 'restricted';
    complianceStatus?: 'compliant' | 'non_compliant' | 'unknown';
    lastAudit?: string;
  };
  
  // Cost tracking
  cost?: {
    monthlyCost?: number;
    currency?: string;
    lastCalculated?: string;
    costCenter?: string;
  };
  
  // Version info
  version?: {
    current: string;
    supported: string[];
    deprecated?: boolean;
    endOfLife?: string;
  };
  
  // Metadata and custom fields
  metadata: Record<string, any>;
  customFields?: Record<string, any>;
}

// Enhanced pagination and filtering
export interface PaginatedDataSources {
  data: DataSource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  filters?: DataSourceFilters;
  sort?: {
    field: keyof DataSource;
    direction: 'asc' | 'desc';
  };
  aggregations?: {
    byType: Record<DataSourceType, number>;
    byStatus: Record<DataSourceStatus, number>;
    byEnvironment: Record<string, number>;
    byHealth: Record<HealthStatus, number>;
    byOwner: Record<string, number>;
    totalSize: number;
    avgResponseTime: number;
  };
}

export interface DataSourceFilters {
  search?: string;
  types?: DataSourceType[];
  statuses?: DataSourceStatus[];
  healthStatuses?: HealthStatus[];
  tags?: string[];
  labels?: Record<string, string>;
  owners?: string[];
  teams?: string[];
  environments?: string[];
  criticalities?: string[];
  createdBy?: string[];
  
  // Date range filters
  createdAfter?: string;
  createdBefore?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  lastAccessedAfter?: string;
  lastAccessedBefore?: string;
  
  // Health and performance
  minResponseTime?: number;
  maxResponseTime?: number;
  minUptime?: number;
  hasErrors?: boolean;
  
  // Usage filters
  minQueryCount?: number;
  maxQueryCount?: number;
  hasRecentActivity?: boolean;
  
  // Governance
  dataClassifications?: string[];
  complianceStatuses?: string[];
  hasDataOwner?: boolean;
  
  // Cost
  minMonthlyCost?: number;
  maxMonthlyCost?: number;
  costCenter?: string[];
  
  // Custom fields
  customFields?: Record<string, any>;
}

// Enhanced API payloads
export interface CreateDataSourcePayload {
  name: string;
  description?: string;
  type: DataSourceType;
  connectionConfig: ConnectionConfig;
  tags?: string[];
  labels?: Record<string, string>;
  owner?: string;
  team?: string;
  environment?: 'development' | 'staging' | 'production' | 'test';
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  
  // Governance
  governance?: {
    dataOwner?: string;
    steward?: string;
    retention?: string;
    classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  };
  
  // Cost tracking
  cost?: {
    monthlyCost?: number;
    currency?: string;
    costCenter?: string;
  };
  
  // Metadata
  metadata?: Record<string, any>;
  customFields?: Record<string, any>;
  
  // Auto-sync settings
  autoSync?: boolean;
  syncSchedule?: string; // cron expression
  syncScope?: {
    includeDatabases?: string[];
    excludeDatabases?: string[];
    includeSchemas?: string[];
    excludeSchemas?: string[];
  };
}

export interface UpdateDataSourcePayload {
  name?: string;
  description?: string;
  connectionConfig?: Partial<ConnectionConfig>;
  status?: DataSourceStatus;
  tags?: string[];
  labels?: Record<string, string>;
  owner?: string;
  team?: string;
  environment?: 'development' | 'staging' | 'production' | 'test';
  criticality?: 'low' | 'medium' | 'high' | 'critical';
  governance?: Partial<DataSource['governance']>;
  cost?: Partial<DataSource['cost']>;
  metadata?: Record<string, any>;
  customFields?: Record<string, any>;
}

// Enhanced test and sync results
export interface ConnectionTestRequest {
  type: DataSourceType;
  connectionConfig: ConnectionConfig;
  testScope?: {
    testConnectivity?: boolean;
    testAuthentication?: boolean;
    testPermissions?: boolean;
    discoverAssets?: boolean;
    sampleQueries?: string[];
  };
}

export interface ConnectionTestResult {
  id: string;
  success: boolean;
  status: 'passed' | 'failed' | 'warning';
  message: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  
  // Test details
  tests: {
    connectivity?: TestStep;
    authentication?: TestStep;
    permissions?: TestStep;
    discovery?: TestStep;
    queries?: TestStep[];
  };
  
  // Connection metadata
  serverInfo?: {
    version: string;
    edition?: string;
    uptime?: string;
    activeConnections?: number;
    maxConnections?: number;
    availableMemory?: string;
    cpuUsage?: number;
  };
  
  // Discovered assets preview
  discoveredAssets?: {
    databases: DatabaseInfo[];
    totalTables?: number;
    totalColumns?: number;
    estimatedSize?: number;
  };
  
  // Performance metrics
  performance?: {
    connectionTime?: number;
    queryTime?: number;
    throughput?: number;
    latency?: number;
  };
  
  errors?: ErrorDetail[];
  warnings?: WarningDetail[];
  metadata?: Record<string, any>;
}

export interface TestStep {
  name: string;
  status: 'passed' | 'failed' | 'skipped' | 'warning';
  message: string;
  durationMs: number;
  details?: Record<string, any>;
  error?: string;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: Record<string, any>;
  remediation?: string;
}

export interface WarningDetail {
  code: string;
  message: string;
  details?: Record<string, any>;
  impact?: 'low' | 'medium' | 'high';
}

// Enhanced sync operations
export interface SyncRequest {
  dataSourceId: string;
  scope?: {
    databases?: string[];
    schemas?: string[];
    tables?: string[];
    includeSystemObjects?: boolean;
    includeViews?: boolean;
    includeFunctions?: boolean;
    includeProcedures?: boolean;
    includeColumns?: boolean;
    includeIndexes?: boolean;
    includeConstraints?: boolean;
    includeStatistics?: boolean;
  };
  options?: {
    fullSync?: boolean; // vs incremental
    parallelism?: number;
    batchSize?: number;
    timeout?: number;
    skipErrors?: boolean;
    dryRun?: boolean;
  };
}

export interface SyncResult {
  id: string;
  dataSourceId: string;
  status: SyncStatus;
  type: 'full' | 'incremental' | 'selective';
  
  // Timing
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  nextScheduledAt?: string;
  
  // Progress
  progress: {
    percentage: number;
    currentStep: string;
    processedAssets: number;
    totalAssets: number;
    estimatedTimeRemaining?: number;
  };
  
  // Results summary
  summary: {
    assetsScanned: number;
    assetsCreated: number;
    assetsUpdated: number;
    assetsDeleted: number;
    columnsCreated: number;
    columnsUpdated: number;
    errorsCount: number;
    warningsCount: number;
  };
  
  // Detailed results
  results: {
    databases?: SyncAssetResult[];
    schemas?: SyncAssetResult[];
    tables?: SyncAssetResult[];
    columns?: SyncAssetResult[];
  };
  
  // Performance metrics
  performance: {
    avgProcessingTime: number;
    throughput: number; // assets per second
    peakMemoryUsage: number;
    networkIO: number;
  };
  
  errors?: ErrorDetail[];
  warnings?: WarningDetail[];
  metadata?: Record<string, any>;
}

export interface SyncAssetResult {
  name: string;
  type: string;
  action: 'created' | 'updated' | 'deleted' | 'skipped' | 'error';
  reason?: string;
  before?: Record<string, any>;
  after?: Record<string, any>;
  error?: string;
}

// Analytics and metrics
export interface DataSourceMetrics {
  // Overview
  totalConnections: number;
  activeConnections: number;
  healthyConnections: number;
  
  // Distribution
  connectionsByType: Record<DataSourceType, number>;
  connectionsByStatus: Record<DataSourceStatus, number>;
  connectionsByEnvironment: Record<string, number>;
  connectionsByHealth: Record<HealthStatus, number>;
  connectionsByOwner: Record<string, number>;
  
  // Usage analytics
  totalQueries: number;
  avgQueriesPerConnection: number;
  topConnectionsByUsage: Array<{
    id: string;
    name: string;
    type: DataSourceType;
    queryCount: number;
    uniqueUsers: number;
    lastUsed: string;
  }>;
  
  // Performance
  avgResponseTime: number;
  uptimePercentage: number;
  errorRate: number;
  
  // Growth trends
  recentActivity: Array<{
    date: string;
    connections: number;
    queries: number;
    newConnections: number;
    errors: number;
  }>;
  
  // Asset statistics
  totalDatabases: number;
  totalTables: number;
  totalColumns: number;
  totalDataVolume: number;
  
  // Cost analytics
  totalMonthlyCost: number;
  avgCostPerConnection: number;
  costByType: Record<DataSourceType, number>;
  costTrend: Array<{
    month: string;
    cost: number;
  }>;
  
  // Governance metrics
  connectionsWithOwner: number;
  complianceScore: number;
  dataClassificationCoverage: number;
  
  // Quality metrics
  connectionsWithErrors: number;
  outdatedConnections: number; // not synced recently
  unusedConnections: number; // not accessed recently
}

// Asset management (enhanced from original)
export interface Asset {
  id: string;
  name: string;
  fullyQualifiedName: string; // database.schema.table
  type: 'database' | 'schema' | 'table' | 'view' | 'materialized_view' | 'function' | 'procedure' | 'index' | 'constraint';
  dataSourceId: string;
  
  // Hierarchy
  database?: string;
  schema?: string;
  parentId?: string;
  
  // Basic info
  description?: string;
  owner?: string;
  created?: string;
  lastModified?: string;
  
  // Physical properties
  rowCount?: number;
  size?: number;
  sizeFormatted?: string;
  
  // Structure
  columns: Column[];
  indexes?: IndexInfo[];
  constraints?: ConstraintInfo[];
  partitions?: PartitionInfo[];
  
  // Organization
  tags: string[];
  labels?: Record<string, string>;
  
  // Status and quality
  status: 'active' | 'inactive' | 'deprecated' | 'archived';
  quality?: {
    score: number;
    checks: DataQualityCheck[];
    lastAssessment: string;
  };
  
  // Usage analytics
  usage?: {
    queryCount: number;
    uniqueUsers: number;
    lastAccessed: string;
    topQueries?: string[];
    popularColumns?: string[];
  };
  
  // Data governance
  governance?: {
    classification: 'public' | 'internal' | 'confidential' | 'restricted';
    sensitivity: 'low' | 'medium' | 'high';
    retention: string;
    owner: string;
    steward: string;
    certifiedBy?: string;
    certificationDate?: string;
  };
  
  // Lineage
  upstream?: string[]; // Asset IDs this depends on
  downstream?: string[]; // Asset IDs that depend on this
  
  // Metadata
  metadata: Record<string, any>;
  customFields?: Record<string, any>;
  
  // Audit trail
  createdAt: string;
  updatedAt: string;
  discoveredAt: string;
  lastSyncAt: string;
}

export interface Column {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: any;
  maxLength?: number;
  precision?: number;
  scale?: number;
  position: number;
  
  // Constraints
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  isUnique?: boolean;
  isIndexed?: boolean;
  
  // References
  referencedTable?: string;
  referencedColumn?: string;
  
  // Description and tags
  description?: string;
  tags?: string[];
  
  // Data profiling
  profile?: {
    distinctCount: number;
    nullCount: number;
    nullPercentage: number;
    minValue?: any;
    maxValue?: any;
    avgValue?: any;
    minLength?: number;
    maxLength?: number;
    avgLength?: number;
    topValues?: Array<{ value: any; count: number }>;
    histogram?: Array<{ bin: string; count: number }>;
  };
  
  // Data classification
  classification?: {
    type: 'pii' | 'sensitive' | 'financial' | 'health' | 'personal' | 'public';
    confidence: number;
    patterns?: string[];
  };
  
  // Quality checks
  qualityRules?: DataQualityRule[];
  
  metadata?: Record<string, any>;
}

export interface DataQualityRule {
  id: string;
  name: string;
  type: 'not_null' | 'unique' | 'range' | 'pattern' | 'custom' | 'referential_integrity' | 'freshness' | 'completeness';
  description?: string;
  
  // Rule configuration
  configuration: {
    threshold?: number;
    pattern?: string;
    minValue?: any;
    maxValue?: any;
    expression?: string;
    referencedTable?: string;
    referencedColumn?: string;
  };
  
  // Execution
  status: 'active' | 'inactive' | 'draft';
  severity: 'low' | 'medium' | 'high' | 'critical';
  
  // Results
  lastRun?: {
    executedAt: string;
    passed: boolean;
    score: number;
    message: string;
    details: Record<string, any>;
    failedRows?: number;
    totalRows?: number;
  };
  
  // Schedule
  schedule?: string; // cron expression
  nextRun?: string;
  
  // Ownership
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DataQualityCheck {
  ruleId: string;
  name: string;
  type: string;
  passed: boolean;
  score: number;
  message: string;
  executedAt: string;
  details?: Record<string, any>;
}

// Lineage and relationships
export interface AssetLineage {
  assetId: string;
  upstream: LineageNode[];
  downstream: LineageNode[];
  relationships: LineageRelationship[];
  depth: number;
  lastUpdated: string;
}

export interface LineageNode {
  id: string;
  name: string;
  type: Asset['type'];
  dataSourceId: string;
  dataSourceName: string;
  level: number;
  metadata?: Record<string, any>;
}

export interface LineageRelationship {
  id: string;
  fromAssetId: string;
  toAssetId: string;
  type: 'table_to_table' | 'column_to_column' | 'view_dependency' | 'etl_process' | 'api_call';
  description?: string;
  confidence: number;
  discoveredAt: string;
  metadata?: Record<string, any>;
}

// Events and webhooks
export interface DataSourceEvent {
  id: string;
  type: 'created' | 'updated' | 'deleted' | 'tested' | 'synced' | 'health_changed' | 'error_occurred' | 'access_granted' | 'access_revoked';
  dataSourceId: string;
  dataSourceName: string;
  timestamp: string;
  userId?: string;
  userEmail?: string;
  
  // Event data
  data?: {
    before?: Partial<DataSource>;
    after?: Partial<DataSource>;
    changes?: string[];
    error?: ErrorDetail;
    testResult?: ConnectionTestResult;
    syncResult?: SyncResult;
  };
  
  // Context
  source: 'web_ui' | 'api' | 'scheduled_job' | 'system';
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  
  metadata?: Record<string, any>;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: DataSourceEvent['type'][];
  
  // Security
  secret?: string;
  headers?: Record<string, string>;
  
  // Configuration
  active: boolean;
  retryAttempts: number;
  timeout: number;
  
  // Filtering
  filters?: {
    dataSourceIds?: string[];
    dataSourceTypes?: DataSourceType[];
    environments?: string[];
    tags?: string[];
  };
  
  // Status
  lastTriggered?: string;
  lastSuccess?: string;
  lastError?: string;
  successCount: number;
  errorCount: number;
  
  // Audit
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Bulk operations
export interface BulkOperation {
  id: string;
  type: 'test_connections' | 'sync_datasources' | 'update_tags' | 'update_owners' | 'delete_datasources';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  
  // Target datasources
  dataSourceIds: string[];
  filters?: DataSourceFilters;
  
  // Operation details
  payload?: Record<string, any>;
  options?: {
    continueOnError?: boolean;
    parallelism?: number;
    batchSize?: number;
  };
  
  // Progress
  progress: {
    total: number;
    completed: number;
    failed: number;
    percentage: number;
  };
  
  // Results
  results?: BulkOperationResult[];
  
  // Timing
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  
  // Audit
  createdBy: string;
  createdAt: string;
}

export interface BulkOperationResult {
  dataSourceId: string;
  status: 'success' | 'failed' | 'skipped';
  message?: string;
  error?: string;
  data?: Record<string, any>;
}

// Export utilities
export interface DataExportRequest {
  format: 'json' | 'csv' | 'xlsx' | 'yaml';
  scope: {
    dataSourceIds?: string[];
    filters?: DataSourceFilters;
    includeAssets?: boolean;
    includeLineage?: boolean;
    includeMetrics?: boolean;
  };
  options?: {
    compress?: boolean;
    includeSchema?: boolean;
    dateFormat?: string;
  };
}

export interface DataExportResult {
  id: string;
  format: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
  expiresAt?: string;
  sizeBytes?: number;
  recordCount?: number;
  createdAt: string;
  completedAt?: string;
  error?: string;
}

// Type utility functions
export const DATA_SOURCE_TYPE_LABELS: Record<DataSourceType, string> = {
  // Relational Databases
  postgresql: 'PostgreSQL',
  mysql: 'MySQL',
  mssql: 'Microsoft SQL Server',
  oracle: 'Oracle Database',
  sqlite: 'SQLite',
  mariadb: 'MariaDB',
  
  // NoSQL Databases
  mongodb: 'MongoDB',
  redis: 'Redis',
  cassandra: 'Apache Cassandra',
  couchdb: 'Apache CouchDB',
  dynamodb: 'Amazon DynamoDB',
  neo4j: 'Neo4j',
  
  // Cloud Data Warehouses
  snowflake: 'Snowflake',
  bigquery: 'Google BigQuery',
  redshift: 'Amazon Redshift',
  databricks: 'Databricks',
  synapse: 'Azure Synapse',
  clickhouse: 'ClickHouse',
  
  // Cloud Storage
  s3: 'Amazon S3',
  'azure-blob': 'Azure Blob Storage',
  gcs: 'Google Cloud Storage',
  hdfs: 'Hadoop HDFS',
  minio: 'MinIO',
  
  // Streaming & Messaging
  kafka: 'Apache Kafka',
  kinesis: 'Amazon Kinesis',
  pubsub: 'Google Pub/Sub',
  eventhub: 'Azure Event Hubs',
  pulsar: 'Apache Pulsar',
  rabbitmq: 'RabbitMQ',
  
  // Search & Analytics
  elasticsearch: 'Elasticsearch',
  opensearch: 'OpenSearch',
  solr: 'Apache Solr',
  splunk: 'Splunk',
  
  // Time Series
  influxdb: 'InfluxDB',
  prometheus: 'Prometheus',
  timescaledb: 'TimescaleDB',
  
  // APIs & Web Services
  api: 'REST API',
  graphql: 'GraphQL API',
  soap: 'SOAP API',
  webhook: 'Webhook',
  
  // File Systems
  file: 'File System',
  ftp: 'FTP/SFTP',
  sftp: 'SFTP',
  
  // Business Applications
  salesforce: 'Salesforce',
  hubspot: 'HubSpot',
  zendesk: 'Zendesk',
  jira: 'Atlassian Jira',
  confluence: 'Atlassian Confluence',
  sharepoint: 'Microsoft SharePoint',
  github: 'GitHub',
  gitlab: 'GitLab',
  slack: 'Slack',
  teams: 'Microsoft Teams',
};

export const DATA_SOURCE_CATEGORIES: Record<string, DataSourceType[]> = {
  'Relational Databases': ['postgresql', 'mysql', 'mssql', 'oracle', 'sqlite', 'mariadb'],
  'NoSQL Databases': ['mongodb', 'redis', 'cassandra', 'couchdb', 'dynamodb', 'neo4j'],
  'Cloud Warehouses': ['snowflake', 'bigquery', 'redshift', 'databricks', 'synapse', 'clickhouse'],
  'Cloud Storage': ['s3', 'azure-blob', 'gcs', 'hdfs', 'minio'],
  'Streaming & Messaging': ['kafka', 'kinesis', 'pubsub', 'eventhub', 'pulsar', 'rabbitmq'],
  'Search & Analytics': ['elasticsearch', 'opensearch', 'solr', 'splunk'],
  'Time Series': ['influxdb', 'prometheus', 'timescaledb'],
  'APIs & Web Services': ['api', 'graphql', 'soap', 'webhook'],
  'File Systems': ['file', 'ftp', 'sftp'],
  'Business Applications': ['salesforce', 'hubspot', 'zendesk', 'jira', 'confluence', 'sharepoint', 'github', 'gitlab', 'slack', 'teams'],
};

// Helper functions for working with configurations
export function getDefaultPort(type: DataSourceType): number | undefined {
  const defaultPorts: Partial<Record<DataSourceType, number>> = {
    postgresql: 5432,
    mysql: 3306,
    mssql: 1433,
    oracle: 1521,
    mongodb: 27017,
    redis: 6379,
    elasticsearch: 9200,
    influxdb: 8086,
    ftp: 21,
    sftp: 22,
  };
  return defaultPorts[type];
}

export function getRequiredFields(type: DataSourceType): string[] {
  const requiredFields: Record<DataSourceType, string[]> = {
    postgresql: ['host', 'database', 'username', 'password'],
    mysql: ['host', 'database', 'username', 'password'],
    mssql: ['host', 'username', 'password'],
    oracle: ['host', 'serviceName', 'username', 'password'],
    mongodb: ['host', 'database'],
    redis: ['host'],
    snowflake: ['account', 'warehouse', 'username', 'password'],
    bigquery: ['projectId', 'serviceAccountKey'],
    s3: ['bucket', 'region'],
    'azure-blob': ['accountName', 'containerName'],
    gcs: ['bucketName', 'projectId'],
    kafka: ['brokers'],
    api: ['baseUrl'],
    file: ['path', 'format'],
    ftp: ['host', 'username', 'password', 'protocol'],
    // Add other types as needed
  } as any;
  
  return requiredFields[type] || ['host'];
}

export function supportsSSL(type: DataSourceType): boolean {
  const sslSupported: DataSourceType[] = [
    'postgresql', 'mysql', 'mssql', 'oracle', 'mongodb', 'redis',
    'snowflake', 'redshift', 'elasticsearch', 'kafka', 'api', 'ftp'
  ];
  return sslSupported.includes(type);
}

export function isCloudService(type: DataSourceType): boolean {
  const cloudServices: DataSourceType[] = [
    'snowflake', 'bigquery', 'redshift', 'databricks', 'synapse',
    's3', 'azure-blob', 'gcs', 'kinesis', 'pubsub', 'eventhub',
    'salesforce', 'hubspot', 'zendesk', 'slack', 'teams'
  ];
  return cloudServices.includes(type);
}