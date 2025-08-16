import { Pool } from 'pg';
import { env } from './config/env.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30_000,
  statement_timeout: 60_000,
});
