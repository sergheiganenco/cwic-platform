// backend/api-gateway/src/config/upstreams.ts
import fs from "node:fs";
import { URL } from "node:url";

export interface Upstreams {
  dataService: string;
  aiService: string;
  authService: string;
}

function inDocker(): boolean {
  try {
    if (fs.existsSync("/.dockerenv")) return true;
    if (process.env.KUBERNETES_SERVICE_HOST) return true;
  } catch {}
  return false;
}

function sanitizeBase(u: string): string {
  try {
    const url = new URL(u);
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString().replace(/\/+$/, "");
  } catch {
    return (u || "").replace(/\/+$/, "");
  }
}

function normalizeServiceBase(raw: string | undefined, fallback: string) {
  let url = (raw || fallback).trim().replace(/\/+$/, "");
  if (url.endsWith("/api")) url = url.slice(0, -4);
  return sanitizeBase(url);
}

function maybeLocalize(u: string, local: string): string {
  if (inDocker()) return u;
  try {
    const url = new URL(u);
    const dockerNames = new Set([
      "data-service",
      "ai-service",
      "auth-service",
      "pipeline-service",
      "notification-service",
      "integration-service",
    ]);
    if (dockerNames.has(url.hostname)) {
      return `${url.protocol}//localhost${url.port ? ":" + url.port : ""}`;
    }
    return u;
  } catch {
    return u;
  }
}

export function resolveUpstreams(): Upstreams {
  const dataService = maybeLocalize(
    normalizeServiceBase(process.env.DATA_SERVICE_URL, "http://data-service:3002"),
    "http://localhost:3002"
  );
  const aiService = maybeLocalize(
    normalizeServiceBase(process.env.AI_SERVICE_URL, "http://ai-service:3003"),
    "http://localhost:3003"
  );
  const authService = maybeLocalize(
    normalizeServiceBase(process.env.AUTH_SERVICE_URL, "http://auth-service:8001"),
    "http://localhost:8001"
  );
  return { dataService, aiService, authService };
}
