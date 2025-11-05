// src/services/AssetService.ts
import { Asset, Column } from '../controllers/AssetController';
import { logger } from '../utils/logger';
import { DatabaseService } from './DatabaseService';

export interface AssetFilters {
  search?: string;
  type?: string;
  dataSourceId?: string;
  status?: string;
  tags?: string[];
  sensitivity?: string;
}

export interface AssetPagination {
  page: number;
  limit: number;
}

export interface AssetResult {
  assets: Asset[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AssetLineage {
  upstream: Asset[];
  downstream: Asset[];
  relationships: LineageRelationship[];
}

export interface LineageRelationship {
  fromAsset: string;
  toAsset: string;
  type: 'table_to_view' | 'procedure_call' | 'data_flow' | 'dependency';
  description?: string;
}

export interface AssetStats {
  accessCount: number;
  lastAccessed: Date | null;
  avgQueryTime: number;
  dataVolume: {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  };
  qualityScore: number;
  usageMetrics: {
    date: string;
    count: number;
  }[];
}

export class AssetService {
  private db: DatabaseService;

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Get assets with filtering and pagination
   */
  public async getAssets(filters: AssetFilters, pagination: AssetPagination): Promise<AssetResult> {
    try {
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      // Build dynamic WHERE clause
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.search) {
        conditions.push(`(a.name ILIKE $${paramIndex} OR a.description ILIKE $${paramIndex})`);
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      if (filters.type) {
        conditions.push(`a.type = $${paramIndex}`);
        params.push(filters.type);
        paramIndex++;
      }

      if (filters.dataSourceId) {
        conditions.push(`a.data_source_id = $${paramIndex}`);
        params.push(filters.dataSourceId);
        paramIndex++;
      }

      if (filters.status) {
        conditions.push(`a.status = $${paramIndex}`);
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.sensitivity) {
        conditions.push(`a.metadata->>'sensitivity' = $${paramIndex}`);
        params.push(filters.sensitivity);
        paramIndex++;
      }

      if (filters.tags && filters.tags.length > 0) {
        conditions.push(`a.tags && $${paramIndex}`);
        params.push(filters.tags);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM assets a
        ${whereClause}
      `;

      // Data query
      const dataQuery = `
        SELECT
          a.*,
          ds.name as data_source_name,
          ds.type as data_source_type,
          COALESCE(ca.pii_detected, false) as pii_detected
        FROM assets a
        LEFT JOIN data_sources ds ON a.data_source_id = ds.id
        LEFT JOIN catalog_assets ca ON ca.table_name = a.name AND ca.datasource_id = a.data_source_id::uuid
        ${whereClause}
        ORDER BY a.updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const [countResult, dataResult] = await Promise.all([
        this.db.query(countQuery, params.slice(0, -2)),
        this.db.query(dataQuery, params)
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const assets: Asset[] = dataResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        dataSourceId: row.data_source_id,
        dataSourceName: row.data_source_name,
        dataSourceType: row.data_source_type,
        schemaName: row.schema_name,
        tableName: row.table_name,
        description: row.description,
        columns: row.columns || [],
        tags: row.tags || [],
        status: row.status,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        metadata: row.metadata || {},
        piiDetected: row.pii_detected || false,
      }));

      return {
        assets,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Error in getAssets:', error);
      throw new Error('Failed to fetch assets');
    }
  }

  /**
   * Get asset by ID
   */
  public async getAssetById(id: string): Promise<Asset | null> {
    try {
      const query = `
        SELECT 
          a.*,
          ds.name as data_source_name,
          ds.type as data_source_type
        FROM assets a
        LEFT JOIN data_sources ds ON a.data_source_id = ds.id
        WHERE a.id = $1
      `;

      const result = await this.db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        name: row.name,
        type: row.type,
        dataSourceId: row.data_source_id,
        dataSourceName: row.data_source_name,
        dataSourceType: row.data_source_type,
        schemaName: row.schema_name,
        tableName: row.table_name,
        description: row.description,
        columns: row.columns || [],
        tags: row.tags || [],
        status: row.status,
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
        metadata: row.metadata || {},
      };
    } catch (error) {
      logger.error('Error in getAssetById:', error);
      throw new Error('Failed to fetch asset');
    }
  }

  /**
   * Create a new asset
   */
  public async createAsset(assetData: Partial<Asset>): Promise<Asset> {
    try {
      const {
        name,
        type,
        dataSourceId,
        schemaName,
        tableName,
        description,
        columns,
        tags,
        status = 'active',
        metadata = {}
      } = assetData;

      const insertQuery = `
        INSERT INTO assets (
          name, type, data_source_id, schema_name, table_name,
          description, columns, tags, status, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `;

      const values = [
        name,
        type,
        dataSourceId,
        schemaName,
        tableName,
        description,
        JSON.stringify(columns || []),
        tags || [],
        status,
        JSON.stringify(metadata)
      ];

      const insertResult = await this.db.query(insertQuery, values);
      const newAssetId = insertResult.rows[0].id;

      // Fetch the complete asset with data source info
      const selectQuery = `
        SELECT
          a.*,
          ds.name as data_source_name,
          ds.type as data_source_type
        FROM assets a
        LEFT JOIN data_sources ds ON a.data_source_id = ds.id
        WHERE a.id = $1
      `;

      const result = await this.db.query(selectQuery, [newAssetId]);
      return this.mapRowToAsset(result.rows[0]);
    } catch (error) {
      logger.error('Error in createAsset:', error);
      throw new Error('Failed to create asset');
    }
  }

  /**
   * Search assets
   */
  public async searchAssets(
    filters: { search: string; type?: string },
    pagination: AssetPagination
  ): Promise<AssetResult> {
    try {
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      // Build search query with full-text search
      const conditions: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (filters.search) {
        conditions.push(`(
          to_tsvector('english', coalesce(a.name, '') || ' ' || coalesce(a.description, '')) 
          @@ plainto_tsquery('english', $${paramIndex})
          OR a.name ILIKE $${paramIndex + 1}
          OR a.description ILIKE $${paramIndex + 1}
        )`);
        params.push(filters.search, `%${filters.search}%`);
        paramIndex += 2;
      }

      if (filters.type) {
        conditions.push(`a.type = $${paramIndex}`);
        params.push(filters.type);
        paramIndex++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Count query
      const countQuery = `
        SELECT COUNT(*) as total
        FROM assets a
        ${whereClause}
      `;

      // Data query
      const dataQuery = `
        SELECT 
          a.*,
          ds.name as data_source_name,
          ds.type as data_source_type,
          ts_rank(to_tsvector('english', coalesce(a.name, '') || ' ' || coalesce(a.description, '')), 
                   plainto_tsquery('english', $1)) as search_rank
        FROM assets a
        LEFT JOIN data_sources ds ON a.data_source_id = ds.id
        ${whereClause}
        ORDER BY ${filters.search ? 'search_rank DESC,' : ''} a.updated_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      params.push(limit, offset);

      const [countResult, dataResult] = await Promise.all([
        this.db.query(countQuery, params.slice(0, -2)),
        this.db.query(dataQuery, params)
      ]);

      const total = parseInt(countResult.rows[0].total);
      const totalPages = Math.ceil(total / limit);

      const assets: Asset[] = dataResult.rows.map(row => this.mapRowToAsset(row));

      return {
        assets,
        total,
        page,
        limit,
        totalPages,
      };
    } catch (error) {
      logger.error('Error in searchAssets:', error);
      throw new Error('Failed to search assets');
    }
  }

  /**
   * Get asset schema details
   */
  public async getAssetSchema(id: string): Promise<Column[] | null> {
    try {
      const query = `
        SELECT columns
        FROM assets
        WHERE id = $1
      `;

      const result = await this.db.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0].columns || [];
    } catch (error) {
      logger.error('Error in getAssetSchema:', error);
      throw new Error('Failed to fetch asset schema');
    }
  }

  /**
   * Get asset lineage
   */
  public async getAssetLineage(id: string, direction: 'upstream' | 'downstream' | 'both'): Promise<AssetLineage> {
    try {
      // Mock implementation - in real scenario, you'd analyze SQL queries, ETL processes, etc.
      const upstreamQuery = `
        SELECT DISTINCT a.*
        FROM assets a
        JOIN asset_lineage al ON a.id = al.upstream_asset_id
        WHERE al.downstream_asset_id = $1
      `;

      const downstreamQuery = `
        SELECT DISTINCT a.*
        FROM assets a
        JOIN asset_lineage al ON a.id = al.downstream_asset_id
        WHERE al.upstream_asset_id = $1
      `;

      const relationshipsQuery = `
        SELECT *
        FROM asset_lineage
        WHERE upstream_asset_id = $1 OR downstream_asset_id = $1
      `;

      let upstream: Asset[] = [];
      let downstream: Asset[] = [];

      if (direction === 'upstream' || direction === 'both') {
        const upstreamResult = await this.db.query(upstreamQuery, [id]);
        upstream = upstreamResult.rows.map(this.mapRowToAsset);
      }

      if (direction === 'downstream' || direction === 'both') {
        const downstreamResult = await this.db.query(downstreamQuery, [id]);
        downstream = downstreamResult.rows.map(this.mapRowToAsset);
      }

      const relationshipsResult = await this.db.query(relationshipsQuery, [id]);
      const relationships: LineageRelationship[] = relationshipsResult.rows.map(row => ({
        fromAsset: row.upstream_asset_id,
        toAsset: row.downstream_asset_id,
        type: row.relationship_type,
        description: row.description,
      }));

      return {
        upstream,
        downstream,
        relationships,
      };
    } catch (error) {
      logger.error('Error in getAssetLineage:', error);
      throw new Error('Failed to fetch asset lineage');
    }
  }

  /**
   * Update asset
   */
  public async updateAsset(id: string, updateData: Partial<Asset>): Promise<Asset | null> {
    try {
      const setClause: string[] = [];
      const params: any[] = [];
      let paramIndex = 1;

      if (updateData.name) {
        setClause.push(`name = $${paramIndex++}`);
        params.push(updateData.name);
      }

      if (updateData.description) {
        setClause.push(`description = $${paramIndex++}`);
        params.push(updateData.description);
      }

      if (updateData.status) {
        setClause.push(`status = $${paramIndex++}`);
        params.push(updateData.status);
      }

      if (updateData.tags) {
        setClause.push(`tags = $${paramIndex++}`);
        params.push(updateData.tags);
      }

      if (updateData.metadata) {
        setClause.push(`metadata = $${paramIndex++}`);
        params.push(JSON.stringify(updateData.metadata));
      }

      setClause.push(`updated_at = NOW()`);
      params.push(id);

      const updateQuery = `
        UPDATE assets
        SET ${setClause.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING id
      `;

      const updateResult = await this.db.query(updateQuery, params);

      if (updateResult.rows.length === 0) {
        return null;
      }

      // Fetch the complete asset with data source info
      const selectQuery = `
        SELECT
          a.*,
          ds.name as data_source_name,
          ds.type as data_source_type
        FROM assets a
        LEFT JOIN data_sources ds ON a.data_source_id = ds.id
        WHERE a.id = $1
      `;

      const result = await this.db.query(selectQuery, [id]);
      return this.mapRowToAsset(result.rows[0]);
    } catch (error) {
      logger.error('Error in updateAsset:', error);
      throw new Error('Failed to update asset');
    }
  }

  /**
   * Add tags to asset
   */
  public async addTags(id: string, tags: string[]): Promise<Asset | null> {
    try {
      const updateQuery = `
        UPDATE assets
        SET tags = COALESCE(tags, '{}') || $1::text[],
            updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const updateResult = await this.db.query(updateQuery, [tags, id]);

      if (updateResult.rows.length === 0) {
        return null;
      }

      // Fetch the complete asset with data source info
      const selectQuery = `
        SELECT
          a.*,
          ds.name as data_source_name,
          ds.type as data_source_type
        FROM assets a
        LEFT JOIN data_sources ds ON a.data_source_id = ds.id
        WHERE a.id = $1
      `;

      const result = await this.db.query(selectQuery, [id]);
      return this.mapRowToAsset(result.rows[0]);
    } catch (error) {
      logger.error('Error in addTags:', error);
      throw new Error('Failed to add tags');
    }
  }

  /**
   * Remove tags from asset
   */
  public async removeTags(id: string, tags: string[]): Promise<Asset | null> {
    try {
      const updateQuery = `
        UPDATE assets
        SET tags = ARRAY(SELECT unnest(tags) EXCEPT SELECT unnest($1::text[])),
            updated_at = NOW()
        WHERE id = $2
        RETURNING id
      `;

      const updateResult = await this.db.query(updateQuery, [tags, id]);

      if (updateResult.rows.length === 0) {
        return null;
      }

      // Fetch the complete asset with data source info
      const selectQuery = `
        SELECT
          a.*,
          ds.name as data_source_name,
          ds.type as data_source_type
        FROM assets a
        LEFT JOIN data_sources ds ON a.data_source_id = ds.id
        WHERE a.id = $1
      `;

      const result = await this.db.query(selectQuery, [id]);
      return this.mapRowToAsset(result.rows[0]);
    } catch (error) {
      logger.error('Error in removeTags:', error);
      throw new Error('Failed to remove tags');
    }
  }

  /**
   * Get asset usage statistics
   */
  public async getAssetStats(id: string, period: string): Promise<AssetStats> {
    try {
      // Mock implementation - in real scenario, you'd aggregate from usage logs
      const statsQuery = `
        SELECT 
          COALESCE(usage.access_count, 0) as access_count,
          usage.last_accessed,
          COALESCE(usage.avg_query_time, 0) as avg_query_time,
          COALESCE(metadata->>'rowCount', '0')::bigint as current_volume,
          COALESCE((metadata->>'qualityScore')::numeric, 85) as quality_score
        FROM assets a
        LEFT JOIN asset_usage_stats usage ON a.id = usage.asset_id
        WHERE a.id = $1
      `;

      const result = await this.db.query(statsQuery, [id]);
      
      if (result.rows.length === 0) {
        throw new Error('Asset not found');
      }

      const row = result.rows[0];

      // Mock usage metrics for the period
      const usageMetrics = this.generateMockUsageMetrics(period);

      return {
        accessCount: row.access_count,
        lastAccessed: row.last_accessed ? new Date(row.last_accessed) : null,
        avgQueryTime: row.avg_query_time,
        dataVolume: {
          current: row.current_volume,
          trend: 'increasing',
          changePercent: 12.5,
        },
        qualityScore: row.quality_score,
        usageMetrics,
      };
    } catch (error) {
      logger.error('Error in getAssetStats:', error);
      throw new Error('Failed to fetch asset stats');
    }
  }

  /**
   * Get asset profile/data preview
   */
  public async getAssetProfile(id: string): Promise<{
    asset: Asset;
    profile: {
      rowCount: number;
      columnCount: number;
      dataTypes: Record<string, number>;
      nullCounts: Record<string, number>;
      sampleData: any[];
      lastProfiledAt: Date;
    };
  } | null> {
    try {
      const asset = await this.getAssetById(id);
      if (!asset) {
        return null;
      }

      // Mock profile data - in real implementation, this would connect to the data source
      const profile = {
        rowCount: Math.floor(Math.random() * 1000000) + 1000,
        columnCount: asset.columns?.length || 0,
        dataTypes: {
          'string': Math.floor(Math.random() * 10) + 1,
          'integer': Math.floor(Math.random() * 5) + 1,
          'decimal': Math.floor(Math.random() * 3) + 1,
          'date': Math.floor(Math.random() * 2) + 1,
          'boolean': Math.floor(Math.random() * 2),
        },
        nullCounts: asset.columns?.reduce((acc, col) => {
          acc[col.name] = Math.floor(Math.random() * 100);
          return acc;
        }, {} as Record<string, number>) || {},
        sampleData: [
          // Mock sample data
          { id: 1, name: 'Sample Row 1', value: 100 },
          { id: 2, name: 'Sample Row 2', value: 200 },
          { id: 3, name: 'Sample Row 3', value: 300 },
        ],
        lastProfiledAt: new Date(),
      };

      return {
        asset,
        profile,
      };
    } catch (error) {
      logger.error('Error in getAssetProfile:', error);
      throw new Error('Failed to get asset profile');
    }
  }

  /**
   * Sync asset metadata from data source
   */
  public async syncAsset(id: string): Promise<{ success: boolean; updatedFields: string[] }> {
    try {
      // Mock implementation - in real scenario, you'd connect to the data source
      // and refresh metadata (row counts, schema changes, etc.)
      
      const updateQuery = `
        UPDATE assets
        SET 
          metadata = metadata || '{"lastSyncAt": "' || NOW() || '", "syncStatus": "completed"}',
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const result = await this.db.query(updateQuery, [id]);

      if (result.rows.length === 0) {
        throw new Error('Asset not found');
      }

      return {
        success: true,
        updatedFields: ['metadata', 'rowCount', 'lastSyncAt'],
      };
    } catch (error) {
      logger.error('Error in syncAsset:', error);
      throw new Error('Failed to sync asset');
    }
  }

  /**
   * Delete asset
   */
  public async deleteAsset(id: string): Promise<boolean> {
    try {
      const query = `
        DELETE FROM assets
        WHERE id = $1
        RETURNING id
      `;

      const result = await this.db.query(query, [id]);
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error in deleteAsset:', error);
      throw new Error('Failed to delete asset');
    }
  }

  /**
   * Helper method to map database row to Asset object
   */
  private mapRowToAsset(row: any): Asset {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      dataSourceId: row.data_source_id,
      dataSourceName: row.data_source_name,
      dataSourceType: row.data_source_type,
      schemaName: row.schema_name,
      tableName: row.table_name,
      description: row.description,
      columns: row.columns || [],
      tags: row.tags || [],
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      metadata: row.metadata || {},
    };
  }

  /**
   * Generate mock usage metrics for testing
   */
  private generateMockUsageMetrics(period: string): { date: string; count: number }[] {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const metrics: { date: string; count: number }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      metrics.push({
        date: date.toISOString().split('T')[0],
        count: Math.floor(Math.random() * 50) + 10,
      });
    }

    return metrics;
  }
}