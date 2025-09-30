// src/server.ts
import http from "node:http";
import process from "node:process";
import app from "./app.js";

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || "0.0.0.0";

const server = http.createServer(app);
server.keepAliveTimeout = 75_000;
server.headersTimeout = 90_000;

const log = (...a: unknown[]) => console.log("[api-gateway]", ...a);
const err = (...a: unknown[]) => console.error("[api-gateway]", ...a);

server
  .listen(PORT, HOST, () => {
    log(`listening on http://${HOST}:${PORT}`);
  })
  .on("error", (e: NodeJS.ErrnoException) => {
    if (e.code === "EADDRINUSE") err(`port ${PORT} already in use`);
    else if (e.code === "EACCES") err(`no permission to bind ${HOST}:${PORT}`);
    else err("server error:", e);
    setTimeout(() => process.exit(1), 1000);
  });

process.on("uncaughtException", (e) => err("uncaughtException:", e));
process.on("unhandledRejection", (r) => err("unhandledRejection:", r as any));

const shutdown = (signal: NodeJS.Signals) => {
  log(`${signal} received → closing server...`);
  server.close((closeErr) => {
    if (closeErr) err("error during close:", closeErr);
    process.exit(0);
  });
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
