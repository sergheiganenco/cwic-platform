import { ListBucketsCommand, S3Client } from '@aws-sdk/client-s3'
import axios, { AxiosError } from 'axios'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { MongoClient } from 'mongodb'
import {
  createConnection as createMySQLConnection,
  type ConnectionOptions,
} from 'mysql2/promise'
import { Client as PgClient } from 'pg'
import { createClient as createRedisClient } from 'redis'

import {
  ConnectionTestResult,
  DataSource,
  DataSourceType,
  isAPIConfig,
  isBigQueryConfig,
  isS3Config,
  isSnowflakeConfig,
  type APIConfig,
  type BigQueryConfig,
  type S3Config,
  type SnowflakeConfig,
} from '../models/DataSource'
import { logger } from '../utils/logger'

const toStr = (v: string | number | undefined): string | undefined =>
  v == null ? undefined : String(v)

const normalizeType = (t?: string): DataSourceType | undefined => {
  if (!t) return undefined
  const x = String(t).toLowerCase()
  if (x === 'postgres') return 'postgresql'
  if (['azure_sql', 'azure-sql', 'sqlserver', 'sql-server'].includes(x))
    return 'mssql' as DataSourceType
  return x as DataSourceType
}

const outboundHostAllowlist = new Set(
  (process.env.OUTBOUND_HOST_ALLOWLIST || '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean),
)

const blockedHostnames = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
  '0.0.0.0',
  'metadata.google.internal',
  'metadata.google.internal.',
])

const blockedIpAddresses = new Set([
  '0.0.0.0',
  '127.0.0.1',
  '169.254.169.254',
  '::',
  '::1',
  '::ffff:127.0.0.1',
  '::ffff:169.254.169.254',
])

export class ConnectionTestService {
  /* =========================================================================
     Public helpers used by the controller
  ========================================================================= */

  /** Test a raw (type, config) before persisting a record */
  async testRawConfig(type: string, config: any): Promise<ConnectionTestResult> {
    const ds: DataSource = {
      id: 'temp',
      name: 'temp',
      description: null as any,
      type: (normalizeType(type) ?? (type as DataSourceType)) as DataSourceType,
      status: 'pending' as any,
      connectionConfig: config,
      tags: [],
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
      lastTestAt: null as any,
      lastSyncAt: null as any,
    } as unknown as DataSource

    return this.testConnection(ds)
  }

  /** Try to enumerate databases using only provided type + config */
  async discoverDatabasesFromConfig(
    type: string,
    config: Record<string, any>,
  ): Promise<Array<{ name: string }>> {
    const t = normalizeType(type) ?? (type as DataSourceType)

    switch (t) {
      case 'postgresql':
        return this.pgListDatabases(config)
      case 'mysql':
        return this.mysqlListDatabases(config)
      case 'mssql':
        return this.mssqlListDatabases(config)
      case 'mongodb':
        return this.mongoListDatabases(config)
      default:
        return []
    }
  }

  /* =========================================================================
     Core “test connection” entry + per-connector tests
  ========================================================================= */

  async testConnection(dataSource: DataSource): Promise<ConnectionTestResult> {
    const startTime = Date.now()
    try {
      logger.info(
        `Testing connection for data source: ${dataSource.name} (${dataSource.type})`,
      )
      let result: ConnectionTestResult

      switch (dataSource.type) {
        case 'postgresql':
          result = await this.testPostgreSQL(dataSource)
          break
        case 'mysql':
          result = await this.testMySQL(dataSource)
          break
        case 'mssql':
          result = await this.testSQLServer(dataSource)
          break
        case 'mongodb':
          result = await this.testMongoDB(dataSource)
          break
        case 'redis':
          result = await this.testRedis(dataSource)
          break
        case 's3':
          result = await this.testS3(dataSource)
          break
        case 'api':
          result = await this.testAPI(dataSource)
          break
        case 'snowflake':
          result = await this.testSnowflake(dataSource)
          break
        case 'bigquery':
          result = await this.testBigQuery(dataSource)
          break
        case 'elasticsearch':
          result = await this.testElasticsearch(dataSource)
          break
        default:
          result = await this.testGeneric(dataSource)
      }

      result.responseTime = Date.now() - startTime
      result.testedAt = new Date()
      logger.info(
        `Connection test completed for ${dataSource.name}: ${
          result.success ? 'SUCCESS' : 'FAILED'
        } (${result.responseTime}ms)`,
      )
      return result
    } catch (error: unknown) {
      const responseTime = Date.now() - startTime
      logger.error(`Connection test failed for ${dataSource.name}:`, error)

      // Provide Azure SQL-specific troubleshooting guidance
      let errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      if (dataSource.type === 'mssql') {
        const config = dataSource.connectionConfig as any
        const isAzureSQL = config.host?.includes('database.windows.net') || config.host?.includes('.database.azure.com')

        if (isAzureSQL && errorMessage.includes('Login failed')) {
          errorMessage += '\n\n🔍 Azure SQL Troubleshooting:\n' +
            '1. Verify the user exists in the specific database (not just server-level)\n' +
            '2. Check Azure SQL firewall rules include your current IP\n' +
            '3. Ensure SQL Authentication is enabled (not just Azure AD)\n' +
            '4. Verify the user has proper permissions on the database\n' +
            '5. For Azure SQL, you must connect to a specific database (not master)'
        }
      }

      return {
        success: false,
        responseTime,
        error: errorMessage,
        testedAt: new Date(),
      }
    }
  }

