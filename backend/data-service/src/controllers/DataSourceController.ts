// backend/data-service/src/controllers/DataSourceController.ts
import type { Request, Response } from 'express';
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

/* ----------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

const normalizeType = (t?: string): DataSourceType | undefined => {
  if (!t) return undefined;
  const x = String(t).toLowerCase();
  if (['azure_sql', 'azure-sql', 'sqlserver', 'sql-server'].includes(x)) return 'mssql' as DataSourceType;
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

const allowedSortBy = new Set(['updatedAt', 'createdAt', 'name', 'status', 'type'] as const);
const normSortBy = (v: unknown): 'updatedAt' | 'createdAt' | 'name' | 'status' | 'type' =>
  allowedSortBy.has(String(v || '') as any) ? (String(v) as any) : 'updatedAt';
const normSortOrder = (v: unknown): 'asc' | 'desc' =>
  String(v || '').toLowerCase() === 'asc' ? 'asc' : 'desc';

/* ----------------------------------------------------------------------------
 * Controller
 * -------------------------------------------------------------------------- */

export class DataSourceController {
  private dataSourceService = new DataSourceService();
  private connectionTestService = new ConnectionTestService();

  /* ------------------------------- Listing -------------------------------- */

  getAllDataSources = async (req: Request, res: Response) => {
    try {
      const page = toInt(req.query.page, 1);
      const limit = toInt(req.query.limit, 20);
      const filters = buildFilters(req.query);
      const sortBy = normSortBy(req.query.sortBy);
      const sortOrder = normSortOrder(req.query.sortOrder);

      const result = await this.dataSourceService.getAllDataSources({
        page,
        limit,
        filters,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        data: result.dataSources,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
          sortBy,
          sortOrder,
        },
      });
    } catch (error) {
      logger.error('Error fetching data sources:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch data sources' } });
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
      res
        .status(500)
        .json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to fetch data source' } });
    }
  };

  /* --------------------------------- CRUD --------------------------------- */

  createDataSource = async (req: Request, res: Response) => {
    try {
      const payload = req.body;

      const err = this.validateDataSourceData(payload);
      if (err) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err } });
        return;
      }

      const normType = normalizeType(payload.type) ?? payload.type;
      const userId = (req as ReqWithUser).user?.id ?? 'system';

      // Skip connection test during creation - we already tested it in the wizard
      const created = await this.dataSourceService.createDataSource({
        ...payload,
        type: normType,
        status: 'connected', // Mark as connected since test passed
        lastTestAt: new Date(),
        createdBy: userId,
      });

      res.status(201).json({ success: true, data: created });
    } catch (error) {
      logger.error('Error creating data source:', error);
      res.status(500).json({ 
        success: false, 
        error: { code: 'CREATE_ERROR', message: 'Failed to create data source' } 
      });
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
      res
        .status(500)
        .json({ success: false, error: { code: 'UPDATE_ERROR', message: 'Failed to update data source' } });
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
      res
        .status(500)
        .json({ success: false, error: { code: 'DELETE_ERROR', message: 'Failed to delete data source' } });
    }
  };

  /* ------------------------------- Testing -------------------------------- */

  /** Test a saved data source by id */
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
      if (!result.success) (patch as any).lastError = result.error || 'Connection test failed';

      await this.dataSourceService.updateDataSource(id, patch);

      res.json({
        success: true,
        data: {
          success: !!result.success,
          connectionStatus: result.success ? 'connected' : 'failed',
          responseTime: result.responseTime, // your model uses responseTime
          details: result.details,
          error: result.error,
          testedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error testing connection:', error);
      res.status(500).json({ success: false, error: { code: 'TEST_ERROR', message: 'Failed to test connection' } });
    }
  };

  /** Test a raw config (wizard step) — works even if your service lacks testRawConfig */
  /** Test a raw config (wizard step) — works even if your service lacks testRawConfig */
testConfig = async (req: Request, res: Response) => {
    try {
      // API Gateway transforms 'config' to 'connection', so we check both
      const { type } = req.body ?? {};
      const config = req.body?.config || req.body?.connection;
      
      console.log('🔍 Controller received - type:', type);
      console.log('🔍 Controller received - config:', JSON.stringify(config, null, 2));
      
      const normType = normalizeType(type);
      if (!normType) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid type' } });
        return;
      }
      if (!config || typeof config !== 'object') {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid config' } });
        return;
      }

      // Create a mock DataSource object that matches what your service expects
      const mockDataSource = {
        id: 'tmp',
        name: 'tmp',
        type: normType,
        connectionConfig: config,
        // Add any other required fields your DataSource interface needs
        status: 'testing' as DataSourceStatus,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system',
        updatedBy: 'system',
      };

      console.log('🔍 Testing connection with mock DataSource:', JSON.stringify(mockDataSource, null, 2));

      const result = await this.connectionTestService.testConnection(mockDataSource as DataSource);

      res.json({
        success: true,
        data: {
          success: !!result?.success,
          connectionStatus: result?.success ? 'connected' : 'failed',
          responseTime: result?.responseTime,
          details: result?.details,
          error: result?.error,
          testedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      logger.error('Error testing raw config:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'TEST_ERROR', message: 'Failed to test data source config' } });
    }
  };

  /* ------------------------------ Discovery ------------------------------- */

  /** Discover DBs from a raw config (wizard preview) */
  previewDatabases = async (req: Request, res: Response) => {
    try {
      console.log('🔍 Preview databases request body:', JSON.stringify(req.body, null, 2));
      
      // API Gateway transforms 'config' to 'connection', so we check both
      const { type } = req.body ?? {};
      const config = req.body?.config || req.body?.connection;
      
      console.log('🔍 Preview databases - type:', type);
      console.log('🔍 Preview databases - config:', JSON.stringify(config, null, 2));
      
      const normType = normalizeType(type);
      if (!normType) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid type' } });
        return;
      }
      if (!config || typeof config !== 'object') {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid config' } });
        return;
      }

      console.log('🔍 Preview databases - calling discovery for type:', normType);

      // Call the method directly since it exists in your service
      let databases: Array<{ name: string }> = [];

      try {
        databases = await this.connectionTestService.discoverDatabasesFromConfig(normType, config);
        console.log('🔍 Preview databases - discovered:', databases);
      } catch (error) {
        logger.warn('Database discovery failed:', error);
        console.log('❌ Preview databases - discovery failed:', error);
        databases = []; // Return empty array on failure
      }

      const data = Array.isArray(databases) && databases.length > 0 ? databases : [];

      console.log('🔍 Preview databases - returning data:', data);
      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error previewing databases:', error);
      console.error('❌ Preview databases - error:', error);
      res.status(500).json({
        success: false,
        error: { code: 'DISCOVERY_ERROR', message: 'Failed to discover databases' },
      });
    }
  };

  /** List DBs for a saved data source (card "Browse Databases") */
  listDatabases = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ds = await this.dataSourceService.getDataSourceById(id);
      if (!ds) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Data source not found' } });
        return;
      }

      // Use service if you add it later; otherwise default to empty list.
      const tryList = (this.dataSourceService as any).listDatabases;
      let databases: Array<string | { name: string }> = [];

      if (typeof tryList === 'function') {
        databases = (await tryList.call(this.dataSourceService, id, ds)) as Array<string | { name: string }>;
      } else {
        databases = [];
      }

      const data =
        Array.isArray(databases) && databases.length > 0
          ? typeof databases[0] === 'string'
            ? (databases as string[]).map((name) => ({ name }))
            : (databases as Array<{ name: string }>)
          : [];

      res.json({ success: true, data });
    } catch (error) {
      logger.error('Error listing databases:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'DB_LIST_ERROR', message: 'Failed to list databases' } });
    }
  };

  /* -------------------------------- Health -------------------------------- */

  getHealthSummary = async (_req: Request, res: Response) => {
    try {
      const summary = await this.dataSourceService.getHealthSummary();
      res.json({ success: true, data: summary });
    } catch (error) {
      logger.error('Error fetching health summary:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'HEALTH_ERROR', message: 'Failed to fetch health summary' } });
    }
  };

  getDataSourceSchema = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const schema = await this.dataSourceService.getDataSourceSchema(id);
      res.json({ success: true, data: schema });
    } catch (error) {
      logger.error('Error fetching schema:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'SCHEMA_ERROR', message: 'Failed to fetch data source schema' } });
    }
  };

  /* --------------------------------- Sync --------------------------------- */

  syncDataSource = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { force = false } = req.body ?? {};

      logger.info(`[SYNC] Starting sync for data source: ${id}`);

      const result = await this.dataSourceService.syncDataSource(id, { force: !!force });

      logger.info(`[SYNC] Sync completed, updating lastSyncAt for: ${id}`);

      // Update lastSyncAt timestamp
      await this.dataSourceService.updateDataSource(id, {
        lastSyncAt: new Date(),
      });

      logger.info(`[SYNC] lastSyncAt updated successfully for: ${id}`);

      const normalizedStatus: 'queued' | 'started' | 'running' | 'completed' | 'failed' =
        (result as any)?.status ??
        ((result as any)?.completedAt ? 'completed' : 'started');

      const normalizedSyncId =
        (result as any)?.syncId ??
        (result as any)?.id ??
        `run_${Date.now()}`;

      // Spread first, then override to avoid duplicate keys warning
      const payload = {
        ...(result as Record<string, any>),
        status: normalizedStatus,
        syncId: normalizedSyncId,
      };

      res.json({ success: true, data: payload });
    } catch (error) {
      logger.error('[SYNC] Error syncing data source:', error);

      // Improve error messaging for common Azure SQL issues
      const errorMsg = error instanceof Error ? error.message : String(error);
      let userMessage = 'Failed to sync data source';

      if (errorMsg.includes('not allowed to access the server') || errorMsg.includes('firewall')) {
        userMessage = 'Azure SQL firewall is blocking this connection. Add your IP address to the server\'s firewall rules in Azure Portal.';
      } else if (errorMsg.includes('login failed') || errorMsg.includes('authentication')) {
        userMessage = 'Authentication failed. Check your username and password.';
      } else if (errorMsg.includes('timeout') || errorMsg.includes('ETIMEDOUT')) {
        userMessage = 'Connection timed out. Check your network and firewall settings.';
      }

      res
        .status(500)
        .json({ success: false, error: userMessage });
    }
  };

  getSyncStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const tryStatus = (this.dataSourceService as any).getSyncStatus;

      if (typeof tryStatus !== 'function') {
        res.json({
          success: true,
          data: { syncId: `unknown_${id}`, status: 'started' as const },
        });
        return;
      }

      const result = await tryStatus.call(this.dataSourceService, id);

      const normalizedStatus: 'queued' | 'started' | 'running' | 'completed' | 'failed' =
        (result as any)?.status ??
        ((result as any)?.completedAt ? 'completed' : 'running');

      const normalizedSyncId =
        (result as any)?.syncId ??
        (result as any)?.id ??
        `run_${Date.now()}`;

      // Spread first, then override to avoid duplicate keys warning
      const payload = {
        ...(result as Record<string, any>),
        status: normalizedStatus,
        syncId: normalizedSyncId,
      };

      res.json({ success: true, data: payload });
    } catch (error) {
      logger.error('Error fetching sync status:', error);
      res
        .status(500)
        .json({ success: false, error: { code: 'SYNC_STATUS_ERROR', message: 'Failed to get sync status' } });
    }
  };

  /* ------------------------------- Validation ------------------------------ */

  private validateDataSourceData(data: any): string | null {
    if (!data?.name) return 'Name is required';
    if (!data?.type) return 'Type is required';
    
    const connectionConfig = data?.connectionConfig || data?.config || data?.connection;
    if (!connectionConfig) return 'Connection configuration is required';

    const t = normalizeType(data.type);
    const hasConnStr = !!connectionConfig.connectionString;
    const hasHost = !!connectionConfig.host;
    const hasDatabase = !!connectionConfig.database;

    switch (t) {
      case 'postgresql':
      case 'mysql':
      case 'oracle':
      case 'redshift':
        // These typically require database specification
        if (!hasConnStr && !hasHost) {
          return 'Host or connection string is required';
        }
        break;

      case 'mssql':
        // SQL Server can connect at server level without specifying database
        if (!hasConnStr && !hasHost) {
          return 'Host or connection string is required for SQL Server';
        }
        // Allow server-level connections - don't require database
        break;

      case 'mongodb':
        if (!hasConnStr && !hasHost) {
          return 'Host or connection string is required for MongoDB';
        }
        break;

      case 's3':
        if (!connectionConfig.bucket) return 'Bucket is required for S3';
        break;

      case 'api':
        if (!connectionConfig.baseUrl) return 'Base URL is required for API connections';
        break;
    }

    return null;
  }
}