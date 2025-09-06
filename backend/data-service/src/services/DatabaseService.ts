// backend/data-service/src/services/DatabaseService.ts
import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config/env';
import { logger, loggerUtils } from '../utils/logger';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean | object;
  max?: number;
  min?: number;
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

export interface QueryOptions { timeout?: number; retries?: number; retryDelay?: number; }
export interface TransactionOptions {
  timeout?: number;
  isolationLevel?: 'READ_UNCOMMITTED'|'READ_COMMITTED'|'REPEATABLE_READ'|'SERIALIZABLE';
}
export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  latency?: number;
  connections?: { total: number; idle: number; waiting: number; };
  error?: string;
  timestamp: string;
}
export interface PoolStats { total: number; idle: number; waiting: number; max: number; min: number; }
export interface Migration { id: number; name: string; sql: string; executedAt?: Date; }

export class DatabaseService {
  private pool!: Pool;
  private isInitialized = false;
  private migrations: Migration[] = [];

  constructor() {
    this.initializePool();
    this.setupMigrations();
  }

  private initializePool(): void {
    const dbConfig: DatabaseConfig = {
      host: config.database.host,
      port: config.database.port,
      database: config.database.name,
      user: config.database.user,
      password: config.database.password,
      ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
      max: config.database.poolMax,
      min: config.database.poolMin,
      idleTimeoutMillis: config.database.idleTimeout,
      connectionTimeoutMillis: config.database.connectionTimeout,
    };

    this.pool = new Pool(dbConfig);

    this.pool.on('error', (err: Error) => {
      logger.error('Database pool error:', { error: err.message, stack: err.stack });
    });

    logger.info('Database pool initialized', {
      host: dbConfig.host, port: dbConfig.port, database: dbConfig.database,
      maxConnections: dbConfig.max, minConnections: dbConfig.min, ssl: !!dbConfig.ssl,
    });

    this.isInitialized = true;
  }

  /** ───────────────────────────── Migrations ───────────────────────────── */
  // ...imports & class skeleton unchanged...

// backend/data-service/src/services/DatabaseService.ts
private setupMigrations(): void {
  this.migrations = [
    {
      id: 0,
      name: '000_enable_pgcrypto',
      sql: `CREATE EXTENSION IF NOT EXISTS pgcrypto;`
    },
    {
      id: 1,
      name: '001_create_data_sources_table',
      sql: `
        CREATE TABLE IF NOT EXISTS data_sources (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          host VARCHAR(255),
          port INTEGER CHECK (port > 0 AND port <= 65535),
          database_name VARCHAR(100),
          username VARCHAR(100),
          password_encrypted TEXT,
          ssl BOOLEAN DEFAULT FALSE,
          connection_string TEXT,
          description TEXT,
          tags TEXT[] DEFAULT '{}',
          status VARCHAR(20) DEFAULT 'active',
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          last_tested_at TIMESTAMPTZ,
          last_sync_at TIMESTAMPTZ
        );

        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        DROP TRIGGER IF EXISTS update_data_sources_updated_at ON data_sources;
        CREATE TRIGGER update_data_sources_updated_at
          BEFORE UPDATE ON data_sources
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();

        CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
        CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);
        CREATE INDEX IF NOT EXISTS idx_data_sources_name ON data_sources(name);
        CREATE INDEX IF NOT EXISTS idx_data_sources_tags ON data_sources USING GIN(tags);
      `
    },
    {
      id: 6,
      name: '006_align_data_sources_schema',
      sql: `
        ALTER TABLE data_sources
          ADD COLUMN IF NOT EXISTS connection_config JSONB DEFAULT '{}'::jsonb,
          ADD COLUMN IF NOT EXISTS created_by VARCHAR(100),
          ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100),
          ADD COLUMN IF NOT EXISTS last_error TEXT,
          ADD COLUMN IF NOT EXISTS public_id VARCHAR(100),
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
          ADD COLUMN IF NOT EXISTS last_test_at TIMESTAMPTZ;  -- tolerate new name

        -- Backfill new last_test_at from legacy last_tested_at if present
        UPDATE data_sources
          SET last_test_at = COALESCE(last_test_at, last_tested_at)
          WHERE last_tested_at IS NOT NULL;

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'uq_data_sources_public_id'
          ) THEN
            CREATE UNIQUE INDEX uq_data_sources_public_id
              ON data_sources ((public_id)) WHERE public_id IS NOT NULL;
          END IF;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_data_sources_updated_at ON data_sources(updated_at);

        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_sources_type_check' AND conrelid = 'data_sources'::regclass) THEN
            ALTER TABLE data_sources DROP CONSTRAINT data_sources_type_check;
          END IF;
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'data_sources_status_check' AND conrelid = 'data_sources'::regclass) THEN
            ALTER TABLE data_sources DROP CONSTRAINT data_sources_status_check;
          END IF;
        END $$;

        ALTER TABLE data_sources
          ADD CONSTRAINT chk_data_sources_type CHECK (type IN (
            'postgresql','mysql','mssql','oracle','mongodb','redis',
            's3','azure-blob','gcs','snowflake','bigquery','redshift',
            'databricks','api','file','kafka','elasticsearch'
          ));

        ALTER TABLE data_sources
          ADD CONSTRAINT chk_data_sources_status CHECK (status IN (
            'active','inactive','pending','error','testing',
            'connected','disconnected','warning','syncing'
          ));
      `
    }
  ];
}