  /* ───────── PostgreSQL (test) ───────── */
  private async testPostgreSQL(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any
    let client: PgClient

    if (c.connectionString) {
      client = new PgClient({
        connectionString: c.connectionString,
        connectionTimeoutMillis: c.timeout || 30_000,
      })
    } else {
      const ssl =
        c.ssl === true
          ? { rejectUnauthorized: false }
          : typeof c.ssl === 'object'
          ? (c.ssl as object)
          : false

      // For server-level connections, use the first database from databases array or 'postgres' as default
      let databaseName: string | undefined = toStr(c.database)
      if (!databaseName && c.scope === 'server') {
        if (Array.isArray(c.databases) && c.databases.length > 0) {
          databaseName = c.databases[0]
        } else {
          databaseName = 'postgres' // Default PostgreSQL admin database
        }
      }

      client = new PgClient({
        host: c.host,
        port: c.port || 5432,
        database: databaseName,
        user: c.username,
        password: c.password,
        ssl,
        connectionTimeoutMillis: c.timeout || 30_000,
      })
    }

    try {
      await client.connect()
      const result = await client.query('SELECT version()')
      const version = result.rows?.[0]?.version as string | undefined
      return {
        success: true,
        details: {
          version,
          serverInfo: { type: 'PostgreSQL' },
          capabilities: ['SQL', 'ACID', 'Indexing'],
        },
        testedAt: new Date(),
      }
    } finally {
      await client.end().catch(() => {})
    }
  }

  /* ───────── MySQL (test) ───────── */
  private async testMySQL(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any

    const cfg: ConnectionOptions = {
      host: c.host,
      port: c.port || 3306,
      database: toStr(c.database),
      user: c.username,
      password: c.password,
      connectTimeout: c.timeout || 30_000,
    }

    if (c.ssl === true) {
      cfg.ssl = { rejectUnauthorized: false } as any
    } else if (typeof c.ssl === 'object') {
      cfg.ssl = c.ssl as any
    }

    const conn = await createMySQLConnection(cfg)
    try {
      const [rows] = await conn.execute('SELECT VERSION() as version')
      const version = (rows as any)?.[0]?.version as string | undefined
      return {
        success: true,
        details: {
          version,
          serverInfo: { type: 'MySQL' },
          capabilities: ['SQL', 'ACID', 'Replication'],
        },
        testedAt: new Date(),
      }
    } finally {
      await conn.end().catch(() => {})
    }
  }

