// src/services/api/dataSources.ts
import http from '@/services/http'
import type {
  Asset,
  ConnectionConfig,
  ConnectionTestResult,
  CreateDataSourcePayload,
  DataSource,
  DataSourceFilters,
  DataSourceMetrics,
  DataSourceType,
  PaginatedDataSources,
  SyncResult,
  UpdateDataSourcePayload,
} from '@/types/dataSources'

/**
 * NOTE ON TYPES:
 * Your '@/types/dataSources' union is broad and some backends vary in shape.
 * This service normalizes responses defensively and only casts at the boundary.
 */

/* -------------------------------- Helpers -------------------------------- */

function toIso(v?: string | number | Date): string | undefined {
  if (!v) return undefined
  try {
    const d = typeof v === 'string' || typeof v === 'number' ? new Date(v) : v
    const t = (d as Date).getTime?.() ?? NaN
    return Number.isNaN(t) ? undefined : new Date(d as Date).toISOString()
  } catch {
    return undefined
  }
}

function boolish(v: any): boolean | undefined {
  if (v === true || v === false) return v
  if (v == null) return undefined
  if (typeof v === 'string') {
    const s = v.toLowerCase()
    if (s === 'true') return true
    if (s === 'false') return false
  }
  return undefined
}

function normalizeTestResult(raw: any): ConnectionTestResult {
  // Build a permissive shape first, then cast at the boundary.
  const out: any = {}

  if (!raw || typeof raw !== 'object') {
    out.success = false
    out.message = 'Invalid test result'
    out.testedAt = new Date().toISOString()
    return out as ConnectionTestResult
  }

  // Backend wraps test result in { success: true, data: { actual result } }
  // Unwrap if present
  const actual = raw.data && typeof raw.data === 'object' ? raw.data : raw

  const successFromStatus =
    typeof actual.status === 'string'
      ? ['ok', 'success', 'connected', 'passed'].includes(actual.status.toLowerCase())
      : undefined
  const successFromConn =
    typeof actual.connectionStatus === 'string'
      ? actual.connectionStatus.toLowerCase() === 'connected'
      : undefined

  out.success = boolish(actual.success) ?? successFromConn ?? successFromStatus ?? false
  out.message =
    actual.message ||
    actual.detail ||
    actual.error ||
    actual.reason ||
    (out.success ? 'Connection OK' : 'Connection test failed')

  out.testedAt =
    toIso(actual.testedAt) ??
    toIso(actual.timestamp) ??
    toIso(actual.checkedAt) ??
    new Date().toISOString()

  out.responseTimeMs =
    typeof actual.responseTimeMs === 'number'
      ? actual.responseTimeMs
      : typeof actual.responseTime === 'number'
      ? actual.responseTime
      : typeof actual.latencyMs === 'number'
      ? actual.latencyMs
      : undefined

  // Keep server extras (connectionStatus, metadata, etc.)
  Object.assign(out, actual)

  return out as ConnectionTestResult
}

function normalizeSyncResult(raw: any, id: string): SyncResult {
  // Build untyped, then cast once.
  const out: any = {}

  if (!raw || typeof raw !== 'object') {
    out.syncId = `local_${Date.now()}_${id}`
    out.status = 'started' // tolerant internal value; backend may use different literals
    out.startedAt = new Date().toISOString()
    out.errors = []
    out.message = 'Sync started'
    return out as SyncResult
  }

  out.syncId = raw.syncId || raw.id || raw.runId || `local_${Date.now()}_${id}`
  // Derive a tolerant status then cast once
  out.status =
    raw.status ??
    (raw.completedAt || raw.completed ? 'completed' : 'started')

  out.startedAt = toIso(raw.startedAt) ?? toIso(raw.started) ?? toIso(raw.timestamp)
  out.completedAt = toIso(raw.completedAt) ?? toIso(raw.completed)
  out.tablesScanned = Number(raw.tablesScanned ?? raw.scanned ?? raw.count ?? 0)
  out.newTables = Number(raw.newTables ?? 0)
  out.updatedTables = Number(raw.updatedTables ?? 0)
  out.errors = Array.isArray(raw.errors) ? raw.errors : raw.error ? [String(raw.error)] : []
  out.message = raw.message ?? undefined

  // keep server extras
  Object.assign(out, raw)

  return out as SyncResult
}

