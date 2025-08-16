import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number; code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message); this.status = status; this.code = code;
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