  /* ───────── SQL Server ───────── */
  private async testSQLServer(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any
    const mssql = require('mssql')

    if (!c.host || !c.username || !c.password) {
      throw new Error('Missing required connection parameters (host, username, password)')
    }

    // Detect Azure SQL by hostname
    const isAzureSQL = c.host?.includes('database.windows.net') || c.host?.includes('.database.azure.com');

    // Determine database name based on scope and config
    let databaseName: string | undefined;

    // For server-level connections to Azure SQL, NEVER specify a database
    // This allows the connection to work at the server level and access all databases
    if (c.scope === 'server' && isAzureSQL) {
      // Explicitly undefined for Azure SQL server-level connections
      databaseName = undefined;
      logger.info('Azure SQL server-level connection - not specifying database');
    } else if (c.scope === 'database') {
      // For database-level connections, use the specified database
      databaseName = toStr(c.database);
    } else if (c.scope === 'server' && !isAzureSQL) {
      // For on-premises server-level connections, also don't specify database
      // This allows listing all databases on the server
      databaseName = undefined;
      logger.info('On-premises SQL Server server-level connection - not specifying database');
    }
    // Otherwise leave undefined (no database specified)

    // Use frontend-provided options if they exist, otherwise use ssl flag
    const options = c.options && typeof c.options === 'object'
      ? {
          encrypt: c.options.encrypt ?? (c.ssl !== false),
          trustServerCertificate: c.options.trustServerCertificate ?? (c.ssl === false || c.ssl === undefined),
          enableArithAbort: true,
        }
      : {
          encrypt: c.ssl !== false,
          trustServerCertificate: c.ssl === false || c.ssl === undefined,
          enableArithAbort: true,
        };

    const config: any = {
      server: c.host,
      port: Number(c.port || 1433),
      user: c.username,
      password: c.password,
      options,
      connectionTimeout: c.timeout || 30_000,
      requestTimeout: c.timeout || 30_000,
    }

    // Only add database if specified - for server-level connections, omit it
    if (databaseName) {
      config.database = databaseName
    }

    logger.info(`Testing MSSQL connection`, {
      server: c.host,
      database: databaseName,
      username: c.username,
      isAzureSQL,
      encrypt: config.options.encrypt,
      trustServerCertificate: config.options.trustServerCertificate,
      port: config.port,
      scope: c.scope
    });

    const pool = await mssql.connect(config)
    try {
      const result = await pool.request().query('SELECT @@VERSION as version, SERVERPROPERTY(\'ProductVersion\') as productVersion')
      const version = result.recordset[0]?.version
      const productVersion = result.recordset[0]?.productVersion

      return {
        success: true,
        details: {
          version: productVersion || 'SQL Server',
          serverInfo: {
            type: 'Microsoft SQL Server',
            host: c.host,
            port: c.port || 1433,
            database: databaseName,
            fullVersion: version,
          },
          capabilities: ['SQL', 'ACID', 'Transactions', 'Clustering'],
        },
        testedAt: new Date(),
      }
    } finally {
      await pool.close().catch(() => {})
    }
  }

