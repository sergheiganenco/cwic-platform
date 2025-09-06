// src/services/api/dataSources.ts
import type {
  Asset,
  AssetFilters,
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
} from '@/types/dataSources';
import http from "@services/http";

/* -------------------------------- Helpers -------------------------------- */

function normalizeTestResult(raw: any): ConnectionTestResult {
  if (!raw || typeof raw !== 'object') {
    return {
      success: true,
      message: 'Connection OK',
      testedAt: new Date().toISOString(),
    };
  }
  // keep server fields but ensure the basics are present
  return {
    success:
      raw.success ??
      (raw.connectionStatus ? raw.connectionStatus === 'connected' : undefined),
    message: raw.message,
    testedAt: raw.testedAt ?? raw.timestamp ?? new Date().toISOString(),
    responseTimeMs: raw.responseTimeMs ?? raw.latencyMs,
    ...raw,
  };
}

function normalizeSyncResult(raw: any, id: string): SyncResult {
  // Handle 202 with empty body, boolean, etc.
  if (!raw || typeof raw !== 'object') {
    return {
      syncId: `local_${Date.now()}_${id}`,
      status: 'started',
      startedAt: new Date().toISOString(),
      errors: [],
      message: 'Sync started',
    };
  }

  const syncId =
    raw.syncId || raw.id || raw.runId || `local_${Date.now()}_${id}`;

  let status: SyncResult['status'];
  if (raw.status === 'ok' || raw.ok === true) status = 'started';
  else status =
    (raw.status as SyncResult['status']) ??
    (raw.completedAt || raw.completed ? 'completed' : 'started');

  return {
    syncId,
    status,
    startedAt: raw.startedAt ?? raw.started ?? raw.timestamp,
    completedAt: raw.completedAt ?? raw.completed,
    tablesScanned: raw.tablesScanned ?? raw.scanned ?? raw.count ?? 0,
    newTables: raw.newTables ?? 0,
    updatedTables: raw.updatedTables ?? 0,
    errors: raw.errors ?? (raw.error ? [String(raw.error)] : []),
    message: raw.message,
    ...raw, // keep any extra fields the server includes
  };
}

/* ------------------------------ List params ------------------------------- */

