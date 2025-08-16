import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export function requireAuth(roles?: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ detail: 'Missing token' });
    try {
      const decoded: any = jwt.verify(token, env.JWT_ACCESS_SECRET);
      (req as any).user = decoded;
      if (roles && !roles.some(r => (decoded.roles || []).includes(r))) {
        return res.status(403).json({ detail: 'Forbidden' });
      }
      next();
    } catch { return res.status(401).json({ detail: 'Invalid token' }); }
  };
}
