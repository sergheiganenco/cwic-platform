// backend/data-service/src/routes/catalog.ts
import { Request, Response, Router } from 'express';
import mssql from 'mssql';
import { Client as PgClient, Pool, QueryResult } from 'pg';
import { z } from 'zod';
import { ProfileQueue } from '../queue';

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
    `SELECT id::text AS id, COALESCE(tenant_id, 1) AS tenant_id, type,
            COALESCE(config, connection_config) AS cfg
     FROM data_sources WHERE id::text = $1`,
    [id]
  );
  const row = rows[0];
  if (!row) throw new Error('Data source not found');
  return { tenantId: row.tenant_id ?? 1, type: row.type, cfg: (row as any).cfg || {}, idText: (row as any).id };
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

  const counts = await src.query(`
    SELECT schemaname AS table_schema, relname AS table_name, n_live_tup AS row_estimate
    FROM pg_stat_user_tables
  `);
  await src.end();

  const cnt = new Map<string, number>();
  counts.rows.forEach((r: any) => cnt.set(`${r.table_schema}.${r.table_name}`, Number(r.row_estimate)));

  let assets = 0, cols = 0;
  for (const t of tables.rows) {
    const assetType = t.table_type === 'VIEW' ? 'view' : 'table';
    const rowCount = cnt.get(`${t.table_schema}.${t.table_name}`) ?? null;

    const ar: QueryResult<{ id: string }> = await cpdb.query(
      `INSERT INTO catalog_assets
         (tenant_id, datasource_id, asset_type, schema_name, table_name, row_count, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (tenant_id, datasource_id, asset_type, schema_name, table_name)
       DO UPDATE SET row_count = EXCLUDED.row_count, updated_at = now()
       RETURNING id`,
      [tenantId, dataSourceId, assetType, t.table_schema, t.table_name, rowCount]
    );
    const assetId = ar.rows[0].id; assets++;

    const colsForTable = columns.rows.filter((c: any) => c.table_schema === t.table_schema && c.table_name === t.table_name);
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
    server: cfg.host,
    port: Number(cfg.port ?? 1433),
    database: cfg.database,
    user: cfg.username,
    password: cfg.password,
    options: { encrypt: true, trustServerCertificate: true, ...(cfg.options || {}) }
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

    const ar: QueryResult<{ id: string }> = await cpdb.query(
      `INSERT INTO catalog_assets
         (tenant_id, datasource_id, asset_type, schema_name, table_name, row_count, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT (tenant_id, datasource_id, asset_type, schema_name, table_name)
       DO UPDATE SET row_count = EXCLUDED.row_count, updated_at = now()
       RETURNING id`,
      [tenantId, dataSourceId, t.asset_type, t.schema_name, t.object_name, rowCount]
    );
    const assetId = ar.rows[0].id; assets++;

    const colsForTable = (columns as any[]).filter(c => c.schema_name === t.schema_name && c.object_name === t.object_name);
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
    const sortCol = sortBy === 'name' ? 'table_name'
                    : sortBy === 'updatedAt' ? 'updated_at'
                    : sortBy === 'createdAt' ? 'created_at'
                    : sortBy === 'quality' ? 'quality'
                    : sortBy === 'owner' ? 'owner'
                    : 'table_name';

    const p: any[] = [];
    let i = 1;
    const where: string[] = [];

    if (q.search) { where.push(`(schema_name || '.' || table_name || ' ' || coalesce(description,'')) ILIKE $${i++}`); p.push(`%${q.search}%`); }
    if (q.type)   { where.push(`asset_type = $${i++}`); p.push(q.type); }
    if (q.owner)  { where.push(`owner = $${i++}`); p.push(q.owner); }
    if (q.quality){ where.push(`quality = $${i++}`); p.push(q.quality); }
    if (q.classification){ where.push(`classification = $${i++}`); p.push(q.classification); }
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

    const listSql = `
      SELECT id, datasource_id, asset_type, schema_name, table_name, owner, quality, classification, tags,
             row_count, description, created_at, updated_at, display_name
      FROM catalog_assets
      ${whereSql}
      ORDER BY ${sortCol} ${sortOrder}
      LIMIT ${limit} OFFSET ${offset};`;

    const countSql = `SELECT COUNT(*)::bigint AS total FROM catalog_assets ${whereSql};`;

    const [list, total] = await Promise.all([cpdb.query(listSql, p), cpdb.query(countSql, p)]);
    const t = Number(total.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(t / limit));
    const payload = { items: list.rows, pagination: { page, limit, total: t, totalPages } };

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
    if (q.owner)  { where.push(`owner = $${i++}`); p.push(q.owner); }
    if (q.quality){ where.push(`quality = $${i++}`); p.push(q.quality); }
    if (q.classification){ where.push(`classification = $${i++}`); p.push(q.classification); }
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

// Export CSV
router.get('/catalog/assets/export', exportAssets);

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
router.get('/catalog/assets', listAssets);
router.get('/assets', listAssets);

router.get('/catalog/assets/:id', getAsset);
router.get('/assets/:id', getAsset);

router.get('/catalog/assets/export', exportAssets);
router.get('/assets/export', exportAssets);

export default router;
