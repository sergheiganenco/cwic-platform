// backend/data-service/src/queue/index.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Production-safe queue bootstrap:
 * - If bullmq/ioredis are available and REDIS_URL is set, use a real Queue
 * - Otherwise export a NOOP queue so the app still boots (no crash loops)
 */

export type QueueLike = {
  add: (name: string, data?: any, opts?: any) => Promise<any>;
  isMock?: boolean;
};

export let queueEnabled = false;
export let queueStatus: "ready" | "disabled" | "error" = "disabled";

function makeNoopQueue(label: string): QueueLike {
  queueEnabled = false;
  queueStatus = "disabled";
  // Returns a shape compatible with bullmq's .add()
  return {
    isMock: true,
    async add(name: string, data?: any) {
      // Log once per process to avoid spam
      if (!("QUEUE_NOOP_LOGGED" in (global as any))) {
        // eslint-disable-next-line no-console
        console.warn(
          `[queue:${label}] bullmq disabled (missing deps or REDIS_URL). Using NOOP queue.`
        );
        (global as any).QUEUE_NOOP_LOGGED = true;
      }
      return { id: `mock_${Date.now()}`, name, data, mocked: true };
    },
  };
}

function makeQueue(): QueueLike {
  try {
    // Use require() to avoid ESM import pitfalls in TS during runtime
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Queue } = require("bullmq");
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require("ioredis");

    const redisUrl =
      process.env.REDIS_URL ||
      process.env.BULL_REDIS_URL ||
      "redis://redis:6379";

    if (!redisUrl) {
      return makeNoopQueue("catalog-profile");
    }

    const connection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    const q = new Queue("catalog-profile", {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1500 },
        removeOnComplete: 200,
        removeOnFail: 200,
      },
    });

    queueEnabled = true;
    queueStatus = "ready";
    return q as QueueLike;
  } catch (e: any) {
    // Missing bullmq or ioredis, or other init error → NOOP
    // eslint-disable-next-line no-console
    console.warn(`[queue] disabled: ${e?.message || String(e)}`);
    return makeNoopQueue("catalog-profile");
  }
}

export const ProfileQueue: QueueLike = makeQueue();
