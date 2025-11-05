// backend/quality-engine/src/utils/database.ts
// Database connection utility

import { Pool, PoolClient } from 'pg';
import { logger } from './logger';
import { config } from '../config';

export class DatabaseService {
  private pool: Pool | null = null;

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    this.pool = new Pool({
      host: config.database.host,
      port: config.database.port,
      database: config.database.database,
      user: config.database.user,
      password: config.database.password,
      max: config.database.poolSize,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database pool error', err);
    });

    // Test connection
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      await this.connect();
    }

    const start = Date.now();
    try {
      const res = await this.pool!.query(text, params);
      const duration = Date.now() - start;

      logger.debug('Executed query', {
        text: text.substring(0, 100),
        duration,
        rows: res.rowCount
      });

      return res;
    } catch (error) {
      logger.error('Database query error:', {
        text: text.substring(0, 100),
        error
      });
      throw error;
    }
  }

  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    if (!this.pool) {
      await this.connect();
    }

    const client = await this.pool!.connect();

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      logger.info('Database disconnected');
    }
  }
}