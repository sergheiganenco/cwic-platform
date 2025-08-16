// src/services/CacheService.ts
import { redis } from '@/config/redis';
import { logger } from '@/utils/logger';

function toSeconds(ms: number): number {
  return Math.max(1, Math.floor(ms / 1000));
}

export class CacheService {
  private readonly defaultTTLSeconds: number;

  constructor() {
    const raw = process.env.REDIS_TTL ?? '3600';
    const ttlNum = Number(raw);
    // If someone passed milliseconds (very large), normalize to seconds.
    this.defaultTTLSeconds = ttlNum > 7 * 24 * 3600 ? toSeconds(ttlNum) : (ttlNum || 3600);
  }

  /* ----------------------- Basic primitives ----------------------- */

  public async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (error) {
      logger.error('Cache GET error', { key, error });
      return null;
    }
  }

  public async getJSON<T = unknown>(key: string): Promise<T | null> {
    const v = await this.get(key);
    if (v == null) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }

  /**
   * Set a value with TTL (seconds). Accepts string or any JSON-serializable value.
   * Works with both:
   *  - node-redis v4: client.set(key, value, { EX: ttl })
   *  - custom wrappers: redis.set(key, value, ttl)
   */
  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.defaultTTLSeconds;
    const toStore = typeof value === 'string' ? value : JSON.stringify(value);

    try {
      // Prefer modern API via underlying client (node-redis v4)
      const client: any = redis.getClient?.() ?? null;
      if (client && typeof client.set === 'function') {
        try {
          await client.set(key, toStore, { EX: ttl });
          return;
        } catch {
          // fall through to wrapper style
        }
      }

      // Fallback to wrapper style: redis.set(key, value, ttl)
      const maybe = (redis as any).set;
      if (typeof maybe === 'function') {
        if (maybe.length >= 3) {
          await maybe.call(redis, key, toStore, ttl);
        } else {
          await maybe.call(redis, key, toStore);
          // If wrapper ignores TTL, try to set it via EXPIRE
          if (client && typeof client.expire === 'function') {
            await client.expire(key, ttl);
          }
        }
      }
    } catch (error) {
      logger.error('Cache SET error', { key, error });
      // don't throw — cache is best effort
    }
  }

  public async del(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logger.error('Cache DEL error', { key, error });
    }
  }

  /**
   * Normalize EXISTS return to boolean whether it’s number or boolean.
   */
  public async exists(key: string): Promise<boolean> {
    try {
      const raw = await (redis as any).exists?.(key);
      const n = typeof raw === 'number' ? raw : raw ? 1 : 0;
      return n > 0;
    } catch (error) {
      logger.error('Cache EXISTS error', { key, error });
      return false;
    }
  }

  /* ----------------------- Bulk helpers ----------------------- */

  /**
   * Flush keys by pattern safely. Uses scanIterator (node-redis v4),
   * falls back to SCAN or KEYS if needed.
   */
  public async flushPattern(pattern: string): Promise<void> {
    try {
      const client: any = redis.getClient?.() ?? null;
      if (!client) return;

      const batch: string[] = [];
      const flushBatch = async () => {
        if (batch.length) {
          await client.del(batch.splice(0, batch.length));
        }
      };

      if (typeof client.scanIterator === 'function') {
        // Best path: async iterator with MATCH/COUNT
        for await (const key of client.scanIterator({ MATCH: pattern, COUNT: 1000 })) {
          batch.push(key as string);
          if (batch.length >= 1000) await flushBatch();
        }
        await flushBatch();
        return;
      }

      if (typeof client.scan === 'function') {
        // Fallback: manual SCAN loop
        let cursor = '0';
        do {
          const [next, keys]: [string, string[]] = await client.scan(cursor, {
            MATCH: pattern,
            COUNT: 1000,
          });
          cursor = next;
          if (keys?.length) {
            batch.push(...keys);
            if (batch.length >= 1000) await flushBatch();
          }
        } while (cursor !== '0');
        await flushBatch();
        return;
      }

      if (typeof client.keys === 'function') {
        // Last resort: KEYS (blocking)
        const keys: string[] = await client.keys(pattern);
        if (keys.length) await client.del(keys);
      }
    } catch (error) {
      logger.error('Cache FLUSH PATTERN error', { pattern, error });
    }
  }

  /* ----------------------- Stats & diagnostics ----------------------- */

  public async getStats(): Promise<Record<string, string | number>> {
    try {
      const client: any = redis.getClient?.() ?? null;
      if (!client || typeof client.info !== 'function') return {};
      const info: string = await client.info('stats');
      return this.parseRedisInfo(info);
    } catch (error) {
      logger.error('Cache STATS error', { error });
      return {};
    }
  }

  private parseRedisInfo(info: string): Record<string, string | number> {
    const stats: Record<string, string | number> = {};
    const lines = info.split(/\r?\n/);

    for (const line of lines) {
      if (!line || line.startsWith('#')) continue; // skip comments / blanks
      const idx = line.indexOf(':');
      if (idx <= 0) continue;

      const key = line.slice(0, idx).trim();
      const raw = line.slice(idx + 1).trim();

      const n = Number(raw);
      stats[key] = Number.isFinite(n) && raw !== '' ? n : raw;
    }
    return stats;
    }
}

// Optional singleton export
export const cacheService = new CacheService();
