// backend/data-service/src/middleware/audit.ts
import { NextFunction, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { logger } from '../utils/logger';
import { maskSecrets } from '../utils/secrets';

interface AuditLogEntry {
  entity_type: string;
  entity_id: string;
  action: string;
  actor?: string;
  actor_ip?: string;
  user_agent?: string;
  changes?: any;
  metadata?: any;
}

class AuditService {
  private db = new DatabaseService();
  private logQueue: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout;

  constructor() {
    // Batch insert audit logs every 5 seconds
    this.flushInterval = setInterval(() => this.flushLogs(), 5000);
  }

  async logAction(entry: AuditLogEntry): Promise<void> {
    this.logQueue.push({
      ...entry,
      metadata: {
        ...entry.metadata,
        timestamp: new Date().toISOString()
      }
    });

    // Flush immediately for critical actions
    if (['DELETE', 'EXECUTE'].includes(entry.action)) {
      await this.flushLogs();
    }
  }

  private async flushLogs(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const logsToFlush = [...this.logQueue];
    this.logQueue = [];

    try {
      for (const log of logsToFlush) {
        await this.db.query(`
          INSERT INTO audit_logs (entity_type, entity_id, action, actor, actor_ip, user_agent, changes, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
        `, [
          log.entity_type,
          log.entity_id,
          log.action,
          log.actor || null,
          log.actor_ip || null,
          log.user_agent || null,
          JSON.stringify(log.changes || {}),
          JSON.stringify(log.metadata || {})
        ]);
      }
    } catch (error) {
      logger.error('Failed to flush audit logs', { 
        error: (error as Error).message, 
        queueSize: logsToFlush.length 
      });
      // Re-queue the failed logs
      this.logQueue.unshift(...logsToFlush);
    }
  }

  async cleanup(): Promise<void> {
    clearInterval(this.flushInterval);
    await this.flushLogs();
  }
}

const auditService = new AuditService();

export const auditMiddleware = (entityType: string, action: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body: any) {
      const user = (req as any).user;
      const entityId = req.params.id || 'bulk_operation';
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      const shouldCaptureBody = req.method === 'POST' || req.method === 'PUT';
      const sanitizedChanges = shouldCaptureBody ? maskSecrets(req.body) : undefined;
      const sanitizedQuery = maskSecrets(req.query);

      auditService.logAction({
        entity_type: entityType,
        entity_id: entityId,
        action: action,
        actor: user?.id || user?.email || 'anonymous',
        actor_ip: clientIp,
        user_agent: userAgent,
        changes: sanitizedChanges,
        metadata: {
          method: req.method,
          path: req.path,
          query: sanitizedQuery,
          statusCode: res.statusCode,
          contentLength: typeof body === 'string' ? Buffer.byteLength(body) : Buffer.isBuffer(body) ? body.length : 0
        }
      }).catch(error => {
        logger.error('Audit logging failed', { error: error.message });
      });

      return originalSend.call(this, body);
    };

    next();
  };
};

// Enhanced rate limiting with Redis-like token bucket implementation
export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillRate: number;
  private readonly refillInterval: number;

  constructor(capacity: number, refillRate: number, refillInterval: number = 1000) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.refillInterval = refillInterval;
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }

  consume(tokens: number = 1): boolean {
    this.refill();
    
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    
    return false;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.refillInterval) * this.refillRate;
    
    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  getTokens(): number {
    this.refill();
    return this.tokens;
  }
}

// Enhanced rate limiting middleware
export const createRateLimit = (options: {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  standardHeaders?: boolean;
  message?: string;
}) => {
  const buckets = new Map<string, TokenBucket>();
  const {
    windowMs,
    max,
    skipSuccessfulRequests = false,
    standardHeaders = true,
    message = 'Too many requests'
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    
    if (!buckets.has(key)) {
      buckets.set(key, new TokenBucket(max, max, windowMs));
    }

    const bucket = buckets.get(key)!;
    const hasTokens = bucket.consume(1);

    if (standardHeaders) {
      res.set({
        'X-RateLimit-Limit': max.toString(),
        'X-RateLimit-Remaining': Math.max(0, bucket.getTokens()).toString(),
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });
    }

    if (!hasTokens) {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        userAgent: req.get('User-Agent')
      });

      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          retryAfter: Math.ceil(windowMs / 1000)
        }
      });
    }

    // Clean up old buckets periodically
    if (Math.random() < 0.01) { // 1% chance
      const now = Date.now();
      for (const [key, bucket] of buckets) {
        if (bucket.getTokens() === max && now - windowMs > 0) {
          buckets.delete(key);
        }
      }
    }

    next();
  };
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Security headers
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
    'X-Permitted-Cross-Domain-Policies': 'none'
  });

  next();
};

// Request sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  const sanitizeValue = (value: any): any => {
    if (typeof value === 'string') {
      // Remove potentially dangerous characters
      return value
        .replace(/[<>]/g, '') // Remove angle brackets
        .replace(/javascript:/gi, '') // Remove javascript: protocol
        .replace(/data:/gi, '') // Remove data: protocol
        .trim();
    }
    
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    
    if (value && typeof value === 'object') {
      const sanitized: any = {};
      for (const [key, val] of Object.entries(value)) {
        sanitized[key] = sanitizeValue(val);
      }
      return sanitized;
    }
    
    return value;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }

  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }

  next();
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn('Request timeout', {
          method: req.method,
          path: req.path,
          ip: req.ip,
          timeout: timeoutMs
        });

        res.status(408).json({
          success: false,
          error: {
            code: 'REQUEST_TIMEOUT',
            message: 'Request timed out'
          }
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    res.on('close', () => {
      clearTimeout(timeout);
    });

    next();
  };
};

// Request size limiting middleware
export const limitRequestSize = (maxSize: number = 10 * 1024 * 1024) => { // 10MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    
    if (contentLength > maxSize) {
      logger.warn('Request too large', {
        contentLength,
        maxSize,
        ip: req.ip,
        path: req.path
      });

      return res.status(413).json({
        success: false,
        error: {
          code: 'PAYLOAD_TOO_LARGE',
          message: `Request size exceeds limit of ${maxSize} bytes`
        }
      });
    }

    next();
  };
};

// Export cleanup function for graceful shutdown
export const cleanupMiddleware = async (): Promise<void> => {
  await auditService.cleanup();
};