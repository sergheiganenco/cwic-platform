// src/config/database.ts
import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';

/**
 * Minimal env parsing with sane defaults.
 * You can swap this for zod if you want strict validation.
 */
const {
  DATABASE_URL,
  PG_MAX = '10',
  PG_IDLE_TIMEOUT_MS = '30000',
  PG_CONN_TIMEOUT_MS = '5000',
  PG_SSL = 'false',
} = process.env;

if (!DATABASE_URL) {
  // Fail fast in production; stay permissive in dev if you prefer
  console.warn('[db] DATABASE_URL is not set. Using default localhost URL may be required for local dev.');
}

const poolConfig: PoolConfig = {
  connectionString: DATABASE_URL,
  max: Number(PG_MAX) || 10,
  idleTimeoutMillis: Number(PG_IDLE_TIMEOUT_MS) || 30_000,
  connectionTimeoutMillis: Number(PG_CONN_TIMEOUT_MS) || 5_000,
  ssl: String(PG_SSL).toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined,
};

/**
 * Shared Pool instance.
 * - Listeners log errors so the process doesn't crash silently.
 * - Graceful shutdown is provided via closePool().
 */
export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[db] Unexpected error on idle client:', err);
});

/** Generic helpers — strongly typed results */
export async function query<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<R[]> {
  const res: QueryResult<R> = await pool.query<R>(text, params);
  return res.rows;
}

export async function queryOne<R extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[],
): Promise<R | null> {
  const res: QueryResult<R> = await pool.query<R>(text, params);
  return res.rows[0] ?? null;
}

/**
 * Execute a function within a transaction.
 * Automatically commits on success and rolls back on error.
 */
export async function withTransaction<T>(fn: (client: import('pg').PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('[db] Rollback failed:', rollbackErr);
    }
    throw err;
  } finally {
    client.release();
  }
}

/** Cheap health check for liveness/readiness probes */
export async function healthCheck(): Promise<boolean> {
  try {
    const res = await pool.query('SELECT 1 as ok');
    return res.rows?.[0]?.ok === 1;
  } catch {
    return false;
  }
}

/** Graceful shutdown helper for process signals */
export async function closePool(): Promise<void> {
  await pool.end();
}
