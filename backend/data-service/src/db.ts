// backend/data-service/src/db.ts - Updated with correct imports
import { Pool, PoolConfig } from 'pg';
import { config } from './config/env';
import { logger } from './utils/logger';

export interface DatabaseConfig extends PoolConfig {
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

class Database {
  private pool: Pool;
  private static instance: Database;

  constructor() {
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

    // Handle pool events
    this.pool.on('connect', (client) => {
      logger.debug('New database client connected', {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
      });
    });

    this.pool.on('acquire', (client) => {
      logger.debug('Database client acquired from pool', {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
        waitingClients: this.pool.waitingCount,
      });
    });

    this.pool.on('remove', (client) => {
      logger.debug('Database client removed from pool', {
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
      });
    });

    this.pool.on('error', (err, client) => {
      logger.error('Database pool error:', {
        error: err.message,
        stack: err.stack,
        totalConnections: this.pool.totalCount,
        idleConnections: this.pool.idleCount,
      });
    });

    logger.info('Database pool initialized', {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.database,
      maxConnections: dbConfig.max,
      minConnections: dbConfig.min,
      ssl: !!dbConfig.ssl,
    });
  }

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  public getPool(): Pool {
    return this.pool;
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const start = Date.now();
    const queryId = Math.random().toString(36).substring(7);
    
    try {
      logger.debug('Database query started', {
        queryId,
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        paramCount: params?.length || 0,
      });

      const result = await this.pool.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Database query completed', {
        queryId,
        duration: `${duration}ms`,
        rowCount: result.rowCount,
        command: result.command,
      });
      
