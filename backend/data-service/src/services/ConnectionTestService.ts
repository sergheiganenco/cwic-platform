import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3';
import axios, { AxiosError } from 'axios';
import { MongoClient } from 'mongodb';
import { createConnection as createMySQLConnection } from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { createClient as createRedisClient } from 'redis';

import {
  ConnectionTestResult,
  DataSource,
  isAPIConfig,
  isBigQueryConfig,
  isS3Config,
  isSnowflakeConfig,
  type APIConfig,
  type BigQueryConfig,
  type S3Config,
  type SnowflakeConfig,
} from '../models/DataSource';
import { logger } from '../utils/logger';

const toStr = (v: string | number | undefined): string | undefined =>
  v == null ? undefined : String(v);

export class ConnectionTestService {
  async testConnection(dataSource: DataSource): Promise<ConnectionTestResult> {
    const startTime = Date.now();
    try {
      logger.info(`Testing connection for data source: ${dataSource.name} (${dataSource.type})`);
      let result: ConnectionTestResult;

      switch (dataSource.type) {
        case 'postgresql':
          result = await this.testPostgreSQL(dataSource); break;
        case 'mysql':
          result = await this.testMySQL(dataSource); break;
        case 'mssql':
          result = await this.testSQLServer(dataSource); break;
        case 'mongodb':
          result = await this.testMongoDB(dataSource); break;
        case 'redis':
          result = await this.testRedis(dataSource); break;
        case 's3':
          result = await this.testS3(dataSource); break;
        case 'api':
          result = await this.testAPI(dataSource); break;
        case 'snowflake':
          result = await this.testSnowflake(dataSource); break;
        case 'bigquery':
          result = await this.testBigQuery(dataSource); break;
        case 'elasticsearch':
          result = await this.testElasticsearch(dataSource); break;
        default:
          result = await this.testGeneric(dataSource);
      }

      result.responseTime = Date.now() - startTime;
      result.testedAt = new Date();
      logger.info(
        `Connection test completed for ${dataSource.name}: ${result.success ? 'SUCCESS' : 'FAILED'} (${result.responseTime}ms)`
      );
      return result;
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime;
      logger.error(`Connection test failed for ${dataSource.name}:`, error);
      return {
        success: false,
        responseTime,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        testedAt: new Date(),
      };
    }
  }

  /* ───────── PostgreSQL ───────── */
  private async testPostgreSQL(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    let client: PgClient;

    if (c.connectionString) {
      client = new PgClient({ connectionString: c.connectionString });
    } else {
      const ssl =
        c.ssl === true ? { rejectUnauthorized: false }
        : typeof c.ssl === 'object' ? (c.ssl as object)
        : false;

      client = new PgClient({
        host: c.host,
        port: c.port || 5432,
        database: toStr(c.database),
        user: c.username,
        password: c.password,
        ssl,
        connectionTimeoutMillis: c.timeout || 30_000,
      });
    }

    try {
      await client.connect();
      const result = await client.query('SELECT version()');
      const version = result.rows?.[0]?.version as string | undefined;
      return {
        success: true,
        details: {
          version,
          serverInfo: { type: 'PostgreSQL' },
          capabilities: ['SQL', 'ACID', 'Indexing'],
        },
        testedAt: new Date(),
      };
    } finally {
      await client.end().catch(() => {});
    }
  }

  /* ───────── MySQL ───────── */
  private async testMySQL(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    const cfg: any = {
      host: c.host,
      port: c.port || 3306,
      database: toStr(c.database),
      user: c.username,
      password: c.password,
      connectTimeout: c.timeout || 30_000,
      acquireTimeout: c.timeout || 30_000,
    };

    if (c.ssl === true) cfg.ssl = { rejectUnauthorized: false };
    else if (typeof c.ssl === 'object') cfg.ssl = c.ssl;

    const conn = await createMySQLConnection(cfg);
    try {
      const [rows] = await conn.execute('SELECT VERSION() as version');
      const version = (rows as any)?.[0]?.version as string | undefined;
      return {
        success: true,
        details: {
          version,
          serverInfo: { type: 'MySQL' },
          capabilities: ['SQL', 'ACID', 'Replication'],
        },
        testedAt: new Date(),
      };
    } finally {
      await conn.end().catch(() => {});
    }
  }

