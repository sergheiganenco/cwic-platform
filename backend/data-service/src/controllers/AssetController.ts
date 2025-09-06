// backend/data-service/src/controllers/AssetController.ts
import { Request, Response } from 'express';
import { AssetService } from '../services/AssetService';
import { logger, loggerUtils } from '../utils/logger';

export interface AssetRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  foreignKey?: { table: string; column: string };
  description?: string;
  tags?: string[];
}

export interface Asset {
  id: string;
  name: string;
  type:
    | 'table'
    | 'view'
    | 'procedure'
    | 'function'
    | 'schema'
    | 'file'
    | 'api_endpoint'
    | 'stream'
    | 'model';
  dataSourceId: string;
  schemaName?: string;
  tableName?: string;
  description?: string;
  columns?: Column[];
  tags?: string[];
  status: 'active' | 'inactive' | 'deprecated';
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    rowCount?: number;
    size?: string;
    lastAccessed?: Date;
    sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  };
}

type LineageDirection = 'upstream' | 'downstream' | 'both';

type ListFilters = {
  search?: string;
  type?: string;
  dataSourceId?: string;
  status?: string;
  tags?: string[];
  sensitivity?: string;
};

type Pagination = { page: number; limit: number };

export class AssetController {
  private assetService: AssetService;

  constructor() {
    this.assetService = new AssetService();
  }

  /**
   * GET /api/assets
   */
  public getAllAssets = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const {
        page = '1',
        limit = '20',
        search,
        type,
        dataSourceId,
        status,
        tags,
        sensitivity,
      } = req.query;

      const filters: ListFilters = {
        search: typeof search === 'string' ? search : undefined,
        type: typeof type === 'string' ? type : undefined,
        dataSourceId: typeof dataSourceId === 'string' ? dataSourceId : undefined,
        status: typeof status === 'string' ? status : undefined,
        tags:
          typeof tags === 'string'
            ? tags
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        sensitivity: typeof sensitivity === 'string' ? sensitivity : undefined,
      };

      const pagination: Pagination = {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      };

      const t0 = Date.now();
      const result = await this.assetService.getAssets(filters, pagination);
      const dt = Date.now() - t0;

      loggerUtils.logDbOperation('select', 'assets', dt, true);

