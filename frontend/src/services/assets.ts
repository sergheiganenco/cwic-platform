import type { ApiListResponse, ApiResponse } from '../types/api';
import type { Asset, AssetStats } from '../types/asset';
import { http } from './http';

export interface ListAssetsQuery {
  page?: number;
  limit?: number;
  type?: string;
  dataSourceId?: string;
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  search?: string;
}

export const AssetsAPI = {
  list: async (q: ListAssetsQuery) => {
    const resp = await http.get<ApiListResponse<Asset>>('/api/catalog/assets', { params: q });
    return resp.data;
  },

  search: async (q: { q: string; type?: string; limit?: number; page?: number }) => {
    const resp = await http.get<ApiListResponse<Asset>>('/assets/search', { params: q });
    return resp.data;
  },

  byId: async (id: string) => {
    const resp = await http.get<ApiResponse<Asset>>(`/assets/${id}`);
    return resp.data;
  },

  schema: async (id: string) => {
    const resp = await http.get<ApiResponse<any>>(`/assets/${id}/schema`);
    return resp.data;
  },

  lineage: async (id: string, direction: 'upstream' | 'downstream' | 'both' = 'both') => {
    const resp = await http.get<ApiResponse<any>>(`/assets/${id}/lineage`, { params: { direction } });
    return resp.data;
  },

  profile: async (id: string) => {
    const resp = await http.get<ApiResponse<any>>(`/assets/${id}/profile`);
    return resp.data;
  },

  stats: async (id: string, period: '1h' | '24h' | '7d' | '30d' | string = '30d') => {
    const resp = await http.get<ApiResponse<AssetStats>>(`/assets/${id}/stats`, { params: { period } });
    return resp.data;
  },

  create: async (payload: Partial<Asset>) => {
    const resp = await http.post<ApiResponse<Asset>>('/assets', payload);
    return resp.data;
  },

  update: async (id: string, payload: Partial<Asset>) => {
    const resp = await http.put<ApiResponse<Asset>>(`/assets/${id}`, payload);
    return resp.data;
  },

  updateClassification: async (id: string, classification: 'public' | 'internal' | 'confidential' | 'restricted', reason?: string) => {
    const resp = await http.put<ApiResponse<Asset>>(`/assets/${id}/classification`, { classification, reason });
    return resp.data;
  },

  delete: async (id: string) => {
    const resp = await http.delete<ApiResponse<{ id: string }>>(`/assets/${id}`);
    return resp.data;
  },

  addTags: async (id: string, tags: string[]) => {
    const resp = await http.post<ApiResponse<Asset>>(`/assets/${id}/tags`, { tags });
    return resp.data;
  },

  removeTags: async (id: string, tags: string[]) => {
    const resp = await http.delete<ApiResponse<Asset>>(`/assets/${id}/tags`, { data: { tags } });
    return resp.data;
  },

  scanOrSync: async (id: string, body?: { type?: 'full' | 'incremental' | 'schema_only' | 'profile_only'; force?: boolean }) => {
    const resp = await http.post<ApiResponse<any>>(`/assets/${id}/scan`, body ?? {});
    return resp.data;
  },
};
