import { Queue, Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL;

// Parse Redis URL if provided, otherwise use individual env vars
let redisConnection: any;

if (redisUrl) {
  // Parse redis://:<password>@<host>:<port>/<db>
  const url = new URL(redisUrl);
  redisConnection = {
    host: url.hostname || "redis",
    port: parseInt(url.port || "6379", 10),
    password: url.password || undefined,
    db: url.pathname ? parseInt(url.pathname.slice(1), 10) : 0,
  };
} else {
  redisConnection = {
    host: process.env.REDIS_HOST || "redis",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
    db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : 0,
  };
}

console.log('🔗 Pipeline Redis connection config:', {
  host: redisConnection.host,
  port: redisConnection.port,
  hasPassword: !!redisConnection.password,
  db: redisConnection.db
});

export const queue = new Queue("cwic:pipeline:runs", {
  connection: redisConnection,
});

export const connection = redisConnection;

export { Worker };
