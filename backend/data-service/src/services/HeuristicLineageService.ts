import { db } from '../db';
import { logger } from '../utils/logger';

const cpdb = db.getPool();

export interface LineageHint {
  from_asset_id: number;
  to_asset_id: number;
  from_column: string;
  to_column: string;
  confidence_score: number;
  discovery_method: string;
  reasoning: string;
}

/**
 * Heuristic-based lineage discovery for databases without explicit FK constraints
 * Perfect for NoSQL, legacy systems, or poorly documented databases
 */
export class HeuristicLineageService {
  private tenantId: number = 1;

  constructor(tenantId?: number) {
    if (tenantId) this.tenantId = tenantId;
  }

  /**
   * Discover lineage using multiple heuristic methods
   */
  async discoverHeuristicLineage(dataSourceId: string): Promise<{
    discovered: number;
    hints: LineageHint[];
  }> {
    logger.info(`Starting heuristic lineage discovery for data source: ${dataSourceId}`);

    const allHints: LineageHint[] = [];

    try {
      // Method 1: Column name pattern matching (e.g., customer_id → customers.id)
      const nameHints = await this.discoverByColumnNames(dataSourceId);
      allHints.push(...nameHints);

      // Method 2: Data type and cardinality analysis
      const cardinalityHints = await this.discoverByCardinality(dataSourceId);
      allHints.push(...cardinalityHints);

      // Method 3: Common naming conventions (user_id, userId, customer_fk, etc.)
      const conventionHints = await this.discoverByNamingConventions(dataSourceId);
      allHints.push(...conventionHints);

      // Method 4: Column value overlap analysis (sample data comparison)
      const overlapHints = await this.discoverByValueOverlap(dataSourceId);
      allHints.push(...overlapHints);

      // Deduplicate and rank by confidence
      const uniqueHints = this.deduplicateHints(allHints);

      // Filter by minimum confidence threshold (60%)
      const highConfidenceHints = uniqueHints.filter(h => h.confidence_score >= 60);

      // Insert discovered relationships
      const inserted = await this.insertHeuristicLineage(highConfidenceHints);

      logger.info(`Heuristic lineage discovery complete: ${inserted} relationships from ${highConfidenceHints.length} hints`);

      return {
        discovered: inserted,
        hints: highConfidenceHints
      };
    } catch (error: any) {
      logger.error(`Heuristic lineage discovery failed:`, error);
      throw error;
    }
  }

  /**
   * Method 1: Discover lineage by matching column names
   * Example: orders.customer_id → customers.id
   */
  private async discoverByColumnNames(dataSourceId: string): Promise<LineageHint[]> {
    try {
      const { rows } = await cpdb.query(`
        SELECT
          cc1.asset_id as from_asset_id,
          cc1.column_name as from_column,
          ca1.table_name as from_table,
          cc2.asset_id as to_asset_id,
          cc2.column_name as to_column,
          ca2.table_name as to_table
        FROM catalog_columns cc1
        JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
        CROSS JOIN catalog_columns cc2
        JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
        WHERE ca1.datasource_id = $1
          AND ca2.datasource_id = $1
          AND ca1.id != ca2.id
          AND (
            -- Pattern: customer_id → customers.id or customer.id
            (cc1.column_name ILIKE '%' || REPLACE(ca2.table_name, 's', '') || '%id%'
             AND cc2.column_name ILIKE '%id%')
            OR
            -- Pattern: customerId → Customer.id or Customers.id
            (LOWER(cc1.column_name) LIKE '%' || LOWER(REPLACE(REPLACE(ca2.table_name, 's', ''), 'S', '')) || 'id%'
             AND cc2.column_name ILIKE '%id%')
            OR
            -- Exact match with _id suffix
            (cc1.column_name = LOWER(ca2.table_name) || '_id'
             AND (cc2.column_name = 'id' OR cc2.column_name ILIKE '%id%'))
          )
          AND cc1.data_type = cc2.data_type  -- Must have compatible types
      `, [dataSourceId]);

      return rows.map(row => ({
        from_asset_id: parseInt(row.from_asset_id),
        to_asset_id: parseInt(row.to_asset_id),
        from_column: row.from_column,
        to_column: row.to_column,
        confidence_score: 85,
        discovery_method: 'column_name_pattern',
        reasoning: `Column '${row.from_column}' in '${row.from_table}' likely references '${row.to_column}' in '${row.to_table}' based on naming convention`
      }));
    } catch (error: any) {
      logger.error('Column name pattern discovery error:', error);
      return [];
    }
  }

