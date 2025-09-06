// src/services/api/dataAssets.ts
import type {
    Asset,
    AssetFilters,
    AssetLineage,
    AssetProfile,
    AssetSearchRequest,
    AssetUsageStats,
    CreateAssetRequest,
    PaginatedAssets,
    UpdateAssetRequest
} from '@/types/dataAssets';
import axios from 'axios';

// Create HTTP client with the same base URL resolution as your other services
function resolveBaseUrl() {
  const env = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL;
  if (!env) return '/api';
  if (env.startsWith(':')) {
    return `${window.location.protocol}//${window.location.hostname}${env}`;
  }
  if (/^[\w.-]+:\d+$/.test(env)) {
    return `${window.location.protocol}//${env}`;
  }
  if (env.startsWith('http')) {
    try {
      const url = new URL(env);
      return url.pathname === '/' ? '/api' : url.pathname;
    } catch {
      return '/api';
    }
  }
  return env;
}

const http = axios.create({
  baseURL: resolveBaseUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Assets API
export const dataAssetsApi = {
  // List and search assets
  async list(filters: AssetFilters = {}): Promise<PaginatedAssets> {
    try {
      const params = {
        page: filters.page || 1,
        limit: filters.limit || 20,
        ...(filters.search && { search: filters.search }),
        ...(filters.type && { type: filters.type }),
        ...(filters.owner && { owner: filters.owner }),
        ...(filters.dataSourceId && { dataSourceId: filters.dataSourceId }),
        ...(filters.tags && filters.tags.length > 0 && { tags: filters.tags.join(',') }),
        ...(filters.quality && { quality: filters.quality }),
        ...(filters.classification && { classification: filters.classification }),
        ...(filters.sortBy && { sortBy: filters.sortBy }),
        ...(filters.sortOrder && { sortOrder: filters.sortOrder }),
      };

      const { data } = await http.get<PaginatedAssets>('/assets', { params });
      return data;
    } catch (error: any) {
      console.error('Failed to list assets:', error);
      
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        console.warn('API not available, returning mock data');
        return getMockAssets(filters);
      }
      
      throw error;
    }
  },

  // Get single asset by ID
  async getById(id: string): Promise<Asset> {
    try {
      const { data } = await http.get<Asset>(`/assets/${id}`);
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return getMockAsset(id);
      }
      throw error;
    }
  },

  // Search assets with advanced options
  async search(request: AssetSearchRequest): Promise<PaginatedAssets> {
    try {
      const { data } = await http.post<PaginatedAssets>('/assets/search', request);
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return getMockAssets(request);
      }
      throw error;
    }
  },

  // Create new asset
  async create(asset: CreateAssetRequest): Promise<Asset> {
    try {
      const { data } = await http.post<Asset>('/assets', asset);
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return {
          id: `mock-${Date.now()}`,
          ...asset,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          dataSourceName: 'Mock Data Source',
        } as Asset;
      }
      throw error;
    }
  },

  // Update asset
  async update(id: string, updates: UpdateAssetRequest): Promise<Asset> {
    try {
      const { data } = await http.put<Asset>(`/assets/${id}`, updates);
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        const existing = getMockAsset(id);
        return { ...existing, ...updates, updatedAt: new Date().toISOString() };
      }
      throw error;
    }
  },

  // Delete asset
  async delete(id: string): Promise<void> {
    try {
      await http.delete(`/assets/${id}`);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        console.warn('API not available, mock deleting asset');
        return;
      }
      throw error;
    }
  },

  // Get asset profile/statistics
  async getProfile(id: string): Promise<AssetProfile> {
    try {
      const { data } = await http.get<AssetProfile>(`/assets/${id}/profile`);
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return getMockProfile(id);
      }
      throw error;
    }
  },

  // Get asset lineage
  async getLineage(id: string): Promise<AssetLineage> {
    try {
      const { data } = await http.get<AssetLineage>(`/assets/${id}/lineage`);
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return getMockLineage(id);
      }
      throw error;
    }
  },

  // Get usage statistics
  async getUsageStats(id: string, period: string = '30d'): Promise<AssetUsageStats> {
    try {
      const { data } = await http.get<AssetUsageStats>(`/assets/${id}/usage`, {
        params: { period }
      });
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return getMockUsageStats(id, period);
      }
      throw error;
    }
  },

  // Add tags to asset
  async addTags(id: string, tags: string[]): Promise<Asset> {
    try {
      const { data } = await http.post<Asset>(`/assets/${id}/tags`, { tags });
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        const existing = getMockAsset(id);
        return {
          ...existing,
          tags: [...(existing.tags || []), ...tags],
          updatedAt: new Date().toISOString()
        };
      }
      throw error;
    }
  },

  // Remove tags from asset
  async removeTags(id: string, tags: string[]): Promise<Asset> {
    try {
      const { data } = await http.delete<Asset>(`/assets/${id}/tags`, { 
        data: { tags } 
      });
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        const existing = getMockAsset(id);
        return {
          ...existing,
          tags: existing.tags?.filter(tag => !tags.includes(tag)) || [],
          updatedAt: new Date().toISOString()
        };
      }
      throw error;
    }
  },

  // Request access to asset
  async requestAccess(id: string, reason?: string): Promise<{ requestId: string; status: string }> {
    try {
      const { data } = await http.post(`/assets/${id}/access-request`, { reason });
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return {
          requestId: `req-${Date.now()}`,
          status: 'pending'
        };
      }
      throw error;
    }
  },

  // Trigger asset profiling
  async triggerProfiling(id: string): Promise<{ jobId: string; status: string }> {
    try {
      const { data } = await http.post(`/assets/${id}/profile`);
      return data;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.message?.includes('socket hang up')) {
        return {
          jobId: `job-${Date.now()}`,
          status: 'started'
        };
      }
      throw error;
    }
  }
};

