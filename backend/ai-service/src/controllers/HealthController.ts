// src/controllers/HealthController.ts
import type { NextFunction, Request, Response } from 'express';
import { unlink, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';

import { db } from '@config/database';
import { openai } from '@config/openai';
import { redis } from '@config/redis';
import { APIError } from '@utils/errors';
import { logger } from '@utils/logger';
import { errorResponse, successResponse } from '@utils/responses';

type Status = 'healthy' | 'degraded' | 'unhealthy';

interface HealthCheck {
  name: string;
  status: Status;
  responseTime: number; // ms
  details?: unknown;
  error?: string;
}

interface SystemHealth {
  status: Status;
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
  environment: string;
  checks: HealthCheck[];
  summary: { total: number; healthy: number; degraded: number; unhealthy: number };
  system: {
    memory: NodeJS.MemoryUsage;
    cpu: { loadAverage: number[]; usageMicros: number };
    process: { pid: number; platform: string; nodeVersion: string };
  };
}

// --- bounded timeouts to avoid crazy env values
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const DEFAULT_CHECK_TIMEOUT_MS = clamp(Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 2000), 250, 10_000);

// Mask detailed dependency errors in production
const mask = (msg: string) => (process.env.NODE_ENV === 'development' ? msg : 'dependency error');

export class HealthController {
  private healthChecks: Map<string, () => Promise<HealthCheck>> = new Map();

  constructor() {
    this.initializeHealthChecks();
  }

  private initializeHealthChecks(): void {
    this.healthChecks.set('database', this.checkDatabase.bind(this));
    this.healthChecks.set('redis', this.checkRedis.bind(this));
    this.healthChecks.set('openai', this.checkOpenAI.bind(this));
    this.healthChecks.set('memory', this.checkMemory.bind(this));
    this.healthChecks.set('storage', this.checkStorage.bind(this));
  }

  public checkHealth = async (_req: Request, res: Response): Promise<void> => {
    const started = Date.now();
    logger.debug('Health: starting');

    const entries = Array.from(this.healthChecks.entries());
    const checks = await Promise.all(
      entries.map(([name, fn]) => this.runWithTimeout(name, fn, DEFAULT_CHECK_TIMEOUT_MS))
    );

    const summary = {
      total: checks.length,
      healthy: checks.filter(c => c.status === 'healthy').length,
      degraded: checks.filter(c => c.status === 'degraded').length,
      unhealthy: checks.filter(c => c.status === 'unhealthy').length
    };

    const overall: Status =
      summary.unhealthy > 0 ? 'unhealthy' : summary.degraded > 0 ? 'degraded' : 'healthy';

    const system = this.getSystemInfo();
    const payload: SystemHealth = {
      status: overall,
      service: 'ai-service',
      version: process.env.APP_VERSION || '1.0.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
      system
    };

    logger.info('Health: completed', { status: overall, durationMs: Date.now() - started, summary });

    // prevent caches from serving stale health
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res
      .status(overall === 'unhealthy' ? 503 : 200)
      .json(successResponse(payload, 'Health check completed'));
  };

  public checkReadiness = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      logger.debug('Readiness: starting');
      const critical: Array<[string, () => Promise<HealthCheck>]> = [
        ['database', this.checkDatabase.bind(this)],
        ['redis', this.checkRedis.bind(this)],
        ['openai', this.checkOpenAI.bind(this)]
      ];

      const results = await Promise.all(
        critical.map(([name, fn]) => this.runWithTimeout(name, fn, DEFAULT_CHECK_TIMEOUT_MS))
      );

      const failures = results.filter(r => r.status === 'unhealthy');

      if (failures.length) {
        logger.warn('Readiness: failed', { failures });
        res
          .status(503)
          .json(
            errorResponse('Service not ready', 503, {
              status: 'not ready',
              service: 'ai-service',
              timestamp: new Date().toISOString(),
              failures
            })
          );
        return;
      }

