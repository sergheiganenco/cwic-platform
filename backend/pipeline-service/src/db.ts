import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://user:password@postgres:5432/cwic',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function q(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res.rows;
}

export async function qOne(text: string, params?: any[]) {
  const res = await pool.query(text, params);
  return res.rows[0];
}

export default pool;