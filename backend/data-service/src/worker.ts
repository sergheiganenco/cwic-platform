import { Worker } from 'bullmq';
import 'dotenv/config';
import mssql from 'mssql';
import { Client as PgClient, Pool } from 'pg';
import { decryptConfig, isEncryptedConfig } from './utils/secrets';

const cpdb = new Pool({ connectionString: process.env.DATABASE_URL });
const connection = { connection: { url: process.env.REDIS_URL || 'redis://redis:6379' } };

// Helpers to fetch DS config
async function getAssetAndDS(assetId: string) {
  const { rows } = await cpdb.query(`
    SELECT a.id, a.schema_name, a.table_name, a.datasource_id, ds.type, COALESCE(ds.config, ds.connection_config) AS cfg
    FROM catalog_assets a JOIN data_sources ds ON ds.id = a.datasource_id
    WHERE a.id = $1
  `, [assetId]);
  return rows[0];
}

// PII heuristics by name/value
const piiNameMatchers = [
  { type: 'email', re: /(email|e[-_ ]?mail)/i },
  { type: 'ssn',   re: /(ssn|social[_-]?security)/i },
  { type: 'cc',    re: /(card|cc|credit)/i },
  { type: 'phone', re: /(phone|mobile|cell|tel)/i },
  { type: 'iban',  re: /(iban)/i },
];

const piiValueMatchers = [
  { type: 'email', re: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i },
  { type: 'cc',    re: /^(?:\d[ -]*?){13,19}$/ },
  { type: 'ssn',   re: /^\d{3}-?\d{2}-?\d{4}$/ },
  { type: 'phone', re: /^\+?\d[\d -]{7,}$/ },
  { type: 'iban',  re: /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/i }
];

function inferPIIByName(col: string): string | null {
  const m = piiNameMatchers.find(m => m.re.test(col));
  return m?.type || null;
}
function inferPIIByValues(samples: any[]): string | null {
  const s = String(samples?.find(v => v != null) ?? '');
  const m = piiValueMatchers.find(m => m.re.test(s));
  return m?.type || null;
}

