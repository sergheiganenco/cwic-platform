import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number; code?: string; details?: unknown;
  constructor(status: number, message: string, code?: string, details?: unknown) {
    super(message); this.status = status; this.code = code; this.details = details;
  }
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.status || 500;
  res.status(status).json({
    type: 'about:blank',
    title: err.code || 'ServerError',
    status,
    detail: err.message || 'Unexpected error'
  });
}
