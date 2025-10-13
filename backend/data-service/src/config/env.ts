// backend/data-service/src/config/env.ts
import dotenv from 'dotenv';
import path from 'path';
import { URL } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export interface Config {
  server: {
    port: number;
    host: string;
    env: string;
    corsOrigin: string | string[];
    serviceName: string;
  };
  database: {
    url: string;
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    ssl: boolean;
    poolMax: number;
    poolMin: number;
    idleTimeout: number;
    connectionTimeout: number;
  };
  security: {
    jwtSecret: string;
    jwtExpiresIn: string;
    connectionEncryptionKey: string;
    helmet: {
      contentSecurityPolicy: boolean;
      crossOriginEmbedderPolicy: boolean;
    };
  };
  monitoring: {
    enableMetrics: boolean;
    enableHealthCheck: boolean;
  };
  logging: {
    level: string;
    enableFileLogging: boolean;
  };
}

/* ───────────────────────── helpers ───────────────────────── */

function coerceBool(v: unknown, def = false): boolean {
  const s = String(v ?? '').trim().toLowerCase();
  if (!s) return def;
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function coerceInt(v: unknown, def: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

/** Accept CSV or leave string; if empty, default to dev origins */
function resolveCorsOrigin(raw?: string): string | string[] {
  if (!raw) return ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8000'];
  const parts = raw.split(',').map((o) => o.trim()).filter(Boolean);
  return parts.length <= 1 ? (parts[0] ?? '') : parts;
}

/** Strip accidental "DATABASE_URL=" prefix and surrounding quotes */
function normalizeDatabaseUrl(input?: string): string {
  let v = (input ?? '').trim();
  if (!v) return '';
  if (/^DATABASE_URL=/i.test(v)) v = v.replace(/^DATABASE_URL=/i, '').trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}

/** Parse PostgreSQL/MySQL/MSSQL-style URL */
function parseDatabaseUrl(url: string): {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
} {
  const normalized = normalizeDatabaseUrl(url);
  try {
    const u = new URL(normalized);
    return {
      host: u.hostname,
      port: parseInt(u.port) || 5432,
      database: u.pathname.replace(/^\//, ''),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
    };
  } catch {
    throw new Error(`Invalid DATABASE_URL format: ${normalized}`);
  }
}

/* ───────────────────────── load & build config ───────────────────────── */

const rawDbUrl = process.env.DATABASE_URL || 'postgresql://cwic_user:cwic_secure_pass@localhost:5432/cwic_platform';
const databaseUrl = normalizeDatabaseUrl(rawDbUrl);
const parsedDb = parseDatabaseUrl(databaseUrl);

export const config: Config = {
  server: {
    port: coerceInt(process.env.PORT, 3002),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    corsOrigin: resolveCorsOrigin(process.env.CORS_ORIGIN),
    serviceName: process.env.SERVICE_NAME || 'data-service',
  },
  database: {
    url: databaseUrl,
    host: parsedDb.host,
    port: parsedDb.port,
    name: parsedDb.database,
    user: parsedDb.user,
    password: parsedDb.password,
    ssl: coerceBool(process.env.DB_SSL, process.env.NODE_ENV === 'production'),
    poolMax: coerceInt(process.env.DB_POOL_MAX, 20),
    poolMin: coerceInt(process.env.DB_POOL_MIN, 2),
    idleTimeout: coerceInt(process.env.DB_IDLE_TIMEOUT, 30_000),
    connectionTimeout: coerceInt(process.env.DB_CONNECTION_TIMEOUT, 10_000),
  },
  security: {
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    connectionEncryptionKey: process.env.CONNECTION_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || 'dev-connection-secret-key-please-change',
    helmet: {
      contentSecurityPolicy: process.env.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: false,
    },
  },
  monitoring: {
    enableMetrics: coerceBool(process.env.ENABLE_METRICS, process.env.NODE_ENV === 'production'),
    enableHealthCheck: process.env.ENABLE_HEALTH_CHECK !== 'false',
  },
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
    enableFileLogging: coerceBool(process.env.ENABLE_FILE_LOGGING, process.env.NODE_ENV === 'production'),
  },
};

export const isProduction = config.server.env === 'production';

/** Small shim for modules that expect `env.JWT_SECRET` etc. */
export const env = {
  NODE_ENV: config.server.env,
  PORT: String(config.server.port),
  HOST: config.server.host,
  SERVICE_NAME: config.server.serviceName,
  JWT_SECRET: config.security.jwtSecret,
  JWT_EXPIRES_IN: config.security.jwtExpiresIn,
  CONNECTION_ENCRYPTION_KEY: config.security.connectionEncryptionKey,
  DATABASE_URL: config.database.url,
  LOG_LEVEL: config.logging.level,
  CORS_ORIGIN: Array.isArray(config.server.corsOrigin)
    ? config.server.corsOrigin.join(',')
    : config.server.corsOrigin,
} as const;

/* ───────────────────────── validation & logging ───────────────────────── */

export const validateConfig = (): void => {
  if (!config.database.url) throw new Error('DATABASE_URL environment variable is required');

  // Re-validate URL (throws with normalized string if bad)
  parseDatabaseUrl(config.database.url);

  // Ports
  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('Server port must be between 1 and 65535');
  }
  if (config.database.port < 1 || config.database.port > 65535) {
    throw new Error('Database port must be between 1 and 65535');
  }

  // JWT secret length in prod
  if (isProduction && config.security.jwtSecret.length < 32) {
    throw new Error('JWT secret must be at least 32 characters long in production');
  }

  if (!config.security.connectionEncryptionKey) {
    throw new Error('CONNECTION_ENCRYPTION_KEY environment variable is required');
  }
  if (isProduction && config.security.connectionEncryptionKey.length < 32) {
    throw new Error('CONNECTION_ENCRYPTION_KEY must be at least 32 characters long in production');
  }

  // Pool sizes
  if (config.database.poolMax < config.database.poolMin) {
    throw new Error('Database pool max must be greater than or equal to pool min');
  }

  // CORS origins are URLs if provided as strings; arrays can include plain origins
  const origins = Array.isArray(config.server.corsOrigin)
    ? config.server.corsOrigin
    : [config.server.corsOrigin];
  origins.forEach((origin) => {
    if (!origin) return;
    try {
      // Allow wildcard-like strings only if exactly "*"
      if (origin === '*') return;
      new URL(origin);
    } catch {
      throw new Error(`Invalid CORS_ORIGIN URL: ${origin}`);
    }
  });
};

export const logConfig = (): void => {
  console.log('🔧 Service Configuration:');
  console.log(`   Service: ${config.server.serviceName}`);
  console.log(`   Port: ${config.server.port}`);
  console.log(`   Host: ${config.server.host}`);
  console.log(`   Environment: ${config.server.env}`);
  console.log(
    `   CORS Origin: ${
      Array.isArray(config.server.corsOrigin) ? config.server.corsOrigin.join(', ') : config.server.corsOrigin
    }`
  );
  console.log(`   Database: ${config.database.host}:${config.database.port}/${config.database.name}`);
  console.log(`   Database User: [REDACTED]`); // Never log credentials
  console.log(`   SSL: ${config.database.ssl ? 'enabled' : 'disabled'}`);
  console.log(`   Pool Max: ${config.database.poolMax}`);
  console.log(`   Pool Min: ${config.database.poolMin}`);
  console.log(`   Metrics: ${config.monitoring.enableMetrics ? 'enabled' : 'disabled'}`);
  console.log(`   Log Level: ${config.logging.level}`);
  console.log('');
};




