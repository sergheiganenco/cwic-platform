import { db } from '../db';
import { logger } from '../utils/logger';
import type { Pool } from 'pg';

const cpdb = db.getPool();

export interface LineageRelationship {
  from_asset_id: number;
  to_asset_id: number;
  edge_type: string;
  confidence_score?: number;
  discovered_by: string;
}

export class LineageDiscoveryService {
  private tenantId: number = 1; // Default tenant

  constructor(tenantId?: number) {
    if (tenantId) this.tenantId = tenantId;
  }

  /**
   * Discover all lineage relationships for a data source
   */
  async discoverLineageForDataSource(dataSourceId: string): Promise<number> {
    logger.info(`Starting lineage discovery for data source: ${dataSourceId}`);

    try {
      const relationships: LineageRelationship[] = [];

      // 1. Discover FK-based lineage
      const fkLineage = await this.discoverForeignKeyLineage(dataSourceId);
      relationships.push(...fkLineage);

      // 2. Discover view-based lineage
      const viewLineage = await this.discoverViewLineage(dataSourceId);
      relationships.push(...viewLineage);

      // 3. Insert discovered lineage into catalog_lineage
      const inserted = await this.insertLineage(relationships);

      logger.info(`Lineage discovery complete for ${dataSourceId}: ${inserted} relationships inserted`);
      return inserted;
    } catch (error: any) {
      logger.error(`Lineage discovery failed for ${dataSourceId}:`, error);
      throw error;
    }
  }

  /**
   * Discover lineage from foreign key relationships
   */
  private async discoverForeignKeyLineage(dataSourceId: string): Promise<LineageRelationship[]> {
    try {
      // Query catalog_columns to find all FK relationships for this data source
      const { rows } = await cpdb.query(`
        SELECT DISTINCT
          cc.asset_id as from_asset_id,
          ca_target.id as to_asset_id,
          cc.foreign_key_table,
          cc.foreign_key_column,
          ca_source.table_name as from_table,
          ca_target.table_name as to_table
        FROM catalog_columns cc
        JOIN catalog_assets ca_source ON ca_source.id = cc.asset_id
        JOIN catalog_assets ca_target ON
          ca_target.table_name = cc.foreign_key_table AND
          ca_target.schema_name = ca_source.schema_name AND
          ca_target.datasource_id = ca_source.datasource_id
        WHERE cc.is_foreign_key = true
          AND cc.foreign_key_table IS NOT NULL
          AND ca_source.datasource_id = $1
      `, [dataSourceId]);

      logger.info(`Discovered ${rows.length} FK-based lineage relationships for ${dataSourceId}`);

      return rows.map(row => ({
        from_asset_id: parseInt(row.from_asset_id),
        to_asset_id: parseInt(row.to_asset_id),
        edge_type: 'foreign_key',
        confidence_score: 100,
        discovered_by: 'foreign_key_metadata'
      }));
    } catch (error: any) {
      logger.error('FK lineage discovery error:', error);
      return [];
    }
  }

  /**
   * Discover lineage from view definitions
   */
  private async discoverViewLineage(dataSourceId: string): Promise<LineageRelationship[]> {
    try {
      // Get all views for this data source
      const { rows: views } = await cpdb.query(`
        SELECT id, table_name, schema_name, database_name
        FROM catalog_assets
        WHERE asset_type = 'view'
          AND datasource_id = $1
      `, [dataSourceId]);

      const relationships: LineageRelationship[] = [];

      for (const view of views) {
        // Try to find source tables by querying the actual database
        const sourceTables = await this.getViewSourceTables(dataSourceId, view.database_name, view.schema_name, view.table_name);

        for (const sourceTable of sourceTables) {
          // Find the asset_id for the source table
          const { rows: sourceAssets } = await cpdb.query(`
            SELECT id
            FROM catalog_assets
            WHERE table_name = $1
              AND schema_name = $2
              AND database_name = $3
              AND datasource_id = $4
          `, [sourceTable.table_name, sourceTable.schema_name, view.database_name, dataSourceId]);

          if (sourceAssets.length > 0) {
            relationships.push({
              from_asset_id: parseInt(sourceAssets[0].id),
              to_asset_id: parseInt(view.id),
              edge_type: 'view_source',
              confidence_score: 90,
              discovered_by: 'view_definition'
            });
          }
        }
      }

      logger.info(`Discovered ${relationships.length} view-based lineage relationships for ${dataSourceId}`);
      return relationships;
    } catch (error: any) {
      logger.error('View lineage discovery error:', error);
      return [];
    }
  }

