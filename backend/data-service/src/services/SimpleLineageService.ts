import { db } from '../db';
import { logger } from '../utils/logger';

const cpdb = db.getPool();

/**
 * SIMPLE, BULLETPROOF Lineage Discovery
 * No complex AI - just simple matching that WORKS
 */
export class SimpleLineageService {
  private tenantId: number = 1;

  constructor(tenantId?: number) {
    if (tenantId) this.tenantId = tenantId;
  }

  /**
   * Discover ALL lineage for a data source - simple and effective
   */
  async discoverAll(dataSourceId: string): Promise<number> {
    logger.info(`Starting simple lineage discovery for: ${dataSourceId}`);

    try {
      // Clear existing lineage for this data source
      await this.clearLineage(dataSourceId);

      let discovered = 0;

      // Method 1: Exact column name + data type match
      discovered += await this.discoverByExactMatch(dataSourceId);

      // Method 2: Common FK patterns (customer_id, customerId, etc.)
      discovered += await this.discoverByFKPatterns(dataSourceId);

      // Method 3: Semantic similarity (similar column names)
      discovered += await this.discoverBySemanticSimilarity(dataSourceId);

      // Method 4: Data cardinality analysis (one-to-many relationships)
      discovered += await this.discoverByCardinality(dataSourceId);

      logger.info(`Lineage discovery complete: ${discovered} relationships found`);
      return discovered;
    } catch (error: any) {
      logger.error('Lineage discovery failed:', error);
      throw error;
    }
  }

