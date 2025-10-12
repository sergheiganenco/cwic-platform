// backend/data-service/src/app.ts
import compression from 'compression';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import {
  cleanupMiddleware,
  limitRequestSize,
  requestTimeout,
  sanitizeInput,
  securityHeaders,
} from './middleware/audit';
import { DatabaseService } from './services/DatabaseService';
import { logger } from './utils/logger';

// Routes
import assetRoutes from './routes/assets';
import catalogRoutes from './routes/catalog';
import { initAdvancedCatalog } from './routes/advancedCatalog';
import initEnhancedCatalog from './routes/catalogEnhanced';
import dataSourceRoutes from './routes/dataSources';
import governanceRoutes from './routes/governance';
import lineageRoutes from './routes/lineage';
import qualityRoutes from './routes/quality';
import requestsRoutes from './routes/requests';
import statsRoutes from './routes/stats';

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

type AppError = Error & { code?: string; statusCode?: number };
const toAppError = (err: unknown): AppError => {
  if (err instanceof Error) return err as AppError;
  try {
    return new Error(typeof err === 'string' ? err : JSON.stringify(err)) as AppError;
  } catch {
    return new Error(String(err)) as AppError;
  }
};

const healthToBoolean = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (v && typeof v === 'object') {
    const anyV = v as any;
    if (typeof anyV.ok === 'boolean') return anyV.ok;
    if (typeof anyV.healthy === 'boolean') return anyV.healthy;
    if (typeof anyV.status === 'string') {
      const s = anyV.status.toLowerCase();
      return s === 'healthy' || s === 'ok' || s === 'ready';
    }
  }
  return false;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Default-exported App class (matches server.ts expectations)
 * ────────────────────────────────────────────────────────────────────────── */

export default class App {
  private readonly app: Express;
  private readonly db: DatabaseService;

  constructor() {
    this.app = express();
    this.db = new DatabaseService();
    this.configure();
    this.registerRoutes();
    this.registerGlobalErrorHandler();
  }

  /** server.ts calls this to get the Express instance and start listening */
  public getExpressApp(): Express {
    return this.app;
  }

  /** server.ts calls this async init after listen (migrations, warmups, etc.) */
  public async initialize(): Promise<void> {
    // Run migrations & any warm-up tasks
    await this.db.runMigrations();
    logger.info('[data-service] initialize complete');
  }

  /** server.ts calls this during shutdown */
  public async cleanup(): Promise<void> {
    try {
      await this.db.close();
      await cleanupMiddleware();
      logger.info('[data-service] cleanup completed');
    } catch (e) {
      const err = toAppError(e);
      logger.error('[data-service] cleanup error', { message: err.message, stack: err.stack });
    }
  }

  /* ────────────────────────────────────────────────────────────────────────
   * Private configuration & routes
   * ──────────────────────────────────────────────────────────────────────── */

