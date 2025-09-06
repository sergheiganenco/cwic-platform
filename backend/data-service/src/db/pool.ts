// backend/data-service/src/db/pool.ts
import { Pool } from "pg";

const {
  DATABASE_URL,
  DB_POOL_MAX = "20",
  DB_IDLE_TIMEOUT = "30000",
  DB_CONNECTION_TIMEOUT = "10000",
  DB_SSL = "false",
} = process.env;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set for data-service");
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  max: Number(DB_POOL_MAX),
  idleTimeoutMillis: Number(DB_IDLE_TIMEOUT),
  connectionTimeoutMillis: Number(DB_CONNECTION_TIMEOUT),
  ssl: String(DB_SSL).toLowerCase() === "true" ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  // Do not crash the process on idle client error; log and continue.
  console.error("[pg] Pool error:", err);
});
