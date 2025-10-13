import { Queue, Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL;

const redisConnection = redisUrl
  ? redisUrl
  : {
      host: process.env.REDIS_HOST || "redis",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
    };

export const queue = new Queue("cwic:pipeline:runs", {
  connection: redisConnection as any,
});

export const connection = redisConnection;

export { Worker };
