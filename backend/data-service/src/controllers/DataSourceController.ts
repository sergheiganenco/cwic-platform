// backend/data-service/src/controllers/DataSourceController.ts
import { Request, Response } from 'express';
import { ConnectionTestService } from '../services/ConnectionTestService';
import { DataSourceService } from '../services/DataSourceService';
import { logger } from '../utils/logger';

import type {
  DataSource,
  DataSourceFilters,
  DataSourceStatus,
  DataSourceType,
} from '../models/DataSource';

type ReqWithUser = Request & { user?: { id?: string; email?: string; role?: string } };

const normalizeType = (t?: string): DataSourceType | undefined => {
  if (!t) return undefined;
  const x = String(t).toLowerCase();
  if (['azure_sql','azure-sql','sqlserver','sql-server'].includes(x)) return 'mssql' as DataSourceType;
  if (x === 'postgres') return 'postgresql' as DataSourceType;
  return x as DataSourceType;
};

const buildFilters = (q: Request['query']): DataSourceFilters => {
  const filters: DataSourceFilters = {};
  if (typeof q.status === 'string' && q.status.trim()) {
    filters.status = q.status.toLowerCase() as DataSourceStatus;
  }
  if (typeof q.type === 'string' && q.type.trim()) {
    filters.type = normalizeType(q.type) as DataSourceType;
  }
  if (typeof q.createdBy === 'string' && q.createdBy.trim()) {
    filters.createdBy = q.createdBy;
  }
  if (typeof q.search === 'string' && q.search.trim()) {
    filters.search = q.search.trim();
  }
  return filters;
};

const toInt = (v: unknown, def: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : def;
};

const allowedSortBy = new Set(['updatedAt','createdAt','name','status','type'] as const);
const normSortBy = (v: unknown): 'updatedAt'|'createdAt'|'name'|'status'|'type' =>
  allowedSortBy.has(String(v || '') as any) ? (String(v) as any) : 'updatedAt';
const normSortOrder = (v: unknown): 'asc'|'desc' =>
  String(v || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

export class DataSourceController {
  private dataSourceService = new DataSourceService();
  private connectionTestService = new ConnectionTestService();

  getAllDataSources = async (req: Request, res: Response) => {
    try {
      const page = toInt(req.query.page, 1);
      const limit = toInt(req.query.limit, 20);
      const filters = buildFilters(req.query);
      const sortBy = normSortBy(req.query.sortBy);
      const sortOrder = normSortOrder(req.query.sortOrder);

      const result = await this.dataSourceService.getAllDataSources({
        page, limit, filters, sortBy, sortOrder,
      });

      res.json({
        success: true,
        data: result.dataSources,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          sortBy, sortOrder,
        },
      });
    } catch (error) {
      logger.error('Error fetching data sources:', error);
      res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch data sources' } });
    }
  };

  getDataSourceById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ds = await this.dataSourceService.getDataSourceById(id);
      if (!ds) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Data source not found' } });
        return;
      }
      res.json({ success: true, data: ds });
    } catch (error) {
      logger.error('Error fetching data source:', error);
      res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch data source' } });
    }
  };

  createDataSource = async (req: Request, res: Response) => {
    try {
      const payload = req.body;

      const err = this.validateDataSourceData(payload);
      if (err) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err } });
        return;
      }

      const test = await this.connectionTestService.testConnection(payload);
      if (!test.success) {
        res.status(400).json({
          success: false,
          error: { code: 'CONNECTION_FAILED', message: 'Failed to connect to data source', details: test.error },
        });
        return;
      }

      const userId = (req as ReqWithUser).user?.id ?? 'system';

      const created = await this.dataSourceService.createDataSource({
        ...payload,
        type: normalizeType(payload.type) ?? payload.type,
        status: 'connected',
        lastTestAt: new Date(),
        createdBy: userId,
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error('Error creating data source:', error);
      res.status(500).json({ success: false, error: { code: 'CREATE_ERROR', message: 'Failed to create data source' } });
    }
  };

  updateDataSource = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const patch = req.body;
      const userId = (req as ReqWithUser).user?.id ?? 'system';

      const updated = await this.dataSourceService.updateDataSource(id, {
        ...patch,
        ...(patch.type ? { type: normalizeType(patch.type) } : {}),
        updatedBy: userId,
        updatedAt: new Date(),
      });

      if (!updated) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Data source not found' } });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Error updating data source:', error);
      res.status(500).json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update data source' } });
    }
  };

  deleteDataSource = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ok = await this.dataSourceService.deleteDataSource(id);
      if (!ok) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Data source not found' } });
        return;
      }
      res.json({ success: true, message: 'Data source deleted successfully' });
    } catch (error) {
      logger.error('Error deleting data source:', error);
      res.status(500).json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete data source' } });
    }
  };

  testConnection = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ds = await this.dataSourceService.getDataSourceById(id);
      if (!ds) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Data source not found' } });
        return;
      }

      const result = await this.connectionTestService.testConnection(ds);
      const patch: Partial<DataSource> = {
        lastTestAt: new Date(),
        status: (result.success ? 'connected' : 'error') as DataSourceStatus,
      };
      if (!result.success) patch.lastError = result.error || 'Connection test failed';

      await this.dataSourceService.updateDataSource(id, patch);

      res.json({
        success: true,
        data: {
          connectionStatus: result.success ? 'connected' : 'failed',
          responseTime: result.responseTime,
          details: result.details,
          error: result.error,
          testedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error testing connection:', error);
      res.status(500).json({ success: false, error: { code: 'TEST_ERROR', message: 'Failed to test connection' } });
    }
  };

  getHealthSummary = async (_req: Request, res: Response) => {
    try {
      const summary = await this.dataSourceService.getHealthSummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Error fetching health summary:', error);
      res.status(500).json({ success: false, error: { code: 'HEALTH_ERROR', message: 'Failed to fetch health summary' } });
    }
  };

  getDataSourceSchema = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const schema = await this.dataSourceService.getDataSourceSchema(id);
      res.json({ success: true, data: schema });
    } catch (error) {
      logger.error('Error fetching schema:', error);
      res.status(500).json({ success: false, error: { code: 'SCHEMA_ERROR', message: 'Failed to fetch data source schema' } });
    }
  };

  syncDataSource = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { force = false } = req.body ?? {};
      const result = await this.dataSourceService.syncDataSource(id, { force: !!force });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error syncing data source:', error);
      res.status(500).json({ success: false, error: { code: 'SYNC_ERROR', message: 'Failed to sync data source' } });
    }
  };

  private validateDataSourceData(data: any): string | null {
  if (!data?.name) return 'Name is required';
  if (!data?.type) return 'Type is required';
  if (!data?.connectionConfig) return 'Connection configuration is required';

  const t = normalizeType(data.type);

  const hasConnStr = !!data.connectionConfig.connectionString;
  const hasHostDb  = !!(data.connectionConfig.host && data.connectionConfig.database);

  switch (t) {
    case 'postgresql':
    case 'mysql':
    case 'mssql':
    case 'oracle':
    case 'redshift':
      if (!hasConnStr && !hasHostDb) {
        return 'Provide either connectionString OR host + database for relational connections';
      }
      break;

    case 'mongodb':
      if (!hasConnStr && !data.connectionConfig.host) {
        return 'Provide connectionString or host for MongoDB';
      }
      break;

    case 's3':
      if (!data.connectionConfig.bucket) return 'Bucket is required for S3';
      break;

    case 'api':
      if (!data.connectionConfig.baseUrl) return 'Base URL is required for API connections';
      break;

    // other types: rely on connector-specific validation
  }

  return null;
}

}