// ------- Profile Worker -------
new Worker('catalog:profile', async job => {
  const { assetId } = job.data as { assetId: string };
  const asset = await getAssetAndDS(assetId);
  if (!asset) throw new Error('Asset not found');

  const { type, cfg, schema_name, table_name } = asset;
  let connection = cfg;
  if (typeof connection === 'string') {
    try {
      connection = JSON.parse(connection);
    } catch {
      connection = {};
    }
  }
  if (isEncryptedConfig(connection)) {
    connection = decryptConfig(connection);
  }
  const safeCfg: any = connection || {};

  let columns: Array<{ name: string, data_type: string }> = [];
  let rowsCount = 0;

  const runIdRes = await cpdb.query(`INSERT INTO catalog_profile_runs (asset_id, status) VALUES ($1,'running') RETURNING id`, [assetId]);
  const runId = runIdRes.rows[0].id;

  try {
    if (type === 'postgresql') {
      const cli = new PgClient({
        host: safeCfg.host, port: Number(safeCfg.port ?? 5432),
        database: safeCfg.database, user: safeCfg.username, password: safeCfg.password,
        ssl: safeCfg.ssl === false || safeCfg.ssl?.mode === 'disable' ? undefined : safeCfg.ssl
      });
      await cli.connect();

      const cols = await cli.query(`
        SELECT column_name as name, data_type
        FROM information_schema.columns
        WHERE table_schema=$1 AND table_name=$2
        ORDER BY ordinal_position`, [schema_name, table_name]);
      columns = cols.rows;

      // Use parameterized query to prevent SQL injection
      const escapedIdentifier = `"${schema_name.replace(/"/g, '""')}"."${table_name.replace(/"/g, '""')}"`;
      const rc = await cli.query(`SELECT reltuples::bigint AS row_est FROM pg_class WHERE oid = $1::regclass`, [escapedIdentifier]);
      rowsCount = Number(rc.rows?.[0]?.row_est || 0);

      for (const col of columns) {
        // sample 1% or up to 10k rows
        // Use parameterized identifiers to prevent SQL injection
        const escapedColumn = col.name.replace(/"/g, '""');
        const escapedSchema = schema_name.replace(/"/g, '""');
        const escapedTable = table_name.replace(/"/g, '""');
        const sample = await cli.query(`
          SELECT "${escapedColumn}" FROM "${escapedSchema}"."${escapedTable}"
          TABLESAMPLE SYSTEM (1) LIMIT 10000
        `).catch(() => ({ rows: [] as any[] }));

        const vals = sample.rows.map(r => r[col.name]).filter(v => v !== undefined);
        const total = Math.max(vals.length, 1);
        const nulls = vals.filter(v => v === null).length;
        const nonNull = vals.filter(v => v !== null).map(v => String(v));

        const distinct = new Set(nonNull.map(v => v)).size;
        const lengths = nonNull.map(s => s.length);
        const minv = nonNull.length ? nonNull.reduce((a,b)=> a < b ? a : b) : null;
        const maxv = nonNull.length ? nonNull.reduce((a,b)=> a > b ? a : b) : null;
        const avgl = nonNull.length ? (lengths.reduce((a,b)=>a+b,0) / nonNull.length) : null;

        const piiByName = inferPIIByName(col.name);
        const piiByValues = inferPIIByValues(nonNull.slice(0,50));
        const pii = piiByValues || piiByName;

        await cpdb.query(`
          INSERT INTO catalog_column_profiles (asset_id, column_name, null_frac, distinct_frac, min_value, max_value, avg_length, sample_values, inferred_type, pii_type, pattern, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
          ON CONFLICT (asset_id, column_name) DO UPDATE SET
            null_frac = EXCLUDED.null_frac,
            distinct_frac = EXCLUDED.distinct_frac,
            min_value = EXCLUDED.min_value,
            max_value = EXCLUDED.max_value,
            avg_length = EXCLUDED.avg_length,
            sample_values = EXCLUDED.sample_values,
            inferred_type = EXCLUDED.inferred_type,
            pii_type = EXCLUDED.pii_type,
            pattern = EXCLUDED.pattern,
            updated_at = now()
        `, [
          assetId, col.name,
          total ? nulls / total : null,
          total ? distinct / total : null,
          minv, maxv, avgl,
          JSON.stringify(nonNull.slice(0,10)),
          col.data_type, pii || null, null
        ]);
      }
      await cli.end();
    } else if (type === 'mssql') {
      const pool = await mssql.connect({
        server: safeCfg.host,
        port: Number(safeCfg.port ?? 1433),
        database: safeCfg.database,
        user: safeCfg.username,
        password: safeCfg.password,
        options: { encrypt: true, trustServerCertificate: true, ...(safeCfg.options || {}) }
      });

      const cols = await pool.request().query(`
        SELECT c.name AS name, ty.name AS data_type
        FROM sys.columns c
        JOIN sys.types ty ON c.user_type_id = ty.user_type_id
        JOIN sys.objects o ON c.object_id = o.object_id
        JOIN sys.schemas s ON s.schema_id = o.schema_id
        WHERE s.name=@schema AND o.name=@table
        ORDER BY c.column_id
      `).then(r => r.recordset);
      columns = cols;

      const rc = await pool.request().query(`
        SELECT SUM(row_count) as rows
        FROM sys.dm_db_partition_stats
        WHERE object_id = OBJECT_ID(QUOTENAME(@schema)+'.'+QUOTENAME(@table)) AND (index_id=0 OR index_id=1)
      `).then(r => Number(r.recordset?.[0]?.rows || 0));
      rowsCount = rc;

      for (const col of columns) {
        const sample = await pool.request().query(`
          SELECT TOP 10000 [${col.name}] AS v FROM QUOTENAME('${schema_name}').${table_name} TABLESAMPLE (1 PERCENT)
        `).then(r => r.recordset).catch(() => [] as any[]);

        const vals = sample.map(r => r.v);
        const total = Math.max(vals.length, 1);
        const nulls = vals.filter(v => v == null).length;
        const nonNull = vals.filter(v => v != null).map(v => String(v));

        const distinct = new Set(nonNull).size;
        const lengths = nonNull.map(s => s.length);
        const minv = nonNull.length ? nonNull.reduce((a,b)=> a < b ? a : b) : null;
        const maxv = nonNull.length ? nonNull.reduce((a,b)=> a > b ? a : b) : null;
        const avgl = nonNull.length ? (lengths.reduce((a,b)=>a+b,0) / nonNull.length) : null;

        const piiByName = inferPIIByName(col.name);
        const piiByValues = inferPIIByValues(nonNull.slice(0,50));
        const pii = piiByValues || piiByName;

        await cpdb.query(`
          INSERT INTO catalog_column_profiles (asset_id, column_name, null_frac, distinct_frac, min_value, max_value, avg_length, sample_values, inferred_type, pii_type, pattern, updated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
          ON CONFLICT (asset_id, column_name) DO UPDATE SET
            null_frac = EXCLUDED.null_frac,
            distinct_frac = EXCLUDED.distinct_frac,
            min_value = EXCLUDED.min_value,
            max_value = EXCLUDED.max_value,
            avg_length = EXCLUDED.avg_length,
            sample_values = EXCLUDED.sample_values,
            inferred_type = EXCLUDED.inferred_type,
            pii_type = EXCLUDED.pii_type,
            pattern = EXCLUDED.pattern,
            updated_at = now()
        `, [
          assetId, col.name,
          total ? nulls / total : null,
          total ? distinct / total : null,
          minv, maxv, avgl,
          JSON.stringify(nonNull.slice(0,10)),
          col.data_type, pii || null, null
        ]);
      }

      await pool.close();
    } else {
      throw new Error(`Unsupported type: ${type}`);
    }

    // Simple asset quality heuristic
    const { rows: colpii } = await cpdb.query(`SELECT count(*)::int AS pii FROM catalog_column_profiles WHERE asset_id=$1 AND pii_type IS NOT NULL`, [assetId]);
    const piiCount = colpii[0].pii || 0;
    const quality = piiCount > 0 ? 'medium' : 'high';

    await cpdb.query(`UPDATE catalog_assets SET quality=$2, updated_at=now() WHERE id=$1`, [assetId, quality]);
    await cpdb.query(`UPDATE catalog_profile_runs SET status='completed', completed_at=now() WHERE id=$1`, [runId]);

  } catch (e: any) {
    await cpdb.query(`UPDATE catalog_profile_runs SET status='failed', completed_at=now(), error=$2 WHERE id=$1`, [runId, e?.message || String(e)]);
    throw e;
  }
}, connection);

// ------- Sync Worker (optional parallelization) -------
new Worker('catalog:sync', async job => {
  // you can call your existing ingestPostgres/ingestMSSQL here
  // keeping empty for brevity since you already sync via route
  return;
}, connection);