  private configure(): void {
    // Trust proxy for accurate IP addresses behind load balancers
    this.app.set('trust proxy', 1);

    // Security middleware
    this.app.use(
      helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
          },
        },
        crossOriginEmbedderPolicy: false,
      })
    );

    // CORS configuration
    this.app.use(
      cors({
        origin: (origin, callback) => {
          const allowedOrigins = (process.env.CORS_ORIGIN || '')
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean);

          // Allow requests with no origin (mobile apps, curl, etc.)
          if (!origin) return callback(null, true);

          if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            callback(null, true);
          } else {
            logger.warn('CORS origin rejected', { origin });
            callback(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        maxAge: 86_400,
      })
    );

    // Compression
    this.app.use(
      compression({
        filter: (req, res) => {
          if (req.headers['x-no-compression']) return false;
          return compression.filter(req, res);
        },
        threshold: 1024,
      })
    );

    // Request parsing with size limits
    this.app.use(
      express.json({
        limit: process.env.MAX_REQUEST_SIZE || '10mb',
        strict: true,
      })
    );
    this.app.use(
      express.urlencoded({
        extended: true,
        limit: process.env.MAX_REQUEST_SIZE || '10mb',
      })
    );

    // Custom security middleware
    this.app.use(securityHeaders);
    this.app.use(sanitizeInput);
    this.app.use(requestTimeout(parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10)));
    this.app.use(limitRequestSize(parseInt(process.env.MAX_REQUEST_SIZE || '10485760', 10)));

    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info('HTTP Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
        });
      });
      next();
    });
  }

  private registerRoutes(): void {
    // Health check
    this.app.get('/health', async (_req, res) => {
      try {
        const dbHealthRaw = (await this.db.healthCheck()) as unknown;
        const dbHealthy = healthToBoolean(dbHealthRaw);

        res.json({
          status: 'healthy',
          service: 'cwic-data-service',
          version: process.env.APP_VERSION || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          database: dbHealthRaw, // raw payload if object
          databaseHealthy: dbHealthy, // normalized boolean
        });
      } catch (error) {
        const err = toAppError(error);
        logger.error('Health check failed', { error: err.message });
        res.status(503).json({
          status: 'unhealthy',
          service: 'cwic-data-service',
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Readiness check
    this.app.get('/ready', async (_req, res) => {
      try {
        let maybe;
        if (typeof (this.db as any).isReady === 'function') {
          maybe = (this.db as any).isReady();
        } else {
          maybe = this.db.healthCheck();
        }
        const raw = await Promise.resolve(maybe as unknown);
        const isReady = healthToBoolean(raw);
        if (!isReady) throw new Error('Database not ready');

        res.json({ status: 'ready', timestamp: new Date().toISOString() });
      } catch (error) {
        const err = toAppError(error);
        res.status(503).json({
          status: 'not ready',
          error: err.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Mount catalog routes FIRST (they have specific /data-sources/:id/sync that should override)
    this.app.use(catalogRoutes);

    // Mount advanced catalog routes
    const advancedCatalogRouter = initAdvancedCatalog(this.db.pool);
    this.app.use('/api/advanced-catalog', advancedCatalogRouter);
    this.app.use('/advanced-catalog', advancedCatalogRouter);

    // Mount enhanced catalog routes (collaboration, ratings, etc.)
    const enhancedCatalogRouter = initEnhancedCatalog(this.db.pool);
    this.app.use('/api', enhancedCatalogRouter);
    this.app.use(enhancedCatalogRouter);

    // Mount routes with both /api prefix and without (gateway flexibility)
    const routes = [
      { path: '/data-sources', router: dataSourceRoutes },
      { path: '/assets', router: assetRoutes },
      { path: '/quality', router: qualityRoutes },
      { path: '/governance', router: governanceRoutes },
      { path: '/requests', router: requestsRoutes },
      { path: '/lineage', router: lineageRoutes },
      { path: '/stats', router: statsRoutes },
    ];

    routes.forEach(({ path, router }) => {
      this.app.use(`/api${path}`, router);
      this.app.use(path, router);
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      logger.warn('Route not found', {
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
      });

      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route ${req.method} ${req.originalUrl} not found`,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }

  private registerGlobalErrorHandler(): void {
    // Global error handler
    this.app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const err = toAppError(error);
      const errorId = Math.random().toString(36).substring(7);

      logger.error('Unhandled application error', {
        errorId,
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
      });

      let statusCode = 500;
      let errorCode = 'INTERNAL_ERROR';
      let message = 'An unexpected error occurred';

      if (err.name === 'ValidationError') {
        statusCode = 400;
        errorCode = 'VALIDATION_ERROR';
        message = err.message;
      } else if ((err as any).code === '23505') {
        statusCode = 409;
        errorCode = 'DUPLICATE_ENTRY';
        message = 'A record with this information already exists';
      } else if ((err as any).code === '23503') {
        statusCode = 400;
        errorCode = 'INVALID_REFERENCE';
        message = 'Referenced record does not exist';
      } else if ((err as any).statusCode) {
        statusCode = (err as any).statusCode;
        errorCode = (err as any).code || errorCode;
        message = err.message || message;
      }

      if (statusCode >= 500 && process.env.NODE_ENV === 'production') {
        message = 'Internal server error';
      }

      res.status(statusCode).json({
        success: false,
        error: {
          code: errorCode,
          message,
          errorId,
          timestamp: new Date().toISOString(),
        },
      });
    });

    // Process-level guards (logging only; actual shutdown handled in server.ts)
    process.on('uncaughtException', (error: unknown) => {
      const err = toAppError(error);
      logger.error('Uncaught exception', { error: err.message, stack: err.stack });
    });

    process.on('unhandledRejection', (reason: unknown, promise) => {
      const msg =
        reason instanceof Error
          ? reason.message
          : typeof reason === 'string'
          ? reason
          : (() => {
              try {
                return JSON.stringify(reason);
              } catch {
                return String(reason);
              }
            })();
      logger.error('Unhandled promise rejection', { reason: msg, promise });
    });
  }
}
