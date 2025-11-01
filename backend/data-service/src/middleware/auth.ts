// backend/data-service/src/middleware/auth.ts
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const IS_PROD = (process.env.NODE_ENV || '').toLowerCase() === 'production';

function devBypass(req: Request): boolean {
  // Removed X-Dev-Auth header bypass for security
  // Only allow SKIP_AUTH in local development with explicit warnings
  const envSkip = (process.env.SKIP_AUTH || '').toLowerCase() === 'true';
  const shouldBypass = !IS_PROD && envSkip;

  console.log('🔍 devBypass check:', {
    IS_PROD,
    envSkip,
    SKIP_AUTH: process.env.SKIP_AUTH,
    NODE_ENV: process.env.NODE_ENV,
    shouldBypass,
    path: req.path
  });

  if (envSkip && !IS_PROD) {
    console.warn('⚠️  WARNING: SKIP_AUTH is enabled - authentication is DISABLED! For local development only.');
  }
  return shouldBypass;
}

function getJwtSecret(): string {
  const s = (process.env.JWT_SECRET || '').trim();
  if (!s) {
    throw new Error('JWT_SECRET is required - set it in your environment variables');
  }
  // Validate minimum secret length
  if (s.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long for security');
  }
  return s;
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
  if (devBypass(req)) {
    // Add mock user for development
    (req as any).user = { id: 'dev-user', role: 'admin', email: 'dev@localhost' };
    console.log('✅ Auth bypassed for development');
    return next();
  }
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
