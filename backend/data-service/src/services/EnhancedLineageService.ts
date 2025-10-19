import { db } from '../db';
import { logger } from '../utils/logger';

const cpdb = db.getPool();

/**
 * Enhanced Lineage Discovery Service
 * Implements sophisticated pattern matching for real-world database relationships
 * Handles normalized and denormalized database patterns
 */
export class EnhancedLineageService {
  private tenantId: number = 1;

  // Common ID column patterns that should be treated as primary keys
  private readonly PRIMARY_KEY_PATTERNS = [
    '^id$',           // id
    '^pk_',           // pk_customer
    '_pk$',           // customer_pk
    '^primary_',      // primary_key
  ];

  // Common foreign key patterns with their confidence levels
  private readonly FOREIGN_KEY_PATTERNS = [
    { pattern: '_id$', confidence: 0.95 },        // customer_id
    { pattern: 'id[0-9]*$', confidence: 0.90 },   // customerid, userid1
    { pattern: '_fk$', confidence: 0.95 },        // customer_fk
    { pattern: '_key$', confidence: 0.85 },       // customer_key
    { pattern: '_code$', confidence: 0.75 },      // customer_code
    { pattern: '_ref$', confidence: 0.85 },       // customer_ref
    { pattern: '_no$', confidence: 0.70 },        // customer_no
    { pattern: '_num$', confidence: 0.70 },       // customer_num
  ];

  // Columns that should NEVER be considered for relationships
  private readonly EXCLUDED_COLUMNS = [
    // User profile fields
    'firstname', 'lastname', 'middlename', 'fullname', 'name',
    'email', 'phone', 'cellphone', 'homephone', 'workphone',
    'street', 'city', 'state', 'zip', 'address', 'location',
    'gender', 'dob', 'dateofbirth', 'birthdate', 'age',
    'profilepicture', 'avatar', 'photo', 'image',

    // Authentication fields
    'passwordhash', 'password', 'securitystamp', 'salt',
    'concurrencystamp', 'lockoutend', 'accessfailedcount',
    'emailconfirmed', 'phoneconfirmed', 'twofactorenabled',
    'lockoutenabled',

    // Descriptive fields
    'description', 'notes', 'comments', 'title', 'label',
    'notificationtitle', 'subject', 'message', 'content',

    // Metadata fields
    'created_at', 'updated_at', 'deleted_at', 'modified',
    'createdon', 'updatedon', 'datetime', 'timestamp',

    // Status/flag fields
    'is_active', 'is_deleted', 'is_enabled', 'active',
    'enabled', 'disabled', 'visible', 'hidden',
    'markasread', 'isread', 'read', 'unread',

    // Counting fields
    'count', 'total', 'sum', 'average', 'min', 'max',
    'how_many_times', 'occurrences', 'frequency'
  ];

  constructor(tenantId?: number) {
    if (tenantId) this.tenantId = tenantId;
  }

  /**
   * Main discovery method
   */
  async discoverAll(dataSourceId: string, options: { includeJunctionTables?: boolean } = {}): Promise<number> {
    logger.info(`Starting enhanced lineage discovery for: ${dataSourceId}`);

    try {
      // Clear existing lineage
      await this.clearLineage(dataSourceId);

      let discovered = 0;

      // Method 0: Actual database FK constraints (100% accurate, highest priority)
      discovered += await this.discoverActualForeignKeys(dataSourceId);

      // Method 1: Direct Primary Key relationships (highest confidence)
      discovered += await this.discoverPrimaryKeyRelationships(dataSourceId);

      // Method 2: Smart foreign key pattern matching (for implicit relationships)
      discovered += await this.discoverSmartForeignKeys(dataSourceId);

      // Method 3: Composite key relationships (disabled by default - too many false positives)
      // discovered += await this.discoverCompositeKeys(dataSourceId);

      // Method 4: Junction/Bridge table patterns (disabled by default - needs refinement)
      if (options.includeJunctionTables) {
        discovered += await this.discoverJunctionTables(dataSourceId);
      }

      // Method 5: View lineage discovery
      discovered += await this.discoverViewLineage(dataSourceId);

      logger.info(`Enhanced lineage discovery complete: ${discovered} relationships found`);
      return discovered;
    } catch (error: any) {
      logger.error('Enhanced lineage discovery failed:', error);
      throw error;
    }
  }