// Mock data functions (fallback when API is not available)
function getMockAssets(filters: AssetFilters): PaginatedAssets {
  const mockAssets: Asset[] = [
    {
      id: '1',
      name: 'customers',
      type: 'table',
      description: 'Customer information and profiles',
      dataSourceId: '1',
      dataSourceName: 'Production PostgreSQL',
      schema: 'public',
      owner: 'john.doe@company.com',
      tags: ['PII', 'customer', 'production'],
      rowCount: 125430,
      columnCount: 15,
      quality: 'high',
      classification: 'confidential',
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-01-20T14:22:00Z',
      lastAccessedAt: '2024-01-20T12:00:00Z',
    },
    {
      id: '2',
      name: 'orders',
      type: 'table',
      description: 'Order transactions and details',
      dataSourceId: '1',
      dataSourceName: 'Production PostgreSQL',
      schema: 'public',
      owner: 'jane.smith@company.com',
      tags: ['orders', 'transactions', 'revenue'],
      rowCount: 892341,
      columnCount: 22,
      quality: 'high',
      classification: 'internal',
      createdAt: '2024-01-10T09:15:00Z',
      updatedAt: '2024-01-20T15:10:00Z',
      lastAccessedAt: '2024-01-20T14:30:00Z',
    },
    {
      id: '3',
      name: 'user_analytics',
      type: 'view',
      description: 'Aggregated user behavior analytics',
      dataSourceId: '2',
      dataSourceName: 'Analytics Snowflake',
      schema: 'analytics',
      owner: 'data.team@company.com',
      tags: ['analytics', 'behavior', 'aggregated'],
      rowCount: 45123,
      columnCount: 8,
      quality: 'medium',
      classification: 'internal',
      createdAt: '2024-01-05T11:20:00Z',
      updatedAt: '2024-01-19T23:30:00Z',
      lastAccessedAt: '2024-01-19T20:15:00Z',
    }
  ];

  // Apply filters
  let filtered = mockAssets;
  
  if (filters.search) {
    const search = filters.search.toLowerCase();
    filtered = filtered.filter(asset => 
      asset.name.toLowerCase().includes(search) ||
      asset.description?.toLowerCase().includes(search) ||
      asset.tags?.some(tag => tag.toLowerCase().includes(search))
    );
  }
  
  if (filters.type) {
    filtered = filtered.filter(asset => asset.type === filters.type);
  }
  
  if (filters.owner) {
    filtered = filtered.filter(asset => 
      asset.owner?.toLowerCase().includes(filters.owner!.toLowerCase())
    );
  }

  // Pagination
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const start = (page - 1) * limit;
  const end = start + limit;
  const paginatedData = filtered.slice(start, end);

  return {
    data: paginatedData,
    pagination: {
      page,
      limit,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / limit)
    }
  };
}

function getMockAsset(id: string): Asset {
  return {
    id,
    name: `Mock Asset ${id}`,
    type: 'table',
    description: 'Mock asset for development',
    dataSourceId: '1',
    dataSourceName: 'Mock Data Source',
    schema: 'public',
    owner: 'mock.user@company.com',
    tags: ['mock', 'development'],
    rowCount: 10000,
    columnCount: 5,
    quality: 'medium',
    classification: 'internal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function getMockProfile(id: string): AssetProfile {
  return {
    assetId: id,
    profiledAt: new Date().toISOString(),
    rowCount: 10000,
    nullCount: { column1: 0, column2: 10, column3: 5 },
    distinctCount: { column1: 9950, column2: 100, column3: 50 },
    minValues: { column1: 1, column2: 'A', column3: 100 },
    maxValues: { column1: 10000, column2: 'Z', column3: 1000 },
    averages: { column1: 5000, column3: 500 }
  };
}

function getMockLineage(id: string): AssetLineage {
  return {
    assetId: id,
    upstream: [],
    downstream: []
  };
}

function getMockUsageStats(id: string, period: string): AssetUsageStats {
  return {
    assetId: id,
    period,
    queryCount: 150,
    uniqueUsers: 12,
    accessCount: 245,
    averageQueryTime: 1250,
    topUsers: [
      { userId: '1', userName: 'John Doe', queryCount: 45 },
      { userId: '2', userName: 'Jane Smith', queryCount: 32 }
    ]
  };
}

export default dataAssetsApi;