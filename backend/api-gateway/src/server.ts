// src/server.ts
import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT ?? 8000);
const HOST = process.env.HOST ?? "0.0.0.0";

const DATA_SERVICE_URL = process.env.DATA_SERVICE_URL ?? "http://localhost:3002";
const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8003";

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 API Gateway listening on ${HOST}:${PORT}`);
  console.log(`📊 Health:           http://localhost:${PORT}/health`);
  console.log(`🔄 Proxy /api/*  →   ${DATA_SERVICE_URL}`);
  console.log(`🤖 Proxy /api/ai/* → ${AI_SERVICE_URL}`);
});

function shutdown(signal: string) {
  console.log(`[gateway] ${signal} received → closing server...`);
  server.close((err?: Error) => {
    if (err) {
      console.error("[gateway] Error during close:", err);
      process.exit(1);
    }
    console.log("[gateway] Closed cleanly.");
    process.exit(0);
  });
  // Force-exit if something hangs (open sockets, etc.)
  setTimeout(() => {
    console.warn("[gateway] Forced shutdown after 10s");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  console.error("[gateway] Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[gateway] Uncaught Exception:", err);
  // In prod you may decide to exit(1); keeping alive here for dev.
  // if (process.env.NODE_ENV === "production") process.exit(1);
});

export default server;
