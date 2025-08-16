// src/middleware/auth.ts
import { APIError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload, VerifyOptions } from 'jsonwebtoken';

/** Extend Express Request with an authenticated user */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions?: string[];
    sub?: string;
    iat?: number;
    exp?: number;
  };
}

/** The JWT claims your system issues/accepts */
interface AppJwtPayload extends JwtPayload {
  id: string;
  email: string;
  role: string;
  permissions?: string[];
}

/* ---------------------------- Helpers & Config ---------------------------- */

const readEnv = () => {
  const {
    JWT_SECRET,
    JWT_ISSUER,
    JWT_AUDIENCE,
    JWT_ALLOWED_ALGS,
    JWT_ALG = 'HS256',
    JWT_CLOCK_TOLERANCE_SEC = '60',
    AUTH_COOKIE = 'auth_token',
  } = process.env;

  if (!JWT_SECRET) {
    // fail closed; this is a deployment/config error
    throw new Error('JWT_SECRET is not configured');
  }

  const allowedAlgs = (JWT_ALLOWED_ALGS?.split(',').map(s => s.trim()).filter(Boolean)) || [JWT_ALG];

  const verifyOptions: VerifyOptions = {
    algorithms: allowedAlgs as jwt.Algorithm[],
    issuer: JWT_ISSUER || undefined,
    audience: JWT_AUDIENCE || undefined,
    clockTolerance: Number.isFinite(+JWT_CLOCK_TOLERANCE_SEC) ? Number(JWT_CLOCK_TOLERANCE_SEC) : 60,
  };

  return { JWT_SECRET, verifyOptions, AUTH_COOKIE };
};

/** Safely extract a token from Authorization header, x-access-token, or a cookie */
const extractToken = (req: Request, cookieName: string): string | null => {
  const hdr = req.headers.authorization || '';
  if (hdr) {
    const [scheme, token] = hdr.split(' ');
    if (scheme?.toLowerCase() === 'bearer' && token) return token.trim();
  }
  const alt = (req.headers['x-access-token'] as string) || '';
  if (alt) return alt.trim();

  // minimal cookie parse (avoid extra deps)
  const cookieHeader = req.headers.cookie || '';
  if (cookieHeader && cookieName) {
    const parts = cookieHeader.split(';').map(c => c.trim());
    for (const p of parts) {
      const [k, v] = p.split('=');
      if (k === cookieName && v) return decodeURIComponent(v);
    }
  }
  return null;
};

/** Central token verification (HMAC secret) */
const verifyToken = (token: string): AppJwtPayload => {
  const { JWT_SECRET, verifyOptions } = readEnv();
  const decoded = jwt.verify(token, JWT_SECRET, verifyOptions);
  if (typeof decoded === 'string') {
    throw new APIError('Invalid token payload', 401);
  }
  const payload = decoded as AppJwtPayload;
  if (!payload.id || !payload.email || !payload.role) {
    throw new APIError('Token missing required claims', 401);
  }
  return payload;
};

/** include optional field only if defined (for exactOptionalPropertyTypes) */
type Defined<T> = Exclude<T, undefined>;
const includeIfDefined = <K extends string, V>(key: K, value: V | undefined) =>
  (value !== undefined ? { [key]: value } as Record<K, Defined<V>> : {});

/** normalize string or string[] input */
const toArray = <T>(v: T | T[]) => (Array.isArray(v) ? v : [v]);

/* -------------------------------- Middlewares ----------------------------- */

/** Strict authentication. Requires a valid token and attaches user to req. */
export const authenticateToken = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { AUTH_COOKIE } = readEnv();
    const token = extractToken(req, AUTH_COOKIE);
    if (!token) throw new APIError('Access token required', 401);

    const payload = verifyToken(token);

    // only include optional fields if they exist
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
      permissions: payload.permissions ?? [],
      ...includeIfDefined('sub', payload.sub),
      ...includeIfDefined('iat', payload.iat),
      ...includeIfDefined('exp', payload.exp),
    };

    logger.debug('Auth: user authenticated', { userId: payload.id, role: payload.role });
    next();
  } catch (err: any) {
    if (err instanceof APIError) return next(err);
    if (err instanceof jwt.TokenExpiredError) return next(new APIError('Token expired', 401));
    if (err instanceof jwt.NotBeforeError) return next(new APIError('Token not active yet', 401));
    if (err instanceof jwt.JsonWebTokenError) return next(new APIError('Invalid token', 401));
    logger.warn('Auth: unexpected verification error', { message: err?.message });
    next(new APIError('Authentication failed', 401));
  }
};

/** Optional auth. If a valid token is present, attaches user; never blocks. */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { AUTH_COOKIE } = readEnv();
    const token = extractToken(req, AUTH_COOKIE);
    if (!token) return next();

    try {
      const payload = verifyToken(token);
      req.user = {
        id: payload.id,
        email: payload.email,
        role: payload.role,
        permissions: payload.permissions ?? [],
        ...includeIfDefined('sub', payload.sub),
        ...includeIfDefined('iat', payload.iat),
        ...includeIfDefined('exp', payload.exp),
      };
      logger.debug('Auth: optional user attached', { userId: payload.id, role: payload.role });
    } catch (e: any) {
      // Do not block optional routes; just log at debug
      logger.debug('Auth: optional token rejected', { reason: e?.message });
    }
    next();
  } catch {
    next();
  }
};

/** Require one of the given roles. */
export const requireRole = (roles: string[] | string) => {
  const required = new Set(toArray(roles).map(r => r.toLowerCase()));
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw new APIError('Authentication required', 401);
      const userRole = (req.user.role || '').toLowerCase();
      if (!required.has(userRole)) throw new APIError('Insufficient permissions', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
};

/** Require a specific permission (exact match). */
export const requirePermission = (permission: string) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    try {
      if (!req.user) throw new APIError('Authentication required', 401);
      const perms = new Set(req.user.permissions || []);
      if (!perms.has(permission)) throw new APIError('Insufficient permissions', 403);
      next();
    } catch (err) {
      next(err);
    }
  };
};
