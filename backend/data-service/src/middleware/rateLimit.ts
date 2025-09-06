import type { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { logger, loggerUtils } from '../utils/logger';

// helper to coerce the rate-limit handler to Express's RequestHandler
const asExpressHandler = (h: unknown) => h as unknown as RequestHandler;

/** Default rate limiting middleware for general use */
const _defaultRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: any, res: any) => {
    logger.warn('Default rate limit exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
    });
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: res.get('Retry-After'),
      timestamp: new Date().toISOString(),
    });
  },
});
export const defaultRateLimit: RequestHandler = asExpressHandler(_defaultRateLimit);

/** Custom key generator */
const keyGenerator = (req: any): string => {
  const user = req.user;
  return user ? `user:${user.id}` : `ip:${req.ip}`;
};

/** Common response body */
const rateLimitMessage = (req: any, res: any) => {
  const user = req.user;
  loggerUtils.logAuth('rate_limit_exceeded', user?.id, req.ip, req.get('User-Agent'));
  return {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests. Please try again later.',
    retryAfter: res.get('Retry-After'),
    timestamp: new Date().toISOString(),
  };
};

// Skip function (keep any to avoid cross-tree type binding)
const skipSuccessfulRequests = (req: any, res: any): boolean =>
  res.statusCode < 400 && req.path === '/health';

/** General rate limiting middleware */
export const rateLimitMiddleware: RequestHandler = asExpressHandler(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: skipSuccessfulRequests,
    handler: (req: any, res: any) => {
      res.status(429).json(rateLimitMessage(req, res));
    },
  })
);

/** Strict auth limiter */
export const strictRateLimitMiddleware: RequestHandler = asExpressHandler(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: any) => `auth:${req.ip}`,
    handler: (req: any, res: any) => {
      res.status(429).json(rateLimitMessage(req, res));
    },
  })
);

/** API limiter */
export const apiRateLimitMiddleware: RequestHandler = asExpressHandler(
  rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: skipSuccessfulRequests,
    handler: (req: any, res: any) => {
      res.status(429).json(rateLimitMessage(req, res));
    },
  })
);

/** Connection test limiter */
export const connectionTestRateLimitMiddleware: RequestHandler = asExpressHandler(
  rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req: any, res: any) => {
      res.status(429).json(rateLimitMessage(req, res));
    },
  })
);

/** Search limiter */
export const searchRateLimitMiddleware: RequestHandler = asExpressHandler(
  rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    skip: skipSuccessfulRequests,
    handler: (req: any, res: any) => {
      res.status(429).json(rateLimitMessage(req, res));
    },
  })
);

/** Export limiter */
export const exportRateLimitMiddleware: RequestHandler = asExpressHandler(
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req: any, res: any) => {
      res.status(429).json(rateLimitMessage(req, res));
    },
  })
);

/** Upload limiter */
export const uploadRateLimitMiddleware: RequestHandler = asExpressHandler(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler: (req: any, res: any) => {
      res.status(429).json(rateLimitMessage(req, res));
    },
  })
);

/** Factory */
export const createRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}): RequestHandler =>
  asExpressHandler(
    rateLimit({
      windowMs: options.windowMs,
      max: options.max,
      message: options.message
        ? {
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: options.message,
            timestamp: new Date().toISOString(),
          }
        : undefined,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      skip: options.skipSuccessfulRequests ? skipSuccessfulRequests : undefined,
      handler: (req: any, res: any) => {
        res.status(429).json(rateLimitMessage(req, res));
      },
    })
  );

export const RATE_LIMITS = {
  GENERAL: { windowMs: 15 * 60 * 1000, max: 100 },
  AUTH: { windowMs: 15 * 60 * 1000, max: 5 },
  API: { windowMs: 1 * 60 * 1000, max: 20 },
  CONNECTION_TEST: { windowMs: 5 * 60 * 1000, max: 10 },
  SEARCH: { windowMs: 1 * 60 * 1000, max: 30 },
  EXPORT: { windowMs: 60 * 60 * 1000, max: 5 },
  UPLOAD: { windowMs: 15 * 60 * 1000, max: 10 },
} as const;
