// src/server.ts
import { logger } from '@utils/logger';
import App from './app';

const PORT = parseInt(process.env.PORT || '8003', 10);
const HOST = process.env.HOST || '0.0.0.0';

function start() {
  try {
    const expressApp = new App().getApp();

    const server = expressApp.listen(PORT, HOST, () => {
      logger.info(`🚀 AI Service listening on http://${HOST}:${PORT}`);
      logger.info(`📍 Health: http://${HOST}:${PORT}/health`);
      logger.info(`🧭 Docs:   http://${HOST}:${PORT}/api/docs`);
      logger.info(`🌱 NODE_ENV=${process.env.NODE_ENV || 'development'}`);
    });

    // Important: log 'error' events on the HTTP server (like EADDRINUSE)
    server.on('error', (err: any) => {
      logger.error('HTTP server error:', {
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
      });
    });

    // Graceful shutdown hooks
    const shutdown = (signal: string) => {
      logger.warn(`Received ${signal}. Shutting down...`);
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });
      // Failsafe in case close hangs
      setTimeout(() => process.exit(1), 5000).unref();
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Catch everything so nodemon doesn’t just “app crashed” without details
    process.on('uncaughtException', (err) => {
      logger.error('Uncaught exception:', { message: err.message, stack: err.stack });
    });
    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled rejection:', { reason: reason?.message || String(reason), stack: reason?.stack });
    });
  } catch (err: any) {
    // Last-resort startup catch
    logger.error('Fatal startup error:', { message: err.message, stack: err.stack });
  }
}

start();
