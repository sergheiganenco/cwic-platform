﻿// src/app.ts
import compression from "compression";
import cors from "cors";
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { randomUUID } from "node:crypto";

import { resolveUpstreams } from "./config/upstreams.js";
import { normalizeDataSourceBody } from "./middleware/normalizeDataSourceBody.js";
import aiServiceProxy from "./proxy/aiServiceProxy.js";
import authServiceProxy from "./proxy/authServiceProxy.js";
import dataServiceProxy from "./proxy/dataServiceProxy.js";

const app = express();

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";
const isDev = !isProd;
const bodyLimit = process.env.BODY_LIMIT || "1mb";
const DEV_BEARER = process.env.DEV_BEARER ?? "";

/** Parse comma-separated CORS origins from env */
function parseOrigins(val?: string): string[] {
  if (!val) return [];
  return val.split(",").map((s) => s.trim()).filter(Boolean);
}

// Allow explicit env origins; in dev, default to localhost ports if none provided
const origins = parseOrigins(
  process.env.CORS_ORIGIN ||
    (isDev ? "http://localhost:3000,http://localhost:5173,http://localhost:4173" : "")
);
/** If no origins provided or '*' present, reflect any origin */
const allowAll = origins.length === 0 || origins.includes("*");

// ────────────────────────── App hardening & basics ──────────────────────────
app.disable("x-powered-by");
app.set("trust proxy", process.env.TRUST_PROXY ?? (isProd ? "1" : "true"));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: isProd ? undefined : false,
  })
);

// ──────────────────────── BULLETPROOF CORS PRE-FLIGHT ───────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "OPTIONS") return next();

  const origin = (req.headers.origin as string) || "";
  const isAllowedOrigin = allowAll || origins.includes(origin);
  if (!isAllowedOrigin) return next();

  // Reflect origin (credentials-compatible)
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Reflect requested methods/headers so *any* custom headers are accepted
  const reqMethods =
    (req.headers["access-control-request-method"] as string) ||
    "GET,POST,PUT,PATCH,DELETE,OPTIONS";
  const reqHeaders =
    (req.headers["access-control-request-headers"] as string) ||
    "authorization,content-type";

  res.setHeader("Access-Control-Allow-Methods", reqMethods);
  res.setHeader("Access-Control-Allow-Headers", reqHeaders);
  res.setHeader("Access-Control-Max-Age", "86400"); // 24h

  return res.status(204).end();
});

// Standard CORS for non-OPTIONS requests
const corsOptions: cors.CorsOptions = {
  origin: allowAll ? true : origins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  exposedHeaders: ["X-Request-Id"],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};
app.use(cors(corsOptions));

// ─────────────────────────── Rate limit (prod only) ─────────────────────────
const limiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === "OPTIONS" || !isProd,
}) as unknown as express.RequestHandler;
app.use(limiter);

// ─────────────────────────── Parsers & logging ──────────────────────────────
app.use(compression());
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.use(morgan(isDev ? "dev" : "combined"));

// Request ID (echo/propagate downstream)
app.use((req: Request, res: Response, next: NextFunction) => {
  const rid = (req.headers["x-request-id"] as string) || randomUUID();
  req.headers["x-request-id"] = rid;
  res.setHeader("X-Request-Id", rid);
  next();
});

// ───────────────────────────── Health & debug ───────────────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, service: "api-gateway", env: NODE_ENV }));
app.get("/ready", (_req, res) => res.json({ ready: true }));
app.get("/upstreams", (_req, res) => res.json({ env: NODE_ENV, upstreams: resolveUpstreams() }));

// ─────────────────────────── Dev stubs (must be early) ──────────────────────
if (isDev) {
  // Token refresh helper for local dev
  app.post("/api/auth/refresh", (_req, res) => {
    if (!DEV_BEARER) return res.status(500).json({ error: "DEV_BEARER not set" });
    const raw = DEV_BEARER.startsWith("Bearer ") ? DEV_BEARER.slice(7) : DEV_BEARER;
    return res.json({ token: raw });
  });

  // Local AI health stub so the UI has something to ping
  app.get("/api/ai/health", (_req, res) => {
    res.json({ status: "ok", stub: true });
  });

  // Frontend expectations (permissions/current user)
  app.get(["/api/auth/me", "/auth/me"], (_req, res) => {
    res.json({
      id: "dev-user-1",
      email: "dev@example.com",
      name: "Dev User",
      roles: ["admin"],
      permissions: [
        "datasources:read",
        "datasources:write",
        "catalog:read",
        "requests:read",
      ],
    });
  });

  app.get(["/api/user/permissions", "/user/permissions"], (_req, res) => {
    res.json({
      success: true,
      data: [
        "datasources:read",
        "datasources:write",
        "catalog:read",
        "requests:read",
      ],
      timestamp: new Date().toISOString(),
    });
  });
}

// In dev, if no Authorization header, attach DEV_BEARER (do not overwrite a real one)
if (isDev) {
  app.use(["/api", "/api/ai", "/api/auth"], (req, _res, next) => {
    if (!req.headers.authorization && DEV_BEARER) {
      req.headers.authorization = DEV_BEARER.startsWith("Bearer ")
        ? DEV_BEARER
        : `Bearer ${DEV_BEARER}`;
    }
    next();
  });
}

app.use(
  [
    "/api/data-sources/test",
    "/api/data-sources/databases/preview",
    "/api/data-sources",               // create/update routes from the UI
  ],
  express.json({ limit: bodyLimit }),  // ensure JSON parser runs here too
  normalizeDataSourceBody
);

// Proxies (order matters)
app.use("/api/ai",   aiServiceProxy);
app.use("/api/auth", authServiceProxy);
app.use("/api",      dataServiceProxy);


// ──────────────────────────────── Proxies ───────────────────────────────────
// NOTE: Our data proxy STRIPS the '^/api' prefix, so the upstream sees bare routes.
// The data-service also mounts '/api/*' internally for flexibility, but the gateway
// forwards '/api/*' and removes the prefix at the proxy layer. Order matters: specific first.
app.use("/api/ai",   aiServiceProxy);     // rewrites ^/api/ai → /api on upstream
app.use("/api/auth", authServiceProxy);   // rewrites ^/api/auth → /auth on upstream (health → /health)
app.use("/api",      dataServiceProxy);   // strips '^/api' so upstream sees '/data-sources', etc.

// ───────────────────────────── 404 + error handling ─────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "NOT_FOUND",
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized JSON error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const code = err.code || "INTERNAL_SERVER_ERROR";
  const publicMessage = isProd ? err.publicMessage || "Internal server error" : err.message || "Internal server error";

  if (!res.headersSent) {
    res.status(status).json({
      success: false,
      error: { code, message: publicMessage },
    });
  }
});

export default app;
