// src/config/upstreams.ts
type Upstreams = {
  dataService: string;
  authService: string;
  aiService: string;
  pipelineService: string;
};

function envOr(def: string, ...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (v && v.trim()) return v.trim();
  }
  return def;
}

/** Resolve service URLs. In Docker, service names are resolvable on the bridge network. */
export function resolveUpstreams(): Upstreams {
  const isDev = (process.env.NODE_ENV || "development") !== "production";

  return {
    dataService: envOr(
      isDev ? "http://data-service:3002" : "http://data-service:3002",
      "DATA_SERVICE_URL"
    ),
    authService: envOr(
      isDev ? "http://auth-service:3001" : "http://auth-service:8001",
      "AUTH_SERVICE_URL"
    ),
    aiService: envOr(
      isDev ? "http://ai-service:3003" : "http://ai-service:3003",
      "AI_SERVICE_URL"
    ),
    pipelineService: envOr(
      isDev ? "http://pipeline-service:3004" : "http://pipeline-service:3004",
      "PIPELINE_SERVICE_URL"
    )
  };
}
