import jwt, { type JwtPayload, type Secret, type SignOptions } from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { env } from '../config/env.js';

const accessOpts: SignOptions = { expiresIn: env.ACCESS_TTL as StringValue };
const refreshOpts: SignOptions = { expiresIn: env.REFRESH_TTL as StringValue };

export function signAccess(payload: JwtPayload | string | object) {
  return jwt.sign(payload as any, env.JWT_ACCESS_SECRET as Secret, accessOpts);
}

export function signRefresh(payload: JwtPayload | string | object) {
  return jwt.sign(payload as any, env.JWT_REFRESH_SECRET as Secret, refreshOpts);
}

export function verifyAccess(token: string) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET as Secret);
}

export function verifyRefresh(token: string) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET as Secret);
}