  /** ───────────────────────────── Query helpers ───────────────────────────── */
  public async query(text: string, params?: any[], options: QueryOptions = {}): Promise<QueryResult> {
    const { timeout = 30000, retries = 0, retryDelay = 1000 } = options;
    const start = Date.now();
    const queryId = Math.random().toString(36).substring(7);
    let lastError: Error;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.pool.query({ text, values: params });
        const duration = Date.now() - start;
        loggerUtils.logDbOperation('select', 'general', duration, true);
        return result;
      } catch (err) {
        lastError = err as Error;
        if (attempt === retries) {
          const duration = Date.now() - start;
          loggerUtils.logDbOperation('select', 'general', duration, false);
          throw lastError;
        }
        await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
      }
    }
    throw lastError!;
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>, options: TransactionOptions = {}): Promise<T> {
    const { timeout = 30000, isolationLevel } = options;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      if (isolationLevel) await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      const result = await Promise.race([
        callback(client),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Transaction timeout after ${timeout}ms`)), timeout)),
      ]);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  public async healthCheck(): Promise<HealthCheckResult> {
    const started = Date.now();
    try {
      await this.pool.query('SELECT 1');
      return {
        status: 'healthy',
        latency: Date.now() - started,
        connections: {
          total: (this.pool as any).totalCount ?? 0,
          idle: (this.pool as any).idleCount ?? 0,
          waiting: (this.pool as any).waitingCount ?? 0,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (e: any) {
      return {
        status: 'unhealthy',
        latency: Date.now() - started,
        error: e?.message || String(e),
        timestamp: new Date().toISOString(),
      };
    }
  }

  public getPoolStats(): PoolStats {
    // @ts-ignore
    return {
      total: this.pool.totalCount ?? 0,
      idle: this.pool.idleCount ?? 0,
      waiting: this.pool.waitingCount ?? 0,
      max: config.database.poolMax,
      min: config.database.poolMin,
    };
  }

  public async runMigrations(): Promise<void> {
    logger.info('Running database migrations...');
    await this.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    for (const m of this.migrations) {
      const seen = await this.query('SELECT 1 FROM migrations WHERE name = $1', [m.name]);
      if (seen.rowCount) continue;

      logger.info(`Running migration: ${m.name}`);
      await this.transaction(async (client) => {
        await client.query(m.sql);
        await client.query('INSERT INTO migrations (name) VALUES ($1)', [m.name]);
      });
      logger.info(`Migration completed: ${m.name}`);
    }
    logger.info('All migrations completed.');
  }

  public async close(): Promise<void> {
    await this.pool.end();
    this.isInitialized = false;
  }

  public isReady(): boolean { return this.isInitialized; }
}
