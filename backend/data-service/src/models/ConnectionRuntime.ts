// backend/data-service/src/models/ConnectionRuntime.ts

export interface ConnectionPool {
  id: string;
  dataSourceId: string;
  poolSize: number;
  activeConnections: number;
  idleConnections: number;
  waitingConnections: number;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface ConnectionMetrics {
  dataSourceId: string;
  totalConnections: number;
  successfulConnections: number;
  failedConnections: number;
  averageResponseTime: number;
  lastConnectionAt?: Date;
  lastFailureAt?: Date;
  lastErrorMessage?: string;
  uptime: number;       // percentage
  availability: number; // percentage
}

export interface ConnectionHistory {
  id: string;
  dataSourceId: string;
  connectionStatus: 'success' | 'failed' | 'timeout' | 'refused';
  responseTime?: number; // ms
  errorCode?: string;
  errorMessage?: string;
  connectionDetails?: {
    host?: string;
    port?: number;
    database?: string;
    serverVersion?: string;
    serverInfo?: Record<string, any>;
  };
  testedAt: Date;
  testedBy?: string;
  testType: 'manual' | 'scheduled' | 'health_check' | 'startup';
}

export interface ConnectionCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  secretKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  certificate?: string;
  privateKey?: string;
  passphrase?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  serviceAccountKey?: string;
  authMethod?: 'basic' | 'bearer' | 'oauth2' | 'certificate' | 'api-key' | 'iam';
  authUrl?: string;
  tokenUrl?: string;
  scope?: string[];
}

export interface RuntimeConnectionSecurity {
  ssl: boolean;
  sslMode?: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  sslCert?: string;
  sslKey?: string;
  sslRootCert?: string;
  verifyCertificate: boolean;
  allowSelfSigned: boolean;
  encryption?: 'none' | 'tls' | 'ssl';
  tlsVersion?: string;
}

export interface RuntimeConnectionOptions {
  connectionTimeout: number; // ms
  queryTimeout: number;      // ms
  idleTimeout: number;       // ms
  minConnections: number;
  maxConnections: number;
  acquireTimeout: number;    // ms
  retryAttempts: number;
  retryDelay: number;        // ms
  exponentialBackoff: boolean;
  keepAlive: boolean;
  keepAliveInterval?: number; // ms
  charset?: string;
  timezone?: string;
  applicationName?: string;
  customOptions: Record<string, any>;
}

export interface ConnectionTest {
  id: string;
  dataSourceId: string;
  testType: 'basic' | 'advanced' | 'schema' | 'performance';
  status: 'pending' | 'running' | 'completed' | 'failed';
  testQueries?: string[];
  expectedResults?: any[];
  performanceThresholds?: {
    maxResponseTime: number;
    minThroughput: number;
  };
  results?: {
    connectionSuccessful: boolean;
    responseTime: number;
    queryResults?: any[];
    performanceMetrics?: {
      throughput: number;
      latency: number;
      errorRate: number;
    };
    schemaInfo?: {
      databases?: string[];
      tables?: string[];
      columns?: string[];
    };
  };
  startedAt: Date;
  completedAt?: Date;
  duration?: number; // ms
  errorMessage?: string;
  testedBy: string;
}

export interface ConnectionFactory {
  createConnection(dataSourceId: string): Promise<any>;
  testConnection(dataSourceId: string): Promise<ConnectionTest>;
  closeConnection(dataSourceId: string): Promise<void>;
  getConnectionMetrics(dataSourceId: string): Promise<ConnectionMetrics>;
}

export const defaultConnectionOptions: RuntimeConnectionOptions = {
  connectionTimeout: 30000,
  queryTimeout: 60000,
  idleTimeout: 300000,
  minConnections: 1,
  maxConnections: 10,
  acquireTimeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  keepAlive: true,
  keepAliveInterval: 30000,
  customOptions: {},
};

// helper (only for telemetry layer — separate from canonical config)
export function getDefaultPort(type: string): number {
  const ports: Record<string, number> = {
    postgresql: 5432,
    mysql: 3306,
    mssql: 1433,
    oracle: 1521,
    mongodb: 27017,
    redis: 6379,
    elasticsearch: 9200,
    cassandra: 9042,
    clickhouse: 8123,
  };
  return ports[type] || 0;
}
