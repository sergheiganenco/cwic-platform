export interface EnvironmentConfig {
  apiBaseUrl: string
  isDevelopment: boolean
  isProduction: boolean
  enableMockData: boolean
  enableDebugLogs: boolean
  apiTimeout: number
  cacheTimeout: number
  retryAttempts: number
}

const getEnvironmentConfig = (): EnvironmentConfig => {
  const isDev = import.meta.env.DEV
  const apiBaseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (isDev ? 'http://localhost:8000' : window.location.origin)

  return {
    apiBaseUrl,
    isDevelopment: isDev,
    isProduction: !isDev,
    enableMockData: isDev || import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
    enableDebugLogs: isDev || import.meta.env.VITE_DEBUG_LOGS === 'true',
    apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT || 10000),
    cacheTimeout: Number(import.meta.env.VITE_CACHE_TIMEOUT || 300000),
    retryAttempts: Number(import.meta.env.VITE_RETRY_ATTEMPTS || 3)
  }
}

export const env = getEnvironmentConfig()
