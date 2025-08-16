import { createClient } from 'redis';
import { env } from './config/env.js';

export const redis = createClient({ url: env.REDIS_URL });

export async function initRedis() {
  redis.on('error', (e) => console.error('[redis] error', e));
  if (!redis.isOpen) {
    await redis.connect();
  }
}