  /**
   * Method 1: Exact column name + same data type = relationship
   * ONLY for columns that can be used for JOINs (id, foreign keys)
   * Example: orders.customer_id (int) → customers.id (int)
   */
  private async discoverByExactMatch(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        WITH potential_matches AS (
          SELECT DISTINCT
            cc1.asset_id as from_asset_id,
            ca1.table_name as from_table,
            cc1.column_name as from_column,
            cc2.asset_id as to_asset_id,
            ca2.table_name as to_table,
            cc2.column_name as to_column
          FROM catalog_columns cc1
          JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
          JOIN catalog_columns cc2 ON cc2.column_name = cc1.column_name
                                   AND cc2.data_type = cc1.data_type
          JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
          WHERE ca1.datasource_id = $1
            AND ca2.datasource_id = $1
            AND ca1.id != ca2.id
            -- ONLY columns that are likely join keys
            AND (
              cc1.column_name ILIKE '%\_id' OR cc1.column_name ILIKE '%\_key' OR
              cc1.column_name ILIKE '%\_fk' OR cc1.column_name ILIKE '%id' OR
              cc1.column_name = 'id' OR cc1.column_name ILIKE 'pk\_%'
            )
            AND (
              cc2.column_name ILIKE '%\_id' OR cc2.column_name ILIKE '%\_key' OR
              cc2.column_name ILIKE '%\_fk' OR cc2.column_name ILIKE '%id' OR
              cc2.column_name = 'id' OR cc2.column_name ILIKE 'pk\_%'
            )
        )
        SELECT
          from_asset_id,
          to_asset_id,
          from_table,
          to_table,
          from_column,
          to_column
        FROM potential_matches
        -- Match where column name suggests a foreign key relationship
        WHERE (
          -- The from_column references the to_table name
          -- Examples: customer_id → customers, country_id → countries, product_id → products
          (
            -- Remove common plurals: 'ies' → 'y', 's' → ''
            (LOWER(from_column) LIKE '%' || LOWER(REGEXP_REPLACE(REGEXP_REPLACE(to_table, 'ies$', 'y'), 's$', '')) || '%'
             AND (LOWER(to_column) LIKE '%' || LOWER(REGEXP_REPLACE(REGEXP_REPLACE(to_table, 'ies$', 'y'), 's$', '')) || '%' OR to_column = 'id'))
            OR
            -- Direct table name match (order_id → order table)
            (LOWER(from_column) LIKE '%' || LOWER(to_table) || '%'
             AND (LOWER(to_column) LIKE '%' || LOWER(to_table) || '%' OR to_column = 'id'))
          )
        )
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          // Build metadata with column details
          const metadata = {
            columns: [{
              from: row.from_column,
              to: row.to_column,
              matchType: 'exact',
              dataType: 'matched'
            }],
            discoveryMethod: 'exact_match',
            fromTable: row.from_table,
            toTable: row.to_table
          };

          // SWAP direction: parent table → child table
          // So countries → customer_addresses (countries flows to customer_addresses)
          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'column_match', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.to_asset_id, row.from_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`Lineage: ${row.from_table}.${row.from_column} → ${row.to_table}.${row.to_column}`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`Exact match method found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('Exact match discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 2: FK naming patterns
   * Examples: customer_id → customers.id, customerId → Customer.id, order_fk → orders.id
   */
  private async discoverByFKPatterns(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        SELECT DISTINCT
          cc1.asset_id as from_asset_id,
          ca1.table_name as from_table,
          cc1.column_name as from_column,
          cc2.asset_id as to_asset_id,
          ca2.table_name as to_table,
          cc2.column_name as to_column
        FROM catalog_columns cc1
        JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
        CROSS JOIN catalog_columns cc2
        JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
        WHERE ca1.datasource_id = $1
          AND ca2.datasource_id = $1
          AND ca1.id != ca2.id
          AND cc1.data_type = cc2.data_type
          AND (
            -- Pattern: customer_id → customers table
            (LOWER(cc1.column_name) LIKE '%' || LOWER(REPLACE(ca2.table_name, 's', '')) || '%id%')
            OR
            -- Pattern: customer_id → customer table (singular)
            (LOWER(cc1.column_name) LIKE LOWER(ca2.table_name) || '%id%')
            OR
            -- Pattern: customerId → Customer/Customers table
            (LOWER(REPLACE(cc1.column_name, '_', '')) LIKE '%' || LOWER(REPLACE(REPLACE(ca2.table_name, 's', ''), '_', '')) || 'id%')
          )
          AND (cc2.column_name = 'id' OR cc2.column_name ILIKE '%id%')
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          // Build metadata with column details
          const metadata = {
            columns: [{
              from: row.from_column,
              to: row.to_column,
              matchType: 'fk_pattern',
              dataType: 'matched'
            }],
            discoveryMethod: 'fk_pattern',
            fromTable: row.from_table,
            toTable: row.to_table
          };

          // SWAP direction: parent table → child table (same as above)
          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'fk_pattern', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.to_asset_id, row.from_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`FK Pattern: ${row.from_table}.${row.from_column} → ${row.to_table}.${row.to_column}`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`FK pattern method found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('FK pattern discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 3: Semantic Similarity - Find similar column names
   * Examples:
   * - user_code, usercode, usr_cd → similar
   * - emp_no, employee_number, empnum → similar
   * Uses Levenshtein distance for fuzzy matching
   */
  private async discoverBySemanticSimilarity(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        SELECT DISTINCT
          cc1.asset_id as from_asset_id,
          ca1.table_name as from_table,
          cc1.column_name as from_column,
          cc2.asset_id as to_asset_id,
          ca2.table_name as to_table,
          cc2.column_name as to_column,
          levenshtein(LOWER(cc1.column_name), LOWER(cc2.column_name)) as similarity_distance
        FROM catalog_columns cc1
        JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
        CROSS JOIN catalog_columns cc2
        JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
        WHERE ca1.datasource_id = $1
          AND ca2.datasource_id = $1
          AND ca1.id != ca2.id
          AND cc1.data_type = cc2.data_type
          AND cc1.column_name != cc2.column_name
          -- Levenshtein distance < 3 means very similar
          AND levenshtein(LOWER(cc1.column_name), LOWER(cc2.column_name)) <= 3
          -- At least one should be an ID/key column
          AND (
            cc1.column_name ILIKE '%id%' OR cc1.column_name ILIKE '%key%' OR
            cc2.column_name ILIKE '%id%' OR cc2.column_name ILIKE '%key%' OR
            cc1.column_name = 'id' OR cc2.column_name = 'id'
          )
        ORDER BY similarity_distance ASC
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          const metadata = {
            columns: [{
              from: row.from_column,
              to: row.to_column,
              matchType: 'semantic_similarity',
              dataType: 'matched',
              similarityScore: row.similarity_distance
            }],
            discoveryMethod: 'semantic_similarity',
            fromTable: row.from_table,
            toTable: row.to_table,
            confidence: 'medium'
          };

          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'semantic_match', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.to_asset_id, row.from_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`Semantic match: ${row.from_table}.${row.from_column} ≈ ${row.to_table}.${row.to_column} (distance: ${row.similarity_distance})`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`Semantic similarity method found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      // If levenshtein extension not installed, skip silently
      if (error.message?.includes('levenshtein')) {
        logger.warn('Levenshtein extension not available - skipping semantic similarity');
        return 0;
      }
      logger.error('Semantic similarity discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 4: Cardinality Analysis - Find one-to-many relationships
   * Analyzes row counts and unique value counts to infer relationships
   * Example: If Orders.customer_id has 1000 unique values and Customers has 1000 rows
   * → Likely relationship
   */
  private async discoverByCardinality(dataSourceId: string): Promise<number> {
    try {
      // This method requires actual data profiling (row counts, unique counts)
      // For now, we'll look for tables with matching row counts or unique value patterns
      const { rows } = await cpdb.query(`
        WITH table_stats AS (
          SELECT
            ca.id as asset_id,
            ca.table_name,
            ca.row_count,
            cc.column_name,
            cc.id as column_id,
            -- Try to parse unique_percentage from profile_json if available
            COALESCE(
              (cc.profile_json->>'unique_count')::bigint,
              COALESCE(
                (cc.profile_json->>'distinct_count')::bigint,
                0
              )
            ) as unique_count
          FROM catalog_assets ca
          JOIN catalog_columns cc ON cc.asset_id = ca.id
          WHERE ca.datasource_id = $1
            AND ca.row_count > 0
            AND (
              cc.column_name ILIKE '%id%' OR cc.column_name ILIKE '%key%' OR
              cc.column_name ILIKE '%code%' OR cc.column_name ILIKE '%num%'
            )
        )
        SELECT DISTINCT
          t1.asset_id as from_asset_id,
          t1.table_name as from_table,
          t1.column_name as from_column,
          t2.asset_id as to_asset_id,
          t2.table_name as to_table,
          t2.column_name as to_column,
          t1.row_count as from_row_count,
          t2.row_count as to_row_count,
          t1.unique_count as from_unique_count,
          t2.unique_count as to_unique_count
        FROM table_stats t1
        CROSS JOIN table_stats t2
        WHERE t1.asset_id != t2.asset_id
          -- The child table (t1) should have many rows pointing to fewer parent records (t2)
          AND t1.row_count > t2.row_count
          -- The unique count in child table should roughly match parent row count (±20%)
          AND t1.unique_count > 0
          AND t2.row_count > 0
          AND ABS(t1.unique_count - t2.row_count) <= (t2.row_count * 0.2)
          -- Column names should suggest relationship
          AND (
            LOWER(t1.column_name) LIKE '%' || LOWER(t2.table_name) || '%'
            OR LOWER(t1.column_name) LIKE '%' || LOWER(REPLACE(t2.table_name, 's', '')) || '%'
          )
        LIMIT 100
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          const metadata = {
            columns: [{
              from: row.from_column,
              to: row.to_column,
              matchType: 'cardinality_analysis',
              dataType: 'inferred'
            }],
            discoveryMethod: 'cardinality',
            fromTable: row.from_table,
            toTable: row.to_table,
            confidence: 'low',
            cardinalityInfo: {
              childRows: row.from_row_count,
              parentRows: row.to_row_count,
              childUnique: row.from_unique_count,
              parentUnique: row.to_unique_count
            }
          };

          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'cardinality_match', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.to_asset_id, row.from_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`Cardinality match: ${row.from_table}.${row.from_column} → ${row.to_table}.${row.to_column} (${row.from_row_count}:${row.to_row_count} rows)`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`Cardinality analysis method found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('Cardinality analysis discovery error:', error);
      return 0;
    }
  }

  /**
   * Clear existing lineage for a data source
   */
  private async clearLineage(dataSourceId: string): Promise<void> {
    try {
      await cpdb.query(`
        DELETE FROM catalog_lineage
        WHERE from_asset_id IN (
          SELECT id FROM catalog_assets WHERE datasource_id = $1
        )
        OR to_asset_id IN (
          SELECT id FROM catalog_assets WHERE datasource_id = $1
        )
      `, [dataSourceId]);
    } catch (error: any) {
      logger.error('Failed to clear lineage:', error);
    }
  }
}
