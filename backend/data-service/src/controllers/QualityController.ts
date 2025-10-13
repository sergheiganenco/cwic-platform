// backend/data-service/src/controllers/QualityController.ts
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { QualityService } from '../services/QualityService';
import { StatsService } from '../services/StatsService';
import { ProfilingService } from '../services/ProfilingService';
import { QualityRuleEngine } from '../services/QualityRuleEngine';
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
      const { timeframe = '7d', dataSourceId } = req.query as { timeframe?: string; dataSourceId?: string };

      try {
        const summary = await this.statsSvc.getQualitySummary(timeframe, dataSourceId);
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
        logger.warn(`Quality summary query failed:`, dbError.message);

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

      logger.info(`Starting data source profiling for ${dataSourceId}`);

      // Validate data source exists
      const dsCheck = await this.svc['db'].query(
        `SELECT id, name FROM data_sources WHERE id = $1`,
        [dataSourceId]
      );

      if (dsCheck.rows.length === 0) {
        throw new BusinessError('Data source not found', 'NOT_FOUND', 404);
      }

      // Profile all assets in the data source
      const profiles = await this.profilingSvc.profileDataSource(dataSourceId);
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

  // PATCH /api/quality/issues/:id/status - Update issue status
  updateIssueStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      const query = `
        UPDATE quality_issues
        SET status = $1, notes = $2, updated_at = NOW()
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

