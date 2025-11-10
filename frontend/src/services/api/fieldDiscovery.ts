import axios, { AxiosInstance } from 'axios';
import { http } from '@/services/http';

// Types
export interface DiscoveredField {
  id: string;
  assetId: number;
  dataSourceId: number;
  schemaName: string;
  tableName: string;
  columnName: string;
  dataType: string;
  classification: string;
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected' | 'needs-review';
  tags: string[];
  description?: string;
  sampleValues?: string[];
  patterns?: string[];
  discoveredAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  metadata?: Record<string, any>;
}

export interface FieldDiscoveryStats {
  totalFields: number;
  byStatus: Record<string, number>;
  byClassification: Record<string, number>;
  bySensitivity: Record<string, number>;
  averageConfidence: number;
  recentDiscoveries: number;
}

export interface DriftAlert {
  id: string;
  assetId: number;
  fieldName: string;
  alertType: 'new_field' | 'removed_field' | 'type_change' | 'classification_change';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detectedAt: string;
  oldValue?: any;
  newValue?: any;
}

export interface DiscoverFieldsRequest {
  dataSourceId: number | string;
  schemas?: string[];
  tables?: string[];
  forceRefresh?: boolean;
}

export interface DiscoverFieldsResponse {
  jobId: string;
  status: 'completed' | 'running' | 'failed';
  fieldsDiscovered: number;
  fields: DiscoveredField[];
}

export interface GetFieldsFilter {
  status?: string;
  classification?: string;
  sensitivity?: string;
  search?: string;
  dataSourceId?: string;
  database?: string;
  table?: string;
  limit?: number;
  offset?: number;
}

export interface GetFieldsResponse {
  fields: DiscoveredField[];
  total: number;
  limit: number;
  offset: number;
}

export interface UpdateFieldStatusRequest {
  status: 'accepted' | 'rejected' | 'needs-review' | 'pending';
}

export interface ClassifyFieldRequest {
  classification: string;
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  tags?: string[];
  description?: string;
}

export interface BulkActionRequest {
  fieldIds: string[];
  action: 'accept' | 'reject' | 'classify' | 'tag';
  value?: any;
}

export interface BulkActionResponse {
  processed: number;
  action: string;
  value?: any;
  performedBy: string;
  performedAt: string;
}

/**
 * Field Discovery API Client
 * Handles all API calls related to field discovery functionality
 */
export class FieldDiscoveryAPI {
  private readonly api: AxiosInstance;
  private readonly basePath = '/field-discovery';