  /**
   * Method 2: Discover lineage by analyzing cardinality relationships
   * Look for many-to-one relationships (typical FK pattern)
   */
  private async discoverByCardinality(dataSourceId: string): Promise<LineageHint[]> {
    try {
      // This requires actual data sampling - we'll look for columns with similar value distributions
      // Child table has many duplicate values, parent table has mostly unique values
      const { rows } = await cpdb.query(`
        SELECT
          cc1.asset_id as from_asset_id,
          cc1.column_name as from_column,
          ca1.table_name as from_table,
          cc2.asset_id as to_asset_id,
          cc2.column_name as to_column,
          ca2.table_name as to_table,
          cc1.unique_percentage as from_unique_pct,
          cc2.unique_percentage as to_unique_pct
        FROM catalog_columns cc1
        JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
        CROSS JOIN catalog_columns cc2
        JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
        WHERE ca1.datasource_id = $1
          AND ca2.datasource_id = $1
          AND ca1.id != ca2.id
          AND cc1.data_type = cc2.data_type
          AND cc1.unique_percentage IS NOT NULL
          AND cc2.unique_percentage IS NOT NULL
          AND cc1.unique_percentage < 80  -- Child has many duplicates
          AND cc2.unique_percentage > 90  -- Parent is mostly unique
          AND cc1.column_name ILIKE '%' || REPLACE(ca2.table_name, 's', '') || '%'
      `, [dataSourceId]);

      return rows.map(row => ({
        from_asset_id: parseInt(row.from_asset_id),
        to_asset_id: parseInt(row.to_asset_id),
        from_column: row.from_column,
        to_column: row.to_column,
        confidence_score: 75,
        discovery_method: 'cardinality_analysis',
        reasoning: `Many-to-one relationship detected: '${row.from_table}.${row.from_column}' (${row.from_unique_pct}% unique) → '${row.to_table}.${row.to_column}' (${row.to_unique_pct}% unique)`
      }));
    } catch (error: any) {
      logger.error('Cardinality analysis error:', error);
      return [];
    }
  }

  /**
   * Method 3: Discover lineage using common naming conventions
   * Recognizes patterns like: user_id, userId, customer_fk, account_ref
   */
  private async discoverByNamingConventions(dataSourceId: string): Promise<LineageHint[]> {
    try {
      const conventions = [
        { suffix: '_id', pk_column: 'id', confidence: 85 },
        { suffix: '_fk', pk_column: 'id', confidence: 90 },
        { suffix: '_key', pk_column: 'id', confidence: 80 },
        { suffix: '_ref', pk_column: 'id', confidence: 75 },
        { suffix: 'Id', pk_column: 'id', confidence: 85 },  // camelCase
        { suffix: 'FK', pk_column: 'id', confidence: 90 },
        { suffix: 'Key', pk_column: 'id', confidence: 80 }
      ];

      const hints: LineageHint[] = [];

      for (const conv of conventions) {
        const { rows } = await cpdb.query(`
          SELECT
            cc1.asset_id as from_asset_id,
            cc1.column_name as from_column,
            ca1.table_name as from_table,
            cc2.asset_id as to_asset_id,
            cc2.column_name as to_column,
            ca2.table_name as to_table
          FROM catalog_columns cc1
          JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
          CROSS JOIN catalog_columns cc2
          JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
          WHERE ca1.datasource_id = $1
            AND ca2.datasource_id = $1
            AND ca1.id != ca2.id
            AND cc1.column_name LIKE '%' || $2
            AND cc2.column_name = $3
            AND cc1.data_type = cc2.data_type
            AND (
              -- Extract base name and match to table
              LOWER(REPLACE(cc1.column_name, $2, '')) = LOWER(ca2.table_name)
              OR
              LOWER(REPLACE(cc1.column_name, $2, '')) = LOWER(REPLACE(ca2.table_name, 's', ''))
            )
        `, [dataSourceId, conv.suffix, conv.pk_column]);

        hints.push(...rows.map(row => ({
          from_asset_id: parseInt(row.from_asset_id),
          to_asset_id: parseInt(row.to_asset_id),
          from_column: row.from_column,
          to_column: row.to_column,
          confidence_score: conv.confidence,
          discovery_method: 'naming_convention',
          reasoning: `Column '${row.from_column}' follows '${conv.suffix}' naming convention pointing to '${row.to_table}.${row.to_column}'`
        })));
      }

      return hints;
    } catch (error: any) {
      logger.error('Naming convention discovery error:', error);
      return [];
    }
  }

