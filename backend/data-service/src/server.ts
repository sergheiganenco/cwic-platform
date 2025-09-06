// src/server.ts
import 'dotenv/config';
import App from './app';
import { config, logConfig } from './config/env';
import { logger } from './utils/logger';

type AppLifecycle = {
  initialize?: () => Promise<void> | void;
  cleanup?: () => Promise<void> | void;
  getExpressApp: () => import('express').Express;
};

class Server {
  private app: App;
  private server: any;

  constructor() {
    this.app = new (App as any)();
  }

  public async start(): Promise<void> {
    try {
      // Log env at boot (safe if logConfig is a no-op)
      try { logConfig?.(); } catch (e) { logger.warn('[data-service] logConfig failed', e as any); }

      // Start listening first so /health is available ASAP
      const host = config?.server?.host || process.env.HOST || '0.0.0.0';
      const port = Number(config?.server?.port || process.env.PORT || 3002);

      const expressApp = (this.app as unknown as AppLifecycle).getExpressApp();
      this.server = expressApp.listen(port, host, () => {
        logger.info(`🚀 data-service listening on http://${host}:${port}`);
        logger.info(`📍 liveness:  GET /health`);
        logger.info(`📍 readiness: GET /ready`);
        logger.info(`🌱 NODE_ENV=${process.env.NODE_ENV || 'development'}`);
      });

      // Visibility if bind fails
      this.server.on('error', (err: any) => {
        logger.error('[data-service] HTTP server error', {
          message: err?.message,
          code: err?.code,
          stack: err?.stack,
        });
      });

      // Initialize dependencies (DB/redis/etc.) without blocking health
      const lifecycle = this.app as unknown as AppLifecycle;
      Promise.resolve(lifecycle.initialize?.()).catch((err: any) => {
        logger.error('[data-service] App init failed', { message: err?.message, stack: err?.stack });
      });

      // Graceful shutdown
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
            if (typeof lifecycle.cleanup === 'function') {
              await Promise.resolve(lifecycle.cleanup());
            }
          } catch (e: any) {
            logger.error('[data-service] cleanup failed', { message: e?.message, stack: e?.stack });
          } finally {
            process.exit(0);
          }
        });

        // Failsafe timer
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
  new Server()
    .start()
    .catch((err) => {
      logger.error('[data-service] Failed to start server', { message: err?.message, stack: err?.stack });
      process.exit(1);
    });
}

export default Server;
