// backend/data-service/src/middleware/error.ts
import { NextFunction, Request, Response } from 'express';
import { isProduction } from '../config/env';
import { logger } from '../utils/logger';

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public isOperational: boolean;
  public details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/** Factory used by other middleware/controllers */
export const createError = (
  message: string,
  statusCode: number = 500,
  code: string = 'INTERNAL_ERROR',
  details?: any
): AppError => new AppError(message, statusCode, code, true, details);

// ──────────────────────────────────────────────────────────────────
// Common error types
// ──────────────────────────────────────────────────────────────────
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', true, details);
  }
}
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND', true);
  }
}
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED', true);
  }
}
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN', true);
  }
}
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409, 'CONFLICT', true);
  }
}
export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', true, details);
  }
}
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(`External service error (${service}): ${message}`, 502, 'EXTERNAL_SERVICE_ERROR', true, details);
  }
}

// ──────────────────────────────────────────────────────────────────
// Error handler
// ──────────────────────────────────────────────────────────────────
export const errorHandler = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (res.headersSent) return next(error);

  // Defaults
  let statusCode = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Internal server error';
  let details: any;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token expired';
  } else if ((error as any).code === '23505') {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Resource already exists';
  } else if ((error as any).code === '23503') {
    statusCode = 400;
    code = 'FOREIGN_KEY_VIOLATION';
    message = 'Referenced resource does not exist';
  } else if ((error as any).code === 'ECONNREFUSED') {
    statusCode = 503;
    code = 'SERVICE_UNAVAILABLE';
    message = 'External service unavailable';
  } else if ((error as any).code === 'ENOTFOUND') {
    statusCode = 503;
    code = 'SERVICE_UNREACHABLE';
    message = 'External service unreachable';
  } else if ((error as any).code === 'ETIMEDOUT') {
    statusCode = 504;
    code = 'SERVICE_TIMEOUT';
    message = 'External service timeout';
  }

  const requestId =
    (req as any).requestId ||
    req.get('X-Request-ID') ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const logPayload = {
    requestId,
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode,
    code,
    message: (error as any).message,
    stack: (error as any).stack,
    body: req.body,
    params: req.params,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  };

  if (statusCode >= 500) {
    logger.error('Server error:', logPayload);
  } else {
    logger.warn('Client error:', logPayload);
  }

  const payload: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  // Only include details/stack outside production
  if (!isProduction) {
    if (details) payload.error.details = details;
    payload.error.details = {
      ...(payload.error.details || {}),
      stack: (error as any).stack,
    };
  }

  res.status(statusCode).json(payload);
};

// ──────────────────────────────────────────────────────────────────
export const notFoundHandler = (req: Request, res: Response): void => {
  const requestId =
    (req as any).requestId ||
    req.get('X-Request-ID') ||
    `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const payload: ErrorResponse = {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      timestamp: new Date().toISOString(),
      requestId,
    },
  };

  logger.warn('Route not found:', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId,
  });

  res.status(404).json(payload);
};

// Wrap async route handlers
export const asyncHandler = (fn: (...args: any[]) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Attach/propagate a request ID for tracing
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.get('X-Request-ID') || `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  (req as any).requestId = requestId;
  res.set('X-Request-ID', requestId);
  next();
};

export default errorHandler;
