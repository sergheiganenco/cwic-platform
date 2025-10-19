import { db } from '../db';
import { logger } from '../utils/logger';

const cpdb = db.getPool();

/**
 * Service to populate foreign key metadata for existing catalog
 * This fills in is_foreign_key, foreign_key_table, foreign_key_column in catalog_columns
 */
export class FKMetadataService {
  /**
   * Populate FK metadata for a PostgreSQL data source
   */
  async populateFKsForPostgreSQL(dataSourceId: string): Promise<number> {
    let pool: any = null;
    try {
      logger.info(`Populating FK metadata for PostgreSQL data source: ${dataSourceId}`);

      // Get the data source connection info
      const { rows: dsRows } = await cpdb.query(`
        SELECT id::text, type, connection_config AS cfg
        FROM data_sources
        WHERE id::text = $1
      `, [dataSourceId]);

      if (dsRows.length === 0) {
        throw new Error(`Data source not found: ${dataSourceId}`);
      }

      let config = dsRows[0].cfg;

      if (!config) {
        throw new Error(`No connection config found for data source: ${dataSourceId}`);
      }

      // Decrypt if encrypted
      try {
        const { decryptConfig, isEncryptedConfig } = require('../utils/secrets');
        if (isEncryptedConfig(config)) {
          config = decryptConfig(config);
        } else if (typeof config === 'string') {
          config = JSON.parse(config);
        }
      } catch (e) {
        logger.warn('Failed to decrypt/parse config:', e);
      }

      logger.info(`Connection config: host=${config.host}, port=${config.port}, db=${config.database}, user=${config.username || config.user}`);

      // Connect to the database and get FK information
      const { Pool } = require('pg');
      pool = new Pool({
        host: config.host,
        port: config.port || 5432,
        database: config.database || config.db || 'postgres',
        user: config.username || config.user,
        password: config.password,
        max: 1,
        connectionTimeoutMillis: 10000
      });

      logger.info('Testing database connection...');

      // Test connection
      await pool.query('SELECT 1');
      logger.info('Database connection successful');

      // Query to get all foreign keys
      const fkQuery = `
        SELECT
          tc.table_schema,
          tc.table_name,
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY tc.table_name, kcu.column_name
      `;

      const result = await pool.query(fkQuery);
      logger.info(`Found ${result.rows.length} foreign key relationships in database`);

      await pool.end();
      logger.info('Database connection closed');

      // Update catalog_columns with FK information
      let updated = 0;

      for (const fk of result.rows) {
        try {
          // Find the asset for this table
          const { rows: assetRows } = await cpdb.query(`
            SELECT id, database_name
            FROM catalog_assets
            WHERE datasource_id = $1
              AND schema_name = $2
              AND table_name = $3
            LIMIT 1
          `, [dataSourceId, fk.table_schema, fk.table_name]);

          if (assetRows.length === 0) {
            logger.warn(`Asset not found for ${fk.table_schema}.${fk.table_name}`);
            continue;
          }

          const assetId = assetRows[0].id;

          // Update the column with FK information
          const { rowCount } = await cpdb.query(`
            UPDATE catalog_columns
            SET
              is_foreign_key = true,
              foreign_key_table = $1,
              foreign_key_column = $2
            WHERE asset_id = $3
              AND column_name = $4
          `, [fk.foreign_table_name, fk.foreign_column_name, assetId, fk.column_name]);

          if (rowCount && rowCount > 0) {
            updated++;
            logger.debug(`Updated FK: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
          }
        } catch (error: any) {
          logger.error(`Failed to update FK metadata for ${fk.table_name}.${fk.column_name}:`, error);
        }
      }

      logger.info(`Successfully updated ${updated} foreign key columns for PostgreSQL`);
      return updated;
    } catch (error: any) {
      logger.error(`FK metadata population failed for PostgreSQL:`, {
        message: error.message,
        stack: error.stack,
        code: error.code
      });
      throw error;
    } finally {
      if (pool) {
        try {
          await pool.end();
        } catch (e) {
          logger.warn('Failed to close pool:', e);
        }
      }
    }
  }

  /**
   * Populate FK metadata for MSSQL/Azure SQL data source
   */
  async populateFKsForMSSQL(dataSourceId: string): Promise<number> {
    try {
      logger.info(`Populating FK metadata for MSSQL data source: ${dataSourceId}`);

      // Get the data source connection info
      const { rows: dsRows } = await cpdb.query(`
        SELECT id::text, type, connection_config AS cfg
        FROM data_sources
        WHERE id::text = $1
      `, [dataSourceId]);

      if (dsRows.length === 0) {
        throw new Error(`Data source not found: ${dataSourceId}`);
      }

      let config = dsRows[0].cfg;

      if (!config) {
        throw new Error(`No connection config found for data source: ${dataSourceId}`);
      }

      // Decrypt if encrypted
      try {
        const { decryptConfig, isEncryptedConfig } = require('../utils/secrets');
        if (isEncryptedConfig(config)) {
          config = decryptConfig(config);
        } else if (typeof config === 'string') {
          config = JSON.parse(config);
        }
      } catch (e) {
        logger.warn('Failed to decrypt/parse config:', e);
      }

      const sql = require('mssql');

      console.error('=== DEBUG FK METADATA ===');
      console.error('Config keys:', Object.keys(config));
      console.error('Full config (sanitized):', {
        ...config,
        password: config.password ? '***' : undefined
      });
      console.error('========================');

      // Get database name (handle both 'database' and 'databases' array)
      const dbName = config.database || config.db || (config.databases && config.databases[0]);

      const poolConfig = {
        user: config.username || config.user,
        password: config.password,
        server: config.host || config.server || config.hostname,
        port: config.port || 1433,
        database: dbName,
        options: {
          encrypt: config.encrypt !== false || config.ssl === true,
          trustServerCertificate: config.trustServerCertificate !== false,
          connectTimeout: 10000,
          requestTimeout: 10000
        }
      };

      console.error('Pool config:', {
        server: poolConfig.server,
        port: poolConfig.port,
        database: poolConfig.database,
        user: poolConfig.user
      });

      const pool = await sql.connect(poolConfig);
      console.error('Connected to database:', dbName);

      // Query to get all foreign keys
      const fkQuery = `
        SELECT
          OBJECT_SCHEMA_NAME(fk.parent_object_id) AS table_schema,
          OBJECT_NAME(fk.parent_object_id) AS table_name,
          COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
          OBJECT_NAME(fk.referenced_object_id) AS foreign_table_name,
          COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS foreign_column_name
        FROM sys.foreign_keys AS fk
        INNER JOIN sys.foreign_key_columns AS fkc
          ON fk.object_id = fkc.constraint_object_id
        WHERE OBJECT_SCHEMA_NAME(fk.parent_object_id) NOT IN ('sys', 'information_schema')
        ORDER BY table_name, column_name
      `;

      const result = await pool.request().query(fkQuery);
      await pool.close();

      logger.info(`Found ${result.recordset.length} foreign key relationships in database`);

      // Update catalog_columns with FK information
      let updated = 0;

      for (const fk of result.recordset) {
        try {
          // Find the asset for this table
          const { rows: assetRows } = await cpdb.query(`
            SELECT id, database_name
            FROM catalog_assets
            WHERE datasource_id = $1
              AND schema_name = $2
              AND table_name = $3
            LIMIT 1
          `, [dataSourceId, fk.table_schema, fk.table_name]);

          if (assetRows.length === 0) {
            logger.warn(`Asset not found for ${fk.table_schema}.${fk.table_name}`);
            continue;
          }

          const assetId = assetRows[0].id;

          // Update the column with FK information
          const { rowCount } = await cpdb.query(`
            UPDATE catalog_columns
            SET
              is_foreign_key = true,
              foreign_key_table = $1,
              foreign_key_column = $2
            WHERE asset_id = $3
              AND column_name = $4
          `, [fk.foreign_table_name, fk.foreign_column_name, assetId, fk.column_name]);

          if (rowCount && rowCount > 0) {
            updated++;
            logger.debug(`Updated FK: ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`);
          }
        } catch (error: any) {
          logger.error(`Failed to update FK metadata for ${fk.table_name}.${fk.column_name}:`, error);
        }
      }

      logger.info(`Successfully updated ${updated} foreign key columns`);
      return updated;
    } catch (error: any) {
      logger.error(`FK metadata population failed:`, error);
      throw error;
    }
  }

  /**
   * Populate FK metadata based on data source type
   */
  async populateFKMetadata(dataSourceId: string): Promise<number> {
    // Get data source type
    const { rows } = await cpdb.query(`
      SELECT type FROM data_sources WHERE id::text = $1
    `, [dataSourceId]);

    if (rows.length === 0) {
      throw new Error(`Data source not found: ${dataSourceId}`);
    }

    const sourceType = rows[0].type;

    if (sourceType === 'postgresql') {
      return await this.populateFKsForPostgreSQL(dataSourceId);
    } else if (sourceType === 'mssql' || sourceType === 'azuresql') {
      return await this.populateFKsForMSSQL(dataSourceId);
    } else {
      logger.warn(`FK metadata population not supported for ${sourceType}`);
      return 0;
    }
  }
}
