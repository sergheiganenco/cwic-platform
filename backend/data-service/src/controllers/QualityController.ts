// backend/data-service/src/controllers/QualityController.ts
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { QualityService } from '../services/QualityService';
import { StatsService } from '../services/StatsService';
import { ProfilingService } from '../services/ProfilingService';
import { QualityRuleEngine } from '../services/QualityRuleEngine';
import { DataHealingService } from '../services/DataHealingService';
import { QualityImpactAnalysisService } from '../services/QualityImpactAnalysisService';
import { QualityROIService } from '../services/QualityROIService';
import { logger } from '../utils/logger';

// Custom error classes
class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

class BusinessError extends Error {
  constructor(message: string, public code: string, public statusCode: number = 400) {
    super(message);
    this.name = 'BusinessError';
  }
}

// Request validation schemas
const ListRulesSchema = z.object({
  q: z.string().max(100).optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  enabled: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const ExecuteRuleSchema = z.object({
  dataSourceId: z.string().uuid().optional(),
  timeout: z.coerce.number().min(1000).max(300000).default(30000),
});

const ListResultsSchema = z.object({
  ruleId: z.string().uuid().optional(),
  dataSourceId: z.string().uuid().optional(),
  status: z.enum(['passed', 'failed', 'error', 'skipped', 'timeout']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

const SummarySchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d']).default('7d').optional(),
});

const StatsSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d']).default('7d').optional(),
  groupBy: z.enum(['severity', 'status', 'data_source']).default('status').optional(),
});

export class QualityController {
  // allow DI for tests, default to real service
  constructor(
    private svc: QualityService = new QualityService(),
    private statsSvc: StatsService = new StatsService(),
    private profilingSvc: ProfilingService = new ProfilingService(),
    private ruleEngine: QualityRuleEngine = new QualityRuleEngine(),
    private healingSvc: DataHealingService = new DataHealingService(),
    private impactSvc: QualityImpactAnalysisService = new QualityImpactAnalysisService(),
    private roiSvc: QualityROIService = new QualityROIService(),
  ) {}

  listRules = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const validatedQuery = ListRulesSchema.parse(req.query);
      const result = await this.svc.listRules(validatedQuery);
      const processingTime = Date.now() - startTime;

      logger.info('Quality rules listed', {
        userId: (req as any).user?.id,
        filters: validatedQuery,
        resultCount: result.rules.length,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: {
          rules: result.rules,
          pagination: {
            total: result.total,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset,
            hasMore: validatedQuery.offset + validatedQuery.limit < result.total,
          },
        },
        meta: { processingTimeMs: processingTime, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(this.handleError(error, 'listRules'));
    }
  };

  createRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const userId = (req as any).user?.id;
      if (!userId) throw new BusinessError('Authentication required', 'AUTH_REQUIRED', 401);

      const rule = await this.svc.createRule(req.body, userId);
      const processingTime = Date.now() - startTime;

      logger.info('Quality rule created', { ruleId: rule.id, name: rule.name, createdBy: userId, processingTimeMs: processingTime });

      res.status(201).json({
        success: true,
        data: rule,
        meta: { processingTimeMs: processingTime, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(this.handleError(error, 'createRule'));
    }
  };

  updateRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const userId = (req as any).user?.id;
      const ruleId = req.params.id;
      if (!userId) throw new BusinessError('Authentication required', 'AUTH_REQUIRED', 401);
      if (!z.string().uuid().safeParse(ruleId).success) throw new ValidationError('Invalid rule ID format');

      const updated = await this.svc.updateRule(ruleId, req.body, userId);
      if (!updated) throw new BusinessError('Rule not found', 'RULE_NOT_FOUND', 404);

      const processingTime = Date.now() - startTime;

      logger.info('Quality rule updated', { ruleId, updatedBy: userId, processingTimeMs: processingTime });

      res.json({
        success: true,
        data: updated,
        meta: { processingTimeMs: processingTime, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(this.handleError(error, 'updateRule'));
    }
  };

  deleteRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const userId = (req as any).user?.id;
      const ruleId = req.params.id;
      if (!userId) throw new BusinessError('Authentication required', 'AUTH_REQUIRED', 401);
      if (!z.string().uuid().safeParse(ruleId).success) throw new ValidationError('Invalid rule ID format');

      const deleted = await this.svc.deleteRule(ruleId, userId);
      if (!deleted) throw new BusinessError('Rule not found', 'RULE_NOT_FOUND', 404);

      const processingTime = Date.now() - startTime;

      logger.info('Quality rule deleted', { ruleId, deletedBy: userId, processingTimeMs: processingTime });

      res.json({
        success: true,
        message: 'Rule successfully disabled',
        meta: { processingTimeMs: processingTime, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(this.handleError(error, 'deleteRule'));
    }
  };

  listResults = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const validatedQuery = ListResultsSchema.parse(req.query);
      const result = await this.svc.listResults(validatedQuery);
      const processingTime = Date.now() - startTime;

      logger.info('Quality results listed', {
        userId: (req as any).user?.id,
        filters: validatedQuery,
        resultCount: result.results.length,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: {
          results: result.results,
          pagination: {
            total: result.total,
            limit: validatedQuery.limit,
            offset: validatedQuery.offset,
            hasMore: validatedQuery.offset + validatedQuery.limit < result.total,
          },
        },
        meta: { processingTimeMs: processingTime, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(this.handleError(error, 'listResults'));
    }
  };

  executeRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const userId = (req as any).user?.id;
      const ruleId = req.params.id;

      if (!userId) throw new BusinessError('Authentication required', 'AUTH_REQUIRED', 401);
      if (!z.string().uuid().safeParse(ruleId).success) throw new ValidationError('Invalid rule ID format');

      const validatedBody = ExecuteRuleSchema.parse(req.body);

      const result = await this.svc.executeRule(ruleId, validatedBody.dataSourceId, {
        timeout: validatedBody.timeout,
        userId,
      });

      const processingTime = Date.now() - startTime;

      logger.info('Quality rule executed', {
        ruleId,
        dataSourceId: validatedBody.dataSourceId,
        status: result.status,
        executionTimeMs: result.execution_time_ms,
        executedBy: userId,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: result,
        meta: { processingTimeMs: processingTime, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(this.handleError(error, 'executeRule'));
    }
  };

  getRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const ruleId = req.params.id;
      if (!z.string().uuid().safeParse(ruleId).success) throw new ValidationError('Invalid rule ID format');

      const rule = await this.svc.getRule(ruleId);
      if (!rule) throw new BusinessError('Rule not found', 'RULE_NOT_FOUND', 404);

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: rule,
        meta: { processingTimeMs: processingTime, timestamp: new Date().toISOString() },
      });
    } catch (error) {
      next(this.handleError(error, 'getRule'));
    }
  };

  // GET /api/quality/health
  healthCheck = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      // Prefer a DB ping in the service if available
      const ok = (this.svc as any).healthCheck ? await (this.svc as any).healthCheck() : (await this.svc.listRules({ limit: 1 })).rules !== undefined;
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          status: ok ? 'healthy' : 'degraded',
          service: 'quality-service',
          timestamp: new Date().toISOString(),
          responseTimeMs: processingTime,
        },
      });
    } catch (error) {
      next(this.handleError(error, 'healthCheck'));
    }
  };

  // GET /api/quality/summary
  getQualitySummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const validatedQuery = SummarySchema.parse(req.query);
      const { timeframe = '7d', dataSourceId, database, databases, assetType } = req.query as { timeframe?: string; dataSourceId?: string; database?: string; databases?: string; assetType?: string };

      // Support both 'databases' (plural, comma-separated) and 'database' (singular) for backwards compatibility
      const databaseFilter = databases || database;

      try {
        const summary = await this.statsSvc.getQualitySummary(timeframe, dataSourceId, databaseFilter, assetType);
        const processingTime = Date.now() - startTime;

        res.json({
          success: true,
          data: summary,
          meta: {
            timestamp: new Date().toISOString(),
            processingTimeMs: processingTime
          }
        });
      } catch (dbError: any) {
        // Return empty summary if database query fails
        logger.warn(`Quality summary query failed: ${dbError.message}`, dbError);

        const emptySummary = {
          timeframe,
          from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          to: new Date().toISOString(),
          totals: {
            totalChecks: 0,
            passed: 0,
            failed: 0,
            error: 0,
            skipped: 0,
            timeout: 0,
            passRate: 0,
            avgExecMs: 0,
            overallScore: 0,
          },
          statusBreakdown: [],
          sourceBreakdown: [],
          ruleCounts: {
            total: 0,
            active: 0,
            disabled: 0,
          },
          assetCoverage: {
            totalAssets: 0,
            monitoredAssets: 0,
          },
          unassigned: null,
        };

        res.json({
          success: true,
          data: emptySummary,
          meta: {
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime,
            note: 'No quality data available. Run profiling and create rules first.'
          }
        });
      }
    } catch (error) {
      next(this.handleError(error, 'getQualitySummary'));
    }
  };

  // GET /api/quality/stats
  getQualityStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { timeframe = '7d', groupBy = 'status' } = StatsSchema.parse(req.query);
      // âœ… FIX: use this.svc, not this.service
      const stats = await this.svc.getStats({ timeframe, groupBy });
      res.json({ success: true, data: stats, meta: { timestamp: new Date().toISOString() } });
    } catch (error) {
      next(this.handleError(error, 'getQualityStats'));
    }
  };

  // POST /api/quality/rules/bulk/execute  (used by router)
  executeRulesBulk = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) throw new BusinessError('Authentication required', 'AUTH_REQUIRED', 401);

      const body = z.object({
        ruleIds: z.array(z.string().uuid()).min(1).max(10),
        dataSourceId: z.string().uuid().optional(),
        timeout: z.coerce.number().min(1000).max(300000).optional(),
      }).parse(req.body);

      const concurrency = 3;
      const results: any[] = [];
      let idx = 0;

      const worker = async () => {
        while (idx < body.ruleIds.length) {
          const myIndex = idx++;
          const id = body.ruleIds[myIndex];
          try {
            const r = await this.svc.executeRule(id, body.dataSourceId, { timeout: body.timeout, userId });
            results[myIndex] = { ok: true, result: r };
          } catch (e: any) {
            results[myIndex] = { ok: false, error: String(e?.message || e) };
          }
        }
      };

      await Promise.all(Array.from({ length: Math.min(concurrency, body.ruleIds.length) }, worker));
      res.status(202).json({ success: true, data: { results } });
    } catch (error) {
      next(this.handleError(error, 'executeRulesBulk'));
    }
  };

  // GET /api/quality/profiles - Get persisted profiles from database
  getPersistedProfiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dataSourceId, assetId } = req.query;

      let query = `
        SELECT
          dp.id,
          dp.asset_id,
          dp.data_source_id,
          dp.profile_date,
          dp.row_count,
          dp.column_count,
          dp.size_bytes,
          dp.profile_data,
          dp.quality_score,
          dp.completeness_score,
          dp.accuracy_score,
          dp.consistency_score,
          dp.validity_score,
          dp.freshness_score,
          dp.uniqueness_score,
          ca.table_name,
          ca.schema_name
        FROM data_profiles dp
        JOIN catalog_assets ca ON ca.id = dp.asset_id
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (dataSourceId) {
        query += ` AND dp.data_source_id = $${paramCount++}`;
        params.push(dataSourceId);
      }

      if (assetId) {
        query += ` AND dp.asset_id = $${paramCount++}`;
        params.push(assetId);
      }

      query += ` ORDER BY dp.profile_date DESC`;

      // If filtering by data source, get the latest profile for each asset
      if (dataSourceId && !assetId) {
        query = `
          WITH latest_profiles AS (
            SELECT DISTINCT ON (asset_id)
              dp.id,
              dp.asset_id,
              dp.data_source_id,
              dp.profile_date,
              dp.row_count,
              dp.column_count,
              dp.size_bytes,
              dp.profile_data,
              dp.quality_score,
              dp.completeness_score,
              dp.accuracy_score,
              dp.consistency_score,
              dp.validity_score,
              dp.freshness_score,
              dp.uniqueness_score,
              ca.table_name,
              ca.schema_name
            FROM data_profiles dp
            JOIN catalog_assets ca ON ca.id = dp.asset_id
            WHERE dp.data_source_id = $1
            ORDER BY dp.asset_id, dp.profile_date DESC
          )
          SELECT * FROM latest_profiles
          ORDER BY quality_score DESC, table_name
        `;
      }

      const result = await this.svc['db'].query(query, params);

      // Transform to match AssetProfile interface
      const profiles = result.rows.map((row: any) => ({
        assetId: row.asset_id,
        assetName: `${row.schema_name}.${row.table_name}`,
        dataSourceId: row.data_source_id,
        rowCount: parseInt(row.row_count) || 0,
        columnCount: parseInt(row.column_count) || 0,
        sizeBytes: parseInt(row.size_bytes) || 0,
        columns: row.profile_data?.columns || [],
        qualityScore: parseFloat(row.quality_score) || 0,
        dimensionScores: {
          completeness: parseFloat(row.completeness_score) || 0,
          accuracy: parseFloat(row.accuracy_score) || 0,
          consistency: parseFloat(row.consistency_score) || 0,
          validity: parseFloat(row.validity_score) || 0,
          freshness: parseFloat(row.freshness_score) || 0,
          uniqueness: parseFloat(row.uniqueness_score) || 0,
        },
        profiledAt: row.profile_date,
      }));

      res.json({
        success: true,
        data: profiles,
        meta: {
          count: profiles.length,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getPersistedProfiles'));
    }
  };

  // POST /api/quality/profile/asset/:id - Profile a specific asset
  profileAsset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const assetId = parseInt(req.params.id);

      if (isNaN(assetId)) {
        throw new ValidationError('Invalid asset ID');
      }

      logger.info(`Starting asset profiling for asset ${assetId}`);

      const profile = await this.profilingSvc.profileAsset(assetId);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: profile,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'profileAsset'));
    }
  };

  // POST /api/quality/profile/datasource/:id - Profile entire data source
  profileDataSource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const dataSourceId = req.params.id;
      const { database } = req.body || {};

      logger.info(`Starting data source profiling for ${dataSourceId}${database ? ` in database ${database}` : ''}`);

      // Validate data source exists
      const dsCheck = await this.svc['db'].query(
        `SELECT id, name FROM data_sources WHERE id = $1`,
        [dataSourceId]
      );

      if (dsCheck.rows.length === 0) {
        throw new BusinessError('Data source not found', 'NOT_FOUND', 404);
      }

      // Profile all assets in the data source (with optional database filter)
      const profiles = await this.profilingSvc.profileDataSource(dataSourceId, database);
      const processingTime = Date.now() - startTime;

      // Calculate summary statistics
      // Count profiles as successful if they have column data (profiling succeeded)
      const successfulProfiles = profiles.filter(p => p.columns && p.columns.length > 0);
      const avgQualityScore = profiles.length > 0
        ? Math.round(profiles.reduce((sum, p) => sum + p.qualityScore, 0) / profiles.length)
        : 0;

      logger.info(`Data source profiling complete: ${successfulProfiles.length}/${profiles.length} successful, avg score: ${avgQualityScore}%`);

      res.json({
        success: true,
        data: {
          dataSourceId,
          profileCount: profiles.length,
          successfulProfiles: successfulProfiles.length,
          failedProfiles: profiles.length - successfulProfiles.length,
          averageQualityScore: avgQualityScore,
          profiles: profiles,
        },
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'profileDataSource'));
    }
  };

  // GET /api/quality/profile/asset/:id/suggestions - Get rule suggestions
  getProfileSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assetId = parseInt(req.params.id);

      if (isNaN(assetId)) {
        throw new ValidationError('Invalid asset ID');
      }

      const suggestions = await this.profilingSvc.suggestRules(assetId);

      res.json({
        success: true,
        data: {
          assetId,
          suggestions,
        },
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getProfileSuggestions'));
    }
  };

  // GET /api/quality/profiles/recent - Get recent profile history
  getRecentProfiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = Number(req.query.limit) || 10;
      const dataSourceId = req.query.dataSourceId as string | undefined;

      logger.info(`Fetching recent profiles (limit: ${limit}, dataSourceId: ${dataSourceId || 'all'})`);

      const profiles = await this.profilingSvc.getRecentProfiles(limit, dataSourceId);

      res.json({
        success: true,
        data: profiles,
        meta: {
          limit,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getRecentProfiles'));
    }
  };

  // POST /api/quality/scan/:dataSourceId - Scan data source with all rules
  scanDataSource = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const dataSourceId = req.params.dataSourceId;
      const { ruleIds } = req.body || {};

      logger.info(`Starting quality scan for data source ${dataSourceId}`);

      try {
        const scanResult = await this.ruleEngine.scanDataSource(dataSourceId, ruleIds);
        const processingTime = Date.now() - startTime;

        res.json({
          success: true,
          data: scanResult,
          meta: {
            processingTimeMs: processingTime,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (error: any) {
        // If scan fails, return error
        logger.error(`Scan failed:`, error.message);

        next(this.handleError(error, 'scanDataSource'));
      }
    } catch (error) {
      next(this.handleError(error, 'scanDataSource'));
    }
  };

  // POST /api/quality/rules/:id/execute/v2 - Execute single rule with new engine
  executeRuleV2 = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const ruleId = req.params.id;
      const userId = (req as any).user?.id;

      logger.info(`Executing rule ${ruleId}`);

      // Validate rule ID
      if (!z.string().uuid().safeParse(ruleId).success) {
        throw new ValidationError('Invalid rule ID format. Expected UUID.');
      }

      const result = await this.ruleEngine.executeRule(ruleId, userId);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: result,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'executeRuleV2'));
    }
  };

  // GET /api/quality/issues - List quality issues with filters
  listIssues = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        status,
        severity,
        dataSourceId,
        assetId,
        limit = 50,
        offset = 0,
      } = req.query;

      try {
        let query = `
          SELECT qi.*, qr.name as rule_name, qr.dimension,
                 ca.table_name, ca.schema_name,
                 ds.name as data_source_name
          FROM quality_issues qi
          JOIN quality_rules qr ON qr.id = qi.rule_id
          LEFT JOIN catalog_assets ca ON ca.id = qi.asset_id
          LEFT JOIN data_sources ds ON ds.id = qi.data_source_id
          WHERE 1=1
        `;

        const params: any[] = [];
        let paramCount = 1;

        if (status) {
          query += ` AND qi.status = $${paramCount++}`;
          params.push(status);
        }

        if (severity) {
          query += ` AND qi.severity = $${paramCount++}`;
          params.push(severity);
        }

        if (dataSourceId) {
          query += ` AND qi.data_source_id = $${paramCount++}`;
          params.push(dataSourceId);
        }

        if (assetId) {
          query += ` AND qi.asset_id = $${paramCount++}`;
          params.push(parseInt(assetId as string));
        }

        query += ` ORDER BY qi.first_seen_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
        params.push(parseInt(limit as string), parseInt(offset as string));

        const result = await this.svc['db'].query(query, params);

        // Get total count
        const countQuery = query.replace(/SELECT .* FROM/, 'SELECT COUNT(*) FROM').split('ORDER BY')[0];
        const countResult = await this.svc['db'].query(countQuery, params.slice(0, -2));

        res.json({
          success: true,
          data: {
            issues: result.rows,
            pagination: {
              total: parseInt(countResult.rows[0].count),
              limit: parseInt(limit as string),
              offset: parseInt(offset as string),
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
          },
        });
      } catch (dbError: any) {
        // If database query fails, return empty issues array
        logger.warn(`Database query failed, returning empty issues:`, dbError.message);

        res.json({
          success: true,
          data: {
            issues: [],
            pagination: {
              total: 0,
              limit: parseInt(limit as string),
              offset: parseInt(offset as string),
            },
          },
          meta: {
            timestamp: new Date().toISOString(),
            note: 'Database schema may need initialization. Run migrations to create quality_issues table.',
          },
        });
      }
    } catch (error) {
      next(this.handleError(error, 'listIssues'));
    }
  };

  // GET /api/quality/business-impact - Get real business impact from quality_results
  getBusinessImpact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dataSourceId, database, databases } = req.query;

      // Calculate business impact from REAL quality_results (failed scans)
      let query = `
        SELECT
          qres.id,
          qres.status,
          qres.rows_failed,
          qr.name as rule_name,
          qr.dimension,
          qr.severity,
          ca.table_name,
          ca.database_name,
          qr.asset_id
        FROM quality_results qres
        JOIN quality_rules qr ON qr.id = qres.rule_id
        LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
        WHERE qres.status = 'failed'
          AND qres.run_at > NOW() - INTERVAL '7 days'
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (dataSourceId) {
        query += ` AND qres.data_source_id = $${paramCount++}`;
        params.push(dataSourceId);
      }

      const databaseFilter = databases || database;
      if (databaseFilter) {
        const databaseList = databaseFilter.split(',').map((d: string) => d.trim()).filter((d: string) => d);
        if (databaseList.length > 0) {
          query += ` AND ca.database_name = ANY($${paramCount++}::text[])`;
          params.push(databaseList);
        }
      }

      const result = await this.svc['db'].query(query, params);

      // Calculate business impact from failed scans
      let totalRevenueImpact = 0;
      let totalUserImpact = 0;
      let criticalCount = 0;
      let highCount = 0;
      let mediumCount = 0;

      const assetImpacts = new Map();

      result.rows.forEach((row: any) => {
        const rowsFailed = parseInt(row.rows_failed) || 0;
        const estimatedRevenuePerRow = 50; // Conservative estimate: $50 per row
        const revenueImpact = rowsFailed * estimatedRevenuePerRow;

        totalRevenueImpact += revenueImpact;
        totalUserImpact += rowsFailed; // Each failed row could be a user

        // Count by severity
        if (row.severity === 'critical') criticalCount++;
        else if (row.severity === 'high') highCount++;
        else if (row.severity === 'medium') mediumCount++;

        // Track per asset (use table_name as fallback if asset_id is null)
        const assetKey = row.asset_id || `table_${row.table_name}_${row.database_name}`;
        if (assetKey) {
          if (!assetImpacts.has(assetKey)) {
            assetImpacts.set(assetKey, {
              assetId: row.asset_id,
              tableName: row.table_name,
              databaseName: row.database_name,
              severity: row.severity,
              revenueImpact: 0,
              userImpact: 0
            });
          }
          const asset = assetImpacts.get(assetKey);
          asset.revenueImpact += revenueImpact;
          asset.userImpact += rowsFailed;
          // Keep highest severity
          if (row.severity === 'critical') asset.severity = 'critical';
          else if (row.severity === 'high' && asset.severity !== 'critical') asset.severity = 'high';
          else if (row.severity === 'medium' && !['critical', 'high'].includes(asset.severity)) asset.severity = 'medium';
        }
      });

      res.json({
        success: true,
        data: {
          totalRevenueImpact,
          totalUserImpact,
          criticalIssues: criticalCount,
          highIssues: highCount,
          mediumIssues: mediumCount,
          totalFailedScans: result.rows.length,
          estimatedDowntimeMinutes: (criticalCount * 5) + (highCount * 2),
          assetsImpacted: assetImpacts.size,
          assetDetails: Array.from(assetImpacts.values())
        },
        meta: {
          timestamp: new Date().toISOString(),
          note: 'Calculated from real quality_results (failed scans). Revenue estimate: $50/row.'
        }
      });
    } catch (error) {
      next(this.handleError(error, 'getBusinessImpact'));
    }
  };

  // GET /api/quality/critical-alerts - Get critical quality alerts from recent failed scans
  getCriticalAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dataSourceId, database, databases, limit = 10 } = req.query;

      // Get recent failed quality results that represent critical issues
      let query = `
        SELECT
          qres.id,
          qres.status,
          qres.rows_failed,
          qres.run_at,
          qres.execution_time_ms,
          qr.name as rule_name,
          qr.dimension,
          qr.severity,
          qr.description,
          ca.table_name,
          ca.database_name,
          ca.asset_type,
          qr.asset_id
        FROM quality_results qres
        JOIN quality_rules qr ON qr.id = qres.rule_id
        LEFT JOIN catalog_assets ca ON ca.id = qr.asset_id
        WHERE qres.status = 'failed'
          AND qres.run_at > NOW() - INTERVAL '24 hours'
      `;

      const params: any[] = [];
      let paramCount = 1;

      if (dataSourceId) {
        query += ` AND qres.data_source_id = $${paramCount++}`;
        params.push(dataSourceId);
      }

      const databaseFilter = databases || database;
      if (databaseFilter) {
        const databaseList = databaseFilter.toString().split(',').map((d: string) => d.trim()).filter((d: string) => d);
        if (databaseList.length > 0) {
          query += ` AND ca.database_name = ANY($${paramCount++}::text[])`;
          params.push(databaseList);
        }
      }

      query += ` ORDER BY
        CASE qr.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          ELSE 4
        END,
        qres.run_at DESC
        LIMIT $${paramCount}`;
      params.push(parseInt(limit as string) || 10);

      const result = await this.svc['db'].query(query, params);

      // Transform results into alert format
      const alerts = result.rows.map((row: any) => {
        const rowsFailed = parseInt(row.rows_failed) || 0;
        const timeAgo = this.getTimeAgo(new Date(row.run_at));

        // Calculate impact estimates
        const estimatedRevenuePerRow = 50;
        const revenueImpact = rowsFailed * estimatedRevenuePerRow;

        // Determine if auto-fix is actually available
        // Empty table checks cannot be auto-fixed (need data insertion, not repair)
        const isEmptyTableCheck = (row.description || '').toLowerCase().includes('should contain at least one row') ||
                                   (row.description || '').toLowerCase().includes('table is empty');

        // Auto-fix only available for actual data quality issues, not empty tables
        const autoFixAvailable = !isEmptyTableCheck &&
                                  rowsFailed > 0 &&
                                  (row.severity === 'high' || row.severity === 'critical');

        // Calculate true criticality score (not just empty tables)
        const criticalityScore = this.calculateCriticalityScore({
          severity: row.severity,
          rowsFailed,
          revenueImpact,
          isEmptyTable: isEmptyTableCheck
        });

        return {
          id: row.id,
          severity: row.severity || 'high',
          table: row.table_name || 'unknown',
          database: row.database_name,
          issue: row.description || row.rule_name,
          timestamp: timeAgo,
          impact: {
            users: rowsFailed > 0 ? rowsFailed : undefined,
            revenue: revenueImpact > 0 ? `$${Math.round(revenueImpact / 1000)}K` : undefined,
            downstream: undefined // Could be calculated from lineage data
          },
          autoFixAvailable,
          confidence: row.severity === 'high' ? 0.92 : 0.87,
          ruleId: row.id,
          assetId: row.asset_id,
          criticalityScore, // Add criticality score for ranking
          isEmptyTableAlert: isEmptyTableCheck // Flag empty table alerts
        };
      });

      // Sort by criticality score (highest first)
      alerts.sort((a, b) => b.criticalityScore - a.criticalityScore);

      // Calculate alert statistics
      const trueCriticalAlerts = alerts.filter(a => !a.isEmptyTableAlert && a.criticalityScore >= 60);
      const emptyTableAlerts = alerts.filter(a => a.isEmptyTableAlert);
      const lowPriorityAlerts = alerts.filter(a => !a.isEmptyTableAlert && a.criticalityScore < 60);

      res.json({
        success: true,
        data: alerts,
        meta: {
          timestamp: new Date().toISOString(),
          count: alerts.length,
          statistics: {
            totalAlerts: alerts.length,
            trueCritical: trueCriticalAlerts.length,
            emptyTables: emptyTableAlerts.length,
            lowPriority: lowPriorityAlerts.length,
            averageCriticalityScore: Math.round(
              alerts.reduce((sum, a) => sum + a.criticalityScore, 0) / alerts.length
            )
          },
          categories: {
            critical: {
              count: trueCriticalAlerts.length,
              description: 'Actual data quality issues requiring immediate attention',
              examples: trueCriticalAlerts.slice(0, 3).map(a => ({
                table: a.table,
                issue: a.issue,
                score: a.criticalityScore
              }))
            },
            informational: {
              count: emptyTableAlerts.length,
              description: 'Empty table notifications (not actionable quality issues)',
              note: 'These tables need data population, not quality fixes'
            },
            lowPriority: {
              count: lowPriorityAlerts.length,
              description: 'Minor quality issues with low business impact'
            }
          },
          note: 'Alerts sorted by criticality score (100 = most critical, 0 = least critical)'
        }
      });
    } catch (error) {
      next(this.handleError(error, 'getCriticalAlerts'));
    }
  };

  // Helper method to format time ago
  private getTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }

  /**
   * Calculate true criticality score for alerts
   * This helps distinguish between truly critical issues vs informational alerts
   */
  private calculateCriticalityScore(params: {
    severity: string;
    rowsFailed: number;
    revenueImpact: number;
    isEmptyTable: boolean;
  }): number {
    let score = 0;

    // Base score from severity
    const severityScores: { [key: string]: number } = {
      'critical': 40,
      'high': 30,
      'medium': 20,
      'low': 10
    };
    score += severityScores[params.severity] || 10;

    // Empty table alerts are low priority (informational, not critical)
    if (params.isEmptyTable) {
      score = Math.min(score, 25); // Cap at 25 for empty tables
      return score;
    }

    // Rows failed impact (up to 30 points)
    if (params.rowsFailed > 10000) {
      score += 30; // Very high impact
    } else if (params.rowsFailed > 1000) {
      score += 25; // High impact
    } else if (params.rowsFailed > 100) {
      score += 20; // Medium impact
    } else if (params.rowsFailed > 10) {
      score += 15; // Low impact
    } else if (params.rowsFailed > 0) {
      score += 10; // Minimal impact
    }

    // Revenue impact (up to 30 points)
    if (params.revenueImpact > 100000) {
      score += 30; // $100K+ at risk
    } else if (params.revenueImpact > 50000) {
      score += 25; // $50K+ at risk
    } else if (params.revenueImpact > 10000) {
      score += 20; // $10K+ at risk
    } else if (params.revenueImpact > 1000) {
      score += 15; // $1K+ at risk
    } else if (params.revenueImpact > 0) {
      score += 10; // Some revenue at risk
    }

    // Total score is 0-100
    return Math.min(100, score);
  }

  // PATCH /api/quality/issues/:id/status - Update issue status
  updateIssueStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      // Set resolved_at when marking as resolved, clear it when reopening
      const resolvedAt = status === 'resolved' ? 'NOW()' : 'NULL';

      const query = `
        UPDATE quality_issues
        SET status = $1, notes = $2, resolved_at = ${resolvedAt}, updated_at = NOW()
        WHERE id = $3
        RETURNING *
      `;

      const result = await this.svc['db'].query(query, [status, notes, id]);

      if (result.rows.length === 0) {
        const err = new Error('Issue not found') as any;
        err.statusCode = 404;
        return next(err);
      }

      res.json({
        success: true,
        data: result.rows[0],
        meta: {
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'updateIssueStatus'));
    }
  };

  // GET /api/quality/trends - Get quality trends over time
  getQualityTrends = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dataSourceId, timeframe = '30d' } = req.query;

      // TODO: Implement real trends from quality_results table
      // For now, return empty trends
      logger.info(`Trends requested for timeframe: ${timeframe}, dataSourceId: ${dataSourceId || 'all'}`);

      res.json({
        success: true,
        data: [],
        meta: {
          timestamp: new Date().toISOString(),
          note: 'Trends feature requires historical quality_results data. Execute rules over time to see trends.'
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getQualityTrends'));
    }
  };

  // POST /api/quality/ai/generate-rule - Generate rule from natural language
  generateRuleFromText = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { prompt, context } = req.body;
      const userId = (req as any).user?.id || 'system';

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 10) {
        throw new ValidationError('Prompt must be at least 10 characters long');
      }

      logger.info(`Generating rule from prompt: ${prompt.substring(0, 50)}...`, { userId, context });

      // Parse the prompt to understand intent
      const lowerPrompt = prompt.toLowerCase();
      let dimension = 'validity';
      let severity: 'low' | 'medium' | 'high' | 'critical' = 'medium';
      let name = prompt.substring(0, 50);
      let description = `AI-generated rule from: ${prompt}`;
      let sqlExpression = '';

      // Determine rule type and generate SQL based on prompt
      if (lowerPrompt.includes('email')) {
        dimension = 'validity';
        severity = 'high';
        name = 'Email Format Validation';
        description = 'Validates email addresses using regex pattern';
        sqlExpression = `SELECT
  (COUNT(*) FILTER (WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'))::float / NULLIF(COUNT(*), 0) < 0.05 as passed,
  COUNT(*) FILTER (WHERE email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$') as invalid_count,
  COUNT(*) as total_rows
FROM ${context?.tableName || 'your_table'}
WHERE email IS NOT NULL`;
      } else if (lowerPrompt.includes('null') || lowerPrompt.includes('missing')) {
        dimension = 'completeness';
        severity = 'medium';
        name = 'Null Rate Check';
        description = 'Checks that null rate is below 5%';
        sqlExpression = `SELECT
  (COUNT(*) FILTER (WHERE column_name IS NULL))::float / NULLIF(COUNT(*), 0) < 0.05 as passed,
  COUNT(*) FILTER (WHERE column_name IS NULL) as null_count,
  COUNT(*) as total_rows
FROM ${context?.tableName || 'your_table'}`;
      } else if (lowerPrompt.includes('duplicate') || lowerPrompt.includes('unique')) {
        dimension = 'uniqueness';
        severity = 'critical';
        name = 'Uniqueness Validation';
        description = 'Validates that a column has unique values';
        sqlExpression = `SELECT
  COUNT(DISTINCT column_name)::float / NULLIF(COUNT(*), 0) >= 0.99 as passed,
  COUNT(DISTINCT column_name) as distinct_count,
  COUNT(*) as total_rows,
  COUNT(*) - COUNT(DISTINCT column_name) as duplicate_count
FROM ${context?.tableName || 'your_table'}`;
      } else if (lowerPrompt.includes('fresh') || lowerPrompt.includes('recent') || lowerPrompt.includes('stale')) {
        dimension = 'freshness';
        severity = 'medium';
        name = 'Data Freshness Check';
        description = 'Checks that data is recent (within 24 hours)';
        sqlExpression = `SELECT
  MAX(updated_at) >= NOW() - INTERVAL '24 hours' as passed,
  MAX(updated_at) as latest_update,
  NOW() - MAX(updated_at) as age
FROM ${context?.tableName || 'your_table'}`;
      } else {
        // Generic check
        name = 'Custom Quality Check';
        description = prompt;
        sqlExpression = `SELECT
  TRUE as passed,
  '${prompt}' as message
FROM ${context?.tableName || 'your_table'}
LIMIT 1`;
      }

      // Create the rule using the service
      const rule = await this.svc.createRule({
        name,
        description,
        severity,
        type: 'sql',
        dialect: 'postgres',
        expression: sqlExpression,
        tags: ['ai-generated', dimension],
        enabled: false,
      }, userId);

      const processingTime = Date.now() - startTime;

      logger.info('AI rule generated', {
        ruleId: rule.id,
        name: rule.name,
        prompt: prompt.substring(0, 50),
        processingTimeMs: processingTime
      });

      res.json({
        success: true,
        data: rule,
        meta: {
          timestamp: new Date().toISOString(),
          processingTimeMs: processingTime,
          note: 'Rule created as disabled. Review and enable it when ready.',
        },
      });
    } catch (error) {
      next(this.handleError(error, 'generateRuleFromText'));
    }
  };

  // GET /api/quality/rule-templates - Get available rule templates
  getRuleTemplates = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { dimension, search, category } = req.query;

      // Import templates
      const { RULE_TEMPLATES, getTemplatesByDimension, searchTemplates, getTemplatesByCategory } = require('../config/ruleTemplates');

      let templates = [...RULE_TEMPLATES];

      // Apply filters
      if (dimension && typeof dimension === 'string') {
        templates = getTemplatesByDimension(dimension);
      }

      if (category && typeof category === 'string') {
        templates = getTemplatesByCategory(category);
      }

      if (search && typeof search === 'string') {
        templates = searchTemplates(search);
      }

      const processingTime = Date.now() - startTime;

      logger.info('Rule templates listed', {
        userId: (req as any).user?.id,
        filters: { dimension, search, category },
        resultCount: templates.length,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: {
          templates,
          count: templates.length,
          dimensions: ['completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'],
        },
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getRuleTemplates'));
    }
  };

  // POST /api/quality/rule-templates/:templateId/apply - Apply a rule template
  applyRuleTemplate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { templateId } = req.params;
      const { parameters } = req.body;
      const userId = (req as any).user?.id || 'system';

      // Import templates
      const { RULE_TEMPLATES, applyTemplate } = require('../config/ruleTemplates');

      // Find the template
      const template = RULE_TEMPLATES.find((t: any) => t.id === templateId);
      if (!template) {
        throw new BusinessError('Template not found', 'TEMPLATE_NOT_FOUND', 404);
      }

      // Validate parameters
      for (const param of template.parameters) {
        if (param.required && !parameters[param.name]) {
          throw new ValidationError(`Missing required parameter: ${param.name}`);
        }
      }

      // Apply template to generate SQL
      const sql = applyTemplate(templateId, parameters);

      // Create the rule using the service
      const rule = await this.svc.createRule({
        name: `${template.name} - ${parameters.tableName}`,
        description: template.description,
        severity: template.severity,
        type: 'sql',
        dialect: 'postgres',
        expression: sql,
        tags: ['template-generated', template.dimension, template.category],
        enabled: false,
      }, userId);

      const processingTime = Date.now() - startTime;

      logger.info('Template applied', {
        ruleId: rule.id,
        templateId,
        userId,
        processingTimeMs: processingTime,
      });

      res.status(201).json({
        success: true,
        data: {
          rule,
          template: {
            id: template.id,
            name: template.name,
            dimension: template.dimension,
          },
        },
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
          note: 'Rule created as disabled. Review and enable it when ready.',
        },
      });
    } catch (error) {
      next(this.handleError(error, 'applyRuleTemplate'));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // DATA HEALING ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // POST /api/quality/healing/analyze/:issueId
  analyzeHealing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { issueId } = req.params;

      if (!z.string().uuid().safeParse(issueId).success) {
        throw new ValidationError('Invalid issue ID format');
      }

      const analysis = await this.healingSvc.analyzeIssue(issueId);
      const processingTime = Date.now() - startTime;

      logger.info('Healing analysis completed', {
        issueId,
        recommendedActions: analysis.recommendedActions.length,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: analysis,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'analyzeHealing'));
    }
  };

  // POST /api/quality/healing/heal/:issueId
  executeHealing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { issueId } = req.params;
      const { actionId, dryRun = false, autoApprove = false } = req.body;
      const userId = (req as any).user?.id || 'system';

      if (!z.string().uuid().safeParse(issueId).success) {
        throw new ValidationError('Invalid issue ID format');
      }

      if (!actionId) {
        throw new ValidationError('actionId is required');
      }

      const result = await this.healingSvc.healIssue(issueId, actionId, {
        dryRun,
        autoApprove,
        userId,
      });

      const processingTime = Date.now() - startTime;

      logger.info('Healing executed', {
        issueId,
        actionId,
        success: result.success,
        rowsAffected: result.rowsAffected,
        dryRun,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: result,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'executeHealing'));
    }
  };

  // POST /api/quality/healing/rollback/:healingId
  rollbackHealing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { healingId } = req.params;
      const userId = (req as any).user?.id || 'system';

      if (!z.string().uuid().safeParse(healingId).success) {
        throw new ValidationError('Invalid healing ID format');
      }

      const result = await this.healingSvc.rollbackHealing(healingId);
      const processingTime = Date.now() - startTime;

      logger.info('Healing rollback completed', {
        healingId,
        success: result.success,
        rowsRestored: result.rowsRestored,
        userId,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: result,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'rollbackHealing'));
    }
  };

  // GET /api/quality/healing/recommendations/:dataSourceId
  getHealingRecommendations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { dataSourceId } = req.params;

      if (!z.string().uuid().safeParse(dataSourceId).success) {
        throw new ValidationError('Invalid data source ID format');
      }

      const recommendations = await this.healingSvc.getRecommendations(dataSourceId);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: {
          dataSourceId,
          recommendations,
          count: recommendations.length,
        },
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getHealingRecommendations'));
    }
  };

  // POST /api/quality/healing/batch
  batchHeal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { issueIds, actionStrategy = 'recommended', dryRun = false } = req.body;
      const userId = (req as any).user?.id || 'system';

      if (!Array.isArray(issueIds) || issueIds.length === 0) {
        throw new ValidationError('issueIds must be a non-empty array');
      }

      if (issueIds.length > 100) {
        throw new ValidationError('Maximum 100 issues per batch');
      }

      const result = await this.healingSvc.batchHeal(issueIds, {
        actionStrategy,
        dryRun,
        userId,
      });

      const processingTime = Date.now() - startTime;

      logger.info('Batch healing completed', {
        totalIssues: result.totalIssues,
        successful: result.successful,
        failed: result.failed,
        dryRun,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: result,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'batchHeal'));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // IMPACT ANALYSIS ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // GET /api/quality/impact/:issueId
  analyzeImpact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { issueId } = req.params;
      const { maxDepth = 5 } = req.query;

      if (!z.string().uuid().safeParse(issueId).success) {
        throw new ValidationError('Invalid issue ID format');
      }

      const impact = await this.impactSvc.analyzeIssueImpact(issueId, {
        maxDepth: parseInt(maxDepth as string),
      });

      const processingTime = Date.now() - startTime;

      logger.info('Impact analysis completed', {
        issueId,
        impactScore: impact.impactScore,
        impactedAssets: impact.impactedAssets.length,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: impact,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'analyzeImpact'));
    }
  };

  // GET /api/quality/impact/summary/:dataSourceId
  getImpactSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { dataSourceId } = req.params;

      if (!z.string().uuid().safeParse(dataSourceId).success) {
        throw new ValidationError('Invalid data source ID format');
      }

      const summary = await this.impactSvc.getDataSourceImpactSummary(dataSourceId);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: summary,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getImpactSummary'));
    }
  };

  // POST /api/quality/impact/simulate/:issueId
  simulatePropagation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { issueId } = req.params;
      const { timeHorizon = '7d', propagationRate = 0.5 } = req.body;

      if (!z.string().uuid().safeParse(issueId).success) {
        throw new ValidationError('Invalid issue ID format');
      }

      const simulation = await this.impactSvc.simulatePropagation(issueId, {
        timeHorizon,
        propagationRate: parseFloat(propagationRate),
      });

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: simulation,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'simulatePropagation'));
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // ROI CALCULATOR ENDPOINTS
  // ═══════════════════════════════════════════════════════════════

  // GET /api/quality/roi/:dataSourceId
  calculateROI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { dataSourceId } = req.params;
      const { period = '30d' } = req.query;

      if (!z.string().uuid().safeParse(dataSourceId).success) {
        throw new ValidationError('Invalid data source ID format');
      }

      const roi = await this.roiSvc.calculateDataSourceROI(dataSourceId, period as string);
      const processingTime = Date.now() - startTime;

      logger.info('ROI calculated', {
        dataSourceId,
        period,
        roi: roi.roi,
        netBenefit: roi.netBenefit,
        processingTimeMs: processingTime,
      });

      res.json({
        success: true,
        data: roi,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'calculateROI'));
    }
  };

  // GET /api/quality/roi/trend/:dataSourceId
  getROITrend = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { dataSourceId } = req.params;
      const { timeframe = '90d', interval = 'weekly' } = req.query;

      if (!z.string().uuid().safeParse(dataSourceId).success) {
        throw new ValidationError('Invalid data source ID format');
      }

      const trend = await this.roiSvc.getROITrend(dataSourceId, {
        timeframe: timeframe as string,
        interval: interval as 'daily' | 'weekly' | 'monthly',
      });

      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: trend,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'getROITrend'));
    }
  };

  // GET /api/quality/roi/initiative/:dataSourceId/:initiative
  calculateInitiativeROI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { dataSourceId, initiative } = req.params;

      if (!z.string().uuid().safeParse(dataSourceId).success) {
        throw new ValidationError('Invalid data source ID format');
      }

      const roi = await this.roiSvc.calculateInitiativeROI(dataSourceId, initiative);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: roi,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'calculateInitiativeROI'));
    }
  };

  // GET /api/quality/roi/compare
  compareDataSourceROI = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startTime = Date.now();
      const { dataSourceIds } = req.query;

      if (!dataSourceIds || typeof dataSourceIds !== 'string') {
        throw new ValidationError('dataSourceIds query parameter is required (comma-separated UUIDs)');
      }

      const ids = dataSourceIds.split(',').map((id: string) => id.trim());

      if (ids.length < 2) {
        throw new ValidationError('At least 2 data source IDs are required for comparison');
      }

      if (ids.length > 10) {
        throw new ValidationError('Maximum 10 data sources can be compared');
      }

      for (const id of ids) {
        if (!z.string().uuid().safeParse(id).success) {
          throw new ValidationError(`Invalid UUID format: ${id}`);
        }
      }

      const comparison = await this.roiSvc.compareDataSourceROI(ids);
      const processingTime = Date.now() - startTime;

      res.json({
        success: true,
        data: comparison,
        meta: {
          processingTimeMs: processingTime,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(this.handleError(error, 'compareDataSourceROI'));
    }
  };

  // Error handling helper
  private handleError(error: any, operation: string): Error {
    const errorId = Math.random().toString(36).substring(7);

    logger.error(`Quality controller error in ${operation}`, {
      errorId,
      operation,
      message: error?.message,
      stack: error?.stack,
      type: error?.constructor?.name,
    });

    if (error instanceof ValidationError) {
      const err = new Error(error.message) as any;
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = error.details;
      err.errorId = errorId;
      return err;
    }

    if (error instanceof BusinessError) {
      const err = new Error(error.message) as any;
      err.statusCode = error.statusCode;
      err.code = error.code;
      err.errorId = errorId;
      return err;
    }

    if (error?.name === 'ZodError') {
      const err = new Error('Invalid request parameters') as any;
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      err.details = error.errors;
      err.errorId = errorId;
      return err;
    }

    if (error?.code && String(error.code).startsWith('23')) {
      const err = new Error('Database constraint violation') as any;
      err.statusCode = 409;
      err.code = 'CONSTRAINT_ERROR';
      err.errorId = errorId;
      return err;
    }

    const err = new Error('Internal server error') as any;
    err.statusCode = 500;
    err.code = 'INTERNAL_ERROR';
    err.errorId = errorId;
    return err;
  }
}

