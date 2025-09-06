// src/hooks/useDataAssets.ts
import { dataAssetsApi } from '@/services/api/dataAssets';
import type {
  Asset,
  AssetFilters,
  AssetLineage,
  AssetProfile,
  AssetUsageStats,
  CreateAssetRequest,
  PaginatedAssets,
  UpdateAssetRequest
} from '@/types/dataAssets';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface UseDataAssetsOptions {
  autoFetch?: boolean;
  defaultFilters?: AssetFilters;
}

export function useDataAssets(options: UseDataAssetsOptions = {}) {
  const { autoFetch = true, defaultFilters = {} } = options;

  // State
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  const [filters, setFilters] = useState<AssetFilters>(defaultFilters);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Asset details cache
  const [assetDetails, setAssetDetails] = useState<Map<string, Asset>>(new Map());
  const [assetProfiles, setAssetProfiles] = useState<Map<string, AssetProfile>>(new Map());
  const [assetLineage, setAssetLineage] = useState<Map<string, AssetLineage>>(new Map());
  const [assetUsage, setAssetUsage] = useState<Map<string, AssetUsageStats>>(new Map());

  // Operation states
  const [operationStates, setOperationStates] = useState({
    creating: false,
    updating: new Set<string>(),
    deleting: new Set<string>(),
    profiling: new Set<string>()
  });

  // Fetch assets
  const fetchAssets = useCallback(async (newFilters?: AssetFilters, silent: boolean = false) => {
    const currentFilters = newFilters || filters;
    
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }

    try {
      const response: PaginatedAssets = await dataAssetsApi.list(currentFilters);
      
      setAssets(response.data);
      setPagination(response.pagination);
      
      if (newFilters) {
        setFilters(currentFilters);
      }
    } catch (err: any) {
      console.error('Failed to fetch assets:', err);
      setError(err.message || 'Failed to fetch assets');
      setAssets([]);
      setPagination({ page: 1, limit: 20, total: 0, totalPages: 0 });
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [filters]);

  // Auto-fetch on mount and filter changes
  useEffect(() => {
    if (autoFetch) {
      fetchAssets();
    }
  }, [fetchAssets, autoFetch]);

  // Refresh assets
  const refresh = useCallback(() => {
    fetchAssets(undefined, false);
  }, [fetchAssets]);

  // Update filters
  const updateFilters = useCallback((newFilters: Partial<AssetFilters>) => {
    const updatedFilters = { ...filters, ...newFilters, page: 1 }; // Reset to first page
    fetchAssets(updatedFilters);
  }, [filters, fetchAssets]);

  // Clear filters
  const clearFilters = useCallback(() => {
    const clearedFilters: AssetFilters = { page: 1, limit: filters.limit || 20 };
    fetchAssets(clearedFilters);
  }, [filters.limit, fetchAssets]);

  // Pagination
  const goToPage = useCallback((page: number) => {
    updateFilters({ page });
  }, [updateFilters]);

  const nextPage = useCallback(() => {
    if (pagination.page < pagination.totalPages) {
      goToPage(pagination.page + 1);
    }
  }, [pagination.page, pagination.totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (pagination.page > 1) {
      goToPage(pagination.page - 1);
    }
  }, [pagination.page, goToPage]);

  // Get single asset (with caching)
  const getAsset = useCallback(async (id: string, forceRefresh: boolean = false): Promise<Asset | null> => {
    if (!forceRefresh && assetDetails.has(id)) {
      return assetDetails.get(id) || null;
    }

    try {
      const asset = await dataAssetsApi.getById(id);
      setAssetDetails(prev => new Map(prev).set(id, asset));
      return asset;
    } catch (err: any) {
      console.error(`Failed to fetch asset ${id}:`, err);
      return null;
    }
  }, [assetDetails]);

  // Create asset
  const createAsset = useCallback(async (assetData: CreateAssetRequest): Promise<Asset> => {
    setOperationStates(prev => ({ ...prev, creating: true }));
    
    try {
      const newAsset = await dataAssetsApi.create(assetData);
      
      // Add to current list if it matches filters
      setAssets(prev => [newAsset, ...prev]);
      setPagination(prev => ({ ...prev, total: prev.total + 1 }));
      
      return newAsset;
    } catch (err: any) {
      console.error('Failed to create asset:', err);
      throw err;
    } finally {
      setOperationStates(prev => ({ ...prev, creating: false }));
    }
  }, []);

  // Update asset
  const updateAsset = useCallback(async (id: string, updates: UpdateAssetRequest): Promise<Asset> => {
    setOperationStates(prev => ({
      ...prev,
      updating: new Set(prev.updating).add(id)
    }));
    
    try {
      const updatedAsset = await dataAssetsApi.update(id, updates);
      
      // Update in current list
      setAssets(prev => prev.map(asset => 
        asset.id === id ? updatedAsset : asset
      ));
      
      // Update cache
      setAssetDetails(prev => new Map(prev).set(id, updatedAsset));
      
      return updatedAsset;
    } catch (err: any) {
      console.error(`Failed to update asset ${id}:`, err);
      throw err;
    } finally {
      setOperationStates(prev => {
        const newUpdating = new Set(prev.updating);
        newUpdating.delete(id);
        return { ...prev, updating: newUpdating };
      });
    }
  }, []);

  // Delete asset
  const deleteAsset = useCallback(async (id: string): Promise<void> => {
    setOperationStates(prev => ({
      ...prev,
      deleting: new Set(prev.deleting).add(id)
    }));
    
    try {
      await dataAssetsApi.delete(id);
      
      // Remove from current list
      setAssets(prev => prev.filter(asset => asset.id !== id));
      setPagination(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
      
      // Clear from cache
      setAssetDetails(prev => {
        const newMap = new Map(prev);
        newMap.delete(id);
        return newMap;
      });
      
    } catch (err: any) {
      console.error(`Failed to delete asset ${id}:`, err);
      throw err;
    } finally {
      setOperationStates(prev => {
        const newDeleting = new Set(prev.deleting);
        newDeleting.delete(id);
        return { ...prev, deleting: newDeleting };
      });
    }
  }, []);

  // Get asset profile
  const getAssetProfile = useCallback(async (id: string, forceRefresh: boolean = false): Promise<AssetProfile | null> => {
    if (!forceRefresh && assetProfiles.has(id)) {
      return assetProfiles.get(id) || null;
    }

    try {
      const profile = await dataAssetsApi.getProfile(id);
      setAssetProfiles(prev => new Map(prev).set(id, profile));
      return profile;
    } catch (err: any) {
      console.error(`Failed to fetch profile for asset ${id}:`, err);
      return null;
    }
  }, [assetProfiles]);

  // Get asset lineage
  const getAssetLineage = useCallback(async (id: string, forceRefresh: boolean = false): Promise<AssetLineage | null> => {
    if (!forceRefresh && assetLineage.has(id)) {
      return assetLineage.get(id) || null;
    }

    try {
      const lineage = await dataAssetsApi.getLineage(id);
      setAssetLineage(prev => new Map(prev).set(id, lineage));
      return lineage;
    } catch (err: any) {
      console.error(`Failed to fetch lineage for asset ${id}:`, err);
      return null;
    }
  }, [assetLineage]);

  // Get asset usage stats
  const getAssetUsage = useCallback(async (id: string, period: string = '30d', forceRefresh: boolean = false): Promise<AssetUsageStats | null> => {
    const cacheKey = `${id}-${period}`;
    if (!forceRefresh && assetUsage.has(cacheKey)) {
      return assetUsage.get(cacheKey) || null;
    }

    try {
      const usage = await dataAssetsApi.getUsageStats(id, period);
      setAssetUsage(prev => new Map(prev).set(cacheKey, usage));
      return usage;
    } catch (err: any) {
      console.error(`Failed to fetch usage stats for asset ${id}:`, err);
      return null;
    }
  }, [assetUsage]);

  // Tag management
  const addTags = useCallback(async (id: string, tags: string[]): Promise<Asset> => {
    try {
      const updatedAsset = await dataAssetsApi.addTags(id, tags);
      
      // Update in current list
      setAssets(prev => prev.map(asset => 
        asset.id === id ? updatedAsset : asset
      ));
      
      // Update cache
      setAssetDetails(prev => new Map(prev).set(id, updatedAsset));
      
      return updatedAsset;
    } catch (err: any) {
      console.error(`Failed to add tags to asset ${id}:`, err);
      throw err;
    }
  }, []);

  const removeTags = useCallback(async (id: string, tags: string[]): Promise<Asset> => {
    try {
      const updatedAsset = await dataAssetsApi.removeTags(id, tags);
      
      // Update in current list
      setAssets(prev => prev.map(asset => 
        asset.id === id ? updatedAsset : asset
      ));
      
      // Update cache
      setAssetDetails(prev => new Map(prev).set(id, updatedAsset));
      
      return updatedAsset;
    } catch (err: any) {
      console.error(`Failed to remove tags from asset ${id}:`, err);
      throw err;
    }
  }, []);

  // Request access to asset
  const requestAccess = useCallback(async (id: string, reason?: string): Promise<{ requestId: string; status: string }> => {
    try {
      return await dataAssetsApi.requestAccess(id, reason);
    } catch (err: any) {
      console.error(`Failed to request access to asset ${id}:`, err);
      throw err;
    }
  }, []);

  // Trigger asset profiling
  const triggerProfiling = useCallback(async (id: string): Promise<{ jobId: string; status: string }> => {
    setOperationStates(prev => ({
      ...prev,
      profiling: new Set(prev.profiling).add(id)
    }));
    
    try {
      const result = await dataAssetsApi.triggerProfiling(id);
      
      // Optionally refresh the asset profile after a delay
      setTimeout(() => {
        getAssetProfile(id, true);
      }, 5000);
      
      return result;
    } catch (err: any) {
      console.error(`Failed to trigger profiling for asset ${id}:`, err);
      throw err;
    } finally {
      setTimeout(() => {
        setOperationStates(prev => {
          const newProfiling = new Set(prev.profiling);
          newProfiling.delete(id);
          return { ...prev, profiling: newProfiling };
        });
      }, 2000); // Keep loading state for a bit
    }
  }, [getAssetProfile]);

  // Computed values
  const isEmpty = useMemo(() => !isLoading && assets.length === 0, [isLoading, assets.length]);
  const hasFilters = useMemo(() => {
    return Boolean(
      filters.search ||
      filters.type ||
      filters.owner ||
      filters.dataSourceId ||
      (filters.tags && filters.tags.length > 0) ||
      filters.quality ||
      filters.classification
    );
  }, [filters]);

  const totalAssets = pagination.total;
  const hasMore = pagination.page < pagination.totalPages;
  const hasPrev = pagination.page > 1;

  // Summary statistics
  const summary = useMemo(() => {
    const stats = {
      total: totalAssets,
      byType: {} as Record<string, number>,
      byQuality: { high: 0, medium: 0, low: 0 },
      byClassification: { public: 0, internal: 0, confidential: 0, restricted: 0 }
    };

    assets.forEach(asset => {
      // Count by type
      stats.byType[asset.type] = (stats.byType[asset.type] || 0) + 1;
      
      // Count by quality
      if (asset.quality) {
        stats.byQuality[asset.quality]++;
      }
      
      // Count by classification
      if (asset.classification) {
        stats.byClassification[asset.classification]++;
      }
    });

    return stats;
  }, [assets, totalAssets]);

  // Operation state helpers
  const isCreating = operationStates.creating;
  const isUpdating = useCallback((id: string) => operationStates.updating.has(id), [operationStates.updating]);
  const isDeleting = useCallback((id: string) => operationStates.deleting.has(id), [operationStates.deleting]);
  const isProfiling = useCallback((id: string) => operationStates.profiling.has(id), [operationStates.profiling]);

  return {
    // Data
    assets,
    pagination,
    filters,
    summary,
    
    // State
    isLoading,
    error,
    isEmpty,
    hasFilters,
    hasMore,
    hasPrev,
    
    // Operations
    fetchAssets,
    refresh,
    updateFilters,
    clearFilters,
    
    // Pagination
    goToPage,
    nextPage,
    prevPage,
    
    // Asset CRUD
    getAsset,
    createAsset,
    updateAsset,
    deleteAsset,
    
    // Asset details
    getAssetProfile,
    getAssetLineage,
    getAssetUsage,
    
    // Tag management
    addTags,
    removeTags,
    
    // Access and governance
    requestAccess,
    triggerProfiling,
    
    // Operation states
    isCreating,
    isUpdating,
    isDeleting,
    isProfiling,
    
    // Cache
    assetDetails,
    assetProfiles,
    assetLineage,
    assetUsage,
  };
}