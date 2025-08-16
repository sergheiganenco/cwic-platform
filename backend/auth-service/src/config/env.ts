import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(3001),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  DATABASE_URL: z.string(),
  REDIS_URL: z.string(),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL: z.string().default('7d'),
});

export const env = Env.parse(process.env);
export const corsOrigins = env.CORS_ORIGIN.split(',').map(s => s.trim());
