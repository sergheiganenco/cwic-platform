// backend/quality-engine/src/utils/logger.ts
// Advanced logging with structured output

import winston from 'winston';
import path from 'path';
import { config } from '../config';

const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss:SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  })
];

// File transport in production
if (config.service.environment === 'production') {
  transports.push(
    new winston.transports.File({
      filename: path.join(config.observability.logging.directory, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(config.observability.logging.directory, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  );
}

export const logger = winston.createLogger({
  level: config.observability.logging.level,
  format: logFormat,
  defaultMeta: {
    service: 'quality-engine',
    environment: config.service.environment
  },
  transports
});