      res.status(200).json({
        success: true,
        data: result.assets,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
        meta: {
          processingTime: `${dt}ms`,
          filters,
        },
      });
    } catch (error) {
      logger.error('Error fetching assets:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_ASSETS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/assets/:id
   */
  public getAssetById = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const t0 = Date.now();
      const asset = await this.assetService.getAssetById(id);
      const dt = Date.now() - t0;

      if (!asset) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Asset not found' });
        return;
      }

      loggerUtils.logDbOperation('select', 'assets', dt, true);

      res.status(200).json({
        success: true,
        data: asset,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error fetching asset:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_ASSET_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/assets/:id/schema
   */
  public getAssetSchema = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const t0 = Date.now();
      const schema = await this.assetService.getAssetSchema(id);
      const dt = Date.now() - t0;

      if (!schema) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Asset schema not found' });
        return;
      }

      res.status(200).json({
        success: true,
        data: schema,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error fetching asset schema:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_SCHEMA_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/assets/:id/lineage
   */
  public getAssetLineage = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const direction = (req.query.direction as LineageDirection) || 'both';

      const t0 = Date.now();
      const lineage = await this.assetService.getAssetLineage(id, direction);
      const dt = Date.now() - t0;

      res.status(200).json({
        success: true,
        data: lineage,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error fetching asset lineage:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_LINEAGE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/assets/:id/profile
   */
  public getAssetProfile = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const t0 = Date.now();
      const profile = await this.assetService.getAssetProfile(id);
      const dt = Date.now() - t0;

      if (!profile) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Asset profile not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: profile,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error fetching asset profile:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_PROFILE_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/assets
   */
  public createAsset = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const assetData = req.body;

      const t0 = Date.now();
      const newAsset = await this.assetService.createAsset(assetData);
      const dt = Date.now() - t0;

      loggerUtils.logDbOperation('insert', 'assets', dt, true);
      logger.info(`Asset created: ${newAsset?.id}`, { userId: req.user?.id });

      res.status(201).json({
        success: true,
        data: newAsset,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error creating asset:', error);
      res.status(500).json({
        success: false,
        error: 'CREATE_ASSET_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * PUT /api/assets/:id
   */
  public updateAsset = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const t0 = Date.now();
      const updatedAsset = await this.assetService.updateAsset(id, updateData);
      const dt = Date.now() - t0;

      if (!updatedAsset) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Asset not found' });
        return;
      }

      loggerUtils.logDbOperation('update', 'assets', dt, true);
      logger.info(`Asset updated: ${id}`, { userId: req.user?.id });

      res.status(200).json({
        success: true,
        data: updatedAsset,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error updating asset:', error);
      res.status(500).json({
        success: false,
        error: 'UPDATE_ASSET_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * PUT /api/assets/:id/classification
   */
  public updateClassification = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { classification } = req.body as { classification: Asset['classification'] };

      const t0 = Date.now();
      const updated =
        typeof (this.assetService as any).updateClassification === 'function'
          ? await (this.assetService as any).updateClassification(id, { classification })
          : await this.assetService.updateAsset(id, { classification });
      const dt = Date.now() - t0;

      if (!updated) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Asset not found' });
        return;
      }

      loggerUtils.logDbOperation('update', 'assets', dt, true);

      res.status(200).json({
        success: true,
        data: updated,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error updating asset classification:', error);
      res.status(500).json({
        success: false,
        error: 'UPDATE_CLASSIFICATION_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/assets/:id/tag
   */
  public addTags = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { tags } = req.body as { tags: string[] };

      if (!Array.isArray(tags)) {
        res
          .status(400)
          .json({ success: false, error: 'VALIDATION_ERROR', message: 'Tags must be an array' });
        return;
      }

      const t0 = Date.now();
      const result = await this.assetService.addTags(id, tags);
      const dt = Date.now() - t0;

      loggerUtils.logDbOperation('update', 'asset_tags', dt, true);

      res.status(200).json({
        success: true,
        data: result,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error adding tags:', error);
      res.status(500).json({
        success: false,
        error: 'ADD_TAGS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * DELETE /api/assets/:id/tag
   */
  public removeTags = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { tags } = req.body as { tags: string[] };

      if (!Array.isArray(tags)) {
        res
          .status(400)
          .json({ success: false, error: 'VALIDATION_ERROR', message: 'Tags must be an array' });
        return;
      }

      const t0 = Date.now();
      const result = await this.assetService.removeTags(id, tags);
      const dt = Date.now() - t0;

      loggerUtils.logDbOperation('update', 'asset_tags', dt, true);

      res.status(200).json({
        success: true,
        data: result,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error removing tags:', error);
      res.status(500).json({
        success: false,
        error: 'REMOVE_TAGS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/assets/stats  (global)
   */
  public getAssetStats = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { period = '30d' } = req.query as { period?: string };

      const t0 = Date.now();
      // Prefer a dedicated overview method if it exists
      const stats =
        typeof (this.assetService as any).getOverviewStats === 'function'
          ? await (this.assetService as any).getOverviewStats(period)
          : await this.assetService.getAssets({}, { page: 1, limit: 1 }).then((r) => ({
              totalAssets: r.total,
            }));

      const dt = Date.now() - t0;

      res.status(200).json({
        success: true,
        data: stats,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error fetching asset stats:', error);
      res.status(500).json({
        success: false,
        error: 'FETCH_STATS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * POST /api/assets/:id/scan
   */
  public scanAsset = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { type = 'full', force = false } = req.body as {
        type?: 'full' | 'incremental' | 'schema_only' | 'profile_only';
        force?: boolean;
      };

      const t0 = Date.now();
      const result =
        typeof (this.assetService as any).scanAsset === 'function'
          ? await (this.assetService as any).scanAsset(id, { type, force })
          : await (this.assetService as any).syncAsset(id, { type, force }); // cast to any to avoid arity/type mismatch
      const dt = Date.now() - t0;

      logger.info(`Asset scan triggered: ${id}`, { userId: req.user?.id, type, force, duration: `${dt}ms` });

      res.status(200).json({
        success: true,
        data: result,
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error scanning asset:', error);
      res.status(500).json({
        success: false,
        error: 'SCAN_ASSET_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * DELETE /api/assets/:id
   */
  public deleteAsset = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const t0 = Date.now();
      const deleted =
        typeof (this.assetService as any).deleteAsset === 'function'
          ? await (this.assetService as any).deleteAsset(id)
          : await this.assetService.updateAsset(id, { status: 'inactive' as Asset['status'] });
      const dt = Date.now() - t0;

      if (!deleted) {
        res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Asset not found' });
        return;
      }

      loggerUtils.logDbOperation('delete', 'assets', dt, true);

      res.status(200).json({
        success: true,
        data: { id, deleted: true },
        meta: { processingTime: `${dt}ms` },
      });
    } catch (error) {
      logger.error('Error deleting asset:', error);
      res.status(500).json({
        success: false,
        error: 'DELETE_ASSET_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  /**
   * GET /api/assets/search
   */
  public searchAssets = async (req: AssetRequest, res: Response): Promise<void> => {
    try {
      const { q, type, limit = '20', page = '1' } = req.query;

      // Ensure `search` is a string (service expects a required string)
      const searchTerm: string = typeof q === 'string' ? q : '';

      const filters: { search: string; type?: string } = {
        search: searchTerm,
        type: typeof type === 'string' ? type : undefined,
      };

      const pagination: Pagination = {
        page: Number(page) || 1,
        limit: Number(limit) || 20,
      };

      const t0 = Date.now();
      const result = await this.assetService.searchAssets(filters, pagination);
      const dt = Date.now() - t0;

      loggerUtils.logDbOperation('select', 'assets', dt, true);

      res.status(200).json({
        success: true,
        data: result.assets,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
        meta: {
          processingTime: `${dt}ms`,
          query: filters.search,
        },
      });
    } catch (error) {
      logger.error('Error searching assets:', error);
      res.status(500).json({
        success: false,
        error: 'SEARCH_ASSETS_FAILED',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };
}

export default AssetController;