  /**
   * Method 4: Discover lineage by analyzing actual column value overlap
   * Sample data from both columns and check for matching values
   */
  private async discoverByValueOverlap(dataSourceId: string): Promise<LineageHint[]> {
    try {
      // Get columns that might be related based on name and type
      const { rows: candidates } = await cpdb.query(`
        SELECT
          cc1.asset_id as from_asset_id,
          cc1.column_name as from_column,
          cc1.sample_values as from_samples,
          ca1.table_name as from_table,
          cc2.asset_id as to_asset_id,
          cc2.column_name as to_column,
          cc2.sample_values as to_samples,
          ca2.table_name as to_table
        FROM catalog_columns cc1
        JOIN catalog_assets ca1 ON ca1.id = cc1.asset_id
        CROSS JOIN catalog_columns cc2
        JOIN catalog_assets ca2 ON ca2.id = cc2.asset_id
        WHERE ca1.datasource_id = $1
          AND ca2.datasource_id = $1
          AND ca1.id != ca2.id
          AND cc1.data_type = cc2.data_type
          AND cc1.sample_values IS NOT NULL
          AND cc2.sample_values IS NOT NULL
          AND cc1.column_name ILIKE '%' || REPLACE(ca2.table_name, 's', '') || '%'
        LIMIT 100  -- Don't analyze too many combinations
      `, [dataSourceId]);

      const hints: LineageHint[] = [];

      for (const candidate of candidates) {
        try {
          // Parse sample values (stored as JSON array or text array)
          const fromSamples = this.parseSampleValues(candidate.from_samples);
          const toSamples = this.parseSampleValues(candidate.to_samples);

          if (fromSamples.length > 0 && toSamples.length > 0) {
            // Calculate overlap percentage
            const fromSet = new Set(fromSamples);
            const toSet = new Set(toSamples);
            const intersection = new Set([...fromSet].filter(x => toSet.has(x)));
            const overlapPercentage = (intersection.size / fromSet.size) * 100;

            // If significant overlap (>50%), it's likely a relationship
            if (overlapPercentage > 50) {
              hints.push({
                from_asset_id: parseInt(candidate.from_asset_id),
                to_asset_id: parseInt(candidate.to_asset_id),
                from_column: candidate.from_column,
                to_column: candidate.to_column,
                confidence_score: Math.min(95, Math.floor(40 + overlapPercentage / 2)),
                discovery_method: 'value_overlap_analysis',
                reasoning: `${overlapPercentage.toFixed(1)}% value overlap between '${candidate.from_table}.${candidate.from_column}' and '${candidate.to_table}.${candidate.to_column}'`
              });
            }
          }
        } catch (err) {
          // Skip this candidate if parsing fails
          continue;
        }
      }

      return hints;
    } catch (error: any) {
      logger.error('Value overlap analysis error:', error);
      return [];
    }
  }

  /**
   * Parse sample values from different formats
   */
  private parseSampleValues(samples: any): string[] {
    if (!samples) return [];

    try {
      // If it's already an array
      if (Array.isArray(samples)) {
        return samples.map(v => String(v)).filter(v => v && v !== 'null');
      }

      // If it's a JSON string
      if (typeof samples === 'string') {
        if (samples.startsWith('[')) {
          return JSON.parse(samples).map((v: any) => String(v)).filter((v: string) => v && v !== 'null');
        }
        // PostgreSQL array format: {val1,val2,val3}
        if (samples.startsWith('{') && samples.endsWith('}')) {
          return samples.slice(1, -1).split(',').map(v => v.trim()).filter(v => v && v !== 'null');
        }
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Deduplicate hints and keep highest confidence
   */
  private deduplicateHints(hints: LineageHint[]): LineageHint[] {
    const map = new Map<string, LineageHint>();

    for (const hint of hints) {
      const key = `${hint.from_asset_id}-${hint.to_asset_id}-${hint.from_column}-${hint.to_column}`;
      const existing = map.get(key);

      if (!existing || hint.confidence_score > existing.confidence_score) {
        map.set(key, hint);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.confidence_score - a.confidence_score);
  }

  /**
   * Insert heuristic lineage into catalog_lineage
   */
  private async insertHeuristicLineage(hints: LineageHint[]): Promise<number> {
    let inserted = 0;

    for (const hint of hints) {
      try {
        // Check if already exists
        const { rows: existing } = await cpdb.query(`
          SELECT id FROM catalog_lineage
          WHERE from_asset_id = $1 AND to_asset_id = $2 AND edge_type = 'heuristic'
        `, [hint.from_asset_id, hint.to_asset_id]);

        if (existing.length === 0) {
          await cpdb.query(`
            INSERT INTO catalog_lineage (
              tenant_id, from_asset_id, to_asset_id, edge_type, created_at
            )
            VALUES ($1, $2, $3, 'heuristic', NOW())
          `, [this.tenantId, hint.from_asset_id, hint.to_asset_id]);
          inserted++;

          logger.info(`Discovered heuristic lineage: ${hint.reasoning} (${hint.confidence_score}% confidence)`);
        }
      } catch (error: any) {
        logger.error(`Failed to insert heuristic lineage:`, error);
      }
    }

    return inserted;
  }

  /**
   * Get all lineage hints without inserting (for review)
   */
  async getLineageHints(dataSourceId: string): Promise<LineageHint[]> {
    const allHints: LineageHint[] = [];

    const nameHints = await this.discoverByColumnNames(dataSourceId);
    allHints.push(...nameHints);

    const cardinalityHints = await this.discoverByCardinality(dataSourceId);
    allHints.push(...cardinalityHints);

    const conventionHints = await this.discoverByNamingConventions(dataSourceId);
    allHints.push(...conventionHints);

    const overlapHints = await this.discoverByValueOverlap(dataSourceId);
    allHints.push(...overlapHints);

    return this.deduplicateHints(allHints).sort((a, b) => b.confidence_score - a.confidence_score);
  }
}