  /**
   * Method 0: Discover Actual Foreign Key Constraints
   * Uses real FK constraints from the database (100% accurate)
   */
  private async discoverActualForeignKeys(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        SELECT
          ca1.id as from_asset_id,
          ca1.table_name as from_table,
          cc.column_name as from_column,
          ca2.id as to_asset_id,
          ca2.table_name as to_table,
          cc.foreign_key_column as to_column
        FROM catalog_columns cc
        JOIN catalog_assets ca1 ON ca1.id = cc.asset_id
        JOIN catalog_assets ca2 ON ca2.table_name = cc.foreign_key_table
          AND ca2.datasource_id = ca1.datasource_id
          AND ca2.database_name = ca1.database_name
        WHERE ca1.datasource_id = $1
          AND cc.is_foreign_key = true
          AND cc.foreign_key_table IS NOT NULL
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          const metadata = {
            columns: [{
              from: row.from_column,
              to: row.to_column,
              matchType: 'database_fk',
              confidence: 1.0
            }],
            discoveryMethod: 'database_constraint',
            fromTable: row.from_table,
            toTable: row.to_table,
            confidence: 'absolute',
            source: 'database_metadata'
          };

          // Store lineage: child table → parent table
          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'database_fk', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.from_asset_id, row.to_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`Database FK: ${row.from_table}.${row.from_column} → ${row.to_table}.${row.to_column} (100% accurate)`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`Actual database FK constraints found: ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('Actual FK discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 1: Discover Primary Key relationships
   * Matches foreign keys to primary keys with proper naming conventions
   */
  private async discoverPrimaryKeyRelationships(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        WITH pk_candidates AS (
          -- Find likely primary key columns
          SELECT DISTINCT
            ca.id as asset_id,
            ca.table_name,
            cc.column_name,
            cc.data_type,
            ca.database_name
          FROM catalog_columns cc
          JOIN catalog_assets ca ON ca.id = cc.asset_id
          WHERE ca.datasource_id = $1
            AND (
              cc.column_name = 'id' OR
              cc.column_name = 'Id' OR
              cc.column_name ILIKE 'pk_%' OR
              cc.is_primary_key = true OR
              cc.ordinal = 1  -- Often first column is PK
            )
        ),
        fk_candidates AS (
          -- Find likely foreign key columns
          SELECT DISTINCT
            ca.id as asset_id,
            ca.table_name,
            cc.column_name,
            cc.data_type,
            ca.database_name,
            -- Extract the referenced table name from the column name
            CASE
              -- Handle patterns like UserId, UserID, user_id -> User
              WHEN cc.column_name ~* '^[A-Z][a-z]+ID$' THEN
                SUBSTRING(cc.column_name FROM '^([A-Z][a-z]+)ID$')
              WHEN cc.column_name ~* '^[A-Z][a-z]+Id$' THEN
                SUBSTRING(cc.column_name FROM '^([A-Z][a-z]+)Id$')
              WHEN cc.column_name ~* '^.+_id$' THEN
                SUBSTRING(cc.column_name FROM '^(.+)_id$')
              WHEN cc.column_name ~* '^.+ID$' THEN
                SUBSTRING(cc.column_name FROM '^(.+)ID$')
              -- Handle patterns like WishID -> tblWish or Wish
              WHEN cc.column_name ~* '^[A-Z][a-z]+[A-Z]+$' THEN
                SUBSTRING(cc.column_name FROM '^([A-Z][a-z]+)[A-Z]+$')
              ELSE NULL
            END as inferred_table
          FROM catalog_columns cc
          JOIN catalog_assets ca ON ca.id = cc.asset_id
          WHERE ca.datasource_id = $1
            AND cc.column_name != 'id'
            AND cc.column_name != 'Id'
            AND (
              cc.column_name ~* '(id|ID|Id|_id|_fk|_key|_ref)$' OR
              cc.column_name ~* '^fk_'
            )
            -- Exclude obviously non-FK columns
            AND LOWER(cc.column_name) NOT IN (${this.EXCLUDED_COLUMNS.map(c => `'${c}'`).join(',')})
        )
        SELECT
          fk.asset_id as from_asset_id,
          fk.table_name as from_table,
          fk.column_name as from_column,
          pk.asset_id as to_asset_id,
          pk.table_name as to_table,
          pk.column_name as to_column,
          fk.data_type as from_type,
          pk.data_type as to_type,
          fk.inferred_table,
          CASE
            -- Exact table name match
            WHEN LOWER(pk.table_name) = LOWER(fk.inferred_table) THEN 1.0
            -- Table name with prefix (tblUser -> User)
            WHEN LOWER(pk.table_name) = LOWER(REPLACE(fk.inferred_table, 'tbl', '')) THEN 0.95
            WHEN LOWER('tbl' || pk.table_name) = LOWER(fk.inferred_table) THEN 0.95
            -- Plural handling
            WHEN LOWER(pk.table_name || 's') = LOWER(fk.inferred_table) THEN 0.90
            WHEN LOWER(pk.table_name) = LOWER(fk.inferred_table || 's') THEN 0.90
            -- Partial match
            WHEN LOWER(pk.table_name) LIKE '%' || LOWER(fk.inferred_table) || '%' THEN 0.70
            WHEN LOWER(fk.inferred_table) LIKE '%' || LOWER(pk.table_name) || '%' THEN 0.70
            ELSE 0.5
          END as confidence_score
        FROM fk_candidates fk
        CROSS JOIN pk_candidates pk
        WHERE fk.asset_id != pk.asset_id
          AND fk.database_name = pk.database_name
          AND fk.data_type = pk.data_type  -- Types must match
          AND fk.inferred_table IS NOT NULL
          AND (
            -- Match inferred table name to actual table name
            LOWER(pk.table_name) = LOWER(fk.inferred_table) OR
            LOWER(pk.table_name) = LOWER(REPLACE(fk.inferred_table, 'tbl', '')) OR
            LOWER('tbl' || pk.table_name) = LOWER(fk.inferred_table) OR
            -- Handle plurals
            LOWER(pk.table_name || 's') = LOWER(fk.inferred_table) OR
            LOWER(pk.table_name) = LOWER(fk.inferred_table || 's')
          )
        ORDER BY confidence_score DESC
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          const metadata = {
            columns: [{
              from: row.from_column,
              to: row.to_column,
              matchType: 'primary_key',
              dataType: row.from_type,
              confidence: row.confidence_score
            }],
            discoveryMethod: 'primary_key_match',
            fromTable: row.from_table,
            toTable: row.to_table,
            confidence: row.confidence_score >= 0.9 ? 'high' :
                       row.confidence_score >= 0.7 ? 'medium' : 'low',
            inferredTable: row.inferred_table
          };

          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'pk_match', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.to_asset_id, row.from_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`PK Match: ${row.from_table}.${row.from_column} → ${row.to_table}.${row.to_column} (confidence: ${row.confidence_score})`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`Primary key matching found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('Primary key discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 2: Smart Foreign Key Pattern Matching
   * Uses naming conventions and data types to infer relationships
   */
  private async discoverSmartForeignKeys(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        WITH smart_matches AS (
          SELECT DISTINCT
            cc1.asset_id as from_asset_id,
            ca1.table_name as from_table,
            cc1.column_name as from_column,
            cc1.data_type as from_type,
            cc2.asset_id as to_asset_id,
            ca2.table_name as to_table,
            cc2.column_name as to_column,
            cc2.data_type as to_type,
            -- Calculate confidence based on pattern matching
            CASE
              -- Perfect match: UserId -> User.Id
              WHEN cc1.column_name ~* ('^' || ca2.table_name || '(ID|Id|_id)$')
                AND cc2.column_name ~* '^(id|Id|ID)$' THEN 0.95

              -- Good match: user_id -> User.id
              WHEN LOWER(cc1.column_name) = LOWER(ca2.table_name || '_id')
                AND LOWER(cc2.column_name) = 'id' THEN 0.90

              -- Handle table prefix (case-insensitive): WishID -> TblWish.Id, WishID -> tblWish.Id
              WHEN cc1.column_name ~* ('^' || REGEXP_REPLACE(ca2.table_name, '^tbl', '', 'i') || '(ID|Id|_id)$')
                AND cc2.column_name ~* '^(id|Id|ID)$'
                AND ca2.table_name ~* '^tbl' THEN 0.90

              -- Reverse: Handle FK with Tbl prefix: TblWishId -> Wish.Id
              WHEN cc1.column_name ~* ('^Tbl' || ca2.table_name || '(ID|Id|_id)$')
                AND cc2.column_name ~* '^(id|Id|ID)$' THEN 0.85

              -- Compound FK names: CreatedByUserId, PickedByUserId -> User.Id
              WHEN cc1.column_name ~* ('.*' || ca2.table_name || '(ID|Id|_id)$')
                AND cc2.column_name ~* '^(id|Id|ID)$'
                AND LENGTH(cc1.column_name) > LENGTH(ca2.table_name) + 2 THEN 0.80

              -- Plural handling: category_id -> categories.id
              WHEN cc1.column_name ~* ('^' || LEFT(ca2.table_name, LENGTH(ca2.table_name)-1) || '(ID|Id|_id)$')
                AND ca2.table_name ~* 's$'
                AND cc2.column_name ~* '^(id|Id|ID)$' THEN 0.85

              ELSE 0.0
            END as confidence_score
          FROM catalog_columns cc1
          JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
          CROSS JOIN catalog_columns cc2
          JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
          WHERE ca1.datasource_id = $1
            AND ca2.datasource_id = $1
            AND ca1.id != ca2.id
            AND ca1.database_name = ca2.database_name
            AND cc1.data_type = cc2.data_type  -- Types must match
            -- Only consider ID-like columns
            AND cc1.column_name ~* '(id|ID|Id|_id|_fk|_key)$'
            AND cc2.column_name ~* '^(id|Id|ID|pk_)'
            -- Exclude columns that already have database FK metadata (priority to actual constraints)
            AND cc1.is_foreign_key != true
            -- Exclude non-FK columns
            AND LOWER(cc1.column_name) NOT IN (${this.EXCLUDED_COLUMNS.map(c => `'${c}'`).join(',')})
            AND LOWER(cc2.column_name) NOT IN (${this.EXCLUDED_COLUMNS.map(c => `'${c}'`).join(',')})
        )
        SELECT * FROM smart_matches
        WHERE confidence_score > 0.5
        ORDER BY confidence_score DESC
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          const metadata = {
            columns: [{
              from: row.from_column,
              to: row.to_column,
              matchType: 'smart_fk',
              dataType: row.from_type,
              confidence: row.confidence_score
            }],
            discoveryMethod: 'smart_foreign_key',
            fromTable: row.from_table,
            toTable: row.to_table,
            confidence: row.confidence_score >= 0.9 ? 'high' :
                       row.confidence_score >= 0.7 ? 'medium' : 'low'
          };

          // Store lineage as child → parent (child depends on parent)
          // row.from = Notifications (child with FK), row.to = TblWish (parent with PK)
          // We store as: Notifications → TblWish (correct direction)
          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'smart_fk', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.from_asset_id, row.to_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`Smart FK: ${row.from_table}.${row.from_column} → ${row.to_table}.${row.to_column} (confidence: ${row.confidence_score})`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`Smart foreign key matching found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('Smart FK discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 3: Discover Composite Key Relationships
   * For tables that use multiple columns as keys
   */
  private async discoverCompositeKeys(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        WITH composite_patterns AS (
          SELECT
            ca1.id as from_asset_id,
            ca1.table_name as from_table,
            ca2.id as to_asset_id,
            ca2.table_name as to_table,
            COUNT(*) as matching_columns,
            array_agg(cc1.column_name || '->' || cc2.column_name) as column_pairs
          FROM catalog_columns cc1
          JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
          JOIN catalog_columns cc2 ON cc2.column_name = cc1.column_name
                                   AND cc2.data_type = cc1.data_type
          JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
          WHERE ca1.datasource_id = $1
            AND ca2.datasource_id = $1
            AND ca1.id != ca2.id
            AND ca1.database_name = ca2.database_name
            -- Look for ID/key columns
            AND cc1.column_name ~* '(id|key|code|_no)$'
          GROUP BY ca1.id, ca1.table_name, ca2.id, ca2.table_name
          HAVING COUNT(*) >= 2  -- At least 2 matching columns
        )
        SELECT * FROM composite_patterns
        ORDER BY matching_columns DESC
        LIMIT 50
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          const metadata = {
            columns: row.column_pairs,
            matchType: 'composite_key',
            discoveryMethod: 'composite_key_match',
            fromTable: row.from_table,
            toTable: row.to_table,
            confidence: 'medium',
            matchingColumns: row.matching_columns
          };

          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'composite_key', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.to_asset_id, row.from_asset_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`Composite Key: ${row.from_table} → ${row.to_table} (${row.matching_columns} columns)`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`Composite key matching found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('Composite key discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 4: Discover Junction/Bridge Tables
   * Many-to-many relationships through intermediate tables
   * FIXED: Much stricter criteria to avoid false positives
   */
  private async discoverJunctionTables(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        WITH junction_candidates AS (
          -- Find tables that are TRULY junction tables
          -- Must have exactly 2 FK columns and minimal other columns
          SELECT
            ca.id as junction_id,
            ca.table_name as junction_table,
            ca.database_name,
            array_agg(
              CASE
                WHEN cc.column_name ~* '(UserId|RoleId|_id|_fk)$'
                  AND cc.column_name NOT IN ('Id', 'id', 'ID')
                THEN cc.column_name
              END
            ) FILTER (WHERE cc.column_name ~* '(UserId|RoleId|_id|_fk)$' AND cc.column_name NOT IN ('Id', 'id', 'ID')) as fk_columns,
            COUNT(*) as total_column_count
          FROM catalog_assets ca
          JOIN catalog_columns cc ON cc.asset_id = ca.id
          WHERE ca.datasource_id = $1
            -- Exclude system tables/views
            AND ca.table_name NOT IN ('sql_logins', 'database_usage', 'bandwidth_usage', 'firewall_rules', 'event_log')
            AND ca.table_name NOT LIKE 'sys%'
            AND ca.table_name NOT LIKE 'dm_%'
            -- Only consider real junction table patterns
            AND (
              ca.table_name LIKE '%User%Role%' OR
              ca.table_name LIKE '%Role%User%' OR
              ca.table_name = 'UserRoles' OR
              ca.table_name LIKE '%_%_%%' -- table1_to_table2 pattern
            )
          GROUP BY ca.id, ca.table_name, ca.database_name
          HAVING array_length(
            array_agg(
              CASE
                WHEN cc.column_name ~* '(UserId|RoleId|_id|_fk)$'
                  AND cc.column_name NOT IN ('Id', 'id', 'ID')
                THEN cc.column_name
              END
            ) FILTER (WHERE cc.column_name ~* '(UserId|RoleId|_id|_fk)$' AND cc.column_name NOT IN ('Id', 'id', 'ID')),
            1
          ) = 2  -- EXACTLY 2 foreign key columns
          AND COUNT(*) <= 5  -- Junction tables should be small (2 FKs + maybe id, created_at, etc.)
        )
        SELECT
          jc.junction_id,
          jc.junction_table,
          jc.fk_columns,
          jc.total_column_count
        FROM junction_candidates jc
      `, [dataSourceId]);

      let inserted = 0;
      for (const row of rows) {
        try {
          // Parse the FK columns to find referenced tables
          const fkColumns = row.fk_columns || [];
          const referencedTables = new Set<string>();

          for (const col of fkColumns) {
            if (!col) continue;
            // Extract table name from column name (UserId -> User, RoleId -> Role)
            const match = col.match(/^(.+?)(Id|ID|_id|_fk)$/);
            if (match) {
              referencedTables.add(match[1]);
            }
          }

          // Only process if we found exactly 2 referenced tables
          if (referencedTables.size !== 2) {
            continue;
          }

          const tables = Array.from(referencedTables);

          // Find the actual table assets
          const { rows: tableAssets } = await cpdb.query(`
            SELECT id, table_name
            FROM catalog_assets
            WHERE datasource_id = $1
              AND (table_name = $2 OR table_name = $3)
          `, [dataSourceId, tables[0], tables[1]]);

          if (tableAssets.length !== 2) {
            continue; // Both referenced tables must exist
          }

          // Create relationships: table1 -> junction, table2 -> junction
          for (const tableAsset of tableAssets) {
            const metadata = {
              matchType: 'junction_table',
              discoveryMethod: 'strict_junction_detection',
              fromTable: tableAsset.table_name,
              toTable: row.junction_table,
              confidence: 'high',
              fkColumns: row.fk_columns
            };

            const { rowCount } = await cpdb.query(`
              INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
              VALUES ($1, $2, $3, 'junction', $4, NOW())
              ON CONFLICT DO NOTHING
            `, [this.tenantId, tableAsset.id, row.junction_id, JSON.stringify(metadata)]);

            if (rowCount && rowCount > 0) {
              inserted++;
              logger.info(`Junction Table: ${tableAsset.table_name} → ${row.junction_table}`);
            }
          }
        } catch (err) {
          logger.error('Junction table processing error:', err);
        }
      }

      logger.info(`Junction table detection found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('Junction table discovery error:', error);
      return 0;
    }
  }

  /**
   * Method 5: Discover View Lineage
   * Matches views to their source tables based on column similarity
   */
  private async discoverViewLineage(dataSourceId: string): Promise<number> {
    try {
      const { rows } = await cpdb.query(`
        WITH view_table_matches AS (
          SELECT
            v.id as view_id,
            v.table_name as view_name,
            t.id as table_id,
            t.table_name as table_name,
            COUNT(DISTINCT vc.column_name) as matching_columns,
            COUNT(DISTINCT vc.column_name) * 1.0 / NULLIF(COUNT(DISTINCT vc2.column_name), 0) as column_match_ratio
          FROM catalog_assets v
          -- View columns
          JOIN catalog_columns vc ON vc.asset_id = v.id
          -- Find tables with matching columns
          JOIN catalog_columns tc ON tc.column_name = vc.column_name
                                  AND tc.data_type = vc.data_type
          JOIN catalog_assets t ON t.id = tc.asset_id
                                AND t.asset_type = 'table'
                                AND t.datasource_id = v.datasource_id
          -- All view columns for ratio calculation
          LEFT JOIN catalog_columns vc2 ON vc2.asset_id = v.id
          WHERE v.datasource_id = $1
            AND v.asset_type = 'view'
            AND v.table_name NOT LIKE 'sys%'  -- Exclude system views
            AND v.table_name NOT LIKE 'dm_%'  -- Exclude dynamic management views
          GROUP BY v.id, v.table_name, t.id, t.table_name
          HAVING COUNT(DISTINCT vc.column_name) >= 3  -- At least 3 matching columns
             AND COUNT(DISTINCT vc.column_name) * 1.0 / NULLIF(COUNT(DISTINCT vc2.column_name), 0) >= 0.5  -- At least 50% match
        )
        SELECT
          view_id,
          view_name,
          table_id,
          table_name,
          matching_columns,
          column_match_ratio,
          CASE
            -- Perfect name match (View 'Wish' -> Table 'TblWish' or 'Wish')
            WHEN LOWER(view_name) = LOWER(table_name) THEN 1.0
            WHEN LOWER(view_name) = LOWER(REPLACE(table_name, 'tbl', '')) THEN 0.95
            WHEN LOWER('tbl' || view_name) = LOWER(table_name) THEN 0.95
            -- High column match ratio
            WHEN column_match_ratio >= 0.9 THEN 0.90
            WHEN column_match_ratio >= 0.7 THEN 0.80
            ELSE 0.70
          END as confidence_score
        FROM view_table_matches
        ORDER BY view_id, confidence_score DESC, matching_columns DESC
      `, [dataSourceId]);

      let inserted = 0;
      const processedViews = new Set<string>();

      for (const row of rows) {
        // Only take the best match for each view
        const viewKey = `${row.view_id}`;
        if (processedViews.has(viewKey)) {
          continue;
        }
        processedViews.add(viewKey);

        try {
          const metadata = {
            matchType: 'view_source',
            viewName: row.view_name,
            tableName: row.table_name,
            matchingColumns: row.matching_columns,
            columnMatchRatio: row.column_match_ratio,
            confidence: row.confidence_score >= 0.9 ? 'high' :
                       row.confidence_score >= 0.8 ? 'medium' : 'low'
          };

          // Views depend on their source tables: View → Table
          const { rowCount } = await cpdb.query(`
            INSERT INTO catalog_lineage (tenant_id, from_asset_id, to_asset_id, edge_type, metadata, created_at)
            VALUES ($1, $2, $3, 'view_source', $4, NOW())
            ON CONFLICT DO NOTHING
          `, [this.tenantId, row.view_id, row.table_id, JSON.stringify(metadata)]);

          if (rowCount && rowCount > 0) {
            inserted++;
            logger.info(`View Lineage: ${row.view_name} → ${row.table_name} (${row.matching_columns} columns, ${Math.round(row.column_match_ratio * 100)}% match)`);
          }
        } catch (err) {
          // Skip duplicates
        }
      }

      logger.info(`View lineage discovery found ${inserted} relationships`);
      return inserted;
    } catch (error: any) {
      logger.error('View lineage discovery error:', error);
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