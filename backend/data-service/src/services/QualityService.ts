// backend/data-service/src/services/QualityService.ts
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { Pool, PoolClient, PoolConfig } from 'pg';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';

/* ──────────────────────────────────────────────────────────────────────────
 * Zod Schemas & Types
 * ────────────────────────────────────────────────────────────────────────── */

const QualityRuleSchema = z.object({
  name: z.string().min(2).max(255).trim(),
  description: z.string().max(1000).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  type: z.enum(['sql', 'metric']).default('sql'),
  dialect: z.enum(['postgres', 'generic']).default('postgres'),
  expression: z.string().min(3).max(10_000),
  tags: z.array(z.string().max(50)).max(20).default([]),
  enabled: z.boolean().default(true),
});

const QueryExecutionSchema = z.object({
  ruleId: z.string().uuid(),
  dataSourceId: z.string().uuid().optional(),
  timeout: z.number().min(1_000).max(300_000).default(30_000),
});

export type QualityRule = z.infer<typeof QualityRuleSchema> & {
  id: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type QualityResult = {
  id: string;
  rule_id: string;
  data_source_id: string | null;
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'timeout';
  run_at: Date;
  execution_time_ms: number;
  metrics: Record<string, any>;
  error: string | null;
  query_hash: string;
};

/* ──────────────────────────────────────────────────────────────────────────
 * SQL Safety Validator
 * ────────────────────────────────────────────────────────────────────────── */

class QueryValidator {
  private static readonly FORBIDDEN = [
    'DROP','DELETE','INSERT','UPDATE','ALTER','CREATE','TRUNCATE',
    'GRANT','REVOKE','EXEC','EXECUTE','CALL','MERGE','REPLACE',
  ];

  static validateSQLQuery(query: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const upper = query.toUpperCase();

    // SELECT-only & no multi-statement
    if (!upper.trim().startsWith('SELECT')) errors.push('Query must start with SELECT.');
    if (upper.includes(';')) errors.push('Multiple statements are not allowed.');

    // DDL/DML
    for (const kw of this.FORBIDDEN) {
      if (upper.includes(kw)) errors.push(`Forbidden keyword detected: ${kw}`);
    }

    // Dangerous patterns
    const bad = [
      /UNION\s+ALL?\s+SELECT.*INFORMATION_SCHEMA/i,
      /pg_sleep\(/i,
      /waitfor\s+delay/i,
      /xp_cmdshell/i,
      /sp_configure/i,
    ];
    for (const pat of bad) {
      if (pat.test(query)) errors.push('Potentially dangerous SQL pattern detected.');
    }

    // Complexity guard
    const selectCount = (upper.match(/\bSELECT\b/g) || []).length;
    if (selectCount > 5) errors.push('Query too complex: >5 nested SELECTs.');

    return { isValid: errors.length === 0, errors };
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * External Data Source Pool Manager (Postgres)
 * ────────────────────────────────────────────────────────────────────────── */

type ExternalPgConfig = { connectionString: string; ssl?: boolean };

class DataSourcePoolManager {
  private pools = new Map<string, Pool>();
  private readonly maxPools = 5;

  getPool(cfg: ExternalPgConfig): Pool {
    const key = this.hashCfg(cfg);
    const found = this.pools.get(key);
    if (found) return found;

    if (this.pools.size >= this.maxPools) {
      throw new Error('Maximum external connection pool limit reached.');
    }

    const poolCfg: PoolConfig = {
      connectionString: cfg.connectionString,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
    };
    const pool = new Pool(poolCfg);
    pool.on('error', (err) => logger.error('External pool idle client error', { err: String(err) }));
    this.pools.set(key, pool);
    return pool;
  }

  async cleanup(): Promise<void> {
    for (const [key, pool] of this.pools) {
      try {
        await pool.end();
      } catch (err) {
        logger.error('Error closing external pool', { key, err: String(err) });
      }
      this.pools.delete(key);
    }
  }

  private hashCfg(cfg: ExternalPgConfig): string {
    const redacted = cfg.connectionString.replace(/:(?:[^@]+)@/, ':***@');
    return createHash('sha256').update(JSON.stringify({ connectionString: redacted, ssl: !!cfg.ssl }))
      .digest('hex').slice(0, 16);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function toInt(x: unknown, fallback = 0): number {
  const n = typeof x === 'string' ? Number(x) : (x as number);
  return Number.isFinite(n) ? (n as number) : fallback;
}

function hashQuery(sql: string): string {
  return createHash('sha256').update(sql).digest('hex').slice(0, 16);
}

async function withStatementTimeout(client: PoolClient, timeoutMs: number, fn: () => Promise<any>) {
  await client.query('SET LOCAL statement_timeout = $1', [timeoutMs]);
  return fn();
}

async function withConnectTimeout(pool: Pool, timeoutMs: number): Promise<PoolClient> {
  let timer: NodeJS.Timeout | null = null;
  try {
    const connectPromise = pool.connect();
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Connection timeout')), timeoutMs);
    });
    const client = (await Promise.race([connectPromise, timeoutPromise])) as PoolClient;
    if (timer) clearTimeout(timer);
    return client;
  } catch (e) {
    if (timer) clearTimeout(timer);
    throw e;
  }
}

function safeJsonParse(s: string): any {
  try { return JSON.parse(s); } catch { return undefined; }
}

function redactError(msg: string): string {
  return msg.replace(/(password|pwd)=([^;\s]+)/gi, 'password=***');
}

function timeframeToMs(tf: '24h' | '7d' | '30d' | '90d'): number {
  switch (tf) {
    case '24h': return 24 * 60 * 60 * 1000;
    case '7d':  return 7  * 24 * 60 * 60 * 1000;
    case '30d': return 30 * 24 * 60 * 60 * 1000;
    case '90d': return 90 * 24 * 60 * 60 * 1000;
    default:    return 7  * 24 * 60 * 60 * 1000;
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Quality Service
 * (no generics at call sites → avoids TS2558 if DatabaseService isn't generic)
 * ────────────────────────────────────────────────────────────────────────── */

export class QualityService {
  private readonly db = new DatabaseService();          // internal metadata DB wrapper
  private readonly pools = new DataSourcePoolManager();  // external DS pools

  /* ── Rules: list/get/create/update/delete ─────────────────────────────── */

  async listRules(filters: {
    q?: string;
    severity?: string;
    enabled?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ rules: QualityRule[]; total: number }> {
    const { q = '', severity, enabled, limit = 50, offset = 0 } = filters;

    const conds: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (q) { conds.push(`(name ILIKE $${i} OR description ILIKE $${i})`); params.push(`%${q}%`); i++; }
    if (severity) { conds.push(`severity = $${i}`); params.push(severity); i++; }
    if (typeof enabled === 'boolean') { conds.push(`enabled = $${i}`); params.push(enabled); i++; }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const countRes = await this.db.query(`SELECT COUNT(*) AS total FROM quality_rules ${where}`, params) as any;
    const total = toInt(countRes.rows?.[0]?.total, 0);

    const pageLimit = Math.min(Math.max(limit, 1), 100);
    const pageOffset = Math.max(offset, 0);

    const rulesRes = await this.db.query(
      `
      SELECT id, name, description, severity, type, dialect, expression, tags,
             enabled, created_by, updated_by, created_at, updated_at
      FROM quality_rules
      ${where}
      ORDER BY updated_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...params, pageLimit, pageOffset],
    ) as any;

    const rules = ((rulesRes.rows ?? []) as QualityRule[]).map((r) => ({
      ...r,
      tags: Array.isArray(r.tags) ? r.tags : [],
    }));

    return { rules, total };
  }

  async getRule(id: string): Promise<QualityRule | null> {
    const res = await this.db.query(`SELECT * FROM quality_rules WHERE id = $1`, [id]) as any;
    return (res.rows?.[0] as QualityRule) ?? null;
  }

  async createRule(data: z.infer<typeof QualityRuleSchema>, userId?: string): Promise<QualityRule> {
    const validated = QualityRuleSchema.parse(data);
    if (validated.type === 'sql') {
      const v = QueryValidator.validateSQLQuery(validated.expression);
      if (!v.isValid) throw new Error(`Invalid SQL query: ${v.errors.join(', ')}`);
    }

    const res = await this.db.query(
      `
      INSERT INTO quality_rules (
        name, description, severity, type, dialect, expression, tags, enabled,
        created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
      RETURNING *
      `,
      [
        validated.name,
        validated.description ?? null,
        validated.severity,
        validated.type,
        validated.dialect,
        validated.expression,
        validated.tags,
        validated.enabled,
        userId ?? null,
      ],
    ) as any;

    const rule = res.rows[0] as QualityRule;
    logger.info('Quality rule created', { ruleId: rule.id, name: rule.name });
    return rule;
  }

  async updateRule(id: string, updates: Partial<z.infer<typeof QualityRuleSchema>>, userId?: string): Promise<QualityRule | null> {
    const validated = QualityRuleSchema.partial().parse(updates);

    if (validated.expression && (validated.type ?? 'sql') === 'sql') {
      const v = QueryValidator.validateSQLQuery(validated.expression);
      if (!v.isValid) throw new Error(`Invalid SQL query: ${v.errors.join(', ')}`);
    }

    const fields: Array<keyof typeof validated> = [
      'name','description','severity','type','dialect','expression','tags','enabled',
    ];
    const sets: string[] = [];
    const params: any[] = [];
    let i = 1;

    for (const f of fields) {
      if (validated[f] !== undefined) {
        sets.push(`${f} = $${i}`);
        params.push(validated[f] as any);
        i++;
      }
    }
    if (!sets.length) throw new Error('No valid fields to update');

    sets.push(`updated_by = $${i}`, `updated_at = NOW()`);
    params.push(userId ?? null);
    i++;
    params.push(id);

    const res = await this.db.query(
      `
      UPDATE quality_rules
      SET ${sets.join(', ')}
      WHERE id = $${i}
      RETURNING *
      `,
      params,
    ) as any;

    if ((res.rows?.length ?? 0) > 0) {
      logger.info('Quality rule updated', { ruleId: id, fieldsUpdated: Object.keys(validated) });
      return res.rows[0] as QualityRule;
    }
    return null;
  }

  async deleteRule(id: string, userId?: string): Promise<boolean> {
    const res = await this.db.query(
      `UPDATE quality_rules SET enabled = false, updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [userId ?? null, id],
    ) as any;
    const ok = (res.rowCount || 0) > 0;
    if (ok) logger.info('Quality rule disabled', { ruleId: id });
    return ok;
  }

  /* ── Results listing ──────────────────────────────────────────────────── */

  async listResults(filters: {
    ruleId?: string;
    dataSourceId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ results: (QualityResult & { rule_name: string | null })[]; total: number }> {
    const { ruleId, dataSourceId, status, limit = 50, offset = 0 } = filters;

    const conds: string[] = [];
    const params: any[] = [];
    let i = 1;

    if (ruleId) { conds.push(`qr.rule_id = $${i}`); params.push(ruleId); i++; }
    if (dataSourceId) { conds.push(`qr.data_source_id = $${i}`); params.push(dataSourceId); i++; }
    if (status) { conds.push(`qr.status = $${i}`); params.push(status); i++; }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    const countRes = await this.db.query(`SELECT COUNT(*) AS total FROM quality_results qr ${where}`, params) as any;
    const total = toInt(countRes.rows?.[0]?.total, 0);

    const pageLimit = Math.min(Math.max(limit, 1), 100);
    const pageOffset = Math.max(offset, 0);

    const res = await this.db.query(
      `
      SELECT qr.*, r.name AS rule_name
      FROM quality_results qr
      LEFT JOIN quality_rules r ON r.id = qr.rule_id
      ${where}
      ORDER BY qr.run_at DESC
      LIMIT $${i} OFFSET $${i + 1}
      `,
      [...params, pageLimit, pageOffset],
    ) as any;

    return { results: (res.rows ?? []) as (QualityResult & { rule_name: string | null })[], total };
  }

  /* ── Rule execution ───────────────────────────────────────────────────── */

  async executeRule(
    ruleId: string,
    dataSourceId?: string,
    options: { timeout?: number; userId?: string } = {},
  ): Promise<QualityResult> {
    const { timeout = 30_000, userId } = options;
    const startedAt = performance.now();

    const input = QueryExecutionSchema.parse({ ruleId, dataSourceId, timeout });

    const ruleRes = await this.db.query(
      `SELECT * FROM quality_rules WHERE id = $1 AND enabled = true`,
      [input.ruleId],
    ) as any;
    if (!ruleRes.rows?.length) throw new Error('Rule not found or disabled');

    const rule = ruleRes.rows[0] as QualityRule;

    let status: QualityResult['status'] = 'skipped';
    let metrics: Record<string, any> = {};
    let error: string | null = null;
    let qhash = '';

    if (rule.type === 'sql' && rule.dialect === 'postgres') {
      const v = QueryValidator.validateSQLQuery(rule.expression);
      if (!v.isValid) throw new Error(`Invalid SQL query: ${v.errors.join(', ')}`);

      qhash = hashQuery(rule.expression);

      // Resolve target connection (default to primary DB)
      let connectionString = process.env.DATABASE_URL as string | undefined;
      let ssl = false;

      if (input.dataSourceId) {
        const ds = await this.db.query(
          `SELECT connection_config FROM data_sources WHERE id = $1`,
          [input.dataSourceId],
        ) as any;

        if (ds.rows?.length) {
          const cfgRaw = (ds.rows[0] as { connection_config: any }).connection_config;
          const cfg = typeof cfgRaw === 'string' ? safeJsonParse(cfgRaw) : cfgRaw;
          if (cfg?.connectionString) connectionString = String(cfg.connectionString);
          if (typeof cfg?.ssl === 'boolean') ssl = !!cfg.ssl;
        }
      }

      if (!connectionString) throw new Error('No connection string available for rule execution.');

      const pool = this.pools.getPool({ connectionString, ssl });

      let client: PoolClient | null = null;
      try {
        client = await withConnectTimeout(pool, 10_000);

        const exec = async () => {
          const result = await client!.query(rule.expression);
          const first = result.rows?.[0] ?? {};
          const passed =
            typeof first.passed === 'boolean'
              ? (first.passed as boolean)
              : ((result.rowCount ?? 0) > 0);

          status = passed ? 'passed' : 'failed';
          metrics = {
            rowCount: result.rowCount ?? 0,
            sampleRows: (result.rows ?? []).slice(0, 3),
            queryHash: qhash,
          };
        };

        await withStatementTimeout(client, timeout, exec);
      } catch (e: any) {
        const msg = String(e?.message || e);
        status = /timeout/i.test(msg) ? 'timeout' : 'error';
        error = redactError(msg);
        logger.error('Quality rule execution failed', {
          ruleId: input.ruleId,
          dataSourceId: input.dataSourceId ?? null,
          error,
        });
      } finally {
        if (client) {
          try { client.release(); } catch (releaseErr) {
            logger.warn('Failed to release PG client', { err: String(releaseErr) });
          }
        }
      }
    } else {
      status = 'skipped';
    }

    const execMs = Math.round(performance.now() - startedAt);

    const insert = await this.db.query(
      `
      INSERT INTO quality_results (
        rule_id, data_source_id, status, execution_time_ms, metrics, error, query_hash
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
      RETURNING *
      `,
      [input.ruleId, input.dataSourceId ?? null, status, execMs, JSON.stringify(metrics), error, qhash],
    ) as any;

    logger.info('Quality rule executed', { ruleId: input.ruleId, status, executionTimeMs: execMs });

    return insert.rows[0] as QualityResult;
  }

  /* ── Stats & Health ───────────────────────────────────────────────────── */

  // Lightweight DB health for /api/quality/health
  async healthCheck(): Promise<boolean> {
    try {
      const pong = await this.db.query('SELECT 1 as ok') as any;
      return pong.rows?.[0]?.ok === 1;
    } catch {
      return false;
    }
  }

  /**
   * Aggregated stats for dashboards.
   * timeframe: '24h' | '7d' | '30d' | '90d' (default '7d')
   * groupBy:   'severity' | 'status' | 'data_source' (default 'status')
   */
  async getStats(params: {
    timeframe?: '24h' | '7d' | '30d' | '90d';
    groupBy?: 'severity' | 'status' | 'data_source';
  }): Promise<{
    from: string;
    to: string;
    timeframe: '24h' | '7d' | '30d' | '90d';
    groupBy: 'severity' | 'status' | 'data_source';
    buckets: Array<{ key: string; count: number }>;
  }> {
    const timeframe = params.timeframe ?? '7d';
    const groupBy = params.groupBy ?? 'status';

    const now = new Date();
    const fromIso = new Date(now.getTime() - timeframeToMs(timeframe)).toISOString();

    let sql: string;
    const values: any[] = [fromIso];

    if (groupBy === 'severity') {
      sql = `
        SELECT r.severity AS key, COUNT(*)::int AS count
        FROM quality_results qr
        JOIN quality_rules r ON r.id = qr.rule_id
        WHERE qr.run_at >= $1
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
      `;
    } else if (groupBy === 'data_source') {
      sql = `
        SELECT COALESCE(qr.data_source_id::text, 'none') AS key, COUNT(*)::int AS count
        FROM quality_results qr
        WHERE qr.run_at >= $1
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
      `;
    } else {
      // status (default)
      sql = `
        SELECT qr.status AS key, COUNT(*)::int AS count
        FROM quality_results qr
        WHERE qr.run_at >= $1
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
      `;
    }

    const res = await this.db.query(sql, values) as any;

    return {
      from: fromIso,
      to: now.toISOString(),
      timeframe,
      groupBy,
      buckets: (res.rows ?? []) as Array<{ key: string; count: number }>,
    };
  }

  /* ── Lifecycle ────────────────────────────────────────────────────────── */

  async cleanup(): Promise<void> {
    await this.pools.cleanup();
  }
}