      return result;
    } catch (error: any) {
      const duration = Date.now() - start;
      logger.error('Database query failed', {
        queryId,
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error?.stack,
        errorCode: error?.code,
        errorDetail: error?.detail,
        errorHint: error?.hint,
        errorPosition: error?.position,
        fullError: error,
        paramCount: params?.length || 0,
      });
      throw error;
    }
  }

  public async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    const transactionId = Math.random().toString(36).substring(7);
    
    try {
      await client.query('BEGIN');
      logger.debug('Database transaction started', { transactionId });
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.debug('Database transaction committed', { transactionId });
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Database transaction rolled back', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    } finally {
      client.release();
      logger.debug('Database transaction client released', { transactionId });
    }
  }

  public async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    latency?: number;
    connections?: {
      total: number;
      idle: number;
      waiting: number;
    };
    error?: string;
    timestamp: string;
  }> {
    const start = Date.now();
    
    try {
      // Simple connectivity test
      await this.pool.query('SELECT 1 as health_check');
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
        connections: {
          total: this.pool.totalCount,
          idle: this.pool.idleCount,
          waiting: this.pool.waitingCount
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - start;
      return {
        status: 'unhealthy',
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  public async deepHealthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    checks: {
      connectivity: boolean;
      writeable: boolean;
      performant: boolean;
    };
    latency: number;
    error?: string;
  }> {
    const start = Date.now();
    const checks = {
      connectivity: false,
      writeable: false,
      performant: false,
    };

    try {
      // Test connectivity
      await this.pool.query('SELECT 1');
      checks.connectivity = true;

      // Test write capability (create temp table and drop it)
      // Use secure random string and validate prefix to prevent SQL injection
      const crypto = require('crypto');
      const randomSuffix = crypto.randomBytes(8).toString('hex');
      const tempTableName = `health_check_${randomSuffix}`;
      // Validate that the table name only contains safe characters
      if (!/^health_check_[a-f0-9]+$/.test(tempTableName)) {
        throw new Error('Invalid temp table name generated');
      }
      await this.pool.query(`CREATE TEMP TABLE ${tempTableName} (id INTEGER)`);
      await this.pool.query(`INSERT INTO ${tempTableName} VALUES (1)`);
      await this.pool.query(`DROP TABLE ${tempTableName}`);
      checks.writeable = true;

      const latency = Date.now() - start;
      
      // Check if performance is acceptable (under 1 second)
      checks.performant = latency < 1000;

      return {
        status: Object.values(checks).every(Boolean) ? 'healthy' : 'unhealthy',
        checks,
        latency,
      };
    } catch (error) {
      const latency = Date.now() - start;
      return {
        status: 'unhealthy',
        checks,
        latency,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  public getStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  public async getDetailedStats(): Promise<{
    pool: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
      maxConnections: number;
      minConnections: number;
    };
    database: {
      version: string;
      size: string;
      activeConnections: number;
    };
  }> {
    try {
      // Get database version
      const versionResult = await this.pool.query('SELECT version()');
      const version = versionResult.rows[0].version;

      // Get database size
      const sizeResult = await this.pool.query(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `);
      const size = sizeResult.rows[0].size;

      // Get active connections count
      const connectionsResult = await this.pool.query(`
        SELECT count(*) as active_connections 
        FROM pg_stat_activity 
        WHERE state = 'active'
      `);
      const activeConnections = parseInt(connectionsResult.rows[0].active_connections);

      return {
        pool: {
          totalCount: this.pool.totalCount,
          idleCount: this.pool.idleCount,
          waitingCount: this.pool.waitingCount,
          maxConnections: config.database.poolMax,
          minConnections: config.database.poolMin,
        },
        database: {
          version: version.split(' ')[1], // Extract version number
          size,
          activeConnections,
        },
      };
    } catch (error) {
      logger.error('Error getting detailed database stats:', error);
      throw error;
    }
  }

  public async close(): Promise<void> {
    try {
      logger.info('Closing database pool...');
      await this.pool.end();
      logger.info('Database pool closed successfully');
    } catch (error) {
      logger.error('Error closing database pool:', error);
      throw error;
    }
  }

  // Migration and schema management
  public async runMigrations(): Promise<void> {
    try {
      logger.info('Running database migrations...');

      // Create migrations table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // List of migrations to run
      const migrations = [
        {
          name: '001_create_data_sources_table',
          sql: `
            CREATE TABLE IF NOT EXISTS data_sources (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR(100) NOT NULL,
              type VARCHAR(50) NOT NULL,
              host VARCHAR(255),
              port INTEGER,
              database_name VARCHAR(100),
              username VARCHAR(100),
              password_encrypted TEXT,
              ssl BOOLEAN DEFAULT FALSE,
              connection_string TEXT,
              description TEXT,
              tags TEXT[] DEFAULT '{}',
              status VARCHAR(20) DEFAULT 'active',
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_data_sources_type ON data_sources(type);
            CREATE INDEX IF NOT EXISTS idx_data_sources_status ON data_sources(status);
          `
        },
        {
          name: '002_create_assets_table',
          sql: `
            CREATE TABLE IF NOT EXISTS assets (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              name VARCHAR(100) NOT NULL,
              type VARCHAR(50) NOT NULL,
              data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
              schema_name VARCHAR(100),
              table_name VARCHAR(100),
              description TEXT,
              columns JSONB DEFAULT '[]',
              tags TEXT[] DEFAULT '{}',
              status VARCHAR(20) DEFAULT 'active',
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_assets_data_source_id ON assets(data_source_id);
            CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type);
            CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
          `
        },
        {
          name: '003_create_asset_lineage_table',
          sql: `
            CREATE TABLE IF NOT EXISTS asset_lineage (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              upstream_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
              downstream_asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
              relationship_type VARCHAR(50) NOT NULL,
              description TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_asset_lineage_upstream ON asset_lineage(upstream_asset_id);
            CREATE INDEX IF NOT EXISTS idx_asset_lineage_downstream ON asset_lineage(downstream_asset_id);
          `
        }
      ];

      for (const migration of migrations) {
        // Check if migration has already been run
        const result = await this.pool.query(
          'SELECT id FROM migrations WHERE name = $1',
          [migration.name]
        );

        if (result.rows.length === 0) {
          logger.info(`Running migration: ${migration.name}`);
          
          // Run migration in a transaction
          await this.transaction(async (client) => {
            await client.query(migration.sql);
            await client.query(
              'INSERT INTO migrations (name) VALUES ($1)',
              [migration.name]
            );
          });

          logger.info(`Migration completed: ${migration.name}`);
        } else {
          logger.debug(`Migration already applied: ${migration.name}`);
        }
      }

      logger.info('All migrations completed successfully');
    } catch (error) {
      logger.error('Migration failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const db = Database.getInstance();
export default db;