// backend/data-service/src/middleware/auth.ts
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const IS_PROD = (process.env.NODE_ENV || '').toLowerCase() === 'production';

function devBypass(req: Request): boolean {
  const hdr = (req.get('X-Dev-Auth') || req.get('x-dev-auth') || '').trim();
  const envSkip = (process.env.SKIP_AUTH || '').toLowerCase() === 'true';
  const envMock = (process.env.MOCK_AUTH || '').toLowerCase() === 'true';
  return !IS_PROD && (envSkip || envMock || hdr === '1');
}

function getJwtSecret(): string {
  const s = (process.env.JWT_SECRET || '').trim();
  if (s) return s;
  if (!IS_PROD) return 'devsecret';
  throw new Error('JWT is not configured (missing JWT_SECRET).');
}

function extractToken(req: Request): string | undefined {
  const h = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  if (typeof h === 'string' && h.startsWith('Bearer ')) return h.slice(7).trim();
  const c = req.headers.cookie;
  if (c) {
    const m = c.match(/(?:^|;\s*)access_token=([^;]+)/i);
    if (m) return decodeURIComponent(m[1]);
  }
  return undefined;
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (devBypass(req)) return next();
  const token = extractToken(req);
  if (!token) return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    (req as any).user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Access denied. Invalid or expired token.' });
  }
}

export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (devBypass(req)) return next();
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    (req as any).user = decoded;
  } catch {/* ignore */}
  next();
}
