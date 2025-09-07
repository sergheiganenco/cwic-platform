// backend/data-service/src/controllers/QualityController.ts
import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { QualityService } from '../services/QualityService';
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

const StatsSchema = z.object({
  timeframe: z.enum(['24h', '7d', '30d', '90d']).default('7d').optional(),
  groupBy: z.enum(['severity', 'status', 'data_source']).default('status').optional(),
});

export class QualityController {
  // allow DI for tests, default to real service
  constructor(private svc: QualityService = new QualityService()) {}

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

  // GET /api/quality/stats
  getQualityStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { timeframe = '7d', groupBy = 'status' } = StatsSchema.parse(req.query);
      // ✅ FIX: use this.svc, not this.service
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
