// executors/unified.ts
// Unified executor that works with both PostgreSQL and MSSQL through data-service

import axios from 'axios';
import * as mssql from 'mssql';
import { Pool, PoolConfig } from 'pg';

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL || 'http://data-service:3002';

export interface UnifiedExecParams {
  dataSourceId?: string;
  engine: 'postgresql' | 'mssql';
  connection?: unknown;
  sql: string;
  timeoutMs?: number;
}

/** ---------- PostgreSQL ---------- */

type PgExecParams = {
  connection: PoolConfig;
  sql: string;
  timeoutMs?: number;
};

export async function execPostgres({ connection, sql: query, timeoutMs = 60_000 }: PgExecParams) {
  const pool = new Pool(connection);
  const client = await pool.connect();
  try {
    // Session-level timeout (ms) - use parameterized query to prevent SQL injection
    const timeout = Math.max(1000, Math.min(timeoutMs, 600000)); // Cap at 10 minutes
    if (!Number.isInteger(timeout)) {
      throw new Error('Invalid timeout value');
    }
    await client.query(`SET statement_timeout TO $1`, [timeout]);
    const started = Date.now();
    const res = await client.query(query);
    return {
      rowCount: res.rowCount ?? 0,
      durationMs: Date.now() - started,
      // 'fields' isn't typed in pg results by default; cast to any to read .name
      fields: (res as any).fields?.map((f: any) => f.name) ?? [],
      sample: res.rows?.slice(0, 50) ?? [],
    };
  } finally {
    client.release();
    await pool.end();
  }
}

/** ---------- MSSQL ---------- */

type MssqlExecParams = {
  connection: mssql.config;
  sql: string;
  timeoutMs?: number;
};

export async function execMssql({ connection, sql: text, timeoutMs = 60_000 }: MssqlExecParams) {
  // ✅ Set per-request timeout at the pool/config level (typed as requestTimeout)
  const pool = new mssql.ConnectionPool({
    ...connection,
    requestTimeout: Math.max(1000, timeoutMs),
    pool: { max: 10, min: 0, idleTimeoutMillis: 30_000 },
    options: {
      encrypt: true,
      trustServerCertificate: true,
      ...(connection as any)?.options,
    },
  });

  await pool.connect();
  try {
    const started = Date.now();
    const req = new mssql.Request(pool); // Do not set req.timeout (not in typings)
    const res = await req.query(text);

    return {
      rowCount: res.rowsAffected?.[0] ?? (res.recordset?.length ?? 0),
      durationMs: Date.now() - started,
      fields: res.recordset ? Object.keys(res.recordset[0] || {}) : [],
      sample: res.recordset?.slice(0, 50) ?? [],
    };
  } finally {
    await pool.close();
  }
}

/** ---------- Unified ---------- */

export async function executeWithDataSource(params: UnifiedExecParams) {
  if (params.dataSourceId) {
    try {
      const response = await axios.get(`${DATA_SERVICE_URL}/api/data-sources/${params.dataSourceId}`);
      const dataSource = response.data?.data;

      const engine: UnifiedExecParams['engine'] =
        dataSource?.type === 'postgresql' || dataSource?.type === 'postgres'
          ? 'postgresql'
          : dataSource?.type === 'mssql' || dataSource?.type === 'azure-sql'
          ? 'mssql'
          : params.engine;

      params.engine = engine;
      params.connection = dataSource?.connectionConfig;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch data source:', error);
      throw new Error(`Failed to fetch data source ${params.dataSourceId}`);
    }
  }

  if (params.engine === 'postgresql') {
    return execPostgres({
      connection: params.connection as PoolConfig,
      sql: params.sql,
      timeoutMs: params.timeoutMs,
    });
  }

  if (params.engine === 'mssql') {
    return execMssql({
      connection: params.connection as mssql.config,
      sql: params.sql,
      timeoutMs: params.timeoutMs,
    });
  }

  throw new Error(`Unsupported engine: ${params.engine}`);
}
