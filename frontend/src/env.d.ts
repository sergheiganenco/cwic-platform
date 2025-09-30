/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE: string;
  readonly VITE_AI_SERVICE_URL: string;
  readonly VITE_USE_MOCKS: string;
  readonly VITE_DEBUG_HTTP: string;
  readonly VITE_DEBUG_AI_SERVICE: string;
  readonly VITE_DEV_BEARER: string;
  readonly VITE_WS_ENABLED: string;
  readonly VITE_APP_VERSION: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}