import 'dotenv/config';
import { z } from 'zod';

const Env = z.object({
  NODE_ENV: z.enum(['development','test','production']).default('development'),
  PORT: z.coerce.number().default(3002),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string()
});

export const env = Env.parse(process.env);
export const corsOrigins = env.CORS_ORIGIN.split(',').map(x => x.trim());
