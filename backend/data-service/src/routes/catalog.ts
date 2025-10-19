// backend/data-service/src/routes/catalog.ts
import { Request, Response, Router } from 'express';
import mssql from 'mssql';
import { Client as PgClient, Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { ProfileQueue } from '../queue';
import { decryptConfig, isEncryptedConfig } from '../utils/secrets';

const router = Router();
const cpdb = new Pool({ connectionString: process.env.DATABASE_URL });

/* ---------------------------- Utilities ---------------------------- */

const ok = <T>(res: Response, data: T, extra: Record<string, unknown> = {}) =>
  res.json({ success: true, data, ...extra });

const fail = (res: Response, code: number, message: string, extra?: Record<string, unknown>) =>
  res.status(code).json({ success: false, error: message, ...(extra ?? {}) });

type DSRow = {
  id: string;
  tenant_id: number | null;
  type: 'postgresql' | 'mssql';
  name?: string;
  config?: any;
  connection_config?: any;
  cfg?: any;
};

async function getDataSourceById(
  id: string
): Promise<{ tenantId: number; type: DSRow['type']; cfg: any; idText: string }> {
  const { rows } = await cpdb.query<DSRow>(
    `SELECT id::text AS id, type, connection_config AS cfg
     FROM data_sources WHERE id::text = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) throw new Error('Data source not found');

  let cfg = (row as any).cfg || {};
  // Decrypt if encrypted
  if (typeof cfg === 'string') {
    try {
      cfg = JSON.parse(cfg);
    } catch {
      cfg = {};
    }
  }
  if (isEncryptedConfig(cfg)) {
    cfg = decryptConfig(cfg);
  }

  return { tenantId: 1, type: row.type, cfg, idText: (row as any).id };
}

/* ------------------------- Ingest (Harvest) ------------------------ */

/**
 * Get system databases for a given database type
 */
function getSystemDatabasesForType(type: string): string[] {
  switch (type) {
    case 'postgresql':
      return ['postgres', 'template0', 'template1'];
    case 'mssql':
    case 'sqlserver':
      return ['master', 'tempdb', 'model', 'msdb'];
    case 'mysql':
    case 'mariadb':
      return ['mysql', 'information_schema', 'performance_schema', 'sys'];
    case 'oracle':
      return ['SYS', 'SYSTEM', 'SYSAUX', 'TEMP', 'USERS'];
    case 'snowflake':
      return ['SNOWFLAKE', 'INFORMATION_SCHEMA'];
    case 'redshift':
      return ['dev', 'padb_harvest', 'template0', 'template1'];
    case 'bigquery':
      return ['INFORMATION_SCHEMA'];
    default:
      return [];
  }
}

/**
 * Sync a single PostgreSQL database
 */
async function ingestPostgresSingleDatabase(
  tenantId: number,
  dataSourceId: string,
  cfg: any,
  targetDatabase: string
): Promise<{ assets: number; columns: number; database: string }> {
  const buildClient = (database: string | undefined) => new PgClient({
    host: cfg.host,
    port: Number(cfg.port ?? 5432),
    database: database || 'postgres',
    user: cfg.username,
    password: cfg.password,
    ssl: cfg.ssl === false || cfg.ssl?.mode === 'disable' ? undefined : cfg.ssl,
  });

  let src = buildClient(targetDatabase);
  try {
    await src.connect();
  } catch (err: any) {
    const msg = String(err?.message || err);
    // Database doesn't exist or can't connect
    if (/does not exist/i.test(msg) || /3D000/.test(msg)) {
      throw new Error(`Database "${targetDatabase}" does not exist or is not accessible`);
    } else {
      throw err;
    }
  }

  const tables = await src.query(`
    SELECT table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema NOT IN ('pg_catalog','information_schema')
  `);

  const columns = await src.query(`
    SELECT c.table_schema, c.table_name, c.column_name, c.data_type, c.is_nullable, c.ordinal_position,
           d.description AS column_comment
    FROM information_schema.columns c
    LEFT JOIN pg_catalog.pg_class cls ON cls.relname = c.table_name
    LEFT JOIN pg_catalog.pg_namespace ns ON ns.nspname = c.table_schema
    LEFT JOIN pg_catalog.pg_description d ON d.objoid = cls.oid AND d.objsubid = c.ordinal_position
    WHERE c.table_schema NOT IN ('pg_catalog','information_schema')
    ORDER BY c.table_schema, c.table_name, c.ordinal_position
  `);

  // Get accurate row counts using COUNT(*) for each table
  const cnt = new Map<string, number>();

  // Build dynamic SQL to count all tables at once
  const countQueries = tables.rows.map((t: any) => {
    const schema = t.table_schema;
    const table = t.table_name;
    return `SELECT '${schema}.${table}' AS key, COUNT(*) AS cnt FROM "${schema}"."${table}"`;
  });

  if (countQueries.length > 0) {
    try {
      const countsQuery = countQueries.join(' UNION ALL ');
      const counts = await src.query(countsQuery);
      counts.rows.forEach((r: any) => cnt.set(r.key, Number(r.cnt)));
    } catch (err) {
      console.warn('Failed to get accurate counts, using estimates:', err);
      // Fallback to estimates if COUNT fails
      const fallback = await src.query(`
        SELECT schemaname AS table_schema, relname AS table_name, n_live_tup AS row_estimate
        FROM pg_stat_user_tables
      `);
      fallback.rows.forEach((r: any) => cnt.set(`${r.table_schema}.${r.table_name}`, Number(r.row_estimate)));
    }
  }

  // Get the actual database name from the connection
  const dbNameResult = await src.query('SELECT current_database() AS database_name');
  const dbName = dbNameResult.rows[0]?.database_name || targetDatabase;

  await src.end();

  let assets = 0, cols = 0;
  for (const t of tables.rows) {
    const assetType = t.table_type === 'VIEW' ? 'view' : 'table';
    const rowCount = cnt.get(`${t.table_schema}.${t.table_name}`) ?? null;

    const colsForTable = columns.rows.filter((c: any) => c.table_schema === t.table_schema && c.table_name === t.table_name);
    const columnCount = colsForTable.length;

    const ar: QueryResult<{ id: string }> = await cpdb.query(
      `INSERT INTO catalog_assets
         (tenant_id, datasource_id, asset_type, schema_name, table_name, row_count, column_count, database_name, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (tenant_id, datasource_id, asset_type, schema_name, table_name)
       DO UPDATE SET row_count = EXCLUDED.row_count, column_count = EXCLUDED.column_count, database_name = EXCLUDED.database_name, updated_at = now()
       RETURNING id`,
      [tenantId, dataSourceId, assetType, t.table_schema, t.table_name, rowCount, columnCount, dbName]
    );
    const assetId = ar.rows[0].id; assets++;

    // Calculate trust score for the asset (simple calculation based on available data)
    await cpdb.query(
      `UPDATE catalog_assets
       SET trust_score = LEAST(100,
         CASE WHEN row_count IS NOT NULL AND row_count > 0 THEN 10 ELSE 0 END +
         CASE WHEN column_count IS NOT NULL AND column_count > 0 THEN 10 ELSE 0 END +
         CASE WHEN description IS NOT NULL AND LENGTH(description) > 10 THEN 15 ELSE 0 END
       )
       WHERE id = $1`,
      [assetId]
    );

    for (const c of colsForTable) {
      await cpdb.query(
        `INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, description, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (asset_id, column_name)
         DO UPDATE SET data_type = EXCLUDED.data_type,
                       is_nullable = EXCLUDED.is_nullable,
                       ordinal = EXCLUDED.ordinal,
                       description = EXCLUDED.description,
                       updated_at = now()`,
        [assetId, c.column_name, c.data_type, c.is_nullable === 'YES', c.ordinal_position, c.column_comment ?? null]
      );
      cols++;
    }
  }

  await cpdb.query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'catalog_metrics') THEN
      PERFORM 1 FROM pg_sleep(0);
      REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_metrics;
    END IF;
  END $$;`);

  return { assets, columns: cols, database: dbName };
}

/**
 * Sync all user databases on a PostgreSQL server
 */
async function ingestPostgresAllDatabases(
  tenantId: number,
  dataSourceId: string,
  cfg: any
): Promise<{ databases: number; totalAssets: number; totalColumns: number; details: any[] }> {
  const buildClient = (database: string) => new PgClient({
    host: cfg.host,
    port: Number(cfg.port ?? 5432),
    database,
    user: cfg.username,
    password: cfg.password,
    ssl: cfg.ssl === false || cfg.ssl?.mode === 'disable' ? undefined : cfg.ssl,
    connectionTimeoutMillis: 10000,
  });

  // Connect to postgres database to discover all databases
  const discoverClient = buildClient('postgres');
  try {
    await discoverClient.connect();
  } catch (err: any) {
    throw new Error(`Failed to connect to server: ${err.message}`);
  }

  // Discover all user databases (exclude system databases)
  const systemDbs = getSystemDatabasesForType('postgresql');
  const systemDbList = systemDbs.map(db => `'${db}'`).join(',');

  const { rows: databases } = await discoverClient.query(`
    SELECT datname
    FROM pg_database
    WHERE datistemplate = false
    AND datname NOT IN (${systemDbList})
    AND datallowconn = true
    ORDER BY datname
  `);

  await discoverClient.end();

  console.log(`[PostgreSQL] Discovered ${databases.length} user databases to sync`);

  // Sync each database with error handling
  const results: any[] = [];
  for (const db of databases) {
    const dbName = db.datname;
    try {
      console.log(`[PostgreSQL] Syncing database: ${dbName}`);
      const result = await ingestPostgresSingleDatabase(tenantId, dataSourceId, cfg, dbName);
      results.push({
        database: dbName,
        success: true,
        assets: result.assets,
        columns: result.columns
      });
      console.log(`[PostgreSQL] ✓ ${dbName}: ${result.assets} assets, ${result.columns} columns`);
    } catch (error: any) {
      console.error(`[PostgreSQL] ✗ ${dbName}: ${error.message}`);
      results.push({
        database: dbName,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const totalAssets = results.reduce((sum, r) => sum + (r.assets || 0), 0);
  const totalColumns = results.reduce((sum, r) => sum + (r.columns || 0), 0);

  console.log(`[PostgreSQL] Sync complete: ${successCount}/${databases.length} databases, ${totalAssets} total assets`);

  return {
    databases: databases.length,
    totalAssets,
    totalColumns,
    details: results
  };
}

/**
 * Main entry point for PostgreSQL sync
 * - If targetDatabase provided: sync only that database
 * - If no targetDatabase: discover and sync ALL user databases
 */
async function ingestPostgres(
  tenantId: number,
  dataSourceId: string,
  cfg: any,
  targetDatabase?: string
) {
  if (targetDatabase) {
    // Database-level sync - sync only the specified database
    return await ingestPostgresSingleDatabase(tenantId, dataSourceId, cfg, targetDatabase);
  } else {
    // Server-level sync - discover and sync ALL user databases
    return await ingestPostgresAllDatabases(tenantId, dataSourceId, cfg);
  }
}

/**
 * Sync a single MSSQL database
 */
async function ingestMSSQLSingleDatabase(
  tenantId: number,
  dataSourceId: string,
  cfg: any,
  targetDatabase: string
): Promise<{ assets: number; columns: number; database: string }> {
  // IMPORTANT: avoid the mssql global connection (mssql.connect) because it is
  // a singleton. Closing it in one request can break others with
  // "Connection is closed." Create a dedicated pool per request instead.
  const pool = await new mssql.ConnectionPool({
    server: cfg.host || cfg.server,
    port: Number(cfg.port ?? 1433),
    database: targetDatabase,
    user: cfg.username || cfg.user,
    password: cfg.password,
    options: {
      encrypt: cfg.ssl !== false,
      trustServerCertificate: true,
      ...(cfg.options || {}),
    },
  }).connect();

  const tables = (await pool.request().query(`
    SELECT s.name AS schema_name, t.name AS object_name, 'table' AS asset_type
    FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
    WHERE t.is_ms_shipped = 0
    UNION ALL
    SELECT s.name, v.name, 'view'
    FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id
  `)).recordset;

  const columns = (await pool.request().query(`
    SELECT s.name AS schema_name, o.name AS object_name, c.name AS column_name,
           ty.name AS data_type, c.is_nullable, c.column_id AS ordinal,
           CAST(ep.value AS NVARCHAR(4000)) AS column_comment
    FROM sys.columns c
    JOIN sys.types ty ON c.user_type_id = ty.user_type_id
    JOIN sys.objects o ON c.object_id = o.object_id AND o.type IN ('U','V')
    JOIN sys.schemas s ON o.schema_id = s.schema_id
    LEFT JOIN sys.extended_properties ep
      ON ep.major_id = c.object_id AND ep.minor_id = c.column_id AND ep.name='MS_Description'
  `)).recordset;

  // Get row counts for tables using sys.partitions (fast, uses metadata)
  const tableCounts = (await pool.request().query(`
    SELECT s.name AS schema_name, t.name AS object_name, SUM(p.rows) AS row_count
    FROM sys.tables t
    JOIN sys.partitions p ON t.object_id=p.object_id AND p.index_id IN (0,1)
    JOIN sys.schemas s ON t.schema_id=s.schema_id
    GROUP BY s.name, t.name
  `)).recordset;

  // Get row counts for views using COUNT(*) (requires query execution)
  const viewCountPromises = tables
    .filter((t: any) => t.asset_type === 'view')
    .map(async (v: any) => {
      try {
        const countResult = await pool.request().query(`SELECT COUNT(*) AS cnt FROM [${v.schema_name}].[${v.object_name}]`);
        return {
          schema_name: v.schema_name,
          object_name: v.object_name,
          row_count: countResult.recordset[0]?.cnt || 0
        };
      } catch (err) {
        console.warn(`Failed to count view ${v.schema_name}.${v.object_name}:`, err);
        return { schema_name: v.schema_name, object_name: v.object_name, row_count: null };
      }
    });

  const viewCounts = await Promise.all(viewCountPromises);

  // Combine table and view counts
  const counts = [...tableCounts, ...viewCounts];

  // Get the actual database name
  const dbResult = await pool.request().query('SELECT DB_NAME() AS database_name');
  const dbName = dbResult.recordset[0]?.database_name || targetDatabase;

  await pool.close();

  const cnt = new Map<string, number>();
  counts.forEach((r: any) => cnt.set(`${r.schema_name}.${r.object_name}`, Number(r.row_count)));

  let assets = 0, cols = 0;
  for (const t of tables as any[]) {
    const rowCount = cnt.get(`${t.schema_name}.${t.object_name}`) ?? null;
    const colsForTable = (columns as any[]).filter(c => c.schema_name === t.schema_name && c.object_name === t.object_name);
    const columnCount = colsForTable.length;

    const ar: QueryResult<{ id: string }> = await cpdb.query(
      `INSERT INTO catalog_assets
         (tenant_id, datasource_id, asset_type, schema_name, table_name, row_count, column_count, database_name, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())
       ON CONFLICT (tenant_id, datasource_id, asset_type, schema_name, table_name)
       DO UPDATE SET row_count = EXCLUDED.row_count, column_count = EXCLUDED.column_count, database_name = EXCLUDED.database_name, updated_at = now()
       RETURNING id`,
      [tenantId, dataSourceId, t.asset_type, t.schema_name, t.object_name, rowCount, columnCount, dbName]
    );
    const assetId = ar.rows[0].id; assets++;

    // Calculate trust score for the asset (simple calculation based on available data)
    await cpdb.query(
      `UPDATE catalog_assets
       SET trust_score = LEAST(100,
         CASE WHEN row_count IS NOT NULL AND row_count > 0 THEN 10 ELSE 0 END +
         CASE WHEN column_count IS NOT NULL AND column_count > 0 THEN 10 ELSE 0 END +
         CASE WHEN description IS NOT NULL AND LENGTH(description) > 10 THEN 15 ELSE 0 END
       )
       WHERE id = $1`,
      [assetId]
    );

    for (const c of colsForTable) {
      await cpdb.query(
        `INSERT INTO catalog_columns (asset_id, column_name, data_type, is_nullable, ordinal, description, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,now())
         ON CONFLICT (asset_id, column_name)
         DO UPDATE SET data_type = EXCLUDED.data_type,
                       is_nullable = EXCLUDED.is_nullable,
                       ordinal = EXCLUDED.ordinal,
                       description = EXCLUDED.description,
                       updated_at = now()`,
        [assetId, c.column_name, c.data_type, !!c.is_nullable, c.ordinal, c.column_comment ?? null]
      );
      cols++;
    }
  }

  await cpdb.query(`DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'catalog_metrics') THEN
      REFRESH MATERIALIZED VIEW CONCURRENTLY catalog_metrics;
    END IF;
  END $$;`);

  return { assets, columns: cols, database: dbName };
}

/**
 * Sync all user databases on an MSSQL server
 */
async function ingestMSSQLAllDatabases(
  tenantId: number,
  dataSourceId: string,
  cfg: any
): Promise<{ databases: number; totalAssets: number; totalColumns: number; details: any[] }> {
  // Connect to master database to discover all databases
  const discoverPool = await new mssql.ConnectionPool({
    server: cfg.host || cfg.server,
    port: Number(cfg.port ?? 1433),
    database: 'master',
    user: cfg.username || cfg.user,
    password: cfg.password,
    options: {
      encrypt: cfg.ssl !== false,
      trustServerCertificate: true,
      ...(cfg.options || {}),
    },
    connectionTimeout: 10000,
  }).connect();

  // Discover all user databases (exclude system databases)
  const systemDbs = getSystemDatabasesForType('mssql');
  const systemDbList = systemDbs.map(db => `'${db}'`).join(',');

  const dbResult = await discoverPool.request().query(`
    SELECT name
    FROM sys.databases
    WHERE name NOT IN (${systemDbList})
    AND state_desc = 'ONLINE'
    AND user_access_desc = 'MULTI_USER'
    ORDER BY name
  `);

  await discoverPool.close();

  const databases = dbResult.recordset;
  console.log(`[MSSQL] Discovered ${databases.length} user databases to sync`);

  // Sync each database with error handling
  const results: any[] = [];
  for (const db of databases) {
    const dbName = db.name;
    try {
      console.log(`[MSSQL] Syncing database: ${dbName}`);
      const result = await ingestMSSQLSingleDatabase(tenantId, dataSourceId, cfg, dbName);
      results.push({
        database: dbName,
        success: true,
        assets: result.assets,
        columns: result.columns
      });
      console.log(`[MSSQL] ✓ ${dbName}: ${result.assets} assets, ${result.columns} columns`);
    } catch (error: any) {
      console.error(`[MSSQL] ✗ ${dbName}: ${error.message}`);
      results.push({
        database: dbName,
        success: false,
        error: error.message
      });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const totalAssets = results.reduce((sum, r) => sum + (r.assets || 0), 0);
  const totalColumns = results.reduce((sum, r) => sum + (r.columns || 0), 0);

  console.log(`[MSSQL] Sync complete: ${successCount}/${databases.length} databases, ${totalAssets} total assets`);

  return {
    databases: databases.length,
    totalAssets,
    totalColumns,
    details: results
  };
}

/**
 * Main entry point for MSSQL sync
 * - If targetDatabase provided: sync only that database
 * - If no targetDatabase: discover and sync ALL user databases
 */
async function ingestMSSQL(
  tenantId: number,
  dataSourceId: string,
  cfg: any,
  targetDatabase?: string
) {
  if (targetDatabase) {
    // Database-level sync - sync only the specified database
    return await ingestMSSQLSingleDatabase(tenantId, dataSourceId, cfg, targetDatabase);
  } else {
    // Server-level sync - discover and sync ALL user databases
    return await ingestMSSQLAllDatabases(tenantId, dataSourceId, cfg);
  }
}

/**
 * Get all available databases for filtering with rich metadata
 * Combines synced databases from catalog with available databases from live discovery
 */
const getAllDatabases = async (req: Request, res: Response) => {
  try {
    const q = req.query as any;
    const dataSourceId = q.datasourceId || q.dataSourceId;

    // Build WHERE clause for data sources query
    const where: string[] = ['deleted_at IS NULL'];  // Exclude deleted data sources
    const params: any[] = [];
    let i = 1;

    if (dataSourceId) {
      where.push(`id::text = $${i++}`);
      params.push(dataSourceId);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Get all data sources (excluding deleted ones)
    const { rows: dataSources } = await cpdb.query<DSRow>(
      `SELECT id::text AS id, type, connection_config AS cfg, name
       FROM data_sources ${whereSql}
       ORDER BY name`,
      params
    );

    const result: Array<{
      dataSourceId: string;
      dataSourceName: string;
      dataSourceType: string;
      databases: Array<{
        name: string;
        isSystem: boolean;
        isSynced: boolean;
        lastSyncAt?: string;
        assetCount?: number;
      }>;
      systemDatabases: string[];
    }> = [];

    for (const ds of dataSources) {
      const systemDatabases = getSystemDatabasesForType(ds.type);
      const systemDbSet = new Set(systemDatabases.map(db => db.toLowerCase()));
      const databaseMap = new Map<string, {
        name: string;
        isSystem: boolean;
        isSynced: boolean;
        lastSyncAt?: string;
        assetCount?: number;
      }>();

      // First, get synced databases from catalog with sync metadata
      const { rows: syncedDbs } = await cpdb.query(
        `SELECT
          database_name,
          COUNT(*) as asset_count,
          MAX(updated_at) as last_sync_at
         FROM catalog_assets
         WHERE datasource_id = $1 AND database_name IS NOT NULL
         GROUP BY database_name`,
        [ds.id]
      );

      syncedDbs.forEach((row: any) => {
        const dbName = row.database_name;
        const isSystem = systemDbSet.has(dbName.toLowerCase());
        databaseMap.set(dbName, {
          name: dbName,
          isSystem,
          isSynced: true,
          lastSyncAt: row.last_sync_at,
          assetCount: parseInt(row.asset_count) || 0
        });
      });

      // Then, try to discover available databases from the connection
      try {
        let cfg = (ds as any).cfg || {};
        if (typeof cfg === 'string') {
          try { cfg = JSON.parse(cfg); } catch { cfg = {}; }
        }
        if (isEncryptedConfig(cfg)) {
          cfg = decryptConfig(cfg);
        }

        const discoveredDatabases: string[] = [];

        if (ds.type === 'postgresql') {
          const buildClient = (db?: string) => new PgClient({
            host: cfg.host,
            port: cfg.port || 5432,
            user: cfg.username,
            password: cfg.password,
            database: db || cfg.database || 'postgres',
            ssl: cfg.ssl === false ? undefined : cfg.ssl,
            connectionTimeoutMillis: 5000,
          });

          let client = buildClient(cfg.database);
          try {
            await client.connect();
          } catch (err: any) {
            // Retry with 'postgres' database
            client = buildClient('postgres');
            await client.connect();
          }

          const result = await client.query(
            `SELECT datname FROM pg_database
             WHERE datistemplate = false
             ORDER BY datname`
          );
          result.rows.forEach((r: any) => discoveredDatabases.push(r.datname));
          await client.end();
        } else if (ds.type === 'mssql') {
          const pool = await mssql.connect({
            server: cfg.host || cfg.server,
            port: cfg.port || 1433,
            user: cfg.username || cfg.user,
            password: cfg.password,
            database: cfg.database || 'master',
            options: {
              encrypt: cfg.encrypt !== false,
              trustServerCertificate: cfg.trustServerCertificate !== false,
              enableArithAbort: true,
            },
            connectionTimeout: 5000,
          });

          const dbResult = await pool.request().query(`
            SELECT name FROM sys.databases
            ORDER BY name
          `);
          dbResult.recordset.forEach((r: any) => discoveredDatabases.push(r.name));
          await pool.close();
        }

        // Add discovered databases that aren't already synced
        discoveredDatabases.forEach(dbName => {
          if (!databaseMap.has(dbName)) {
            const isSystem = systemDbSet.has(dbName.toLowerCase());
            databaseMap.set(dbName, {
              name: dbName,
              isSystem,
              isSynced: false
            });
          }
        });
      } catch (error) {
        // If live discovery fails, we still have synced databases
        console.warn(`Failed to discover databases for ${ds.name}:`, error);
      }

      if (databaseMap.size > 0) {
        result.push({
          dataSourceId: ds.id,
          dataSourceName: (ds as any).name || 'Unknown',
          dataSourceType: ds.type,
          databases: Array.from(databaseMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
          systemDatabases
        });
      }
    }

    ok(res, result);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
};

/* -------------------------- Validation/Zod ------------------------- */

const PatchAsset = z.object({
  display_name: z.string().min(1).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  classification: z.enum(['public','internal','confidential','restricted']).optional(),
  quality: z.enum(['low','medium','high']).optional(),
  tags: z.array(z.string()).optional()
});

/* ----------------------- Handlers (shared) ------------------------ */

const listAssets = async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string|undefined>;
    const page = Math.max(1, parseInt(q.page ?? '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(q.limit ?? '50', 10)));
    const offset = (page - 1) * limit;

    const sortBy = (q.sortBy ?? 'name');
    const sortOrder = (q.sortOrder ?? 'asc') === 'desc' ? 'desc' : 'asc';
    const sortCol = sortBy === 'name' ? 'ca.table_name'
                    : sortBy === 'updatedAt' ? 'ca.updated_at'
                    : sortBy === 'createdAt' ? 'ca.created_at'
                    : 'ca.table_name';

    const p: any[] = [];
    let i = 1;
    const where: string[] = [];

    if (q.search) { where.push(`(ca.schema_name || '.' || ca.table_name || ' ' || coalesce(ca.description,'')) ILIKE $${i++}`); p.push(`%${q.search}%`); }
    if (q.type)   { where.push(`ca.asset_type = $${i++}`); p.push(q.type); }
    const dsId = q.datasourceId || q.dataSourceId; // Support both camelCase and lowercase
    if (dsId){ where.push(`ca.datasource_id::text = $${i++}`); p.push(dsId); }

    // Support multiple databases (comma-separated string or single database)
    if (q.databases) {
      const dbList = q.databases.split(',').map(d => d.trim()).filter(Boolean);
      if (dbList.length > 0) {
        where.push(`ca.database_name = ANY($${i++})`);
        p.push(dbList);
      }
    } else if (q.database) {
      where.push(`ca.database_name = $${i++}`);
      p.push(q.database);
    }

    if (q.schema) { where.push(`ca.schema_name = $${i++}`); p.push(q.schema); }
    // Object type filter: user (exclude system schemas) or system (only system schemas)
    if (q.objectType === 'user') {
      where.push(`ca.schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')`);
      where.push(`ca.database_name NOT IN ('master', 'tempdb', 'model', 'msdb')`); // Exclude system databases
    } else if (q.objectType === 'system') {
      where.push(`(ca.schema_name IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast') OR ca.database_name IN ('master', 'tempdb', 'model', 'msdb'))`);
    }
    if (q.tags) {
      where.push(`
        (
          (pg_typeof(ca.tags)::text = 'jsonb' AND (ca.tags ?| $${i}))
          OR
          (pg_typeof(ca.tags)::text <> 'jsonb' AND (ca.tags && $${i}::text[]))
        )
      `);
      p.push(q.tags.split(',').map(t => t.trim()));
      i++;
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const userId = (req as any).user?.id || 'system';

    const listSql = `
      SELECT ca.id, ca.datasource_id, ca.asset_type, ca.schema_name, ca.table_name, ca.database_name, ca.tags,
             ca.row_count, ca.column_count, ca.description, ca.created_at, ca.updated_at,
             ca.trust_score, ca.quality_score, ca.view_count, ca.owner_id, ca.rating_avg,
             ca.bookmark_count, ca.comment_count, ca.last_profiled_at,
             ds.name as datasource_name, ds.type as datasource_type,
             EXISTS(SELECT 1 FROM catalog_bookmarks WHERE object_id = ca.id AND user_id = '${userId}') as is_bookmarked
      FROM catalog_assets ca
      LEFT JOIN data_sources ds ON ca.datasource_id = ds.id
      ${whereSql}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT ${limit} OFFSET ${offset};`;

    const countSql = `SELECT COUNT(*)::bigint AS total FROM catalog_assets ca LEFT JOIN data_sources ds ON ca.datasource_id = ds.id ${whereSql};`;

    const [list, total] = await Promise.all([cpdb.query(listSql, p), cpdb.query(countSql, p)]);
    const t = Number(total.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(t / limit));

    // Transform snake_case to camelCase for frontend
    const items = list.rows.map((row: any) => ({
      id: row.id,
      dataSourceId: row.datasource_id,
      dataSourceName: row.datasource_name,
      dataSourceType: row.datasource_type,
      type: row.asset_type,
      schema: row.schema_name,
      table: row.table_name,
      name: row.table_name,
      databaseName: row.database_name,
      tags: row.tags || [],
      rowCount: row.row_count ? Number(row.row_count) : null,
      columnCount: row.column_count ? Number(row.column_count) : null,
      description: row.description,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      trustScore: row.trust_score || 0,
      qualityScore: row.quality_score || 0,
      viewCount: row.view_count || 0,
      ownerId: row.owner_id,
      ratingAvg: row.rating_avg ? Number(row.rating_avg) : null,
      bookmarkCount: row.bookmark_count || 0,
      commentCount: row.comment_count || 0,
      lastProfiledAt: row.last_profiled_at,
      isBookmarked: row.is_bookmarked || false,
    }));

    const payload = { assets: items, pagination: { page, limit, total: t, totalPages } };

    const newest = list.rows.reduce<number>((acc: number, r: any) => {
      const ts = r?.updated_at ? new Date(r.updated_at).getTime() : 0;
      return Math.max(acc, ts);
    }, 0);
    const etag = `"assets-${t}-${newest}"`;
    res.set('ETag', etag);
    if (req.headers['if-none-match'] === etag) return res.status(304).end();

    ok(res, payload);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
};

const getAsset = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'system';
    const { rows } = await cpdb.query(
      `SELECT a.*,
              jsonb_agg(c ORDER BY c.ordinal) AS columns,
              EXISTS(SELECT 1 FROM catalog_bookmarks WHERE object_id = a.id AND user_id = $2) as is_bookmarked
       FROM catalog_assets a
       LEFT JOIN catalog_columns c ON c.asset_id = a.id
       WHERE a.id::text = $1
       GROUP BY a.id`,
      [req.params.id, userId]
    );
    if (!rows[0]) return fail(res, 404, 'Not found');

    // Transform is_bookmarked to isBookmarked for frontend
    const asset = rows[0];
    if (asset.is_bookmarked !== undefined) {
      asset.isBookmarked = asset.is_bookmarked;
    }

    ok(res, asset);
  } catch (e: any) {
    fail(res, 500, e.message);
  }
};

const exportAssets = async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string|undefined>;

    const p: any[] = [];
    let i = 1;
    const where: string[] = [];

    if (q.search) { where.push(`(schema_name || '.' || table_name || ' ' || coalesce(description,'')) ILIKE $${i++}`); p.push(`%${q.search}%`); }
    if (q.type)   { where.push(`asset_type = $${i++}`); p.push(q.type); }
    if (q.datasourceId){ where.push(`datasource_id::text = $${i++}`); p.push(q.datasourceId); }
    if (q.tags) {
      where.push(`
        (
          (pg_typeof(tags)::text = 'jsonb' AND (tags ?| $${i}))
          OR
          (pg_typeof(tags)::text <> 'jsonb' AND (tags && $${i}::text[]))
        )
      `);
      p.push(q.tags.split(',').map(t => t.trim()));
      i++;
    }

    // Object type filter: user (exclude system schemas) or system (only system schemas)
    if (q.objectType === 'user') {
      where.push(`schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')`);
      where.push(`database_name NOT IN ('master', 'tempdb', 'model', 'msdb')`);
    } else if (q.objectType === 'system') {
      where.push(`(schema_name IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast') OR database_name IN ('master', 'tempdb', 'model', 'msdb'))`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await cpdb.query(
      `SELECT datasource_id::text AS datasource_id, asset_type, schema_name, table_name, database_name,
              row_count, column_count, tags, description, trust_score, quality_score, rating_avg,
              owner_id, domain, sensitivity_level, is_deprecated, created_at, updated_at
       FROM catalog_assets
       ${whereSql}
       ORDER BY database_name, schema_name, table_name`,
      p
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="catalog-assets-${Date.now()}.csv"`);

    const header = [
      'datasource_id','asset_type','database_name','schema_name','table_name',
      'row_count','column_count','trust_score','quality_score','rating_avg',
      'owner_id','domain','sensitivity_level','is_deprecated','tags','description',
      'created_at','updated_at'
    ];
    res.write(header.join(',') + '\n');

    for (const r of rows) {
      const tags =
        Array.isArray(r.tags) ? r.tags.join('|')
        : (typeof r.tags === 'object' && r.tags ? Object.values(r.tags as any).join('|') : '');
      const esc = (v: any) => {
        const s = String(v ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      res.write([
        esc(r.datasource_id),
        esc(r.asset_type),
        esc(r.database_name ?? ''),
        esc(r.schema_name),
        esc(r.table_name),
        esc(r.row_count ?? ''),
        esc(r.column_count ?? ''),
        esc(r.trust_score ?? ''),
        esc(r.quality_score ?? ''),
        esc(r.rating_avg ?? ''),
        esc(r.owner_id ?? ''),
        esc(r.domain ?? ''),
        esc(r.sensitivity_level ?? ''),
        esc(r.is_deprecated ? 'true' : 'false'),
        esc(tags),
        esc(r.description ?? ''),
        esc(r.created_at ? new Date(r.created_at).toISOString() : ''),
        esc(r.updated_at ? new Date(r.updated_at).toISOString() : '')
      ].join(',') + '\n');
    }

    res.end();
  } catch (e: any) {
    fail(res, 500, e.message);
  }
};

/* ------------------------------ Routes ---------------------------- */

// PATCH asset metadata
router.patch('/catalog/assets/:id', async (req, res) => {
  try {
    const body = PatchAsset.parse(req.body || {});
    const fields = Object.keys(body);
    if (fields.length === 0) return fail(res, 400, 'No fields');

    const sets = fields.map((k, idx) => `${k}=$${idx+1}`).join(', ') + ', updated_at=now()';
    const vals = fields.map(k => (body as any)[k]);
    vals.push(req.params.id);

    const q = await cpdb.query(
      `UPDATE catalog_assets SET ${sets} WHERE id::text=$${vals.length} RETURNING *`, vals
    );
    if (!q.rows[0]) return fail(res, 404, 'Not found');
    ok(res, q.rows[0]);
  } catch (e: any) {
    fail(res, 400, e?.message || 'Invalid payload');
  }
});

// Profile launch & read - Direct row count scan
router.post('/catalog/assets/:id/profile', async (req, res) => {
  try {
    const assetId = String(req.params.id);

    // Get asset details
    const { rows: assetRows } = await cpdb.query(
      `SELECT ca.*, ds.type as ds_type, ds.connection_config
       FROM catalog_assets ca
       LEFT JOIN data_sources ds ON ca.datasource_id = ds.id
       WHERE ca.id::text = $1`,
      [assetId]
    );

    if (!assetRows[0]) {
      return fail(res, 404, 'Asset not found');
    }

    const asset = assetRows[0];
    const dsType = asset.ds_type;
    const config = { ...asset.connection_config, type: dsType };

    console.log('Profile asset:', { assetId, table: asset.table_name, dsType, hasConfig: !!config });

    // Quick row count - try to get it directly
    try {
      const { ConnectorFactory } = require('../services/connectors/factory');
      const connector = await ConnectorFactory.createConnector(config);

      let rowCount = null;

      // Build the appropriate query based on database type
      if (dsType === 'postgresql') {
        const countQuery = `SELECT COUNT(*) as count FROM "${asset.schema_name}"."${asset.table_name}"`;
        const result = await connector.executeQuery(countQuery);
        rowCount = parseInt(result.rows[0]?.count || 0);
      } else if (dsType === 'mssql') {
        const schema = asset.schema_name || 'dbo';
        const countQuery = `SELECT COUNT(*) as count FROM [${asset.database_name}].[${schema}].[${asset.table_name}]`;
        const result = await connector.executeQuery(countQuery);
        rowCount = parseInt(result.rows[0]?.count || 0);
      }

      await connector.close();

      // Update the asset with the row count
      if (rowCount !== null) {
        await cpdb.query(
          `UPDATE catalog_assets SET row_count = $1, last_profiled_at = now(), updated_at = now() WHERE id::text = $2`,
          [rowCount, assetId]
        );

        ok(res, { success: true, rowCount, profiledAt: new Date() });
      } else {
        // Fallback to queue
        await ProfileQueue.add('profile-one', { assetId }, { removeOnComplete: 100, removeOnFail: 100 });
        ok(res, { queued: true });
      }
    } catch (queryError: any) {
      console.error('Direct profile failed, falling back to queue:', queryError.message);
      // Fallback to queue if direct query fails
      await ProfileQueue.add('profile-one', { assetId }, { removeOnComplete: 100, removeOnFail: 100 });
      ok(res, { queued: true });
    }
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});
router.get('/catalog/assets/:id/profile', async (req, res) => {
  try {
    const assetId = String(req.params.id);
    const runs = await cpdb.query(
      `SELECT * FROM catalog_profile_runs WHERE asset_id=$1 ORDER BY started_at DESC LIMIT 1`, [assetId]
    );
    const cols = await cpdb.query(
      `SELECT column_name, null_frac, distinct_frac, min_value, max_value, avg_length, pii_type, inferred_type
       FROM catalog_column_profiles WHERE asset_id=$1 ORDER BY column_name`, [assetId]
    );
    ok(res, { run: runs.rows[0] || null, columns: cols.rows });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Search
router.get('/catalog/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return ok(res, { items: [] });
    const limit = Math.min(50, Number(req.query.limit || 20));
    const sql = `
      SELECT id, datasource_id, asset_type, schema_name, table_name, display_name, description, tags,
             ts_rank(search, plainto_tsquery('simple',$1)) AS rank
      FROM catalog_assets
      WHERE search @@ plainto_tsquery('simple',$1)
      ORDER BY rank DESC, updated_at DESC
      LIMIT $2
    `;
    const { rows } = await cpdb.query(sql, [q, limit]);
    ok(res, { items: rows });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Lineage
router.get('/catalog/assets/:id/lineage', async (req, res) => {
  try {
    const id = String(req.params.id);
    const { rows } = await cpdb.query(
      `SELECT upstream_asset_id, downstream_asset_id, edge_type, confidence
       FROM catalog_edges
       WHERE upstream_asset_id=$1 OR downstream_asset_id=$1`, [id]
    );
    ok(res, { edges: rows });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Metrics (matview if present, fallback otherwise)
router.get('/catalog/metrics', async (_req: Request, res: Response) => {
  try {
    const { rows } = await cpdb.query(`
      WITH ensure AS (
        SELECT 1
        FROM pg_matviews
        WHERE matviewname = 'catalog_metrics'
      )
      SELECT * FROM catalog_metrics LIMIT 1;
    `).catch(async () => {
      const fb = await cpdb.query(`
        SELECT COUNT(*)::bigint AS total,
               COUNT(*) FILTER (WHERE asset_type='table')::bigint AS tables,
               COUNT(*) FILTER (WHERE asset_type='view')::bigint AS views
        FROM catalog_assets;
      `);
      return { rows: [fb.rows[0]] } as any;
    });

    ok(res, rows?.[0] || { total: 0, tables: 0, views: 0 });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// IMPORTANT: More specific routes must be defined BEFORE general /:id routes

// Preview data from asset
router.get('/catalog/assets/:id/preview', async (req: Request, res: Response) => {
  try {
    const { rows: assets } = await cpdb.query(
      `SELECT datasource_id, schema_name, table_name, database_name, asset_type FROM catalog_assets WHERE id::text = $1`,
      [req.params.id]
    );
    if (!assets[0]) return fail(res, 404, 'Asset not found');

    const asset = assets[0];
    const limit = Math.min(100, Number(req.query.limit || 20));
    const { type, cfg } = await getDataSourceById(asset.datasource_id);

    // Use database_name from the asset, fallback to cfg.database
    const targetDatabase = asset.database_name || cfg.database;

    let previewData: any[] = [];

    if (type === 'postgresql') {
      const client = new PgClient({
        host: cfg.host,
        port: Number(cfg.port ?? 5432),
        database: targetDatabase,
        user: cfg.username,
        password: cfg.password,
        ssl: cfg.ssl === false || cfg.ssl?.mode === 'disable' ? undefined : cfg.ssl,
      });
      await client.connect();
      const result = await client.query(`SELECT * FROM "${asset.schema_name}"."${asset.table_name}" LIMIT $1`, [limit]);
      previewData = result.rows;
      await client.end();
    } else if (type === 'mssql') {
      const pool = await mssql.connect({
        server: cfg.host || cfg.server,
        port: Number(cfg.port ?? 1433),
        database: targetDatabase,
        user: cfg.username || cfg.user,
        password: cfg.password,
        options: { encrypt: cfg.ssl !== false, trustServerCertificate: true, ...(cfg.options || {}) }
      });
      const result = await pool.request().query(`SELECT TOP ${limit} * FROM [${asset.schema_name}].[${asset.table_name}]`);
      previewData = result.recordset;
      await pool.close();
    }

    ok(res, { rows: previewData, rowCount: previewData.length });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Generate SQL query for asset
router.get('/catalog/assets/:id/query', async (req: Request, res: Response) => {
  try {
    const { rows } = await cpdb.query(
      `SELECT datasource_id, schema_name, table_name, asset_type FROM catalog_assets WHERE id::text = $1`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 404, 'Asset not found');

    const asset = rows[0];
    const { type } = await getDataSourceById(asset.datasource_id);

    let query = '';
    if (type === 'postgresql') {
      query = `SELECT *\nFROM "${asset.schema_name}"."${asset.table_name}"\nLIMIT 100;`;
    } else if (type === 'mssql') {
      query = `SELECT TOP 100 *\nFROM [${asset.schema_name}].[${asset.table_name}];`;
    }

    ok(res, { query, dialect: type });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Bookmark asset
router.post('/catalog/assets/:id/bookmark', async (req: Request, res: Response) => {
  try {
    const assetId = req.params.id;
    const userId = (req as any).user?.id || 'system'; // Get from auth middleware

    // Check if already bookmarked (using object_id which is the actual column name)
    const { rows: existing } = await cpdb.query(
      `SELECT id FROM catalog_bookmarks WHERE object_id::text = $1 AND user_id = $2`,
      [assetId, userId]
    );

    if (existing.length > 0) {
      // Remove bookmark
      await cpdb.query(`DELETE FROM catalog_bookmarks WHERE id = $1`, [existing[0].id]);
      // Update bookmark count if column exists
      const { rows: assetCheck } = await cpdb.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name='catalog_assets' AND column_name='bookmark_count'`
      );
      if (assetCheck.length > 0) {
        await cpdb.query(`UPDATE catalog_assets SET bookmark_count = GREATEST(0, bookmark_count - 1) WHERE id::text = $1`, [assetId]);
      }
      ok(res, { bookmarked: false });
    } else {
      // Add bookmark (using object_id column)
      await cpdb.query(
        `INSERT INTO catalog_bookmarks (object_id, user_id, created_at) VALUES ($1::bigint, $2, now())`,
        [assetId, userId]
      );
      // Update bookmark count if column exists
      const { rows: assetCheck } = await cpdb.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name='catalog_assets' AND column_name='bookmark_count'`
      );
      if (assetCheck.length > 0) {
        await cpdb.query(`UPDATE catalog_assets SET bookmark_count = bookmark_count + 1 WHERE id::text = $1`, [assetId]);
      }
      ok(res, { bookmarked: true });
    }
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Rate asset
router.post('/catalog/assets/:id/rate', async (req: Request, res: Response) => {
  try {
    const assetId = req.params.id;
    const userId = (req as any).user?.id || '00000000-0000-0000-0000-000000000000'; // Use null UUID for system
    const { rating } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return fail(res, 400, 'Rating must be between 1 and 5');
    }

    // Upsert rating (insert or update if exists)
    await cpdb.query(
      `INSERT INTO asset_ratings (asset_id, user_id, rating, tenant_id, created_at, updated_at)
       VALUES ($1::bigint, $2::uuid, $3, 1, now(), now())
       ON CONFLICT (asset_id, user_id)
       DO UPDATE SET rating = $3, updated_at = now()`,
      [assetId, userId, rating]
    );

    // Update average rating on catalog_assets if rating_avg column exists
    const { rows: avgResult } = await cpdb.query(
      `SELECT AVG(rating)::numeric(3,2) as avg_rating, COUNT(*) as count
       FROM asset_ratings
       WHERE asset_id = $1::bigint`,
      [assetId]
    );

    const avgRating = avgResult[0]?.avg_rating || 0;
    const ratingCount = avgResult[0]?.count || 0;

    // Check if rating_avg column exists before updating
    const { rows: columnCheck } = await cpdb.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='catalog_assets' AND column_name='rating_avg'`
    );

    if (columnCheck.length > 0) {
      await cpdb.query(
        `UPDATE catalog_assets SET rating_avg = $1 WHERE id::text = $2`,
        [avgRating, assetId]
      );
    }

    ok(res, {
      rating,
      avgRating: Number(avgRating),
      ratingCount: Number(ratingCount)
    });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Update description (with AI generation option)
router.post('/catalog/assets/:id/description', async (req: Request, res: Response) => {
  try {
    const assetId = req.params.id;
    const { description, generate } = req.body;

    if (generate) {
      // AI generation - get asset details and generate description
      const { rows } = await cpdb.query(
        `SELECT a.id, a.asset_type, a.schema_name, a.table_name, a.row_count, a.column_count,
                jsonb_agg(c.column_name ORDER BY c.ordinal) FILTER (WHERE c.column_name IS NOT NULL) AS columns
         FROM catalog_assets a
         LEFT JOIN catalog_columns c ON c.asset_id = a.id
         WHERE a.id::text = $1
         GROUP BY a.id, a.asset_type, a.schema_name, a.table_name, a.row_count, a.column_count`,
        [assetId]
      );
      if (!rows[0]) return fail(res, 404, 'Asset not found');

      const asset = rows[0];

      // Generate an intelligent description by analyzing columns
      const assetType = asset.asset_type === 'table' ? 'table' : 'view';
      const tableName = asset.table_name || 'unknown';
      const schemaName = asset.schema_name || 'public';
      const colCount = asset.column_count || 0;
      const rowCount = asset.row_count;
      const columns = (asset.columns || []).map((c: string) => c.toLowerCase());

      // Analyze columns to understand purpose
      const hasId = columns.some(c => c === 'id' || c.endsWith('_id'));
      const hasTenantId = columns.some(c => c === 'tenant_id');
      const hasTimestamps = columns.some(c => c === 'created_at' || c === 'updated_at' || c === 'timestamp');
      const hasUserId = columns.some(c => c === 'user_id' || c === 'created_by' || c === 'owner_id');
      const hasMetadata = columns.some(c => c.includes('metadata') || c.includes('properties') || c.includes('tags'));

      // Determine purpose based on table name and columns
      let purpose = '';
      let details = '';
      const lowerName = tableName.toLowerCase();

      // Catalog/Metadata tables
      if (lowerName.includes('catalog_columns')) {
        purpose = 'Stores metadata about columns in data assets';
        details = 'Tracks column definitions including data types, nullability, ordinal positions, and descriptions for tables discovered by the data catalog. Essential for schema documentation and data lineage.';
      } else if (lowerName.includes('catalog_assets')) {
        purpose = 'Central registry of all data assets';
        details = 'Maintains comprehensive metadata for tables, views, and other data objects including schema information, row counts, quality scores, and ownership. Core table for the data catalog system.';
      } else if (lowerName.includes('catalog') && lowerName.includes('bookmark')) {
        purpose = 'User bookmarks for data assets';
        details = 'Allows users to save and organize their frequently accessed or important data assets for quick reference.';
      } else if (lowerName.includes('catalog') && lowerName.includes('comment')) {
        purpose = 'Collaborative comments on data assets';
        details = 'Enables team collaboration through comments and discussions on data assets, supporting knowledge sharing and data governance.';
      } else if (lowerName.includes('catalog') && lowerName.includes('rating')) {
        purpose = 'User ratings and feedback for data assets';
        details = 'Collects quality ratings and feedback from users to help assess data asset trustworthiness and usefulness.';
      } else if (lowerName.includes('catalog') && lowerName.includes('tag')) {
        purpose = 'Classification tags for data assets';
        details = 'Provides flexible tagging system for organizing and categorizing data assets by domain, sensitivity, or custom attributes.';
      }
      // Data Source tables
      else if (lowerName.includes('data_source') || lowerName.includes('datasource')) {
        purpose = 'Data source connection registry';
        details = 'Manages connection details, credentials, and configuration for external data sources like databases, APIs, and file systems.';
      } else if (lowerName.includes('connection')) {
        purpose = 'Database connection management';
        details = 'Stores and manages database connection parameters including hosts, ports, authentication details, and SSL configurations.';
      }
      // Pipeline tables
      else if (lowerName.includes('pipeline') && !lowerName.includes('run')) {
        purpose = 'Data pipeline definitions';
        details = 'Defines ETL/ELT pipeline configurations including source/target mappings, transformation logic, and scheduling parameters.';
      } else if (lowerName.includes('pipeline_run') || lowerName.includes('pipeline') && lowerName.includes('execution')) {
        purpose = 'Pipeline execution history';
        details = 'Tracks pipeline run history including start times, completion status, error logs, and performance metrics for monitoring and debugging.';
      }
      // Quality tables
      else if (lowerName.includes('data_quality') || lowerName.includes('quality_issue')) {
        purpose = 'Data quality issue tracking';
        details = 'Records detected data quality problems such as null values, duplicates, outliers, and schema violations with severity levels and resolution status.';
      } else if (lowerName.includes('quality_rule')) {
        purpose = 'Data quality rule definitions';
        details = 'Defines validation rules and thresholds for automated data quality checks including completeness, accuracy, and consistency metrics.';
      }
      // Audit/Log tables
      else if (lowerName.includes('audit_log') || lowerName.includes('audit_trail')) {
        purpose = 'Audit trail for compliance';
        details = 'Maintains immutable record of user actions, data changes, and system events for security auditing and regulatory compliance.';
      } else if (lowerName.includes('activity_log') || lowerName.includes('event_log')) {
        purpose = 'System activity logging';
        details = 'Captures user activities, API calls, and system events for analytics, troubleshooting, and usage monitoring.';
      }
      // Lineage/Dependency tables
      else if (lowerName.includes('lineage')) {
        purpose = 'Data lineage tracking';
        details = 'Maps upstream and downstream dependencies between data assets to enable impact analysis and data provenance tracking.';
      }
      // Access Control tables
      else if (lowerName.includes('permission') || lowerName.includes('access_control')) {
        purpose = 'Access control and permissions';
        details = 'Manages user and role-based access permissions to data assets ensuring proper data governance and security.';
      } else if (lowerName.includes('role')) {
        purpose = 'Role definitions';
        details = 'Defines user roles and their associated permissions for role-based access control (RBAC).';
      }
      // User/Auth tables
      else if (lowerName.includes('user') && !lowerName.includes('_user_')) {
        purpose = 'User account management';
        const authCols = columns.filter(c => c.includes('password') || c.includes('email') || c.includes('auth'));
        details = authCols.length > 0
          ? 'Stores user account information including authentication credentials, profile details, and account status.'
          : 'Stores user profile information and account details for the application.';
      }
      // Generic fallback with column analysis
      else {
        // Analyze columns to infer purpose
        const colPatterns: string[] = [];
        if (columns.some(c => c.includes('price') || c.includes('amount') || c.includes('cost'))) colPatterns.push('financial data');
        if (columns.some(c => c.includes('status') || c.includes('state'))) colPatterns.push('status tracking');
        if (columns.some(c => c.includes('name') || c.includes('title'))) colPatterns.push('named entities');
        if (columns.some(c => c.includes('description') || c.includes('comment'))) colPatterns.push('descriptive information');
        if (columns.some(c => c.includes('date') || c.includes('time'))) colPatterns.push('temporal data');
        if (columns.some(c => c.includes('count') || c.includes('total'))) colPatterns.push('metrics/aggregations');

        purpose = `Stores ${tableName.replace(/_/g, ' ')} data`;
        if (colPatterns.length > 0) {
          details = `Manages ${colPatterns.slice(0, 2).join(' and ')} with ${colCount} attributes.`;
        } else {
          details = `Contains ${colCount} fields for storing and managing ${tableName.replace(/_/g, ' ')} information.`;
        }
      }

      // Build comprehensive description
      let desc = purpose + '. ' + details;

      // Add key columns if available
      if (asset.columns && asset.columns.length > 0) {
        const keyColumns = asset.columns.slice(0, 5);
        desc += ` Key fields include: ${keyColumns.join(', ')}`;
        if (asset.columns.length > 5) desc += `, and ${asset.columns.length - 5} more`;
        desc += '.';
      }

      // Add row count context
      if (rowCount !== null && rowCount !== undefined) {
        if (rowCount == 0) {
          desc += ' Currently empty.';
        } else if (rowCount < 100) {
          desc += ` Contains ${rowCount.toLocaleString()} record${rowCount !== 1 ? 's' : ''}.`;
        } else if (rowCount < 10000) {
          desc += ` Actively used with ${Math.floor(rowCount / 1000)}K+ records.`;
        } else {
          desc += ` Large production dataset with ${(rowCount / 1000000).toFixed(1)}M+ records.`;
        }
      }

      const generatedDesc = desc;

      await cpdb.query(
        `UPDATE catalog_assets SET description = $1, updated_at = now() WHERE id::text = $2`,
        [generatedDesc, assetId]
      );

      ok(res, { description: generatedDesc });
    } else if (description !== undefined) {
      // Manual description update - the trigger will auto-update trust_score
      await cpdb.query(
        `UPDATE catalog_assets SET description = $1, updated_at = now() WHERE id::text = $2`,
        [description, assetId]
      );

      ok(res, { description });
    } else {
      fail(res, 400, 'description or generate flag required');
    }
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

// Sync (harvest)
router.post('/data-sources/:id/sync', async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const doAsync = String(req.query.async ?? 'false') === 'true';
  const targetDatabase = req.query.database ? String(req.query.database) : undefined;

  try {
    const { tenantId, type, cfg, idText } = await getDataSourceById(id);

    const run = async () => {
      if (type === 'postgresql') return ingestPostgres(tenantId, idText, cfg, targetDatabase);
      if (type === 'mssql') return ingestMSSQL(tenantId, idText, cfg, targetDatabase);
      throw new Error(`Unsupported datasource type: ${type}`);
    };

    if (doAsync) {
      res.status(202).json({ success: true, syncId: `sync_${Date.now()}` });
      run()
        .then(async () => {
          // Update lastSyncAt after async sync completes
          await cpdb.query(
            `UPDATE data_sources SET last_sync_at = now(), updated_at = now() WHERE id::text = $1`,
            [id]
          );
        })
        .catch((e) => console.error('[data-service] async sync failed', e));
      return;
    }

    const result = await run();

    // Update lastSyncAt after synchronous sync completes
    await cpdb.query(
      `UPDATE data_sources SET last_sync_at = now(), updated_at = now() WHERE id::text = $1`,
      [id]
    );

    ok(res, { ...result, syncId: `sync_${Date.now()}_${id}` });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

/* -------------------------- Dual registration --------------------- */
// Catalog summary endpoint - returns counts by type based on filters
router.get('/catalog/summary', async (req: Request, res: Response) => {
  try {
    const q = req.query as Record<string, string|undefined>;
    const where: string[] = [];
    const p: any[] = [];
    let i = 1;

    // Apply same filters as listAssets
    if (q.search) { where.push(`(ca.schema_name || '.' || ca.table_name || ' ' || coalesce(ca.description,'')) ILIKE $${i++}`); p.push(`%${q.search}%`); }
    const dsId = q.datasourceId || q.dataSourceId;
    if (dsId){ where.push(`ca.datasource_id::text = $${i++}`); p.push(dsId); }

    // Support multiple databases
    if (q.databases) {
      const dbList = q.databases.split(',').map(d => d.trim()).filter(Boolean);
      if (dbList.length > 0) {
        where.push(`ca.database_name = ANY($${i++})`);
        p.push(dbList);
      }
    } else if (q.database) {
      where.push(`ca.database_name = $${i++}`);
      p.push(q.database);
    }

    if (q.schema) { where.push(`ca.schema_name = $${i++}`); p.push(q.schema); }

    // Object type filter
    if (q.objectType === 'user') {
      where.push(`ca.schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')`);
      where.push(`ca.database_name NOT IN ('master', 'tempdb', 'model', 'msdb')`); // Exclude system databases
    } else if (q.objectType === 'system') {
      where.push(`(ca.schema_name IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast') OR ca.database_name IN ('master', 'tempdb', 'model', 'msdb'))`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    // Get counts by type and total rows
    const countsSql = `
      SELECT
        COUNT(*) FILTER (WHERE asset_type = 'table') as table_count,
        COUNT(*) FILTER (WHERE asset_type = 'view') as view_count,
        COUNT(*) as total_count,
        COUNT(DISTINCT datasource_id) as source_count,
        COUNT(DISTINCT schema_name) as schema_count,
        SUM(COALESCE(row_count, 0)) as total_rows
      FROM catalog_assets ca
      ${whereSql}
    `;

    const result = await cpdb.query(countsSql, p);
    const counts = result.rows[0];

    ok(res, {
      totalAssets: Number(counts.total_count || 0),
      totalSources: Number(counts.source_count || 0),
      totalSchemas: Number(counts.schema_count || 0),
      totalRows: Number(counts.total_rows || 0),
      byType: {
        table: Number(counts.table_count || 0),
        view: Number(counts.view_count || 0),
      }
    });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

/* These ensure the FE can call either /api/catalog/assets or /api/assets */
// IMPORTANT: List and export routes (no :id) must come before /:id routes
router.get('/catalog/databases', getAllDatabases);
router.get('/catalog/assets/export', exportAssets);
router.get('/assets/export', exportAssets);
router.get('/catalog/assets', listAssets);
router.get('/assets', listAssets);

// General asset detail route (must come AFTER all specific /assets/:id/* routes)
router.get('/catalog/assets/:id', getAsset);
router.get('/assets/:id', getAsset);

// Note: Specific routes like /catalog/assets/:id/preview are defined above
// and must be registered BEFORE the general /:id route to avoid conflicts

export default router;
