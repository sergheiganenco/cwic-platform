import { default as api, default as http } from "@services/http";
import type { ApiListResponse, ApiResponse } from '../types/api';
import type { DataSource } from '../types/source';


export interface ListSourcesQuery {
  page?: number;
  limit?: number;
  type?: string;
  environment?: 'development' | 'staging' | 'production';
  status?: 'active' | 'inactive' | 'error' | 'pending';
}

export const SourcesAPI = {
  list: async (q: ListSourcesQuery) => {
    const resp = await http.get<ApiListResponse<DataSource>>('/sources', { params: q });
    return resp.data;
  },

  types: async () => {
    const resp = await http.get<ApiResponse<{ types: string[] }>>('/sources/types');
    return resp.data;
  },

  templates: async (type?: string) => {
    const resp = await http.get<ApiResponse<any>>('/sources/templates', { params: { type } });
    return resp.data;
  },

  health: async () => {
    const resp = await http.get<ApiResponse<any>>('/sources/health');
    return resp.data;
  },

  byId: async (id: string) => {
    const resp = await http.get<ApiResponse<DataSource>>(`/sources/${id}`);
    return resp.data;
  },

  assets: async (id: string, q?: { type?: string; limit?: number }) => {
    const resp = await http.get<ApiResponse<any>>(`/sources/${id}/assets`, { params: q });
    return resp.data;
  },

  metrics: async (id: string, period?: '1h' | '24h' | '7d' | '30d') => {
    const resp = await http.get<ApiResponse<any>>(`/sources/${id}/metrics`, { params: { period } });
    return resp.data;
  },

  schema: async (id: string) => {
    const resp = await http.get<ApiResponse<any>>(`/sources/${id}/schema`);
    return resp.data;
  },

  create: async (payload: Partial<DataSource>) => {
    const resp = await http.post<ApiResponse<DataSource>>('/sources', payload);
    return resp.data;
  },

  test: async (payload: any) => {
    const resp = await http.post<ApiResponse<any>>('/sources/test', payload);
    return resp.data;
  },

  discover: async (id: string, body?: { type?: 'full' | 'incremental' | 'schema_only'; options?: Record<string, any> }) => {
    const resp = await http.post<ApiResponse<any>>(`/sources/${id}/discover`, body ?? {});
    return resp.data;
  },

  update: async (id: string, payload: Partial<DataSource>) => {
    const resp = await http.put<ApiResponse<DataSource>>(`/sources/${id}`, payload);
    return resp.data;
  },

  updateStatus: async (id: string, status: 'active' | 'inactive' | 'error' | 'pending', reason?: string) => {
    const resp = await http.put<ApiResponse<DataSource>>(`/sources/${id}/status`, { status, reason });
    return resp.data;
  },

  delete: async (id: string, opts?: { force?: boolean; deleteAssets?: boolean }) => {
    const resp = await http.delete<ApiResponse<{ id: string }>>(`/sources/${id}`, { data: opts ?? {} });
    return resp.data;
  },
};

export interface CreateDataSourceBody {
  name: string;
  type: string;
  config: Record<string, any>;
}

export async function listDataSources() {
  const { data } = await api.get("/data-sources");
  return data;
}

export async function createDataSource(body: CreateDataSourceBody) {
  const { data } = await api.post("/data-sources", body);
  return data;
}

export async function testConnection(id: string) {
  const { data } = await api.post(`/data-sources/${id}/test`);
  return data;
} 
