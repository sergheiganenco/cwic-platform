// src/server.ts
import compression from 'compression';
import cors from 'cors';
import 'dotenv/config';
import type { Express, NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import App from './app';
import { config, logConfig } from './config/env';
import catalogRouter from './routes/catalog';
import { logger } from './utils/logger';

type AppLifecycle = {
  initialize?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
  getExpressApp: () => Express;
};

class Server {
  private app: App;
  private server: any;

  constructor() {
    this.app = new (App as any)();
  }

  public async start(): Promise<void> {
    try {
      try { logConfig?.(); } catch (e) { logger.warn('[data-service] logConfig failed', e as any); }

      const host = config?.server?.host || process.env.HOST || '0.0.0.0';
      const port = Number(config?.server?.port || process.env.PORT || 3002);

      const expressApp = (this.app as unknown as AppLifecycle).getExpressApp();

      // --- hardening & DX ---
      expressApp.disable('x-powered-by');
      // Allow local dev UIs
      expressApp.use(cors({ origin: [/^http:\/\/localhost:(5173|3000)$/], credentials: true }));
      expressApp.use(helmet({ contentSecurityPolicy: false }));
      expressApp.use(compression());

      // Request ID (no extra deps)
      expressApp.use((req: Request, res: Response, next: NextFunction) => {
        // @ts-ignore
        req.id = (globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2));
        res.setHeader('x-request-id', (req as any).id);
        next();
      });

      // ---- Mount service routes BEFORE listen ----
      expressApp.use('/api', catalogRouter);
      logger.info('[data-service] Catalog routes mounted at /api (sync, assets, metrics, details)');

      this.server = expressApp.listen(port, host, () => {
        logger.info(`🚀 data-service listening on http://${host}:${port}`);
        logger.info(`📍 liveness:  GET /health`);
        logger.info(`📍 readiness: GET /ready`);
        logger.info(`🌱 NODE_ENV=${process.env.NODE_ENV || 'development'}`);
      });

      this.server.on('error', (err: any) => {
        logger.error('[data-service] HTTP server error', {
          message: err?.message, code: err?.code, stack: err?.stack,
        });
      });

      // Initialize WebSocket server after HTTP server is created
      // NOTE: Temporarily disabled due to Docker workspace dependency issues
      // socket.io needs to be properly installed in standalone Docker builds
      if (typeof (this.app as any).initializeWebSocket === 'function') {
        try {
          (this.app as any).initializeWebSocket(this.server);
          logger.info('🔌 WebSocket server initialized for real-time quality updates');
        } catch (err: any) {
          logger.warn('⚠️  WebSocket server initialization skipped (optional feature)', {
            reason: err?.message || 'socket.io not available'
          });
        }
      }

      const lifecycle = this.app as unknown as AppLifecycle;
      Promise.resolve(lifecycle.initialize?.()).catch((err: any) => {
        logger.error('[data-service] App init failed', { message: err?.message, stack: err?.stack });
      });

      // 404 JSON & error handler (after routes)
      expressApp.use((req: Request, res: Response) => {
        res.status(404).json({ success: false, error: `Route ${req.method} ${req.path} not found` });
      });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      expressApp.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        logger.error('[data-service] Unhandled error', { message: err?.message, stack: err?.stack });
        res.status(500).json({ success: false, error: 'Internal Server Error' });
      });

      const shutdown = (signal: string) => {
        logger.warn(`[data-service] ${signal} received. Shutting down...`);
        this.server?.close(async (err?: Error) => {
          if (err) {
            logger.error('[data-service] Error during close', { message: err.message, stack: err.stack });
            process.exit(1);
            return;
          }
          logger.info('[data-service] HTTP server closed');
          try {
            if (typeof lifecycle.cleanup === 'function') await Promise.resolve(lifecycle.cleanup());
          } catch (e: any) {
            logger.error('[data-service] cleanup failed', { message: e?.message, stack: e?.stack });
          } finally {
            process.exit(0);
          }
        });
        setTimeout(() => {
          logger.warn('[data-service] Forced shutdown after 10s');
          process.exit(1);
        }, 10_000).unref();
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('uncaughtException', (err: any) => {
        logger.error('[data-service] Uncaught exception', { message: err?.message, stack: err?.stack });
      });
      process.on('unhandledRejection', (reason: any) => {
        logger.error('[data-service] Unhandled rejection', {
          reason: reason?.message || String(reason),
          stack: reason?.stack,
        });
      });
    } catch (e: any) {
      logger.error('[data-service] Startup failed', { message: e?.message, stack: e?.stack });
      process.exit(1);
    }
  }
}

if (require.main === module) {
  new Server().start().catch((err) => {
    logger.error('[data-service] Failed to start server', { message: err?.message, stack: err?.stack });
    process.exit(1);
  });
}

export default Server;