  /**
   * Get source tables for a view by querying information_schema
   */
  private async getViewSourceTables(
    dataSourceId: string,
    databaseName: string,
    schemaName: string,
    viewName: string
  ): Promise<Array<{ table_name: string; schema_name: string }>> {
    try {
      // Get the data source connection info
      const { rows: dsRows } = await cpdb.query(`
        SELECT id, type, connection_config
        FROM data_sources
        WHERE id = $1
      `, [dataSourceId]);

      if (dsRows.length === 0) {
        logger.warn(`Data source not found: ${dataSourceId}`);
        return [];
      }

      const dataSource = dsRows[0];
      const sourceType = dataSource.type;

      // For PostgreSQL
      if (sourceType === 'postgresql') {
        return await this.getPostgreSQLViewSources(dataSource.connection_config, schemaName, viewName);
      }

      // For MSSQL/Azure SQL
      if (sourceType === 'mssql' || sourceType === 'azuresql') {
        return await this.getMSSQLViewSources(dataSource.connection_config, databaseName, schemaName, viewName);
      }

      return [];
    } catch (error: any) {
      logger.error(`Error getting view sources for ${viewName}:`, error);
      return [];
    }
  }

  /**
   * Get PostgreSQL view source tables
   */
  private async getPostgreSQLViewSources(
    config: any,
    schemaName: string,
    viewName: string
  ): Promise<Array<{ table_name: string; schema_name: string }>> {
    try {
      const { Pool } = require('pg');
      const pool = new Pool({
        host: config.host,
        port: config.port || 5432,
        database: config.database,
        user: config.username || config.user,
        password: config.password,
        max: 1,
        connectionTimeoutMillis: 5000
      });

      // Query to find view dependencies
      const query = `
        SELECT DISTINCT
          vtu.table_name,
          vtu.table_schema as schema_name
        FROM information_schema.view_table_usage vtu
        WHERE vtu.view_schema = $1
          AND vtu.view_name = $2
          AND vtu.table_schema NOT IN ('pg_catalog', 'information_schema')
      `;

      const result = await pool.query(query, [schemaName, viewName]);
      await pool.end();

      return result.rows;
    } catch (error: any) {
      logger.error(`PostgreSQL view source discovery error:`, error);
      return [];
    }
  }

  /**
   * Get MSSQL/Azure SQL view source tables
   */
  private async getMSSQLViewSources(
    config: any,
    databaseName: string,
    schemaName: string,
    viewName: string
  ): Promise<Array<{ table_name: string; schema_name: string }>> {
    try {
      const sql = require('mssql');
      const poolConfig = {
        user: config.username || config.user,
        password: config.password,
        server: config.host || config.server,
        port: config.port || 1433,
        database: databaseName || config.database,
        options: {
          encrypt: config.encrypt !== false,
          trustServerCertificate: config.trustServerCertificate !== false,
          connectTimeout: 5000,
          requestTimeout: 5000
        }
      };

      const pool = await sql.connect(poolConfig);

      // Query to find view dependencies
      const query = `
        SELECT DISTINCT
          OBJECT_NAME(d.referenced_id) as table_name,
          OBJECT_SCHEMA_NAME(d.referenced_id) as schema_name
        FROM sys.sql_expression_dependencies d
        INNER JOIN sys.views v ON d.referencing_id = v.object_id
        WHERE OBJECT_SCHEMA_NAME(v.object_id) = @schemaName
          AND OBJECT_NAME(v.object_id) = @viewName
          AND d.referenced_id IS NOT NULL
          AND OBJECT_SCHEMA_NAME(d.referenced_id) NOT IN ('sys', 'information_schema')
      `;

      const result = await pool.request()
        .input('schemaName', sql.NVarChar, schemaName)
        .input('viewName', sql.NVarChar, viewName)
        .query(query);

      await pool.close();

      return result.recordset || [];
    } catch (error: any) {
      logger.error(`MSSQL view source discovery error:`, error);
      return [];
    }
  }

  /**
   * Insert lineage relationships into catalog_lineage table
   */
  private async insertLineage(relationships: LineageRelationship[]): Promise<number> {
    let inserted = 0;

    for (const rel of relationships) {
      try {
        // Check if already exists
        const { rows: existing } = await cpdb.query(`
          SELECT id FROM catalog_lineage
          WHERE from_asset_id = $1 AND to_asset_id = $2 AND edge_type = $3
        `, [rel.from_asset_id, rel.to_asset_id, rel.edge_type]);

        if (existing.length === 0) {
          await cpdb.query(`
            INSERT INTO catalog_lineage (
              tenant_id, from_asset_id, to_asset_id, edge_type, created_at
            )
            VALUES ($1, $2, $3, $4, NOW())
          `, [this.tenantId, rel.from_asset_id, rel.to_asset_id, rel.edge_type]);
          inserted++;
        }
      } catch (error: any) {
        logger.error(`Failed to insert lineage relationship:`, error);
      }
    }

    return inserted;
  }

  /**
   * Clear all lineage for a data source (useful for re-sync)
   */
  async clearLineageForDataSource(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        DELETE FROM catalog_lineage
        WHERE from_asset_id IN (
          SELECT id FROM catalog_assets WHERE datasource_id = $1
        )
        OR to_asset_id IN (
          SELECT id FROM catalog_assets WHERE datasource_id = $1
        )
        RETURNING id
      `, [dataSourceId]);

      logger.info(`Cleared ${rows.length} lineage relationships for data source ${dataSourceId}`);
      return rows.length;
    } catch (error: any) {
      logger.error(`Failed to clear lineage for data source ${dataSourceId}:`, error);
      return 0;
    }
  }
}
