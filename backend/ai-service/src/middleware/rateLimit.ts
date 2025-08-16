// src/middleware/rateLimit.ts
import { redis } from '@/config/redis';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit, {
  type ClientRateLimitInfo,
  type RateLimitRequestHandler,
  type Store as RateLimitStore,
} from 'express-rate-limit';

/* ──────────────────────────────────────────────────────────────────────────
 * Central config (can move to config/env)
 * ────────────────────────────────────────────────────────────────────────── */
const RATE_LIMIT_CONFIG = {
  ai: { windowMs: 15 * 60 * 1000, max: 10, prefix: 'rl:ai:' },         // 10 per 15m
  discovery: { windowMs: 5 * 60 * 1000, max: 3, prefix: 'rl:disc:' },   // 3 per 5m
  api: { windowMs: 15 * 60 * 1000, max: 100, prefix: 'rl:api:' },       // 100 per 15m
};

/* ──────────────────────────────────────────────────────────────────────────
 * Minimal request shape (avoid importing Express Request types here)
 * ────────────────────────────────────────────────────────────────────────── */
type MaybeAuthed = {
  user?: { id?: string | null | undefined; role?: string | null | undefined };
  ip?: string;
  originalUrl?: string;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Redis-backed store for express-rate-limit v7
 * (Do NOT `implements Store` to avoid cross-package type conflicts)
 * ────────────────────────────────────────────────────────────────────────── */
class RateLimitRedisStore {
  private readonly _prefix: string;
  private readonly _windowMs: number;

  constructor(windowMs: number, prefix = 'rl:') {
    this._prefix = prefix;
    this._windowMs = windowMs;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const redisKey = `${this._prefix}${key}`;
    try {
      const client = redis.getClient();
      const totalHits = await client.incr(redisKey);

      // set expiry on first hit
      if (totalHits === 1) {
        await client.expire(redisKey, Math.ceil(this._windowMs / 1000));
      }

      const ttlSec = await client.ttl(redisKey);
      // resetTime is REQUIRED by ClientRateLimitInfo
      const resetTime =
        ttlSec > 0
          ? new Date(Date.now() + ttlSec * 1000)
          : new Date(Date.now() + this._windowMs);

      return { totalHits, resetTime };
    } catch {
      // If Redis is unavailable, be permissive but still provide a resetTime
      return { totalHits: 1, resetTime: new Date(Date.now() + this._windowMs) };
    }
  }

  async decrement(key: string): Promise<void> {
    try {
      await redis.getClient().decr(`${this._prefix}${key}`);
    } catch {
      // swallow
    }
  }

  async resetKey(key: string): Promise<void> {
    try {
      await redis.getClient().del(`${this._prefix}${key}`);
    } catch {
      // swallow
    }
  }

  // Optional: some versions may call resetAll; implement as no-op
  async resetAll(): Promise<void> {
    // Implement SCAN/DEL by prefix if you need global resets
  }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Factory (uses `unknown` to avoid type-forks between @types/express trees)
 * ────────────────────────────────────────────────────────────────────────── */
export function createRateLimiter(options: {
  windowMs: number;
  max: number | ((req: unknown) => number);
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: unknown, res: unknown) => string;
  prefix?: string;
}): RateLimitRequestHandler {
  const {
    windowMs,
    max,
    message = 'Too many requests',
    skipSuccessfulRequests = false,
    keyGenerator,
    prefix = 'rl:',
  } = options;

  return rateLimit({
    windowMs,

    // ValueDeterminingMiddleware<number> compatible
    max: (req: unknown) => {
      // functional max support
      if (typeof max === 'function') {
        try {
          return max(req);
        } catch {
          return 100;
        }
      }
      // super_admin bypass (unlimited)
      const r = req as MaybeAuthed;
      if (r?.user?.role === 'super_admin') return Number.MAX_SAFE_INTEGER;
      return max;
    },

    standardHeaders: true,
    legacyHeaders: false,

    // Cast through unknown to satisfy possible distinct type trees
    store: new RateLimitRedisStore(windowMs, prefix) as unknown as RateLimitStore,

    keyGenerator: (req: unknown, res: unknown): string => {
      if (keyGenerator) {
        const k = keyGenerator(req, res);
        // Must always return a string
        return (k ?? '').toString() || (req as MaybeAuthed).ip || 'unknown';
      }
      const r = req as MaybeAuthed;
      const id = (r?.user?.id ?? '').toString().trim();
      return id || r?.ip || 'unknown';
    },

    skipSuccessfulRequests,

    handler: (req: unknown, res: unknown): void => {
      const _res = res as {
        setHeader: (k: string, v: string) => void;
        status: (c: number) => { json?: (b: unknown) => void };
      };
      const _req = req as MaybeAuthed;

      _res.setHeader('Retry-After', Math.ceil(windowMs / 1000).toString());
      _res
        .status(429)
        .json?.({
          success: false,
          error: { code: 'RATE_LIMIT_EXCEEDED', message },
          meta: { timestamp: new Date().toISOString(), path: _req?.originalUrl || '' },
        });
    },
  });
}

/* ──────────────────────────────────────────────────────────────────────────
 * Preconfigured limiters (raw RateLimitRequestHandler)
 * ────────────────────────────────────────────────────────────────────────── */
export const aiRateLimit: RateLimitRequestHandler = createRateLimiter({
  ...RATE_LIMIT_CONFIG.ai,
  message: 'AI request limit exceeded',
  prefix: RATE_LIMIT_CONFIG.ai.prefix,
  // Admins can do more AI calls
  max: (req) => ((req as MaybeAuthed).user?.role === 'admin' ? 50 : RATE_LIMIT_CONFIG.ai.max),
  keyGenerator: (req) => {
    const r = req as MaybeAuthed;
    const id = (r?.user?.id ?? '').toString().trim();
    return id || r?.ip || 'unknown';
  },
});

export const discoveryRateLimit: RateLimitRequestHandler = createRateLimiter({
  ...RATE_LIMIT_CONFIG.discovery,
  message: 'Discovery request limit exceeded',
  prefix: RATE_LIMIT_CONFIG.discovery.prefix,
  keyGenerator: (req) => {
    const r = req as MaybeAuthed;
    const id = (r?.user?.id ?? '').toString().trim();
    return id || r?.ip || 'unknown';
  },
});

export const apiRateLimit: RateLimitRequestHandler = createRateLimiter({
  ...RATE_LIMIT_CONFIG.api,
  message: 'API request limit exceeded',
  prefix: RATE_LIMIT_CONFIG.api.prefix,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const r = req as MaybeAuthed;
    const id = (r?.user?.id ?? '').toString().trim();
    return id || r?.ip || 'unknown';
  },
});

/* ──────────────────────────────────────────────────────────────────────────
 * Wrappers to plain Express RequestHandler (fix type tree mismatches)
 * Use these in your routers: aiRateLimitMw/discoveryRateLimitMw/apiRateLimitMw
 * ────────────────────────────────────────────────────────────────────────── */
const asMiddleware = (rl: RateLimitRequestHandler): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) =>
    (rl as unknown as (req: Request, res: Response, next: NextFunction) => void)(req, res, next);

export const aiRateLimitMw: RequestHandler = asMiddleware(aiRateLimit);
export const discoveryRateLimitMw: RequestHandler = asMiddleware(discoveryRateLimit);
export const apiRateLimitMw: RequestHandler = asMiddleware(apiRateLimit);