  /* ───────── MongoDB (test) ───────── */
  private async testMongoDB(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any
    const auth = c.username ? `${c.username}:${c.password}@` : ''
    const port = c.port || 27017
    const database = c.database ? `/${toStr(c.database)}` : ''
    const uri = c.connectionString || `mongodb://${auth}${c.host}:${port}${database}`

    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: c.timeout || 30_000,
    })
    try {
      await client.connect()
      const serverStatus = await client.db().admin().serverStatus()
      return {
        success: true,
        details: {
          version: (serverStatus as any).version,
          serverInfo: {
            type: 'MongoDB',
            host: (serverStatus as any).host,
            uptime: (serverStatus as any).uptime,
          },
          capabilities: ['Document Store', 'Indexing', 'Aggregation'],
        },
        testedAt: new Date(),
      }
    } finally {
      await client.close().catch(() => {})
    }
  }

  /* ───────── Redis (test) ───────── */
  private async testRedis(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any
    const client = createRedisClient({
      socket: {
        host: c.host,
        port: c.port || 6379,
        connectTimeout: c.timeout || 30_000,
      },
      password: c.password,
    })

    try {
      await client.connect()
      const info = await client.info()
      const version = info.match(/redis_version:([^\r\n]+)/)?.[1]
      return {
        success: true,
        details: {
          version,
          serverInfo: { type: 'Redis' },
          capabilities: ['Key-Value Store', 'Pub/Sub', 'Streams'],
        },
        testedAt: new Date(),
      }
    } finally {
      await client.disconnect().catch(() => {})
    }
  }

  /* ───────── S3 (test) ───────── */
  private async testS3(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig
    if (!isS3Config(c)) throw new Error('Invalid S3 configuration')

    const s3 = c as S3Config
    if (!s3.accessKeyId || !s3.secretAccessKey) {
      throw new Error(
        'S3 credentials (accessKeyId and secretAccessKey) are required',
      )
    }

    const s3Client = new S3Client({
      region: s3.region || 'us-east-1',
      credentials: {
        accessKeyId: s3.accessKeyId,
        secretAccessKey: s3.secretAccessKey,
      },
    })

    const response = await s3Client.send(new ListBucketsCommand({}))
    const bucketExists = s3.bucket
      ? !!response.Buckets?.some((b) => b.Name === s3.bucket)
      : true

    return {
      success: true,
      details: {
        serverInfo: {
          type: 'Amazon S3',
          region: s3.region,
          bucketCount: response.Buckets?.length || 0,
          bucketExists,
        },
        capabilities: ['Object Storage', 'Versioning', 'Lifecycle Management'],
      },
      testedAt: new Date(),
    }
  }

  /* ───────── HTTP API (test) ───────── */
  private async testAPI(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig
    if (!isAPIConfig(c)) throw new Error('Invalid API configuration')

    const api = c as APIConfig
    if (!api.baseUrl) throw new Error('Base URL is required for API connections')

    const safeUrl = await this.assertSafeHttpEndpoint(api.baseUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'CWIC-Data-Service/1.0',
      ...(api as any).headers || {},
    }

    if ((api as any).apiKey) headers['Authorization'] = `Bearer ${(api as any).apiKey}`

    if ((api as any).authentication) {
      const creds = (api as any).authentication.credentials || {}
      switch ((api as any).authentication.type) {
        case 'basic':
          if (creds.username && creds.password) {
            headers['Authorization'] =
              'Basic ' + Buffer.from(`${creds.username}:${creds.password}`).toString('base64')
          }
          break
        case 'bearer':
          if (creds.token) headers['Authorization'] = `Bearer ${creds.token}`
          break
        case 'api-key':
          if (creds.apiKey)
            headers[creds.headerName || 'X-API-Key'] = creds.apiKey
          break
      }
    }

    try {
      const response = await axios.get(safeUrl.toString(), {
        headers,
        timeout: (api as any).timeout || 30_000,
        validateStatus: (s) => s < 500,
      })

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
      }
    } catch (err) {
      const error = err as AxiosError
      if (error.response) {
        const ok = error.response.status < 500
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
          error: !ok
            ? `Server error: ${error.response.status} ${error.response.statusText}`
            : undefined,
          testedAt: new Date(),
        }
      }
      if (error.request) throw new Error(`Network error: ${error.message}`)
      throw error
    }
  }

  /* ───────── Snowflake (placeholder) ───────── */
  private async testSnowflake(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig
    if (!isSnowflakeConfig(c)) throw new Error('Invalid Snowflake configuration')
    const sf = c as SnowflakeConfig

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!sf.host || !sf.username || !sf.password) {
          reject(
            new Error(
              'Missing required Snowflake connection parameters (host, username, password)',
            ),
          )
          return
        }
        resolve({
          success: true,
          details: {
            version: 'Snowflake (placeholder)',
            serverInfo: {
              type: 'Snowflake',
              account: sf.host,
              warehouse: sf.warehouse,
            },
            capabilities: ['SQL', 'Data Warehouse', 'Auto-scaling'],
          },
          testedAt: new Date(),
        })
      }, 200)
    })
  }

  /* ───────── BigQuery (placeholder) ───────── */
  private async testBigQuery(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig
    if (!isBigQueryConfig(c)) throw new Error('Invalid BigQuery configuration')
    const bq = c as BigQueryConfig

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!bq.projectId || !bq.serviceAccountKey) {
          reject(
            new Error(
              'Missing required BigQuery connection parameters (projectId, serviceAccountKey)',
            ),
          )
          return
        }
        resolve({
          success: true,
          details: {
            version: 'BigQuery API (placeholder)',
            serverInfo: {
              type: 'Google BigQuery',
              projectId: bq.projectId,
              location: bq.location || 'US',
            },
            capabilities: ['SQL', 'Analytics', 'Machine Learning'],
          },
          testedAt: new Date(),
        })
      }, 150)
    })
  }

  /* ───────── Elasticsearch (test) ───────── */
  private async testElasticsearch(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any
    if (!c.host) throw new Error('Host is required for Elasticsearch connections')

    const protocol = c.ssl ? 'https' : 'http'
    const port = c.port || 9200
    const baseUrl = (await this.assertSafeHttpEndpoint(`${protocol}://${c.host}:${port}`)).toString()

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (c.username && c.password) {
      headers['Authorization'] =
        'Basic ' + Buffer.from(`${c.username}:${c.password}`).toString('base64')
    }

    const health = await axios.get(`${baseUrl}/_cluster/health`, {
      headers,
      timeout: c.timeout || 30_000,
    })
    const root = await axios.get(`${baseUrl}/`, {
      headers,
      timeout: c.timeout || 30_000,
    })

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
    }
  }

  /* ───────── Generic fallback (test) ───────── */
  private async testGeneric(ds: DataSource): Promise<ConnectionTestResult> {
    const c = ds.connectionConfig as any
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!c.host && !c.baseUrl && !c.connectionString) {
          reject(
            new Error(
              'At least one of host, baseUrl, or connectionString is required',
            ),
          )
          return
        }
        resolve({
          success: true,
          details: {
            serverInfo: { type: ds.type, host: c.host, port: c.port },
            capabilities: ['Generic Connection'],
          },
          testedAt: new Date(),
        })
      }, 100)
    })
  }

  /* =========================================================================
     Database discovery helpers
  ========================================================================= */

  private async pgListDatabases(cfg: any): Promise<Array<{ name: string }>> {
    const base: any = cfg?.connectionString
      ? { connectionString: cfg.connectionString }
      : {
          host: cfg.host,
          port: cfg.port || 5432,
          user: cfg.username,
          password: cfg.password,
          database: cfg.database || 'postgres',
          ssl:
            cfg.ssl === true
              ? { rejectUnauthorized: false }
              : typeof cfg.ssl === 'object'
              ? cfg.ssl
              : false,
        }
    const client = new PgClient({
      ...base,
      connectionTimeoutMillis: cfg.timeout || 30_000,
    })

    try {
      await client.connect()
      const q = `
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false
          AND datname NOT IN ('postgres', 'template0', 'template1')
        ORDER BY datname;
      `
      const { rows } = await client.query(q)
      return rows.map((r) => ({ name: r.datname as string }))
    } finally {
      await client.end().catch(() => {})
    }
  }

  private async mysqlListDatabases(
    cfgIn: any,
  ): Promise<Array<{ name: string }>> {
    const cfg: ConnectionOptions = {
      host: cfgIn.host,
      port: cfgIn.port || 3306,
      user: cfgIn.username,
      password: cfgIn.password,
      // no database needed for SHOW DATABASES
      connectTimeout: cfgIn.timeout || 30_000,
    }

    if (cfgIn.ssl === true) {
      cfg.ssl = { rejectUnauthorized: false } as any
    } else if (typeof cfgIn.ssl === 'object') {
      cfg.ssl = cfgIn.ssl as any
    }

    const conn = await createMySQLConnection(cfg)
    try {
      const [rows] = await conn.query('SHOW DATABASES;')
      // Filter out MySQL system databases
      const systemDbs = ['mysql', 'information_schema', 'performance_schema', 'sys'];
      return (rows as any[])
        .filter((r) => !systemDbs.includes(r.Database.toLowerCase()))
        .map((r) => ({ name: r.Database as string }))
    } finally {
      await conn.end().catch(() => {})
    }
  }

  private async mssqlListDatabases(cfg: any): Promise<Array<{ name: string }>> {
    const mssql = require('mssql');
    const isAzureSQL = cfg.host?.includes('database.windows.net') || cfg.host?.includes('.database.azure.com');

    // For Azure SQL Database, return the configured database since server-level queries aren't allowed
    if (isAzureSQL) {
      if (cfg.database) {
        logger.info(`Azure SQL Database detected, returning configured database: ${cfg.database}`);
        return [{ name: cfg.database }];
      } else {
        logger.warn('Azure SQL Database detected but no database configured. Cannot list databases without a specific database connection.');
        // Return empty array - user must configure a specific database
        return [];
      }
    }

    // For on-premises SQL Server or Azure SQL Managed Instance, try server-level query
    try {
      const config = {
        server: cfg.host || cfg.server,
        port: Number(cfg.port || 1433),
        user: cfg.username || cfg.user,
        password: cfg.password,
        database: 'master',
        options: {
          encrypt: cfg.ssl !== false,
          trustServerCertificate: cfg.ssl === false,
          enableArithAbort: true,
        },
        connectionTimeout: cfg.timeout || 15000,
        requestTimeout: cfg.timeout || 15000,
      };

      const pool = await mssql.connect(config);

      try {
        // Try simple query first (works on newer SQL Server versions)
        const result = await pool.request().query(`
          SELECT name
          FROM sys.databases
          WHERE state = 0
            AND name NOT IN ('master', 'tempdb', 'model', 'msdb')
          ORDER BY name
        `);

        const databases = result.recordset.map((row: any) => ({ name: row.name }));
        logger.info(`Found ${databases.length} databases via sys.databases`);
        return databases;
      } finally {
        await pool.close();
      }
    } catch (error) {
      logger.warn('MSSQL server-level database discovery failed', {
        error: (error as Error)?.message || String(error),
        host: cfg.host
      });

      // Fallback: return configured database if available
      if (cfg.database) {
        logger.info(`Falling back to configured database: ${cfg.database}`);
        return [{ name: cfg.database }];
      }

      return [];
    }
  }

  private async mongoListDatabases(cfg: any): Promise<Array<{ name: string }>> {
    const auth = cfg.username ? `${cfg.username}:${cfg.password}@` : ''
    const port = cfg.port || 27017
    const uri = cfg.connectionString || `mongodb://${auth}${cfg.host}:${port}`

    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: cfg.timeout || 30_000,
    })
    try {
      await client.connect()
      const adminDb = client.db().admin()
      const res = await adminDb.listDatabases()
      const dbs = (res.databases || []).map((d: any) => ({
        name: d.name as string,
      }))
      return dbs
    } finally {
      await client.close().catch(() => {})
    }
  }

  /* ========================================================================= */

  private async assertSafeHttpEndpoint(rawUrl: string): Promise<URL> {
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      throw new Error('Base URL must be a valid absolute URL')
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Only http(s) URLs are allowed for connection tests')
    }

    const hostname = parsed.hostname
    const normalizedHost = hostname.toLowerCase()

    if (outboundHostAllowlist.has(normalizedHost)) {
      return parsed
    }

    if (blockedHostnames.has(normalizedHost)) {
      throw new Error('Target host is not permitted')
    }

    const addresses: string[] = []
    if (isIP(hostname)) {
      addresses.push(hostname)
    } else {
      try {
        const results = await lookup(hostname, { all: true, family: 0 })
        results.forEach((entry) => addresses.push(entry.address))
      } catch {
        throw new Error(`Unable to resolve host ${hostname}`)
      }
    }

    if (!addresses.length) {
      throw new Error(`Unable to resolve host ${hostname}`)
    }

    for (const address of addresses) {
      const lowered = address.toLowerCase()
      if (blockedIpAddresses.has(lowered)) {
        throw new Error('Target host is not permitted')
      }

      if (this.isLoopbackOrLinkLocal(lowered)) {
        throw new Error('Refusing to contact loopback or link-local addresses')
      }
    }

    return parsed
  }

  private isLoopbackOrLinkLocal(address: string): boolean {
    const kind = isIP(address)
    if (kind === 4) {
      const parts = address.split('.').map((segment) => Number(segment))
      // Loopback (127.0.0.0/8)
      if (parts[0] === 127) return true
      // Current network (0.0.0.0/8)
      if (parts[0] === 0) return true
      // Link-local (169.254.0.0/16)
      if (parts[0] === 169 && parts[1] === 254) return true
      // Private networks - block all RFC1918 ranges
      // 10.0.0.0/8
      if (parts[0] === 10) return true
      // 172.16.0.0/12
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
      // 192.168.0.0/16
      if (parts[0] === 192 && parts[1] === 168) return true
      // Multicast (224.0.0.0/4) and reserved (240.0.0.0/4)
      if (parts[0] >= 224) return true
      return false
    }

    if (kind === 6) {
      const normalized = address.toLowerCase()
      // Loopback
      if (normalized === '::1') return true
      // Unspecified
      if (normalized === '::') return true
      // Link-local (fe80::/10)
      if (normalized.startsWith('fe80')) return true
      // Unique local addresses (fc00::/7)
      if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
      // IPv4-mapped IPv6 addresses
      if (normalized.startsWith('::ffff:')) {
        const mapped = normalized.replace('::ffff:', '')
        return this.isLoopbackOrLinkLocal(mapped)
      }
      return false
    }

    return false
  }

  public async testMultipleConnections(
    dataSources: DataSource[],
  ): Promise<ConnectionTestResult[]> {
    const promises = dataSources.map((ds) =>
      this.testConnection(ds).catch((err) => {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        return {
          success: false,
          error: msg,
          responseTime: 0,
          testedAt: new Date(),
        } as ConnectionTestResult
      }),
    )
    return Promise.all(promises)
  }

  public getSupportedTypes(): string[] {
    return [
      'postgresql',
      'mysql',
      'mssql',
      'mongodb',
      'redis',
      's3',
      'api',
      'file',
      'snowflake',
      'bigquery',
      'elasticsearch',
      'oracle',
      'azure-blob',
      'gcs',
      'redshift',
      'databricks',
      'kafka',
    ]
  }
}