export interface ListDataSourcesParams extends DataSourceFilters {
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'type' | 'status' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ListAssetsParams extends AssetFilters {
  page?: number;
  limit?: number;
  dataSourceId?: string;
  sortBy?: 'name' | 'type' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

/* ------------------------------ DataSources API --------------------------- */

export const dataSourcesApi = {
  async list(params: ListDataSourcesParams = {}) {
    const { data } = await http.get<PaginatedDataSources>('/data-sources', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await http.get<DataSource>(`/data-sources/${id}`);
    return data;
  },

  async create(payload: CreateDataSourcePayload) {
    const { data } = await http.post<DataSource>('/data-sources', payload);
    return data;
  },

  async update(id: string, payload: UpdateDataSourcePayload) {
    const { data } = await http.put<DataSource>(`/data-sources/${id}`, payload);
    return data;
  },

  async delete(id: string) {
    await http.delete(`/data-sources/${id}`);
  },

  // Test by id — always return a filled object
  async test(id: string) {
    const res = await http.post<ConnectionTestResult>(`/data-sources/${id}/test`);
    return normalizeTestResult(res.data);
  },

  // Test config before creating
  async testConfig(type: DataSourceType, config: ConnectionConfig) {
    const res = await http.post<ConnectionTestResult>('/data-sources/test', { type, config });
    return normalizeTestResult(res.data);
  },

  // Sync/discover — normalize even if backend returns empty body/202
  async sync(id: string) {
    const res = await http.post<SyncResult>(`/data-sources/${id}/sync`);
    return normalizeSyncResult(res.data, id);
  },

  // Sync status — normalize too
  async getSyncStatus(id: string) {
    const res = await http.get<SyncResult>(`/data-sources/${id}/sync/status`);
    return normalizeSyncResult(res.data, id);
  },

  async updateStatus(id: string, status: DataSource['status'], reason?: string) {
    const { data } = await http.patch<DataSource>(`/data-sources/${id}/status`, { status, reason });
    return data;
  },

  async getMetrics(id?: string) {
    const endpoint = id ? `/data-sources/${id}/metrics` : '/data-sources/metrics';
    const { data } = await http.get<DataSourceMetrics>(endpoint);
    return data;
  },

  async getHealth(id: string) {
    const { data } = await http.get<DataSource['healthStatus']>(`/data-sources/${id}/health`);
    return data;
  },

  async duplicate(id: string, newName: string) {
    const { data } = await http.post<DataSource>(`/data-sources/${id}/duplicate`, { name: newName });
    return data;
  },

  async exportConfig(id: string) {
    const { data } = await http.get(`/data-sources/${id}/export`);
    return data;
  },

  async importConfig(config: any) {
    const { data } = await http.post<DataSource>('/data-sources/import', config);
    return data;
  },

  async getTemplates(type?: DataSourceType) {
    const params = type ? { type } : {};
    const { data } = await http.get('/data-sources/templates', { params });
    return data;
  },

  async validateField(type: DataSourceType, field: string, value: any, config: ConnectionConfig) {
    const { data } = await http.post('/data-sources/validate-field', {
      type, field, value, config,
    });
    return data;
  },
};

/* --------------------------------- Assets --------------------------------- */

export const assetsApi = {
  async list(params: ListAssetsParams = {}) {
    const { data } = await http.get('/assets', { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await http.get<Asset>(`/assets/${id}`);
    return data;
  },

  async getSchema(id: string) {
    const { data } = await http.get(`/assets/${id}/schema`);
    return data;
  },

  async getLineage(id: string) {
    const { data } = await http.get(`/assets/${id}/lineage`);
    return data;
  },

  async getProfile(id: string) {
    const { data } = await http.get(`/assets/${id}/profile`);
    return data;
  },

  async getStats(id: string, period: '7d' | '30d' | '90d' = '30d') {
    const { data } = await http.get(`/assets/${id}/stats`, { params: { period } });
    return data;
  },

  async update(id: string, payload: Partial<Asset>) {
    const { data } = await http.put<Asset>(`/assets/${id}`, payload);
    return data;
  },

  async addTags(id: string, tags: string[]) {
    const { data } = await http.post(`/assets/${id}/tags`, { tags });
    return data;
  },

  async removeTags(id: string, tags: string[]) {
    const { data } = await http.delete(`/assets/${id}/tags`, { data: { tags } });
    return data;
  },

  async search(query: string, filters?: AssetFilters) {
    const { data } = await http.get('/assets/search', { params: { q: query, ...filters } });
    return data;
  },

  async scan(id: string) {
    const { data } = await http.post(`/assets/${id}/scan`);
    return data;
  },

  async updateClassification(id: string, classification: string) {
    const { data } = await http.put(`/assets/${id}/classification`, { classification });
    return data;
  },
};

/* --------------------------------- Health --------------------------------- */

export const healthApi = {
  async getSystemHealth() {
    const { data } = await http.get('/health');
    return data;
  },

  async getDataSourcesHealth() {
    const { data } = await http.get('/health/data-sources');
    return data;
  },

  async testConnectionType(type: DataSourceType, config: ConnectionConfig) {
    const res = await http.post(`/health/${type}`, config);
    return normalizeTestResult(res.data);
  },
};

/* -------------------------------- Utilities ------------------------------- */

export const dataSourceUtils = {
  getTypeDisplayName(type: DataSourceType): string {
    const displayNames: Record<DataSourceType, string> = {
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
    };
    return displayNames[type] || type;
  },

  getStatusColor(status: DataSource['status']): string {
    const colors = { active: 'green', inactive: 'gray', pending: 'yellow', error: 'red', testing: 'blue' };
    return colors[status] || 'gray';
  },

  getStatusText(status: DataSource['status']): string {
    const texts = { active: 'Active', inactive: 'Inactive', pending: 'Pending', error: 'Error', testing: 'Testing' };
    return texts[status] || status;
  },

  supportsFeature(type: DataSourceType, feature: 'sync' | 'assets' | 'streaming' | 'files'): boolean {
    const features: Record<DataSourceType, string[]> = {
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
    };
    return features[type]?.includes(feature) || false;
  },

  maskConfig(config: ConnectionConfig): ConnectionConfig {
    const masked = { ...config };
    const sensitive = ['password', 'apiKey', 'secretAccessKey', 'serviceAccountKey', 'accessToken'];
    for (const k of sensitive) if (k in masked && (masked as any)[k]) (masked as any)[k] = '***masked***';
    return masked;
  },

  formatLastSync(lastSync?: string): string {
    if (!lastSync) return 'Never';
    const date = new Date(lastSync);
    const diffMs = Date.now() - date.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const minutes = Math.floor(diffMs / (1000 * 60));
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  },
};

/* ---------------------- Legacy named exports (compat) --------------------- */

export async function listDataSources(params: ListDataSourcesParams = {}) {
  return dataSourcesApi.list(params);
}
export async function createDataSource(payload: CreateDataSourcePayload) {
  return dataSourcesApi.create(payload);
}
export async function deleteDataSource(id: string) {
  return dataSourcesApi.delete(id);
}
export async function testDataSource(id: string) {
  return dataSourcesApi.test(id);
}
export async function syncDataSource(id: string) {
  return dataSourcesApi.sync(id);
}

export default {
  dataSources: dataSourcesApi,
  assets: assetsApi,
  health: healthApi,
  utils: dataSourceUtils,
};