  /* ───────── SQL Server (mock) ───────── */
  private async testSQLServer(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!c.host || !c.username || !c.password) {
          reject(new Error('Missing required connection parameters'));
          return;
        }
        resolve({
          success: true,
          details: {
            version: 'SQL Server 2019',
            serverInfo: { type: 'SQL Server', host: c.host, port: c.port || 1433 },
            capabilities: ['SQL', 'ACID', 'Clustering'],
          },
          testedAt: new Date(),
        });
      }, 100);
    });
  }

  /* ───────── MongoDB ───────── */
  private async testMongoDB(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    const auth = c.username ? `${c.username}:${c.password}@` : '';
    const port = c.port || 27017;
    const database = c.database ? `/${toStr(c.database)}` : '';
    const uri = c.connectionString || `mongodb://${auth}${c.host}:${port}${database}`;

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: c.timeout || 30_000 });
    try {
      await client.connect();
      const serverStatus = await client.db().admin().serverStatus();
      return {
        success: true,
        details: {
          version: (serverStatus as any).version,
          serverInfo: { type: 'MongoDB', host: (serverStatus as any).host, uptime: (serverStatus as any).uptime },
          capabilities: ['Document Store', 'Indexing', 'Aggregation'],
        },
        testedAt: new Date(),
      };
    } finally {
      await client.close().catch(() => {});
    }
  }

  /* ───────── Redis ───────── */
  private async testRedis(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    const client = createRedisClient({
      socket: { host: c.host, port: c.port || 6379, connectTimeout: c.timeout || 30_000 },
      password: c.password,
    });

    try {
      await client.connect();
      const info = await client.info();
      const version = info.match(/redis_version:([^\r\n]+)/)?.[1];
      return {
        success: true,
        details: {
          version,
          serverInfo: { type: 'Redis' },
          capabilities: ['Key-Value Store', 'Pub/Sub', 'Streams'],
        },
        testedAt: new Date(),
      };
    } finally {
      await client.disconnect().catch(() => {});
    }
  }

  /* ───────── S3 ───────── */
  private async testS3(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    if (!isS3Config(c)) throw new Error('Invalid S3 configuration');

    const s3 = c as S3Config;
    if (!s3.accessKeyId || !s3.secretAccessKey) {
      throw new Error('S3 credentials (accessKeyId and secretAccessKey) are required');
    }

    const s3Client = new S3Client({
      region: s3.region || 'us-east-1',
      credentials: { accessKeyId: s3.accessKeyId, secretAccessKey: s3.secretAccessKey },
    });

    const response = await s3Client.send(new ListBucketsCommand({}));
    const bucketExists = s3.bucket ? !!response.Buckets?.some(b => b.Name === s3.bucket) : true;

    return {
      success: true,
      details: {
        serverInfo: { type: 'Amazon S3', region: s3.region, bucketCount: response.Buckets?.length || 0, bucketExists },
        capabilities: ['Object Storage', 'Versioning', 'Lifecycle Management'],
      },
      testedAt: new Date(),
    };
  }

  /* ───────── HTTP API ───────── */
  private async testAPI(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    if (!isAPIConfig(c)) throw new Error('Invalid API configuration');

    const api = c as APIConfig;
    if (!api.baseUrl) throw new Error('Base URL is required for API connections');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CWIC-Data-Service/1.0',
      ...(api.headers || {}),
    };

    if (api.apiKey) headers['Authorization'] = `Bearer ${api.apiKey}`;

    if (api.authentication) {
      const creds = api.authentication.credentials || {};
      switch (api.authentication.type) {
        case 'basic':
          if (creds.username && creds.password) {
            headers['Authorization'] = `Basic ${Buffer.from(`${creds.username}:${creds.password}`).toString('base64')}`;
          }
          break;
        case 'bearer':
          if (creds.token) headers['Authorization'] = `Bearer ${creds.token}`;
          break;
        case 'api-key':
          if (creds.apiKey) headers[creds.headerName || 'X-API-Key'] = creds.apiKey;
          break;
      }
    }

    try {
      const response = await axios.get(api.baseUrl, {
        headers,
        timeout: api.timeout || 30_000,
        validateStatus: s => s < 500,
      });

      return {
        success: true,
        details: {
          serverInfo: {
            type: 'REST API',
            statusCode: response.status,
            statusText: response.statusText,
            contentType: response.headers['content-type'],
          },
          capabilities: ['HTTP REST', 'JSON', 'Authentication'],
        },
        testedAt: new Date(),
      };
    } catch (err) {
      const error = err as AxiosError;
      if (error.response) {
        const ok = error.response.status < 500;
        return {
          success: ok,
          details: {
            serverInfo: {
              type: 'REST API',
              statusCode: error.response.status,
              statusText: error.response.statusText,
              errorMessage: error.message,
            },
            capabilities: ['HTTP REST'],
          },
          error: !ok ? `Server error: ${error.response.status} ${error.response.statusText}` : undefined,
          testedAt: new Date(),
        };
      }
      if (error.request) throw new Error(`Network error: ${error.message}`);
      throw error;
    }
  }

  /* ───────── Snowflake (mock) ───────── */
  private async testSnowflake(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    if (!isSnowflakeConfig(c)) throw new Error('Invalid Snowflake configuration');
    const sf = c as SnowflakeConfig;

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!sf.host || !sf.username || !sf.password) {
          reject(new Error('Missing required Snowflake connection parameters (host, username, password)'));
          return;
        }
        resolve({
          success: true,
          details: {
            version: 'Snowflake 6.0',
            serverInfo: { type: 'Snowflake', account: sf.host, warehouse: sf.warehouse },
            capabilities: ['SQL', 'Data Warehouse', 'Auto-scaling'],
          },
          testedAt: new Date(),
        });
      }, 200);
    });
  }

  /* ───────── BigQuery (mock) ───────── */
  private async testBigQuery(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    if (!isBigQueryConfig(c)) throw new Error('Invalid BigQuery configuration');
    const bq = c as BigQueryConfig;

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!bq.projectId || !bq.serviceAccountKey) {
          reject(new Error('Missing required BigQuery connection parameters (projectId, serviceAccountKey)'));
          return;
        }
        resolve({
          success: true,
          details: {
            version: 'BigQuery API v2',
            serverInfo: { type: 'Google BigQuery', projectId: bq.projectId, location: bq.location || 'US' },
            capabilities: ['SQL', 'Analytics', 'Machine Learning'],
          },
          testedAt: new Date(),
        });
      }, 150);
    });
  }

  /* ───────── Elasticsearch ───────── */
  private async testElasticsearch(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig;
    if (!c.host) throw new Error('Host is required for Elasticsearch connections');

    const protocol = c.ssl ? 'https' : 'http';
    const port = c.port || 9200;
    const baseUrl = `${protocol}://${c.host}:${port}`;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (c.username && c.password) {
      headers['Authorization'] = `Basic ${Buffer.from(`${c.username}:${c.password}`).toString('base64')}`;
    }

    const health = await axios.get(`${baseUrl}/_cluster/health`, { headers, timeout: c.timeout || 30_000 });
    const root = await axios.get(`${baseUrl}/`, { headers, timeout: c.timeout || 30_000 });

    return {
      success: true,
      details: {
        version: (root.data as any)?.version?.number,
        serverInfo: {
          type: 'Elasticsearch',
          clusterName: health.data.cluster_name,
          status: health.data.status,
          numberOfNodes: health.data.number_of_nodes,
        },
        capabilities: ['Full-text Search', 'Analytics', 'Aggregations'],
      },
      testedAt: new Date(),
    };
  }

  /* ───────── Generic fallback ───────── */
  private async testGeneric(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any;
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!c.host && !c.baseUrl && !c.connectionString) {
          reject(new Error('At least one of host, baseUrl, or connectionString is required'));
          return;
        }
        resolve({
          success: true,
          details: {
            serverInfo: { type: ds.type, host: c.host, port: c.port },
            capabilities: ['Generic Connection'],
          },
          testedAt: new Date(),
        });
      }, 100);
    });
  }

  /* ───────── Utilities ───────── */
  public async testMultipleConnections(dataSources: DataSource[]): Promise<ConnectionTestResult[]> {
    const promises = dataSources.map(ds =>
      this.testConnection(ds).catch(err => {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, error: msg, responseTime: 0, testedAt: new Date() } as ConnectionTestResult;
      })
    );
    return Promise.all(promises);
  }

  public getSupportedTypes(): string[] {
    return [
      'postgresql','mysql','mssql','mongodb','redis','s3','api','file',
      'snowflake','bigquery','elasticsearch','oracle','azure-blob','gcs',
      'redshift','databricks','kafka',
    ];
  }
}