  constructor() {
    // Create axios instance for AI service on port 3003
    this.api = axios.create({
      baseURL: 'http://localhost:3003/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token interceptor
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // -------------------- Normalizers (server -> client) --------------------
  private mapSensitivityToClient(s: string | undefined): DiscoveredField['sensitivity'] {
    const v = (s || '').toLowerCase();
    // server: Low | Medium | High | Critical
    if (v === 'low') return 'public';
    if (v === 'medium') return 'internal';
    if (v === 'high') return 'confidential';
    if (v === 'critical') return 'restricted';
    // already in client terms?
    if (v === 'public' || v === 'internal' || v === 'confidential' || v === 'restricted') {
      return v as DiscoveredField['sensitivity'];
    }
    return 'internal';
  }

  private mapField(server: any): DiscoveredField {
    // Accept both backend DiscoveredField and asset-like records
    const id = String(server.id ?? `${server.assetId ?? 'asset'}-${server.fieldName ?? server.columnName ?? 'field'}`);
    const assetId = Number(server.assetId ?? server.tableId ?? server.asset_id ?? 0);
    const dsId = Number(server.dataSourceId ?? server.data_source_id ?? 0);
    const schemaName = String(server.schemaName ?? server.schema ?? server.schema_name ?? 'public');
    const tableName = String(server.tableName ?? server.table_name ?? server.assetName?.split('.')?.[1] ?? 'unknown');
    const columnName = String(server.columnName ?? server.fieldName ?? server.name ?? 'unknown');
    const dataType = String(server.dataType ?? server.type ?? 'unknown');
    const classification = String(server.classification ?? 'General');
    const sensitivity = this.mapSensitivityToClient(String(server.sensitivity ?? 'Medium'));
    const confidence = Number(server.confidence ?? 0.8);
    const status = (server.status ?? server.reviewStatus ?? 'pending') as DiscoveredField['status'];
    const tags = Array.isArray(server.tags) ? server.tags : Array.isArray(server.suggestedTags) ? server.suggestedTags : [];
    const description = server.description ?? undefined;
    const discoveredAt = new Date(server.detectedAt ?? server.createdAt ?? Date.now()).toISOString();
    const reviewedBy = server.reviewedBy ?? undefined;
    const reviewedAt = server.reviewedAt ? new Date(server.reviewedAt).toISOString() : undefined;
    const metadata = server.metadata ?? {};

    return {
      id,
      assetId,
      dataSourceId: dsId,
      schemaName,
      tableName,
      columnName,
      dataType,
      classification,
      sensitivity,
      confidence,
      status,
      tags,
      description,
      sampleValues: Array.isArray(server.sampleValues) ? server.sampleValues : undefined,
      patterns: Array.isArray(server.dataPatterns) ? server.dataPatterns : Array.isArray(server.patterns) ? server.patterns : undefined,
      discoveredAt,
      reviewedBy,
      reviewedAt,
      metadata,
    };
  }

  private mapStats(server: any): FieldDiscoveryStats {
    // Support both legacy and new shapes
    if (server && server.byStatus && server.byClassification) {
      // Assume already in client shape but maybe sensitivity is server-style
      const bySensitivity = server.bySensitivity ?? {};
      const mappedSensitivity: Record<string, number> = { public: 0, internal: 0, confidential: 0, restricted: 0 };
      for (const [k, v] of Object.entries(bySensitivity)) {
        const m = this.mapSensitivityToClient(k).toString();
        mappedSensitivity[m] = (mappedSensitivity[m] ?? 0) + Number(v ?? 0);
      }
      return {
        totalFields: Number(server.totalFields ?? 0),
        byStatus: server.byStatus ?? {},
        byClassification: server.byClassification ?? {},
        bySensitivity: mappedSensitivity,
        averageConfidence: Number(server.averageConfidence ?? 0),
        recentDiscoveries: Number(server.recentDiscoveries ?? 0),
      };
    }

    // Legacy server stats -> derive a minimal client-compatible object
    const totalFields = Number(server?.totalFields ?? 0);
    const sensitive = Number(server?.sensitiveFields ?? 0);
    const classified = Number(server?.classifiedFields ?? 0);

    return {
      totalFields,
      byStatus: { pending: Math.max(0, totalFields - classified) },
      byClassification: { Sensitive: sensitive, General: Math.max(0, totalFields - sensitive) },
      bySensitivity: { public: 0, internal: 0, confidential: sensitive, restricted: 0 },
      averageConfidence: 0.8,
      recentDiscoveries: Number(server?.newFieldsThisWeek ?? 0),
    };
  }

  private mapAlert(server: any) {
    const id = String(server.id ?? `${server.assetId ?? 'asset'}-${server.fieldName ?? 'field'}`);
    const assetId = Number(server.assetId ?? 0);
    const fieldName = String(server.fieldName ?? server.name ?? 'unknown');
    const alertType = (server.alertType ?? server.issueType ?? 'type_change') as 'new_field' | 'removed_field' | 'type_change' | 'classification_change';
    const severity = (server.severity ?? 'low') as 'low' | 'medium' | 'high' | 'critical';
    const description = String(server.description ?? server.issue ?? '');
    const detectedAt = new Date(server.detectedAt ?? server.firstSeen ?? Date.now()).toISOString();
    const oldValue = server.oldValue ?? undefined;
    const newValue = server.newValue ?? undefined;
    return { id, assetId, fieldName, alertType, severity, description, detectedAt, oldValue, newValue };
  }

  /**
   * Trigger field discovery for a data source
   * POST /api/ai/field-discovery/discover
   */
  async discoverFields(request: DiscoverFieldsRequest): Promise<DiscoverFieldsResponse> {
    console.log('Sending discovery request:', request);
    const response = await this.api.post(`${this.basePath}/discover`, request);
    console.log('Discovery API response:', response.data);
    const data = response.data.data ?? response.data;
    const fields = Array.isArray(data?.fields) ? data.fields.map((f: any) => this.mapField(f)) : [];
    return {
      jobId: String(data?.jobId ?? `job_${Date.now()}`),
      status: (data?.status ?? 'completed') as DiscoverFieldsResponse['status'],
      fieldsDiscovered: Number(data?.fieldsDiscovered ?? fields.length),
      fields,
    };
  }

  /**
   * Get discovered fields with filtering
   * GET /api/ai/field-discovery
   */
  async getDiscoveredFields(filter?: GetFieldsFilter): Promise<GetFieldsResponse> {
    const params = new URLSearchParams();

    if (filter?.status) params.append('status', filter.status);
    if (filter?.classification) params.append('classification', filter.classification);
    if (filter?.sensitivity) params.append('sensitivity', filter.sensitivity);
    if (filter?.search) params.append('search', filter.search);
    if (filter?.dataSourceId) params.append('dataSourceId', filter.dataSourceId);
    if (filter?.database) params.append('database', filter.database);
    if (filter?.table) params.append('table', filter.table);
    if (filter?.limit) params.append('limit', filter.limit.toString());
    if (filter?.offset) params.append('offset', filter.offset.toString());

    console.log('Field Discovery API call with params:', params.toString());
    const response = await this.api.get(`${this.basePath}?${params.toString()}`);
    const data = response.data.data ?? response.data;
    const fields = Array.isArray(data?.fields) ? data.fields.map((f: any) => this.mapField(f)) : [];
    return {
      fields,
      total: Number(data?.total ?? fields.length ?? 0),
      limit: Number(data?.limit ?? filter?.limit ?? 50),
      offset: Number(data?.offset ?? filter?.offset ?? 0),
    };
  }

  /**
   * Get field discovery statistics
   * GET /api/ai/field-discovery/stats
   */
  async getStats(): Promise<FieldDiscoveryStats> {
    const response = await this.api.get(`${this.basePath}/stats`);
    const raw = response.data.data ?? response.data;
    return this.mapStats(raw);
  }

  /**
   * Get schema drift alerts
   * GET /api/ai/field-discovery/drift-alerts
   */
  async getDriftAlerts(): Promise<DriftAlert[]> {
    const response = await this.api.get(`${this.basePath}/drift-alerts`);
    const data = response.data.data ?? response.data;
    const list = Array.isArray(data?.alerts) ? data.alerts : Array.isArray(data) ? data : [];
    return list.map((a: any) => this.mapAlert(a));
  }

  /**
   * Update field status
   * PATCH /api/ai/field-discovery/:id/status
   */
  async updateFieldStatus(fieldId: string, request: UpdateFieldStatusRequest): Promise<DiscoveredField> {
    const response = await this.api.patch(`${this.basePath}/${fieldId}/status`, request);
    const data = response.data.data ?? response.data;
    return this.mapField({ ...data, id: fieldId });
  }

  /**
   * Manually classify a field
   * POST /api/ai/field-discovery/:id/classify
   */
  async classifyField(fieldId: string, request: ClassifyFieldRequest): Promise<DiscoveredField> {
    const response = await this.api.post(`${this.basePath}/${fieldId}/classify`, request);
    const data = response.data.data ?? response.data;
    return this.mapField({ ...data, id: fieldId });
  }

  /**
   * Perform bulk action on multiple fields
   * POST /api/ai/field-discovery/bulk-action
   */
  async bulkAction(request: BulkActionRequest): Promise<BulkActionResponse> {
    const response = await this.api.post(`${this.basePath}/bulk-action`, request);
    return response.data.data;
  }
}

// Export singleton instance
export const fieldDiscoveryAPI = new FieldDiscoveryAPI();