      logger.info('Readiness: passed');
      res.setHeader('Cache-Control', 'no-store');
      res.json(
        successResponse(
          { status: 'ready', service: 'ai-service', timestamp: new Date().toISOString(), message: 'Service is ready to accept requests' },
          'Readiness check passed'
        )
      );
    } catch (err) {
      logger.error('Readiness: error', { err });
      next(new APIError('Readiness check failed', 503, err));
    }
  };

  public checkLiveness = async (_req: Request, res: Response): Promise<void> => {
    const status = {
      status: 'alive',
      service: 'ai-service',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      pid: process.pid,
      memory: process.memoryUsage()
    };
    logger.debug('Liveness: ok', status);
    res.setHeader('Cache-Control', 'no-store');
    res.json(successResponse(status, 'Service is alive'));
  };

  public getMetrics = async (_req: Request, res: Response): Promise<void> => {
    try {
      // short sampling window to compute delta CPU
      const snap = process.cpuUsage();
      await new Promise(r => setTimeout(r, 50));
      const delta = process.cpuUsage(snap);
      const usageMicros = delta.user + delta.system;

      const metrics = {
        service: 'ai-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: { loadAverage: os.loadavg(), usageMicros },
        requests: { total: 0, active: 0, errors: 0 }, // wire your counters via middleware
        cache: await this.getCacheMetrics(),
        database: await this.getDatabaseMetrics()
      };

      res.setHeader('Cache-Control', 'no-store');
      res.json(successResponse(metrics, 'Metrics retrieved'));
    } catch (err) {
      logger.error('Metrics: failed', { err });
      res.status(500).json(errorResponse('Failed to retrieve metrics', 500));
    }
  };

  // ----- Individual checks

  private async checkDatabase(): Promise<HealthCheck> {
    const t0 = Date.now();
    try {
      await db.query('SELECT 1');
      return { name: 'database', status: 'healthy', responseTime: Date.now() - t0, details: { type: 'PostgreSQL', connection: 'active' } };
    } catch (err: any) {
      return { name: 'database', status: 'unhealthy', responseTime: Date.now() - t0, error: mask(err?.message || 'db error') };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const t0 = Date.now();
    try {
      const key = `health:check:${Date.now()}`;
      // Redis v4: { EX: seconds }
      await (redis as any).set?.(key, 'ok', { EX: 10 });
      const val = await (redis as any).get?.(key);
      await (redis as any).del?.(key);
      if (val !== 'ok') throw new Error('Redis read/write test failed');
      return { name: 'redis', status: 'healthy', responseTime: Date.now() - t0, details: { type: 'Redis', operation: 'read/write passed' } };
    } catch (err: any) {
      return { name: 'redis', status: 'unhealthy', responseTime: Date.now() - t0, error: mask(err?.message || 'redis error') };
    }
  }

  private async checkOpenAI(): Promise<HealthCheck> {
    const t0 = Date.now();
    try {
      let ok = false;
      if (typeof (openai as any)?.testConnection === 'function') {
        ok = await (openai as any).testConnection();
      } else if ((openai as any)?.models?.list) {
        const models = await (openai as any).models.list();
        ok = Boolean(models);
      }
      return {
        name: 'openai',
        status: ok ? 'healthy' : 'degraded',
        responseTime: Date.now() - t0,
        details: { type: 'OpenAI API', available: ok },
        ...(ok ? {} : { error: 'OpenAI API not verified' })
      };
    } catch (err: any) {
      return { name: 'openai', status: 'degraded', responseTime: Date.now() - t0, error: mask(err?.message || 'OpenAI check failed') };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const t0 = Date.now();
    try {
      const m = process.memoryUsage();
      const pct = (m.heapUsed / Math.max(m.heapTotal, 1)) * 100;
      let status: Status = 'healthy';
      let message = 'Memory usage normal';
      if (pct > 90) { status = 'unhealthy'; message = 'Critical memory usage'; }
      else if (pct > 75) { status = 'degraded'; message = 'High memory usage'; }

      return {
        name: 'memory',
        status,
        responseTime: Date.now() - t0,
        details: {
          usagePercent: Math.round(pct * 100) / 100,
          heapUsedMB: Math.round((m.heapUsed / 1024 / 1024) * 100) / 100,
          heapTotalMB: Math.round((m.heapTotal / 1024 / 1024) * 100) / 100,
          message
        }
      };
    } catch {
      return { name: 'memory', status: 'unhealthy', responseTime: Date.now() - t0, error: 'Failed to evaluate memory' };
    }
  }

  private async checkStorage(): Promise<HealthCheck> {
    const t0 = Date.now();
    const base = process.env.HEALTH_TMP_DIR || os.tmpdir(); // configurable for read-only FS
    const file = path.join(base, `ai-service-health-${process.pid}-${Date.now()}.tmp`);
    try {
      await writeFile(file, 'health check');
      await unlink(file);
      return { name: 'storage', status: 'healthy', responseTime: Date.now() - t0, details: { type: 'filesystem', dir: base, writable: true } };
    } catch (err: any) {
      return { name: 'storage', status: 'degraded', responseTime: Date.now() - t0, error: mask(err?.message || 'Storage write test failed') };
    }
  }

  // ----- Helpers

  private getSystemInfo() {
    const mem = process.memoryUsage();
    const cpu0 = process.cpuUsage();
    const load = os.loadavg();
    return {
      memory: mem,
      cpu: { loadAverage: load, usageMicros: cpu0.user + cpu0.system },
      process: { pid: process.pid, platform: process.platform, nodeVersion: process.version }
    };
  }

  private async getCacheMetrics() {
    try {
      if (typeof (redis as any)?.getStats === 'function') {
        const stats = await (redis as any).getStats();
        return { connected: true, stats };
      }
      const pong = await (redis as any).ping?.();
      return { connected: pong === 'PONG' || pong === true };
    } catch (err: any) {
      return { connected: false, error: mask(err?.message || 'Failed to get Redis stats') };
    }
  }

  private async getDatabaseMetrics() {
    try {
      const result = await db.query(`
        SELECT 
          pg_database_size(current_database()) as database_size,
          (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections
      `);
      const row = (result as any).rows?.[0] || {};
      return {
        connected: true,
        size: Number(row.database_size ?? 0),
        activeConnections: Number(row.active_connections ?? 0)
      };
    } catch (err: any) {
      return { connected: false, error: mask(err?.message || 'Failed to get database metrics') };
    }
  }

  private async runWithTimeout(name: string, fn: () => Promise<HealthCheck>, timeoutMs: number): Promise<HealthCheck> {
    const started = Date.now();
    try {
      const result = await Promise.race<Promise<HealthCheck>>([
        fn(),
        new Promise<HealthCheck>((_resolve, reject) => setTimeout(() => reject(new Error(`${name} check timed out after ${timeoutMs}ms`)), timeoutMs))
      ]);
      return result;
    } catch (err: any) {
      logger.warn('Health: check failed', { name, error: err?.message });
      return { name, status: 'unhealthy', responseTime: Date.now() - started, error: mask(err?.message || 'Unknown error') };
    }
  }
}
