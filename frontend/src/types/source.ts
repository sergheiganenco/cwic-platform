export type DataSourceType =
  | 'postgresql' | 'mysql' | 'mssql' | 'oracle' | 'mongodb' | 'redis'
  | 's3' | 'azure-blob' | 'gcs' | 'snowflake' | 'bigquery' | 'redshift'
  | 'databricks' | 'api' | 'file' | 'kafka' | 'elasticsearch';

export type DataSourceStatus =
  | 'pending' | 'connected' | 'disconnected' | 'error' | 'warning' | 'syncing' | 'testing';

export interface ConnectionConfig {
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  schema?: string;
  ssl?: boolean;
  connectionString?: string;

  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  serviceAccountKey?: string;

  baseUrl?: string;
  apiKey?: string;
  headers?: Record<string, string>;
  authentication?: { type: 'basic' | 'bearer' | 'oauth2' | 'api-key'; credentials: Record<string, string> };

  path?: string;
  format?: 'csv' | 'json' | 'parquet' | 'avro' | 'xml';

  brokers?: string[];
  topics?: string[];
  consumerGroup?: string;

  timeout?: number;
  maxConnections?: number;
  retryAttempts?: number;
  customOptions?: Record<string, any>;
}

export interface DataSource {
  id: string;
  name: string;
  description?: string;
  type: DataSourceType;
  status: DataSourceStatus;
  connectionConfig: ConnectionConfig;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: string | Date;
  updatedAt: string | Date;
  createdBy: string;
  updatedBy?: string;
  deletedAt?: string | Date;
  lastTestAt?: string | Date;
  lastSyncAt?: string | Date;
  lastError?: string;
  responseTime?: number;
  availability?: number;
}
