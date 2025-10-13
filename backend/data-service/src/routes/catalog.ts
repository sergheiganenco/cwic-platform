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
  config?: any;
  connection_config?: any;
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

async function ingestPostgres(tenantId: number, dataSourceId: string, cfg: any) {
  const src = new PgClient({
    host: cfg.host,
    port: Number(cfg.port ?? 5432),
    database: cfg.database,
    user: cfg.username,
    password: cfg.password,
    ssl: cfg.ssl === false || cfg.ssl?.mode === 'disable' ? undefined : cfg.ssl,
  });
  await src.connect();

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

  await src.end();

  let assets = 0, cols = 0;
  for (const t of tables.rows) {
    const assetType = t.table_type === 'VIEW' ? 'view' : 'table';
    const rowCount = cnt.get(`${t.table_schema}.${t.table_name}`) ?? null;

    const colsForTable = columns.rows.filter((c: any) => c.table_schema === t.table_schema && c.table_name === t.table_name);
    const columnCount = colsForTable.length;

    const ar: QueryResult<{ id: string }> = await cpdb.query(
      `INSERT INTO catalog_assets
         (tenant_id, datasource_id, asset_type, schema_name, table_name, row_count, column_count, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (tenant_id, datasource_id, asset_type, schema_name, table_name)
       DO UPDATE SET row_count = EXCLUDED.row_count, column_count = EXCLUDED.column_count, updated_at = now()
       RETURNING id`,
      [tenantId, dataSourceId, assetType, t.table_schema, t.table_name, rowCount, columnCount]
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

  return { assets, columns: cols };
}

async function ingestMSSQL(tenantId: number, dataSourceId: string, cfg: any) {
  const pool = await mssql.connect({
    server: cfg.host || cfg.server,
    port: Number(cfg.port ?? 1433),
    database: cfg.database,
    user: cfg.username || cfg.user,
    password: cfg.password,
    options: { encrypt: cfg.ssl !== false, trustServerCertificate: true, ...(cfg.options || {}) }
  });

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

  const counts = (await pool.request().query(`
    SELECT s.name AS schema_name, t.name AS object_name, SUM(p.rows) AS row_count
    FROM sys.tables t
    JOIN sys.partitions p ON t.object_id=p.object_id AND p.index_id IN (0,1)
    JOIN sys.schemas s ON t.schema_id=s.schema_id
    GROUP BY s.name, t.name
  `)).recordset;

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
         (tenant_id, datasource_id, asset_type, schema_name, table_name, row_count, column_count, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now())
       ON CONFLICT (tenant_id, datasource_id, asset_type, schema_name, table_name)
       DO UPDATE SET row_count = EXCLUDED.row_count, column_count = EXCLUDED.column_count, updated_at = now()
       RETURNING id`,
      [tenantId, dataSourceId, t.asset_type, t.schema_name, t.object_name, rowCount, columnCount]
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

  return { assets, columns: cols };
}

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
    if (q.schema) { where.push(`ca.schema_name = $${i++}`); p.push(q.schema); }
    // Object type filter: user (exclude system schemas) or system (only system schemas)
    if (q.objectType === 'user') {
      where.push(`ca.schema_name NOT IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')`);
    } else if (q.objectType === 'system') {
      where.push(`ca.schema_name IN ('sys', 'information_schema', 'pg_catalog', 'pg_toast')`);
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

    const listSql = `
      SELECT ca.id, ca.datasource_id, ca.asset_type, ca.schema_name, ca.table_name, ca.tags,
             ca.row_count, ca.column_count, ca.description, ca.created_at, ca.updated_at,
             ca.trust_score, ca.quality_score, ca.view_count, ca.owner_id, ca.rating_avg,
             ca.bookmark_count, ca.comment_count, ca.last_profiled_at,
             ds.name as datasource_name, ds.type as datasource_type
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
    const { rows } = await cpdb.query(
      `SELECT a.*, jsonb_agg(c ORDER BY c.ordinal) AS columns
       FROM catalog_assets a
       LEFT JOIN catalog_columns c ON c.asset_id = a.id
       WHERE a.id::text = $1
       GROUP BY a.id`,
      [req.params.id]
    );
    if (!rows[0]) return fail(res, 404, 'Not found');
    ok(res, rows[0]);
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
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const { rows } = await cpdb.query(
      `SELECT datasource_id::text AS datasource_id, asset_type, schema_name, table_name, display_name, owner, quality, classification, row_count, tags, description, updated_at
       FROM catalog_assets
       ${whereSql}
       ORDER BY schema_name, table_name`,
      p
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="assets-${Date.now()}.csv"`);

    const header = [
      'datasource_id','asset_type','schema_name','table_name','display_name',
      'owner','quality','classification','row_count','tags','description','updated_at'
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
        esc(r.schema_name),
        esc(r.table_name),
        esc(r.display_name ?? ''),
        esc(r.owner ?? ''),
        esc(r.quality ?? ''),
        esc(r.classification ?? ''),
        esc(r.row_count ?? ''),
        esc(tags),
        esc(r.description ?? ''),
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

// Profile launch & read
router.post('/catalog/assets/:id/profile', async (req, res) => {
  try {
    const assetId = String(req.params.id);
    await ProfileQueue.add('profile-one', { assetId }, { removeOnComplete: 100, removeOnFail: 100 });
    ok(res, { queued: true });
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
      `SELECT datasource_id, schema_name, table_name, asset_type FROM catalog_assets WHERE id::text = $1`,
      [req.params.id]
    );
    if (!assets[0]) return fail(res, 404, 'Asset not found');

    const asset = assets[0];
    const limit = Math.min(100, Number(req.query.limit || 20));
    const { type, cfg } = await getDataSourceById(asset.datasource_id);

    let previewData: any[] = [];

    if (type === 'postgresql') {
      const client = new PgClient({
        host: cfg.host,
        port: Number(cfg.port ?? 5432),
        database: cfg.database,
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
        database: cfg.database,
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

    // Check if already bookmarked
    const { rows: existing } = await cpdb.query(
      `SELECT id FROM catalog_bookmarks WHERE asset_id::text = $1 AND user_id = $2`,
      [assetId, userId]
    );

    if (existing.length > 0) {
      // Remove bookmark
      await cpdb.query(`DELETE FROM catalog_bookmarks WHERE id = $1`, [existing[0].id]);
      await cpdb.query(`UPDATE catalog_assets SET bookmark_count = GREATEST(0, bookmark_count - 1) WHERE id::text = $1`, [assetId]);
      ok(res, { bookmarked: false });
    } else {
      // Add bookmark
      await cpdb.query(
        `INSERT INTO catalog_bookmarks (asset_id, user_id, created_at) VALUES ($1::uuid, $2, now())`,
        [assetId, userId]
      );
      await cpdb.query(`UPDATE catalog_assets SET bookmark_count = bookmark_count + 1 WHERE id::text = $1`, [assetId]);
      ok(res, { bookmarked: true });
    }
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

  try {
    const { tenantId, type, cfg, idText } = await getDataSourceById(id);

    const run = async () => {
      if (type === 'postgresql') return ingestPostgres(tenantId, idText, cfg);
      if (type === 'mssql') return ingestMSSQL(tenantId, idText, cfg);
      throw new Error(`Unsupported datasource type: ${type}`);
    };

    if (doAsync) {
      res.status(202).json({ success: true, syncId: `sync_${Date.now()}` });
      run().catch((e) => console.error('[data-service] async sync failed', e));
      return;
    }

    const result = await run();
    ok(res, { ...result });
  } catch (e: any) {
    fail(res, 500, e.message);
  }
});

/* -------------------------- Dual registration --------------------- */
/* These ensure the FE can call either /api/catalog/assets or /api/assets */
// IMPORTANT: List and export routes (no :id) must come before /:id routes
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
