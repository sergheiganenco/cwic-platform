// backend/data-service/src/utils/logger.ts
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { env } from '../config/env';

function bool(val: any, def = true) {
  if (val === undefined || val === null) return def;
  const s = String(val).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), 'logs'); // default ./logs
const LOG_TO_FILES = bool(process.env.LOG_TO_FILES, true);
const LOG_LEVEL = env.LOG_LEVEL || process.env.LOG_LEVEL || 'info';

function ensureWritable(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const testFile = path.join(dir, `.writable-${Date.now()}`);
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    return true;
  } catch {
    return false;
  }
}

const canWriteFiles = LOG_TO_FILES && ensureWritable(LOG_DIR);

// common formats
const human = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

const jsonFmt = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// base transports: always console
const baseTransports: winston.transport[] = [
  new winston.transports.Console({ level: LOG_LEVEL, format: human }),
];

// add file transports only if writable
if (canWriteFiles) {
  baseTransports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'combined.log'),
      level: LOG_LEVEL,
      format: jsonFmt,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true,
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: jsonFmt,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 3,
      tailable: true,
    })
  );
} else {
  // visible, but non-fatal notice
  // eslint-disable-next-line no-console
  console.warn(`[logger] File logging disabled. LOG_DIR=${LOG_DIR} not writable. Using console only.`);
}

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: jsonFmt,
  transports: baseTransports,
  exitOnError: false,
});

export const httpLogger = winston.createLogger({
  level: 'http',
  format: human,
  transports: canWriteFiles
    ? [
        new winston.transports.Console({ level: 'http', format: human }),
        new winston.transports.File({
          filename: path.join(LOG_DIR, 'http.log'),
          level: 'http',
          format: jsonFmt,
        }),
      ]
    : [new winston.transports.Console({ level: 'http', format: human })],
});

export const performanceLogger = winston.createLogger({
  level: 'info',
  format: jsonFmt,
  transports: canWriteFiles
    ? [new winston.transports.File({ filename: path.join(LOG_DIR, 'performance.log'), format: jsonFmt })]
    : [new winston.transports.Console({ level: 'info', format: human })],
});

export const securityLogger = winston.createLogger({
  level: 'warn',
  format: jsonFmt,
  transports: canWriteFiles
    ? [new winston.transports.File({ filename: path.join(LOG_DIR, 'security.log'), format: jsonFmt })]
    : [new winston.transports.Console({ level: 'warn', format: human })],
});

// Structured helpers (unchanged API, but now safe)
export const loggerUtils = {
  logRequest: (req: any, res: any, duration: number) => {
    httpLogger.http(`${req.method} ${req.url} - ${res.statusCode} - ${duration}ms`);
  },
  logDbOperation: (operation: string, table: string, duration: number, success: boolean) => {
    performanceLogger.info({ type: 'database', operation, table, duration, success, ts: new Date().toISOString() });
  },
  logAuth: (event: string, userId?: string, ip?: string, userAgent?: string) => {
    securityLogger.warn({ type: 'authentication', event, userId, ip, userAgent, ts: new Date().toISOString() });
  },
  logApiCall: (service: string, endpoint: string, method: string, duration: number, statusCode: number) => {
    performanceLogger.info({ type: 'external_api', service, endpoint, method, duration, statusCode, ts: new Date().toISOString() });
  },
  logDataSource: (operation: string, dataSourceId: string, status: string, details?: any) => {
    logger.info({ type: 'data_source', operation, dataSourceId, status, details, ts: new Date().toISOString() });
  },
  logConnectionTest: (dataSourceId: string, type: string, success: boolean, duration: number, error?: string) => {
    logger.info({ type: 'connection_test', dataSourceId, connectionType: type, success, duration, error, ts: new Date().toISOString() });
  },
  logError: (error: Error, context?: any) => {
    logger.error({ message: error.message, stack: error.stack, context, ts: new Date().toISOString() });
  },
};

// Crash guards (optional)
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { message: error.message, stack: error.stack });
  // Don’t exit here; let orchestrator handle restarts based on health checks.
});
process.on('unhandledRejection', (reason: any, promise) => {
  logger.error('Unhandled Rejection', { reason: reason?.message || String(reason), promise: String(promise) });
});
