// src/utils/gracefulShutdown.ts
import { Server } from 'http';
import { logger } from './logger';

interface ShutdownOptions {
  timeout?: number; // Timeout in milliseconds
  signals?: string[]; // Signals to listen for
  forceExitDelay?: number; // Delay before force exit
}

/**
 * Production-ready graceful shutdown handler
 */
export class GracefulShutdown {
  private server: Server;
  private isShuttingDown: boolean = false;
  private connections: Set<any> = new Set();
  private options: Required<ShutdownOptions>;
  private shutdownTimeout: NodeJS.Timeout | null = null;
  private forceExitTimeout: NodeJS.Timeout | null = null;

  constructor(server: Server, options: ShutdownOptions = {}) {
    this.server = server;
    this.options = {
      timeout: options.timeout || 30000, // 30 seconds default
      signals: options.signals || ['SIGTERM', 'SIGINT', 'SIGUSR2'],
      forceExitDelay: options.forceExitDelay || 5000 // 5 seconds before force exit
    };

    this.setupConnectionTracking();
    this.setupSignalHandlers();
  }

  /**
   * Track active connections
   */
  private setupConnectionTracking(): void {
    this.server.on('connection', (connection) => {
      this.connections.add(connection);
      
      connection.on('close', () => {
        this.connections.delete(connection);
      });

      // Handle connection errors
      connection.on('error', (error) => {
        logger.warn('Connection error during shutdown:', error);
        this.connections.delete(connection);
      });
    });
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    this.options.signals.forEach((signal) => {
      process.on(signal, () => {
        logger.info(`Received ${signal} signal, starting graceful shutdown...`);
        this.initiateShutdown(signal);
      });
    });

    // Handle uncaught exceptions during shutdown
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception during shutdown:', error);
      if (this.isShuttingDown) {
        this.forceExit(1);
      }
    });

    // Handle unhandled promise rejections during shutdown
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled promise rejection during shutdown:', { reason, promise });
      if (this.isShuttingDown) {
        this.forceExit(1);
      }
    });
  }

  /**
   * Initiate graceful shutdown process
   */
  private async initiateShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal');
      return;
    }

    this.isShuttingDown = true;
    const startTime = Date.now();

    logger.info('Starting graceful shutdown process...', {
      signal,
      activeConnections: this.connections.size,
      timeout: this.options.timeout
    });

    // Set timeout for forced shutdown
    this.shutdownTimeout = setTimeout(() => {
      logger.warn('Graceful shutdown timeout reached, forcing shutdown');
      this.forceShutdown();
    }, this.options.timeout);

    // Set force exit timeout
    this.forceExitTimeout = setTimeout(() => {
      logger.error('Force exit timeout reached, terminating process');
      this.forceExit(1);
    }, this.options.timeout + this.options.forceExitDelay);

    try {
      // Step 1: Stop accepting new connections
      await this.stopAcceptingConnections();

      // Step 2: Close existing connections gracefully
      await this.closeExistingConnections();

      // Step 3: Cleanup resources
      await this.cleanupResources();

      // Step 4: Exit gracefully
      const duration = Date.now() - startTime;
      logger.info(`Graceful shutdown completed successfully in ${duration}ms`);
      
      this.clearTimeouts();
      process.exit(0);

    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      this.forceExit(1);
    }
  }

  /**
   * Stop accepting new connections
   */
  private async stopAcceptingConnections(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server.listening) {
        logger.info('Server not listening, skipping connection stop');
        return resolve();
      }

      logger.info('Stopping server from accepting new connections...');
      
      this.server.close((error) => {
        if (error) {
          logger.error('Error stopping server:', error);
          return reject(error);
        }
        
        logger.info('Server stopped accepting new connections');
        resolve();
      });
    });
  }

  /**
   * Close existing connections gracefully
   */
  private async closeExistingConnections(): Promise<void> {
    if (this.connections.size === 0) {
      logger.info('No active connections to close');
      return;
    }

    logger.info(`Closing ${this.connections.size} active connections...`);

    // Give connections time to finish naturally
    await this.waitForConnectionsToClose(5000);

    // Force close remaining connections
    if (this.connections.size > 0) {
      logger.warn(`Force closing ${this.connections.size} remaining connections`);
      this.connections.forEach((connection) => {
        try {
          connection.destroy();
        } catch (error) {
          logger.warn('Error destroying connection:', error);
        }
      });
      this.connections.clear();
    }

    logger.info('All connections closed');
  }

  /**
   * Wait for connections to close naturally
   */
  private async waitForConnectionsToClose(timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (this.connections.size > 0 && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Cleanup application resources
   */
  private async cleanupResources(): Promise<void> {
    logger.info('Cleaning up application resources...');

    try {
      // Import and close database connections
      const { db } = await import('@/config/database');
      if (db && typeof db.close === 'function') {
        await db.close();
        logger.info('Database connections closed');
      }
    } catch (error) {
      logger.warn('Error closing database connections:', error);
    }

    try {
      // Import and close Redis connections
      const { redis } = await import('@/config/redis');
      if (redis && typeof redis.close === 'function') {
        await redis.close();
        logger.info('Redis connections closed');
      }
    } catch (error) {
      logger.warn('Error closing Redis connections:', error);
    }

    // Clear any intervals or timeouts
    this.clearApplicationTimers();

    logger.info('Resource cleanup completed');
  }

  /**
   * Clear application timers and intervals
   */
  private clearApplicationTimers(): void {
    // Clear any global intervals or timeouts
    // This is a placeholder - you can add specific timer cleanup here
    logger.debug('Application timers cleared');
  }

  /**
   * Force shutdown when graceful shutdown fails
   */
  private forceShutdown(): void {
    logger.warn('Forcing immediate shutdown...');

    // Destroy all connections immediately
    this.connections.forEach((connection) => {
      try {
        connection.destroy();
      } catch (error) {
        logger.warn('Error destroying connection during force shutdown:', error);
      }
    });

    this.connections.clear();
    
    // Force close server
    try {
      this.server.close();
    } catch (error) {
      logger.warn('Error force closing server:', error);
    }

    this.clearTimeouts();
    this.forceExit(1);
  }

  /**
   * Force exit the process
   */
  private forceExit(code: number): void {
    logger.error(`Force exiting with code ${code}`);
    this.clearTimeouts();
    process.exit(code);
  }

  /**
   * Clear shutdown timeouts
   */
  private clearTimeouts(): void {
    if (this.shutdownTimeout) {
      clearTimeout(this.shutdownTimeout);
      this.shutdownTimeout = null;
    }

    if (this.forceExitTimeout) {
      clearTimeout(this.forceExitTimeout);
      this.forceExitTimeout = null;
    }
  }

  /**
   * Get shutdown status
   */
  public isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }

  /**
   * Get active connections count
   */
  public getActiveConnectionsCount(): number {
    return this.connections.size;
  }
}

/**
 * Simple graceful shutdown function (backwards compatible)
 */
export function gracefulShutdown(server: Server, options?: ShutdownOptions): GracefulShutdown {
  return new GracefulShutdown(server, options);
}

/**
 * Enhanced graceful shutdown with custom cleanup
 */
export function createGracefulShutdown(
  server: Server, 
  options: ShutdownOptions = {},
  customCleanup?: () => Promise<void>
): GracefulShutdown {
  const shutdown = new GracefulShutdown(server, options);

  // Add custom cleanup if provided
  if (customCleanup) {
    const originalCleanup = (shutdown as any).cleanupResources;
    (shutdown as any).cleanupResources = async function() {
      await originalCleanup.call(this);
      try {
        await customCleanup();
        logger.info('Custom cleanup completed');
      } catch (error) {
        logger.error('Error in custom cleanup:', error);
      }
    };
  }

  return shutdown;
}

// Export default
export default gracefulShutdown;