import axios, { AxiosInstance } from 'axios';

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
  dataSourceId: number;
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
    this.api = axios.create({
      baseURL: '/api/ai',
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

  /**
   * Trigger field discovery for a data source
   * POST /api/ai/field-discovery/discover
   */
  async discoverFields(request: DiscoverFieldsRequest): Promise<DiscoverFieldsResponse> {
    const response = await this.api.post(`${this.basePath}/discover`, request);
    return response.data.data;
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
    if (filter?.limit) params.append('limit', filter.limit.toString());
    if (filter?.offset) params.append('offset', filter.offset.toString());

    const response = await this.api.get(`${this.basePath}?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Get field discovery statistics
   * GET /api/ai/field-discovery/stats
   */
  async getStats(): Promise<FieldDiscoveryStats> {
    const response = await this.api.get(`${this.basePath}/stats`);
    return response.data.data;
  }

  /**
   * Get schema drift alerts
   * GET /api/ai/field-discovery/drift-alerts
   */
  async getDriftAlerts(): Promise<DriftAlert[]> {
    const response = await this.api.get(`${this.basePath}/drift-alerts`);
    return response.data.data.alerts;
  }

  /**
   * Update field status
   * PATCH /api/ai/field-discovery/:id/status
   */
  async updateFieldStatus(fieldId: string, request: UpdateFieldStatusRequest): Promise<DiscoveredField> {
    const response = await this.api.patch(`${this.basePath}/${fieldId}/status`, request);
    return response.data.data;
  }

  /**
   * Manually classify a field
   * POST /api/ai/field-discovery/:id/classify
   */
  async classifyField(fieldId: string, request: ClassifyFieldRequest): Promise<DiscoveredField> {
    const response = await this.api.post(`${this.basePath}/${fieldId}/classify`, request);
    return response.data.data;
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
