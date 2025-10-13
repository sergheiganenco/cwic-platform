// src/hooks/useAdvancedCatalog.ts
import { useCallback, useEffect, useState } from 'react';
import { useApi } from './useApi';
import type {
  CatalogObject,
  CatalogObjectsFilter,
  CatalogObjectsResponse,
  HierarchySource,
  ObjectDetails,
  ScanConfig,
  ScanHistoryItem,
  ScanProgress,
} from '@/types/advancedCatalog';

export function useAdvancedCatalog() {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hierarchy state
  const [hierarchy, setHierarchy] = useState<HierarchySource[]>([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);

  // Objects state
  const [objects, setObjects] = useState<CatalogObject[]>([]);
  const [objectsTotal, setObjectsTotal] = useState(0);
  const [objectsPage, setObjectsPage] = useState(1);
  const [objectsTotalPages, setObjectsTotalPages] = useState(0);

  // Scan state
  const [scans, setScans] = useState<ScanHistoryItem[]>([]);
  const [activeScan, setActiveScan] = useState<ScanProgress | null>(null);

  // Selected object state
  const [selectedObject, setSelectedObject] = useState<ObjectDetails | null>(null);
  const [selectedObjectLoading, setSelectedObjectLoading] = useState(false);

  // Fetch hierarchy
  const fetchHierarchy = useCallback(async (sourceId?: string) => {
    setHierarchyLoading(true);
    setError(null);
    try {
      const query = sourceId ? `?sourceId=${sourceId}` : '';
      const response = await api.get<{ success: boolean; data: HierarchySource[] }>(
        `/api/advanced-catalog/hierarchy${query}`
      );
      setHierarchy(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch hierarchy');
      setHierarchy([]);
    } finally {
      setHierarchyLoading(false);
    }
  }, [api]);

  // Fetch objects with filters
  const fetchObjects = useCallback(async (filters: CatalogObjectsFilter = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();

      if (filters.search) params.append('search', filters.search);
      if (filters.sourceIds?.length) params.append('sourceIds', filters.sourceIds.join(','));
      if (filters.databaseIds?.length) params.append('databaseIds', filters.databaseIds.join(','));
      if (filters.schemaIds?.length) params.append('schemaIds', filters.schemaIds.join(','));
      if (filters.objectTypes?.length) params.append('objectTypes', filters.objectTypes.join(','));
      if (filters.classifications?.length) params.append('classifications', filters.classifications.join(','));
      if (filters.minQuality !== undefined) params.append('minQuality', String(filters.minQuality));
      if (filters.tags?.length) params.append('tags', filters.tags.join(','));
      if (filters.page) params.append('page', String(filters.page));
      if (filters.limit) params.append('limit', String(filters.limit));

      const query = params.toString();
      const response = await api.get<CatalogObjectsResponse>(
        `/api/advanced-catalog/objects${query ? `?${query}` : ''}`
      );

      if (response.success && response.data) {
        setObjects(response.data.objects || []);
        setObjectsTotal(response.data.pagination?.total || 0);
        setObjectsPage(response.data.pagination?.page || 1);
        setObjectsTotalPages(response.data.pagination?.totalPages || 0);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch objects');
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Fetch object details
  const fetchObjectDetails = useCallback(async (objectId: number) => {
    setSelectedObjectLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; data: ObjectDetails }>(
        `/api/advanced-catalog/objects/${objectId}`
      );
      if (response.success && response.data) {
        setSelectedObject(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch object details');
      setSelectedObject(null);
    } finally {
      setSelectedObjectLoading(false);
    }
  }, [api]);

  // Start scan
  const startScan = useCallback(async (config: ScanConfig) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post<{ success: boolean; data: { scanId: string } }>(
        '/api/advanced-catalog/scan',
        config
      );
      if (response.success && response.data) {
        return response.data.scanId;
      }
      throw new Error('Failed to start scan');
    } catch (err: any) {
      setError(err.message || 'Failed to start scan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Fetch scan progress
  const fetchScanProgress = useCallback(async (scanId: string) => {
    try {
      const response = await api.get<{ success: boolean; data: ScanProgress }>(
        `/api/advanced-catalog/scan/${scanId}/progress`
      );
      if (response.success && response.data) {
        setActiveScan(response.data);
        return response.data;
      }
      return null;
    } catch (err: any) {
      console.error('Failed to fetch scan progress:', err);
      return null;
    }
  }, [api]);

  // Fetch scan history
  const fetchScans = useCallback(async (sourceId?: string, limit = 10) => {
    try {
      const params = new URLSearchParams();
      if (sourceId) params.append('sourceId', sourceId);
      params.append('limit', String(limit));

      const query = params.toString();
      const response = await api.get<{ success: boolean; data: ScanHistoryItem[] }>(
        `/api/advanced-catalog/scans${query ? `?${query}` : ''}`
      );

      if (response.success && response.data) {
        setScans(response.data);
      }
    } catch (err: any) {
      console.error('Failed to fetch scans:', err);
    }
  }, [api]);

  // Fetch popular objects
  const fetchPopularObjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<{ success: boolean; data: CatalogObject[] }>(
        '/api/advanced-catalog/popular'
      );
      if (response.success && response.data) {
        setObjects(response.data);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch popular objects');
      setObjects([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Bookmark object
  const bookmarkObject = useCallback(async (objectId: number) => {
    try {
      await api.post(`/api/advanced-catalog/objects/${objectId}/bookmark`);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to bookmark object');
    }
  }, [api]);

  // Add comment
  const addComment = useCallback(async (objectId: number, content: string) => {
    try {
      const response = await api.post<{ success: boolean; data: any }>(
        `/api/advanced-catalog/objects/${objectId}/comments`,
        { content }
      );
      return response.data;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to add comment');
    }
  }, [api]);

  return {
    // State
    loading,
    error,

    // Hierarchy
    hierarchy,
    hierarchyLoading,
    fetchHierarchy,

    // Objects
    objects,
    objectsTotal,
    objectsPage,
    objectsTotalPages,
    fetchObjects,
    fetchPopularObjects,

    // Object details
    selectedObject,
    selectedObjectLoading,
    fetchObjectDetails,
    clearSelectedObject: () => setSelectedObject(null),

    // Scan
    scans,
    activeScan,
    startScan,
    fetchScanProgress,
    fetchScans,
    clearActiveScan: () => setActiveScan(null),

    // Actions
    bookmarkObject,
    addComment,
  };
}
