import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError } from '../middleware/error.js';
import { redis } from '../redis.js';
import { signAccess, signRefresh, verifyRefresh } from '../utils/jwt.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

export const authRouter = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  display_name: z.string().min(2).max(100).regex(/^[a-zA-Z0-9\s\-_.]+$/, 'Display name contains invalid characters')
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

/** POST /auth/register */
authRouter.post('/register', async (req, res, next) => {
  try {
    const { email, password, display_name } = RegisterSchema.parse(req.body);
    const pwHash = await hashPassword(password);

    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name, roles, is_verified)
       VALUES ($1, $2, $3, ARRAY['user'], false)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email, display_name, roles, is_verified, created_at`,
      [email, pwHash, display_name]
    );
    const user = rows[0];
    if (!user) throw new HttpError(409, 'Email already registered', 'EmailTaken');

    const sid = randomUUID();
    const access = signAccess({ sub: user.id, roles: user.roles, sid });
    const refresh = signRefresh({ sub: user.id, sid });

    // Set secure HTTP-only cookies
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', access, {
      httpOnly: true,
      secure: isProd, // HTTPS only in production
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });
    res.cookie('refresh_token', refresh, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh',
    });

    res.status(201).json({ user, tokens: { access, refresh } });
  } catch (e) { next(e); }
});

/** POST /auth/login */
authRouter.post('/login', async (req, res, next) => {
  try {
    const { email, password } = LoginSchema.parse(req.body);
    const { rows } = await pool.query(
      'SELECT id, email, password_hash, display_name, roles, is_verified FROM users WHERE email=$1',
      [email]
    );
    const u = rows[0];
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      throw new HttpError(401, 'Invalid credentials', 'AuthFailed');
    }
    const sid = randomUUID();
    const access = signAccess({ sub: u.id, roles: u.roles, sid });
    const refresh = signRefresh({ sub: u.id, sid });

    // Set secure HTTP-only cookies
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', access, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });
    res.cookie('refresh_token', refresh, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh',
    });

    res.json({ user: { id: u.id, email: u.email, display_name: u.display_name, roles: u.roles }, tokens: { access, refresh } });
  } catch (e) { next(e); }
});

/** POST /auth/refresh */
authRouter.post('/refresh', async (req, res, next) => {
  try {
    const { refresh } = (req.body || {}) as { refresh?: string };
    if (!refresh) throw new HttpError(400, 'Missing refresh token', 'BadRequest');

    let decoded: any;
    try { decoded = verifyRefresh(refresh); }
    catch { throw new HttpError(401, 'Invalid refresh token', 'InvalidRefresh'); }

    // revoked?
    const revoked = await redis.get(`revoked:${decoded.sid}`);
    if (revoked) throw new HttpError(401, 'Refresh revoked', 'TokenRevoked');

    // rotate: revoke old session id
    await redis.setEx(`revoked:${decoded.sid}`, 60 * 60 * 24 * 8, '1');
    const newSid = randomUUID();

    // fetch roles to embed (optional)
    const { rows } = await pool.query('SELECT roles FROM users WHERE id=$1', [decoded.sub]);
    const roles = rows[0]?.roles || ['user'];

    const access = signAccess({ sub: decoded.sub, roles, sid: newSid });
    const newRefresh = signRefresh({ sub: decoded.sub, sid: newSid });

    // Set secure HTTP-only cookies
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('access_token', access, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('refresh_token', newRefresh, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    res.json({ access, refresh: newRefresh });
  } catch (e) { next(e); }
});

/** POST /auth/logout */
authRouter.post('/logout', async (req, res, _next) => {
  try {
    const { refresh } = (req.body || {}) as { refresh?: string };
    // Clear cookies on logout
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/auth/refresh' });

    if (refresh) {
      try {
        const decoded: any = verifyRefresh(refresh);
        await redis.setEx(`revoked:${decoded.sid}`, 60 * 60 * 24 * 8, '1');
      } catch { /* ignore */ }
    }
    res.status(204).send();
  } catch { res.status(204).send(); }
});

/** GET /auth/me (requires Authorization: Bearer <access>) */
authRouter.get('/me', async (req, res, next) => {
  try {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) throw new HttpError(401, 'Missing token', 'AuthRequired');

    // Verify access; we don’t need roles here
    const jwt = await import('jsonwebtoken');
    const { env } = await import('../config/env.js');
    const decoded: any = jwt.default.verify(token, env.JWT_ACCESS_SECRET);

    const { rows } = await pool.query(
      'SELECT id, email, display_name, roles, is_verified, created_at FROM users WHERE id=$1',
      [decoded.sub]
    );
    const u = rows[0];
    if (!u) throw new HttpError(404, 'User not found', 'NotFound');
    res.json(u);
  } catch (e) { next(e); }
});
