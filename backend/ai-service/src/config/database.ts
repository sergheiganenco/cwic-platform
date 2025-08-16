import { logger } from '@utils/logger';
import { Pool } from 'pg';

class DatabaseConfig {
  private pool: Pool | null = null;

  constructor() {
    this.initializePool();
  }

  private initializePool(): void {
    try {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
        max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      // Handle pool errors
      this.pool.on('error', (err) => {
        logger.error('Database pool error:', err);
      });

      // Handle client connection errors
      this.pool.on('connect', () => {
        logger.debug('New database client connected');
      });

    } catch (error) {
      logger.error('Failed to initialize database pool:', error);
      throw error;
    }
  }

  public getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database pool not initialized');
    }
    return this.pool;
  }

  public async query(text: string, params?: any[]): Promise<any> {
    const client = await this.getPool().connect();
    try {
      const start = Date.now();
      const result = await client.query(text, params);
      const duration = Date.now() - start;
      
      logger.debug('Query executed', {
        query: text,
        duration: `${duration}ms`,
        rows: result.rowCount
      });
      
      return result;
    } catch (error) {
      logger.error('Database query error:', { query: text, error });
      throw error;
    } finally {
      client.release();
    }
  }

  public async transaction(callback: (client: any) => Promise<any>): Promise<any> {
    const client = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database pool closed');
    }
  }
}

export const db = new DatabaseConfig();

export async function connectDatabase(): Promise<void> {
  try {
    await db.query('SELECT 1');
    logger.info('Database connection verified');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw error;
  }
}