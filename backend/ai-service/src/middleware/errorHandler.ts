import { APIError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { NextFunction, Request, Response } from 'express';

// Extended Error interface for database and system errors
interface ExtendedError extends Error {
  code?: string;
  errno?: number;
  sqlState?: string;
  sqlMessage?: string;
  statusCode?: number;
}

export const errorHandler = (
  error: ExtendedError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  void next; // keep Express signature, silence TS unused

  // Log the error with full context
  logger.error('Request error:', {
    error: error.message,
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId: (req as any).id,
    body: req.method !== 'GET' ? req.body : undefined,
    query: req.query,
    params: req.params
  });

  // Handle API errors (our custom errors)
  if (error instanceof APIError) {
    res.status(error.statusCode).json({
      success: false,
      error: {
        message: error.message,
        code: error.statusCode,
        type: 'APIError',
        ...(error.details && { details: error.details }),
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle Joi validation errors
  if (error.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: {
        message: 'Validation failed',
        code: 400,
        type: 'ValidationError',
        details: error.message
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle JWT errors
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      error: {
        message: 'Invalid token',
        code: 401,
        type: 'AuthenticationError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      error: {
        message: 'Token expired',
        code: 401,
        type: 'AuthenticationError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle database connection errors
  if (error.message?.includes('connect ECONNREFUSED') || 
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT') {
    res.status(503).json({
      success: false,
      error: {
        message: 'Database connection failed',
        code: 503,
        type: 'DatabaseConnectionError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle PostgreSQL specific errors
  if (error.code?.startsWith('23')) { // PostgreSQL constraint violations
    let message = 'Database constraint violation';
    let statusCode = 400;

    switch (error.code) {
      case '23505': // unique_violation
        message = 'Duplicate entry - record already exists';
        break;
      case '23503': // foreign_key_violation
        message = 'Referenced record does not exist';
        break;
      case '23502': // not_null_violation
        message = 'Required field cannot be empty';
        break;
      case '23514': // check_violation
        message = 'Data does not meet validation requirements';
        break;
    }

    res.status(statusCode).json({
      success: false,
      error: {
        message,
        code: statusCode,
        type: 'DatabaseConstraintError',
        dbCode: error.code,
        ...(process.env.NODE_ENV === 'development' && { 
          sqlMessage: (error as any).sqlMessage || error.message 
        })
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle Redis connection errors
  if (error.message?.includes('Redis') || error.code === 'ECONNRESET') {
    res.status(503).json({
      success: false,
      error: {
        message: 'Cache service temporarily unavailable',
        code: 503,
        type: 'CacheConnectionError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle OpenAI API errors
  if (error.message?.includes('OpenAI') || error.message?.includes('AI service')) {
    res.status(503).json({
      success: false,
      error: {
        message: 'AI service temporarily unavailable',
        code: 503,
        type: 'AIServiceError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle rate limiting errors
  if ((error.message?.includes('rate limit') || (error as any).statusCode === 429)) {
    res.status(429).json({
      success: false,
      error: {
        message: 'Too many requests - please try again later',
        code: 429,
        type: 'RateLimitError',
        retryAfter: '15 minutes'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle file upload errors
  if ((error as any).code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      success: false,
      error: {
        message: 'File too large',
        code: 413,
        type: 'FileUploadError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  if ((error as any).code === 'LIMIT_UNEXPECTED_FILE') {
    res.status(400).json({
      success: false,
      error: {
        message: 'Invalid file upload',
        code: 400,
        type: 'FileUploadError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle syntax errors (malformed JSON, etc.)
  if (error instanceof SyntaxError) {
    res.status(400).json({
      success: false,
      error: {
        message: 'Invalid request format',
        code: 400,
        type: 'SyntaxError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle timeout errors
  if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
    res.status(408).json({
      success: false,
      error: {
        message: 'Request timeout',
        code: 408,
        type: 'TimeoutError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle permission errors
  if (error.code === 'EACCES' || error.code === 'EPERM') {
    res.status(403).json({
      success: false,
      error: {
        message: 'Access denied',
        code: 403,
        type: 'PermissionError'
      },
      requestId: (req as any).id,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Handle default errors
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = (error as any).statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      message: isDevelopment ? error.message : 'Internal server error',
      code: statusCode,
      type: 'InternalServerError',
      ...(isDevelopment && { 
        stack: error.stack,
        originalError: {
          name: error.name,
          message: error.message,
          code: error.code
        }
      })
    },
    requestId: (req as any).id,
    timestamp: new Date().toISOString()
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  const error = {
    success: false,
    error: {
      message: `Route ${req.method} ${req.path} not found`,
      code: 404,
      type: 'NotFoundError',
      availableRoutes: [
        'GET /api/health',
        'GET /api/docs',
        'POST /api/discovery',
        'POST /api/analysis/schema'
      ]
    },
    requestId: (req as any).id,
    timestamp: new Date().toISOString()
  };

  logger.warn('Route not found', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json(error);
};

// Async error wrapper utility
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Global unhandled error handlers
export const setupGlobalErrorHandlers = (): void => {
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception - Server shutting down:', {
      error: error.message,
      stack: error.stack,
      pid: process.pid
    });
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Promise Rejection:', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString()
    });
    process.exit(1);
  });

  // Handle SIGTERM (graceful shutdown)
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received - starting graceful shutdown');
    process.exit(0);
  });

  // Handle SIGINT (Ctrl+C)
  process.on('SIGINT', () => {
    logger.info('SIGINT received - starting graceful shutdown');
    process.exit(0);
  });
};

// Error types for better error handling
export enum ErrorTypes {
  API_ERROR = 'APIError',
  VALIDATION_ERROR = 'ValidationError',
  AUTHENTICATION_ERROR = 'AuthenticationError',
  AUTHORIZATION_ERROR = 'AuthorizationError',
  DATABASE_ERROR = 'DatabaseError',
  CACHE_ERROR = 'CacheError',
  AI_SERVICE_ERROR = 'AIServiceError',
  RATE_LIMIT_ERROR = 'RateLimitError',
  FILE_UPLOAD_ERROR = 'FileUploadError',
  TIMEOUT_ERROR = 'TimeoutError',
  NOT_FOUND_ERROR = 'NotFoundError',
  INTERNAL_SERVER_ERROR = 'InternalServerError'
}

// Helper function to create standardized error responses
export const createErrorResponse = (
  message: string,
  code: number,
  type: ErrorTypes,
  details?: any,
  requestId?: string
) => {
  return {
    success: false,
    error: {
      message,
      code,
      type,
      ...(details && { details })
    },
    requestId: requestId || 'unknown',
    timestamp: new Date().toISOString()
  };
};