/* ------------------------------ List params ------------------------------- */

export interface ListDataSourcesParams extends DataSourceFilters {
  page?: number
  limit?: number
  sortBy?: 'name' | 'type' | 'status' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

/**
 * Local, safe filter type for Assets because AssetFilters is not exported from your types.
 * We accept a generic record here and let the backend ignore unknowns.
 */
export type AssetFiltersInput = Record<string, string | number | boolean | undefined> & {
  tag?: string
  type?: string
  owner?: string
  updatedAfter?: string
}

export interface ListAssetsParams extends AssetFiltersInput {
  page?: number
  limit?: number
  dataSourceId?: string
  sortBy?: 'name' | 'type' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
}

/* --------------------------------- API ------------------------------------ */

export const dataSourcesApi = {
  async list(params: ListDataSourcesParams = {}) {
    const { data } = await http.get<PaginatedDataSources>('/data-sources', { params })
    return data
  },

  async getById(id: string) {
    const { data } = await http.get<DataSource>(`/data-sources/${id}`)
    return data
  },

  async create(payload: CreateDataSourcePayload) {
    const { data } = await http.post<DataSource>('/data-sources', payload)
    return data
  },

  async update(id: string, payload: UpdateDataSourcePayload) {
    const { data } = await http.put<DataSource>(`/data-sources/${id}`, payload)
    return data
  },

  async delete(id: string) {
    await http.delete(`/data-sources/${id}`)
  },

  async test(id: string) {
    const res = await http.post<ConnectionTestResult>(`/data-sources/${id}/test`)
    return normalizeTestResult(res.data)
  },

  /**
   * Pre-create test endpoint for the wizard.
   * Azure gateway & data-service accept: { type, config }
   * Also include `connectionConfig` for backward compatibility.
   */
  async testConfig(
    type: DataSourceType,
    connectionConfig: ConnectionConfig,
    signal?: AbortSignal
  ) {
    // Some gateways expose /data-sources/test, others /connections/test,
    // some legacy UIs used /data-sources/test-connection. Try them in order.
    const body = { type, config: connectionConfig, connectionConfig }

    const candidates = [
      { method: 'post' as const, url: '/data-sources/test' },
      { method: 'post' as const, url: '/connections/test' },
      { method: 'post' as const, url: '/data-sources/test-connection' },
    ]

    let lastErr: unknown
    for (const c of candidates) {
      try {
        const res = await http[c.method]<ConnectionTestResult>(c.url, body, { signal })
        return normalizeTestResult(res.data)
      } catch (e: any) {
        // try next only on 404/405; otherwise rethrow
        const status = e?.response?.status ?? e?.status
        if (status !== 404 && status !== 405) throw e
        lastErr = e
      }
    }
    // if all failed, surface the last error
    throw lastErr ?? new Error('No test endpoint available')
  },

  /**
   * Preview/discover databases (server-scope connectors).
   * Tries multiple endpoints for compatibility.
   */
  async previewDatabases(
    type: DataSourceType,
    connectionConfig: ConnectionConfig,
    signal?: AbortSignal
  ) {
    const body = { type, config: connectionConfig, connectionConfig }

    const candidates = [
      { method: 'post' as const, url: '/data-sources/databases/preview' },
      { method: 'post' as const, url: '/connections/discover' },
      { method: 'post' as const, url: '/data-sources/discover' },
    ]

    let lastErr: unknown
    for (const c of candidates) {
      try {
        const { data } = await http[c.method]<{ databases?: any[]; metadata?: any }>(
          c.url,
          body,
          { signal }
        )
        return {
          databases: Array.isArray(data?.databases) ? data.databases : [],
          metadata: data?.metadata,
        }
      } catch (e: any) {
        const status = e?.response?.status ?? e?.status
        if (status !== 404 && status !== 405) throw e
        lastErr = e
      }
    }
    // graceful fallback
    return { databases: [], metadata: undefined }
  },

  async sync(id: string, database?: string) {
    // Some deployments return an envelope { success, data }, and some expose
    // the endpoint under different route groups. Try primary + fallbacks and
    // always unwrap the payload before normalizing. If the primary returns 5xx,
    // attempt an alternate discovery endpoint.
    const encoded = encodeURIComponent(id)
    const tryNormalize = (res: any) => normalizeSyncResult((res as any)?.data?.data ?? (res as any)?.data, id)
    const params = database ? { database } : undefined

    // 1) Primary - try API gateway first, fallback on any error
    try {
      const res = await http.post<any>(`/data-sources/${encoded}/sync`, null, { params })
      return tryNormalize(res)
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status
      console.log('[SYNC] Attempt #1 failed with status:', status, 'error:', e, '- trying fallback #2')
      // If status is undefined or in fallback list, continue to next attempt
      // Status can be undefined when http interceptor re-throws as new Error()
      if (status !== undefined && ![400, 404, 405, 500, 502, 503, 504].includes(Number(status))) throw e
    }

    // 2) Discover (older API): /sources/:id/discover
    try {
      const res = await http.post<any>(`/sources/${encoded}/discover`, null, { params })
      return tryNormalize(res)
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status
      console.log('[SYNC] Attempt #2 failed with status:', status, '- trying fallback #3')
      // Allow undefined status to continue to fallback
      if (status !== undefined && ![400, 404, 405, 500, 502, 503, 504].includes(Number(status))) throw e
    }

    // 3) Try data-service directly (port 3002)
    try {
      const res = await http.post<any>(`/data-sources/${encoded}/sync`, null, { baseURL: 'http://localhost:3002', params })
      return tryNormalize(res)
    } catch (e: any) {
      const status = e?.response?.status ?? e?.status
      if (status && ![400, 404, 405, 500, 502, 503, 504].includes(Number(status))) throw e
    }

    // 4) Async hint on data-service
    const res = await http.post<any>(`/data-sources/${encoded}/sync`, null, { params: { async: 'true', ...params }, baseURL: 'http://localhost:3002' })
    return tryNormalize(res)
  },

  async getSyncStatus(id: string) {
    const encoded = encodeURIComponent(id)
    const candidates = [
      { method: 'get' as const, url: `/data-sources/${encoded}/sync/status` },
      { method: 'get' as const, url: `/catalog/data-sources/${encoded}/sync/status` },
      { method: 'get' as const, url: `/connections/${encoded}/sync/status` },
    ]

    let lastErr: unknown
    for (const c of candidates) {
      try {
        const res = await http[c.method]<any>(c.url)
        const raw = (res as any)?.data?.data ?? (res as any)?.data
        return normalizeSyncResult(raw, id)
      } catch (e: any) {
        const status = e?.response?.status ?? e?.status
        if (status && status !== 404 && status !== 405) throw e
        lastErr = e
      }
    }

    // Try root path without /api base
    const rootBase = (http.defaults.baseURL || '').replace(/\/?api\/?$/, '') || undefined
    const res = await http.get<any>(`/data-sources/${encodeURIComponent(id)}/sync/status`, { baseURL: rootBase })
    const raw = (res as any)?.data?.data ?? (res as any)?.data
    return normalizeSyncResult(raw, id)
  },

  async updateStatus(id: string, status: DataSource['status'], reason?: string) {
    const { data } = await http.patch<DataSource>(`/data-sources/${id}/status`, { status, reason })
    return data
  },

  async getMetrics(id?: string) {
    const endpoint = id ? `/data-sources/${id}/metrics` : '/data-sources/metrics'
    const { data } = await http.get<DataSourceMetrics>(endpoint)
    return data
  },

  async getHealth(id: string) {
    const { data } = await http.get<DataSource['healthStatus']>(`/data-sources/${id}/health`)
    return data
  },

  async duplicate(id: string, newName: string) {
    const { data } = await http.post<DataSource>(`/data-sources/${id}/duplicate`, { name: newName })
    return data
  },

  async exportConfig(id: string) {
    const { data } = await http.get(`/data-sources/${id}/export`)
    return data
  },

  async importConfig(config: any) {
    const { data } = await http.post<DataSource>('/data-sources/import', config)
    return data
  },

  async getTemplates(type?: DataSourceType) {
    const params = type ? { type } : {}
    const { data } = await http.get('/data-sources/templates', { params })
    return data
  },

  async validateField(type: DataSourceType, field: string, value: any, config: ConnectionConfig) {
    const { data } = await http.post('/data-sources/validate-field', {
      type,
      field,
      value,
      config,
    })
    return data
  },

  /** Accepts: string[], { name: string }[], or { databases: [...] } */
  async listDatabases(id: string) {
    const { data: response } = await http.get(`/data-sources/${encodeURIComponent(id)}/databases`)
    // Backend returns { success: true, data: [...] }, so extract the data array
    const data = (response as any)?.data ?? response

    if (Array.isArray(data)) {
      if (data.length === 0) return [] as Array<{ name: string }>
      if (typeof data[0] === 'string') return (data as string[]).map((name) => ({ name }))
      if (typeof data[0] === 'object' && data[0] && 'name' in data[0]) return data as Array<{ name: string }>
    }
    if (data && Array.isArray((data as any).databases)) {
      const dbs = (data as any).databases
      if (dbs.length === 0) return []
      if (typeof dbs[0] === 'string') return (dbs as string[]).map((name) => ({ name }))
      if (typeof dbs[0] === 'object' && dbs[0] && 'name' in dbs[0]) return dbs
    }
    return []
  },
}

/* --------------------------------- Assets --------------------------------- */

export const assetsApi = {
  async list(params: ListAssetsParams = {}) {
    const { data } = await http.get('/assets', { params })
    return data
  },
  async getById(id: string) {
    const { data } = await http.get<Asset>(`/assets/${id}`)
    return data
  },
  async getSchema(id: string) {
    const { data } = await http.get(`/assets/${id}/schema`)
    return data
  },
  async getLineage(id: string) {
    const { data } = await http.get(`/assets/${id}/lineage`)
    return data
  },
  async getProfile(id: string) {
    const { data } = await http.get(`/assets/${id}/profile`)
    return data
  },
  async getStats(id: string, period: '7d' | '30d' | '90d' = '30d') {
    const { data } = await http.get(`/assets/${id}/stats`, { params: { period } })
    return data
  },
  async update(id: string, payload: Partial<Asset>) {
    const { data } = await http.put<Asset>(`/assets/${id}`, payload)
    return data
  },
  async addTags(id: string, tags: string[]) {
    const { data } = await http.post(`/assets/${id}/tags`, { tags })
    return data
  },
  async removeTags(id: string, tags: string[]) {
    const { data } = await http.delete(`/assets/${id}/tags`, { data: { tags } })
    return data
  },
  async search(query: string, filters?: AssetFiltersInput) {
    const { data } = await http.get('/assets/search', { params: { q: query, ...filters } })
    return data
  },
  async scan(id: string) {
    const { data } = await http.post(`/assets/${id}/scan`)
    return data
  },
  async updateClassification(id: string, classification: string) {
    const { data } = await http.put(`/assets/${id}/classification`, { classification })
    return data
  },
}

/* --------------------------------- Health --------------------------------- */

export const healthApi = {
  async getSystemHealth() {
    const { data } = await http.get('/health')
    return data
  },
  async getDataSourcesHealth() {
    const { data } = await http.get('/health/data-sources')
    return data
  },
  /**
   * Lightweight connection check per type (dashboard convenience).
   * If your health service expects { type, config }, adapt here.
   */
  async testConnectionType(type: DataSourceType, config: ConnectionConfig) {
    // If your gateway expects body { type, config }, you can switch to:
    // return normalizeTestResult((await http.post(`/health/${type}`, { type, config })).data)
    const res = await http.post(`/health/${type}`, config)
    return normalizeTestResult(res.data)
  },
}

/* -------------------------------- Utilities ------------------------------- */

export const dataSourceUtils = {
  getTypeDisplayName(type: DataSourceType): string {
    const displayNames: Partial<Record<DataSourceType, string>> = {
      postgresql: 'PostgreSQL',
      mysql: 'MySQL',
      mssql: 'SQL Server',
      mongodb: 'MongoDB',
      redis: 'Redis',
      snowflake: 'Snowflake',
      bigquery: 'BigQuery',
      redshift: 'Amazon Redshift',
      databricks: 'Databricks',
      s3: 'Amazon S3',
      'azure-blob': 'Azure Blob Storage',
      gcs: 'Google Cloud Storage',
      kafka: 'Apache Kafka',
      api: 'REST API',
      file: 'File System',
      ftp: 'FTP/SFTP',
      elasticsearch: 'Elasticsearch',
      oracle: 'Oracle Database',
    }
    return displayNames[type] || String(type)
  },

  getStatusColor(status: DataSource['status']): string {
    const colors: Record<string, string> = {
      active: 'green',
      inactive: 'gray',
      pending: 'yellow',
      error: 'red',
      testing: 'blue',
    }
    return colors[status] || 'gray'
  },

  getStatusText(status: DataSource['status']): string {
    const texts: Record<string, string> = {
      active: 'Active',
      inactive: 'Inactive',
      pending: 'Pending',
      error: 'Error',
      testing: 'Testing',
    }
    return texts[status] || String(status)
  },

  supportsFeature(type: DataSourceType, feature: 'sync' | 'assets' | 'streaming' | 'files'): boolean {
    // Partial record, tolerant to broader DataSourceType unions
    const features: Partial<Record<DataSourceType, string[]>> = {
      postgresql: ['sync', 'assets'],
      mysql: ['sync', 'assets'],
      mssql: ['sync', 'assets'],
      mongodb: ['sync', 'assets'],
      redis: ['sync'],
      snowflake: ['sync', 'assets'],
      bigquery: ['sync', 'assets'],
      redshift: ['sync', 'assets'],
      databricks: ['sync', 'assets'],
      s3: ['files'],
      'azure-blob': ['files'],
      gcs: ['files'],
      kafka: ['streaming'],
      api: [],
      file: ['files'],
      ftp: ['files'],
      elasticsearch: ['sync', 'assets'],
      oracle: ['sync', 'assets'],
    }
    return !!features[type]?.includes(feature)
  },

  maskConfig(config: ConnectionConfig): ConnectionConfig {
    const masked: any = { ...config }
    const sensitive = ['password', 'apiKey', 'secretAccessKey', 'serviceAccountKey', 'accessToken', 'bearerToken']
    for (const k of sensitive) if (k in masked && masked[k]) masked[k] = '***masked***'
    return masked as ConnectionConfig
  },

  formatLastSync(lastSync?: string): string {
    if (!lastSync) return 'Never'
    const date = new Date(lastSync)
    const diffMs = Date.now() - date.getTime()
    const hours = Math.floor(diffMs / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`
    const minutes = Math.floor(diffMs / (1000 * 60))
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`
  },
}

/* ---------------------- Named exports (compat) --------------------- */

export async function listDataSources(params: ListDataSourcesParams = {}) {
  return dataSourcesApi.list(params)
}
export async function getDataSource(id: string) {
  return dataSourcesApi.getById(id)
}
export async function createDataSource(payload: CreateDataSourcePayload) {
  return dataSourcesApi.create(payload)
}
export async function updateDataSource(id: string, payload: UpdateDataSourcePayload) {
  return dataSourcesApi.update(id, payload)
}
export async function deleteDataSource(id: string) {
  return dataSourcesApi.delete(id)
}
export async function testDataSource(id: string) {
  return dataSourcesApi.test(id)
}
export async function syncDataSource(id: string, database?: string) {
  return dataSourcesApi.sync(id, database)
}
export async function listDataSourceDatabases(id: string) {
  return dataSourcesApi.listDatabases(id)
}

/** Optional helpers used by your wizard */
export async function testDataSourceConfig(type: DataSourceType, config: ConnectionConfig, signal?: AbortSignal) {
  return dataSourcesApi.testConfig(type, config, signal)
}
export async function previewDataSourceDatabases(type: DataSourceType, config: ConnectionConfig, signal?: AbortSignal) {
  return dataSourcesApi.previewDatabases(type, config, signal)
}

export default {
  dataSources: dataSourcesApi,
  assets: assetsApi,
  health: healthApi,
  utils: dataSourceUtils,
}
