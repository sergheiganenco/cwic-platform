import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { config, validateConfig } from './config/env';
import { logger } from './utils/logger';

// Probes & errors
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/error';
import { defaultRateLimit } from './middleware/rateLimit';

// Routes
import assetRoutes from './routes/assets';
import dataSourceRoutes from './routes/dataSources';
import sourceRoutes from './routes/sources';

// Services
import { DatabaseService } from './services/DatabaseService';

// Async wrapper
const asyncHandler =
  (fn: express.RequestHandler): express.RequestHandler =>
    (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class App {
  public app: express.Application;
  private dbService: DatabaseService;
  public ready = false;

  constructor() {
    this.app = express();
    this.dbService = new DatabaseService();

    this.validateEnvironment();

    // 1) Probes FIRST (no external deps)
    this.registerProbes();

    // 2) Base middleware (safe)
    this.registerBaseMiddleware();

    // 3) Dependent middleware
    this.registerDependentMiddleware();

    // 4) API routes
    this.registerApiRoutes();

    // 5) Errors
    this.registerErrorHandlers();
  }

  private validateEnvironment(): void {
    try {
      validateConfig();
      logger.info('Environment validation passed');
    } catch (error) {
      logger.error('Environment validation failed:', error);
      process.exit(1);
    }
  }

  /** Liveness/readiness */
  private registerProbes(): void {
    this.app.get('/health', (_req, res) => {
      res.status(200).json({
        status: 'ok',
        service: 'cwic-data-service',
        env: config.server.env,
        uptimeSec: Math.round(process.uptime()),
      });
    });
    this.app.head('/health', (_req, res) => res.sendStatus(200));

    this.app.get('/ready', asyncHandler(async (_req, res) => {
      const dbHealth = await this.dbService.healthCheck().catch((e: any) => ({
        status: 'unhealthy',
        error: e?.message || String(e),
      }));
      const good = dbHealth.status === 'healthy';
      this.ready = good;
      res.status(good ? 200 : 503).json({ status: good ? 'ready' : 'not_ready', database: dbHealth });
    }));
    this.app.head('/ready', asyncHandler(async (_req, res) => {
      const dbHealth = await this.dbService.healthCheck().catch(() => ({ status: 'unhealthy' }));
      res.sendStatus(dbHealth.status === 'healthy' ? 200 : 503);
    }));
  }

  private registerBaseMiddleware(): void {
    this.app.use(helmet(config.security.helmet));

    const origins =
      Array.isArray(config.server.corsOrigin) ? config.server.corsOrigin : [config.server.corsOrigin || '']
        .concat((process.env.CORS_ORIGIN || '').split(','))
        .map(s => s.trim()).filter(Boolean);

    this.app.use(cors({
      origin: origins.length ? origins : true,
      credentials: true,
      methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
      allowedHeaders: [
        'Content-Type','Authorization','X-Request-ID','X-API-Key',
        'X-Client-Env','X-Client-Version','X-Client-Type','X-Platform','X-Health-Check','X-Dev-Auth'
      ],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 86400,
    }));

    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  }

  private registerDependentMiddleware(): void {
    this.app.use(requestIdMiddleware);
    this.app.use(defaultRateLimit);

    this.app.use((req, res, next) => {
      const t0 = Date.now();
      res.on('finish', () => {
        logger.info('HTTP Request', {
          method: req.method,
          url: req.originalUrl || req.url,
          statusCode: res.statusCode,
          durationMs: Date.now() - t0,
          requestId: (req as any).requestId,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
        });
      });
      next();
    });
  }

  private registerApiRoutes(): void {
    // Prometheus metrics (optional)
    if (config.monitoring.enableMetrics) {
      this.app.get('/metrics', asyncHandler(async (_req, res) => {
        let pool = { total: 0, idle: 0, waiting: 0 };
        try { pool = this.dbService.getPoolStats(); } catch {}
        const mu = process.memoryUsage();
        const lines = [
          '# HELP cwic_data_service_uptime_seconds Total uptime of the service',
          '# TYPE cwic_data_service_uptime_seconds counter',
          `cwic_data_service_uptime_seconds ${process.uptime()}`,
          '# HELP cwic_data_service_memory_usage_bytes Memory usage in bytes',
          '# TYPE cwic_data_service_memory_usage_bytes gauge',
          `cwic_data_service_memory_usage_bytes{type="rss"} ${mu.rss}`,
          `cwic_data_service_memory_usage_bytes{type="heapTotal"} ${mu.heapTotal}`,
          `cwic_data_service_memory_usage_bytes{type="heapUsed"} ${mu.heapUsed}`,
          '# HELP cwic_data_service_db_connections Database connection pool stats',
          '# TYPE cwic_data_service_db_connections gauge',
          `cwic_data_service_db_connections{state="total"} ${pool.total}`,
          `cwic_data_service_db_connections{state="idle"} ${pool.idle}`,
          `cwic_data_service_db_connections{state="waiting"} ${pool.waiting}`,
        ];
        res.set('Content-Type','text/plain; version=0.0.4');
        res.send(lines.join('\n'));
      }));
    }

    /**
     * IMPORTANT: Your gateway sometimes **strips `/api`** in dev.
     * Mount at BOTH `/api/*` and root to be robust.
     */
    // Data sources
    this.app.use('/api/data-sources', dataSourceRoutes);
    this.app.use('/data-sources',     dataSourceRoutes);

    // Assets
    this.app.use('/api/assets', assetRoutes);
    this.app.use('/assets',     assetRoutes);

    // Sources
    this.app.use('/api/sources', sourceRoutes);
    this.app.use('/sources',     sourceRoutes);

    // Index
    const indexHandler: express.RequestHandler = (_req, res) => {
      res.json({
        service: 'CWIC Data Service',
        version: process.env.npm_package_version || '1.0.0',
        docs: {
          '/api/data-sources': 'Data source management',
          '/api/assets':       'Data asset management',
          '/api/sources':      'Source configuration',
          '/health':           'Liveness (no deps)',
          '/ready':            'Readiness (checks DB)',
          '/metrics':          'Prometheus metrics',
        },
      });
    };
    this.app.get('/api', indexHandler);
    this.app.get('/', indexHandler);
  }

  private registerErrorHandlers(): void {
    this.app.use(notFoundHandler);
    this.app.use(errorHandler);
  }

  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing database (migrations + connectivity)...');
      await this.dbService.runMigrations();
      const dbHealth = await this.dbService.healthCheck();
      if (dbHealth.status !== 'healthy') {
        throw new Error(`Database is not healthy: ${dbHealth.error}`);
      }
      this.ready = true;
      logger.info('Database initialized; service READY.');
    } catch (err) {
      this.ready = false;
      logger.error('App initialization failed (service NOT ready):', err);
    }
  }

  public getExpressApp(): express.Application { return this.app; }
  public getDbService(): DatabaseService { return this.dbService; }
}

export default App;
