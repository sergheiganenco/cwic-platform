/**
 * Data Catalog - Production Version with Fixed Filtering
 */

// Extend window type for missing data sources tracking
declare global {
  interface Window {
    _missingDataSources?: Set<string>;
  }
}

import { RatingStars } from '@/components/catalog/RatingStars';
import { TrustScoreRing } from '@/components/catalog/TrustScoreRing';
import { Button } from '@/components/ui/Button';
import { useDataAssets } from '@/hooks/useDataAssets';
import { useDataSources } from '@/hooks/useDataSources';
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  Eye,
  Grid3x3,
  LayoutList,
  MessageSquare,
  RefreshCw,
  Search,
  Share2,
  Shield,
  Star,
  Table as TableIcon,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

interface Filters {
  search: string;
  dataSourceId?: string;
  databases?: string[]; // Changed from database to databases (array)
  schema?: string;
  type?: 'all' | 'table' | 'view';
}

type ViewMode = 'grid' | 'table' | 'compact';

// Enhanced system schemas - Added PostgreSQL schemas
const SYSTEM_SCHEMAS = [
  // SQL Server
  'sys', 'INFORMATION_SCHEMA', 'dbo_system', 'guest', 'db_owner', 'db_accessadmin',
  // PostgreSQL
  'pg_catalog', 'information_schema', 'pg_toast', 'pg_temp_1', 'pg_toast_temp_1',
];
const SYSTEM_TABLE_PREFIXES = ['sys', 'MS', '__RefactorLog', 'trace_xe', 'pg_', 'sql_'];

const normalizeString = (value?: string | number | null) =>
  value === undefined || value === null ? '' : String(value).trim().toLowerCase();

const normalizeType = (value?: string | null) => normalizeString(value);

// Better ID comparison that handles both strings and numbers
const compareIds = (id1: any, id2: any): boolean => {
  if (id1 === id2) return true;
  return String(id1).toLowerCase() === String(id2).toLowerCase();
};

const isSystemTable = (asset: any): boolean => {
  const schema = normalizeString(asset.schema);
  if (SYSTEM_SCHEMAS.some(sys => normalizeString(sys) === schema)) return true;
  
  const tableName = asset.name || asset.table || '';
  return SYSTEM_TABLE_PREFIXES.some(prefix => tableName.toLowerCase().startsWith(prefix.toLowerCase()));
};

const DataCatalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>({
    search: '',
    type: 'all',
    databases: [], // Initialize as empty array
  });

  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [previewModal, setPreviewModal] = useState<{ open: boolean; data: any; loading: boolean }>({ 
    open: false, data: null, loading: false 
  });
  const [queryModal, setQueryModal] = useState<{ open: boolean; query: string; loading: boolean }>({ 
    open: false, query: '', loading: false 
  });
  const [descriptionModal, setDescriptionModal] = useState<{ 
    open: boolean; assetId: string; currentDesc: string; loading: boolean 
  }>({ 
    open: false, assetId: '', currentDesc: '', loading: false 
  });

  const { assets, summary, isLoading, refresh, pagination, updateFilters } = useDataAssets({
    autoFetch: true,
    defaultFilters: { limit: 20, page: 1, objectType: 'user' },  // Exclude system tables by default
  });

  const { items: dataSources } = useDataSources();

  const [catalogSummary, setCatalogSummary] = useState<any>(null);

  // Extract unique data sources from assets for the dropdown
  const uniqueDataSources = useMemo(() => {
    const dsMap = new Map<string, { id: string; name: string; type: string }>();

    // Add from assets
    assets.forEach(asset => {
      if (asset.dataSourceId && !dsMap.has(asset.dataSourceId)) {
        dsMap.set(asset.dataSourceId, {
          id: asset.dataSourceId,
          name: asset.dataSourceName || 'Unknown',
          type: asset.dataSourceType || ''
        });
      }
    });

    // Merge with dataSources from the hook (in case some sources have no assets)
    dataSources.forEach(ds => {
      if (!dsMap.has(ds.id)) {
        dsMap.set(ds.id, {
          id: ds.id,
          name: ds.name,
          type: ds.type
        });
      }
    });

    return Array.from(dsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [assets, dataSources]);

  // Fetch all available databases from all data sources via API
  const [databasesByDataSource, setDatabasesByDataSource] = useState<Array<{ dataSourceId: string; dataSourceName: string; databases: Array<{ name: string; isSystem: boolean; isSynced: boolean }> }>>([]);

  // Fetch available databases from all data sources
  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const params = new URLSearchParams();
        if (filters.dataSourceId) {
          params.append('dataSourceId', filters.dataSourceId);
        }
        const response = await fetch(`/api/catalog/databases?${params}`);
        const data = await response.json();
        if (data.success) {
          setDatabasesByDataSource(data.data);
        }
      } catch (error) {
        console.warn('Failed to fetch databases:', error);
      }
    };
    fetchDatabases();
  }, [filters.dataSourceId]);

  // Fetch catalog summary separately to get accurate counts based on current filters
  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const params = new URLSearchParams();
        params.append('objectType', 'user'); // Always exclude system tables

        // Apply same filters as the main asset list
        if (filters.dataSourceId) params.append('dataSourceId', filters.dataSourceId);
        if (filters.databases && filters.databases.length > 0) {
          params.append('databases', filters.databases.join(','));
        }
        if (filters.schema) params.append('schema', filters.schema);
        const searchTerm = filters.search?.trim();
        if (searchTerm) params.append('search', searchTerm);

        const response = await fetch(`/api/catalog/summary?${params}`);
        const data = await response.json();
        if (data.success) {
          console.log('📊 Catalog summary updated:', data.data);
          setCatalogSummary(data.data);
        }
      } catch (error) {
        console.warn('Failed to fetch catalog summary:', error);
      }
    };
    fetchSummary();
  }, [filters.dataSourceId, filters.databases, filters.schema, filters.search]);

  // Handle deep linking - auto-open asset from URL parameter
  useEffect(() => {
    const assetId = searchParams.get('asset');
    if (assetId && !selectedAsset) {
      // First try to find in loaded assets
      const asset = assets.find(a => a.id === assetId);
      if (asset) {
        console.log('🔗 Deep link: Opening asset from URL (found in loaded assets):', assetId);
        setSelectedAsset(asset);
      } else if (assets.length > 0) {
        // If not found in loaded assets, fetch directly from API
        console.log('🔗 Deep link: Fetching asset from API:', assetId);
        fetch(`/api/catalog/assets/${assetId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data) {
              console.log('🔗 Deep link: Asset loaded from API:', data.data);
              setSelectedAsset(data.data);
            } else {
              console.warn('🔗 Deep link: Asset not found:', assetId);
            }
          })
          .catch(err => console.error('🔗 Deep link: Failed to fetch asset:', err));
      }
    }
  }, [searchParams, assets, selectedAsset]);

  // Debug logging
  useEffect(() => {
    console.log('🔍 Filter Debug:', {
      selectedDataSourceId: filters.dataSourceId,
      totalAssets: assets.length,
      dataSources: dataSources.map(ds => ({ id: ds.id, name: ds.name, type: ds.type })),
      sampleAsset: assets[0] ? {
        id: assets[0].id,
        name: assets[0].name,
        dataSourceId: assets[0].dataSourceId,
        schema: assets[0].schema,
      } : null,
    });
  }, [filters.dataSourceId, assets.length, dataSources]);

  // Simplified server-side filter updates
  const normalizedSearch = filters.search.trim();
  const activeTypeFilter = filters.type !== 'all' ? filters.type : undefined;
  const activeSchemaFilter = filters.schema?.trim() ? filters.schema.trim() : undefined;

  // Always filter to only user tables (exclude system tables)
  const objectTypeFilter = 'user';

  // Only update server filters when they actually change
  useEffect(() => {
    const serverFilters: any = {
      limit: 20,  // Set to 20 items per page for pagination
      page: pagination?.page || 1,  // Use current page from pagination
      objectType: objectTypeFilter,
    };

    if (normalizedSearch) serverFilters.search = normalizedSearch;
    if (filters.dataSourceId) serverFilters.dataSourceId = filters.dataSourceId;
    // Handle multiple databases - send as comma-separated string
    if (filters.databases && filters.databases.length > 0) {
      serverFilters.databases = filters.databases.join(',');
    }
    if (activeSchemaFilter) serverFilters.schema = activeSchemaFilter;
    if (activeTypeFilter) serverFilters.type = activeTypeFilter;

    console.log('📡 Updating server filters:', serverFilters);
    updateFilters(serverFilters);
  }, [
    normalizedSearch,
    filters.dataSourceId,
    filters.databases,
    activeSchemaFilter,
    activeTypeFilter,
    objectTypeFilter,
    pagination?.page,  // Added pagination page to dependencies
    updateFilters,
  ]);

  // Extract unique schemas based on current data source and database filters
  const schemas = useMemo(() => {
    let scopedAssets = assets;

    // Filter by data source first
    if (filters.dataSourceId) {
      scopedAssets = scopedAssets.filter(a => compareIds(a.dataSourceId, filters.dataSourceId));
    }

    // Filter by databases if selected (multiple)
    if (filters.databases && filters.databases.length > 0) {
      const targetDatabases = filters.databases.map(normalizeString);
      scopedAssets = scopedAssets.filter(a => targetDatabases.includes(normalizeString(a.databaseName)));
    }

    // Always filter out system tables
    scopedAssets = scopedAssets.filter(a => !isSystemTable(a));

    const uniqueSchemas = new Set(
      scopedAssets
        .map(a => a.schema)
        .filter((schema): schema is string => Boolean(schema))
    );

    return Array.from(uniqueSchemas).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [assets, filters.dataSourceId, filters.databases]);

  // Client-side filtering (should match server-side for consistency)
  const filteredAssets = useMemo(() => {
    let filtered = assets;

    console.log('🎯 Client-side filtering:', {
      startingAssets: filtered.length,
      filters: filters,
    });

    // Always filter out system tables
    filtered = filtered.filter(a => !isSystemTable(a));
    console.log('  After system tables filter:', filtered.length);

    // Search filter
    if (filters.search && filters.search.trim()) {
      const search = filters.search.trim().toLowerCase();
      filtered = filtered.filter(a =>
        a.name?.toLowerCase().includes(search) ||
        a.table?.toLowerCase().includes(search) ||
        a.schema?.toLowerCase().includes(search) ||
        a.description?.toLowerCase().includes(search)
      );
      console.log('  After search filter:', filtered.length);
    }

    // Data source filter - FIXED comparison
    if (filters.dataSourceId) {
      const beforeFilter = filtered.length;
      filtered = filtered.filter(a => compareIds(a.dataSourceId, filters.dataSourceId));
      console.log(`  After data source filter (${filters.dataSourceId}):`, filtered.length, 'from', beforeFilter);

      if (filtered.length === 0 && beforeFilter > 0) {
        console.warn('⚠️ No assets after data source filter! Check ID types:', {
          filterValue: filters.dataSourceId,
          filterType: typeof filters.dataSourceId,
          sampleAssetId: assets[0]?.dataSourceId,
          sampleAssetIdType: typeof assets[0]?.dataSourceId,
        });
      }
    }

    // Database filter (multiple databases)
    if (filters.databases && filters.databases.length > 0) {
      const targetDatabases = filters.databases.map(normalizeString);
      filtered = filtered.filter(a => targetDatabases.includes(normalizeString(a.databaseName)));
      console.log('  After databases filter:', filtered.length);
    }

    // Schema filter
    if (filters.schema) {
      const targetSchema = normalizeString(filters.schema);
      filtered = filtered.filter(a => normalizeString(a.schema) === targetSchema);
      console.log('  After schema filter:', filtered.length);
    }

    // Type filter
    if (filters.type && filters.type !== 'all') {
      const targetType = normalizeType(filters.type);
      filtered = filtered.filter(a => normalizeType(a.type) === targetType);
      console.log('  After type filter:', filtered.length);
    }

    console.log('✅ Final filtered count:', filtered.length);
    return filtered;
  }, [assets, filters]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      (filters.search && filters.search.trim()) ||
      filters.dataSourceId ||
      (filters.databases && filters.databases.length > 0) ||
      filters.schema ||
      (filters.type && filters.type !== 'all')
    );
  }, [filters]);

  // Calculate statistics - use catalogSummary from backend for accurate counts
  const stats = useMemo(() => {
    // If we have catalogSummary from the backend, use it directly (it's already filtered)
    if (catalogSummary) {
      return {
        totalAssets: catalogSummary.totalAssets || 0,
        totalSources: catalogSummary.totalSources || 0,
        totalSchemas: catalogSummary.totalSchemas || 0,
        totalRows: catalogSummary.totalRows || 0,
        avgQuality: 0,
        byType: {
          tables: catalogSummary.byType?.table || 0,
          views: catalogSummary.byType?.view || 0,
        },
      };
    }

    // Fallback to estimation from current page if catalogSummary not available
    const totalAssets = pagination.total || 0;
    let tableCount = 0;
    let viewCount = 0;

    if (summary && summary.byType) {
      const currentTables = assets.filter(a => normalizeType(a.type) === 'table').length;
      const currentViews = assets.filter(a => normalizeType(a.type) === 'view').length;
      const currentTotal = assets.length;

      if (currentTotal > 0) {
        const ratio = totalAssets / currentTotal;
        tableCount = Math.round(currentTables * ratio);
        viewCount = Math.round(currentViews * ratio);
      } else {
        tableCount = totalAssets;
        viewCount = 0;
      }
    } else {
      const currentTables = assets.filter(a => normalizeType(a.type) === 'table').length;
      const currentViews = assets.filter(a => normalizeType(a.type) === 'view').length;
      const currentTotal = assets.length;

      if (currentTotal > 0) {
        const ratio = totalAssets / currentTotal;
        tableCount = Math.round(currentTables * ratio);
        viewCount = Math.round(currentViews * ratio);
      } else {
        tableCount = totalAssets;
        viewCount = 0;
      }
    }

    const currentPageRows = assets.reduce((sum, a) => sum + (a.rowCount || 0), 0);
    const estimatedTotalRows = assets.length > 0
      ? Math.round((currentPageRows / assets.length) * totalAssets)
      : 0;

    const uniqueDataSources = new Set(assets.map(a => a.dataSourceId));
    const totalSources = Math.max(uniqueDataSources.size, dataSources.length);

    const uniqueSchemas = new Set(assets.map(a => a.schema));
    const totalSchemas = uniqueSchemas.size;

    return {
      totalAssets,
      totalSources,
      totalSchemas,
      totalRows: estimatedTotalRows,
      avgQuality: 0,
      byType: {
        tables: tableCount,
        views: viewCount,
      },
    };
  }, [catalogSummary, assets, pagination, summary, dataSources.length]);

  const getDataSourceInfo = (dataSourceId: string) => {
    const ds = dataSources.find(d => compareIds(d.id, dataSourceId));
    if (!ds) {
      // Only warn once per missing data source to avoid console spam
      if (!window._missingDataSources) window._missingDataSources = new Set();
      if (!window._missingDataSources.has(dataSourceId)) {
        console.warn('⚠️ Data source not found:', dataSourceId, '(possibly deleted or not loaded yet)');
        window._missingDataSources.add(dataSourceId);
      }
      return { name: 'Unknown Source', database: '', type: 'unknown' };
    }

    const config = (ds as any).connectionConfig || {};
    const database = config.database || config.initialCatalog || config.catalog || '';

    return { name: ds.name, database, type: ds.type };
  };

  const toggleAssetSelection = (assetId: string) => {
    setSelectedAssets(prev => {
      const next = new Set(prev);
      next.has(assetId) ? next.delete(assetId) : next.add(assetId);
      return next;
    });
  };

  const handlePreview = async (assetId: string) => {
    setPreviewModal({ open: true, data: null, loading: true });
    try {
      const response = await fetch(`/api/catalog/assets/${assetId}/preview?limit=20`);
      const result = await response.json();

      // Check if there's an error in the response
      if (!response.ok || result.error) {
        const errorMsg = result.error || result.message || `Server error: ${response.status}`;
        setPreviewModal({ open: true, data: { error: errorMsg }, loading: false });
        return;
      }

      setPreviewModal({ open: true, data: result.data || result, loading: false });
    } catch (error: any) {
      console.error('Preview failed:', error);
      setPreviewModal({ open: true, data: { error: error.message || 'Failed to load preview' }, loading: false });
    }
  };

  const handleQuery = async (assetId: string) => {
    setQueryModal({ open: true, query: '', loading: true });
    try {
      const response = await fetch(`/api/catalog/assets/${assetId}/query`);
      const result = await response.json();
      setQueryModal({ open: true, query: result.data?.query || result.query || '', loading: false });
    } catch (error) {
      console.error('Query generation failed:', error);
      setQueryModal({ open: true, query: '-- Failed to generate query', loading: false });
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    notification.className = `fixed top-20 right-6 ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  };

  const handleBookmark = async (assetId: string) => {
    try {
      const response = await fetch(`/api/catalog/assets/${assetId}/bookmark`, { method: 'POST' });
      const result = await response.json();

      if (!response.ok || result.error) {
        const errorMsg = result.error || result.message || 'Failed to toggle bookmark';
        console.error('Bookmark failed:', errorMsg);
        alert(`Bookmark action failed: ${errorMsg}`);
        return;
      }

      const isBookmarked = result.bookmarked || result.data?.bookmarked || false;
      console.log('Bookmark toggled:', result, 'isBookmarked:', isBookmarked);

      // Update the selected asset if it's the one being bookmarked
      if (selectedAsset && selectedAsset.id === assetId) {
        setSelectedAsset({ ...selectedAsset, isBookmarked });
      }

      // Show success feedback
      const message = isBookmarked ? '⭐ Bookmarked!' : 'Bookmark removed';
      showNotification(message, 'success');
      refresh();
    } catch (error: any) {
      console.error('Bookmark failed:', error);
      alert(`Bookmark action failed: ${error.message || 'Network error'}`);
    }
  };

  const handleRate = async (assetId: string, rating: number) => {
    try {
      const response = await fetch(`/api/catalog/assets/${assetId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating })
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Rating failed:', result.error || result.message);
        showNotification('Failed to save rating', 'error');
        return;
      }

      const avgRating = result.data?.avgRating || rating;
      console.log('✅ Rating saved:', { assetId, rating, avgRating, result });

      // Update the selected asset if it's the one being rated
      if (selectedAsset && selectedAsset.id === assetId) {
        setSelectedAsset({
          ...selectedAsset,
          ratingAvg: avgRating,
          rating_avg: avgRating,
          rating: avgRating
        });
      }

      showNotification(`Rated ${rating} stars!`, 'success');

      // Refresh the asset list to show updated rating
      refresh();
    } catch (error: any) {
      console.error('Rating failed:', error);
      showNotification('Failed to save rating', 'error');
    }
  };

  const handleShare = async (assetId: string) => {
    try {
      const asset = filteredAssets.find(a => a.id === assetId);
      if (!asset) return;

      const shareUrl = `${window.location.origin}/data-catalog?asset=${assetId}`;
      const shareText = `Check out this ${asset.type}: ${asset.name || asset.table}`;

      if (navigator.share) {
        await navigator.share({
          title: asset.name || asset.table,
          text: shareText,
          url: shareUrl
        });
        showNotification('Shared successfully!', 'success');
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(shareUrl);
        console.log('📋 Link copied:', shareUrl);
        showNotification('Link copied! You can now paste it anywhere.', 'success');
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Share failed:', error);
        showNotification('Failed to share', 'error');
      }
    }
  };

  const handleExport = async () => {
    try {
      // Build query params with current filters
      const params = new URLSearchParams();
      if (filters.search) params.append('search', filters.search);
      if (filters.type && filters.type !== 'all') params.append('type', filters.type);
      if (filters.dataSourceId) params.append('datasourceId', filters.dataSourceId);
      if (filters.databases && filters.databases.length > 0) {
        params.append('databases', filters.databases.join(','));
      }
      if (filters.schema) params.append('schema', filters.schema);
      params.append('objectType', 'user'); // Only export user objects

      // Trigger download
      const url = `/api/catalog/assets/export?${params.toString()}`;
      window.open(url, '_blank');

      showNotification('Export started! Download will begin shortly.', 'success');
    } catch (error: any) {
      console.error('Export failed:', error);
      showNotification('Failed to export assets', 'error');
    }
  };

  const handleProfile = async (assetId: string) => {
    try {
      showNotification('Starting profile scan...', 'success');

      const response = await fetch(`/api/catalog/assets/${assetId}/profile`, {
        method: 'POST'
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        console.error('Profile failed:', result.error || result.message);
        showNotification('Failed to start profile scan', 'error');
        return;
      }

      showNotification('✓ Profile scan queued! This may take a few moments...', 'success');

      // Refresh after a delay to show updated data
      setTimeout(() => {
        refresh();
      }, 5000);
    } catch (error: any) {
      console.error('Profile failed:', error);
      showNotification('Failed to start profile scan', 'error');
    }
  };

  const handleSaveDescription = async (assetId: string, description: string) => {
    setDescriptionModal(prev => ({ ...prev, loading: true }));
    try {
      const response = await fetch(`/api/catalog/assets/${assetId}/description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to save description');
      }

      if (selectedAsset && selectedAsset.id === assetId) {
        setSelectedAsset({ ...selectedAsset, description });
      }

      setDescriptionModal({ open: false, assetId: '', currentDesc: '', loading: false });
      refresh();
    } catch (error: any) {
      console.error('Save description failed:', error);
      alert(`Failed to save description: ${error?.message || error}`);
      setDescriptionModal(prev => ({ ...prev, loading: false }));
    }
  };

  const handleGenerateDescription = async (assetId: string) => {
    setDescriptionModal(prev => ({ ...prev, currentDesc: '', loading: true }));

    try {
      const response = await fetch(`/api/catalog/assets/${assetId}/description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to generate description');
      }

      const newDesc = result.data?.description || result.description || '';

      if (selectedAsset && selectedAsset.id === assetId) {
        setSelectedAsset({ ...selectedAsset, description: newDesc });
      }

      setDescriptionModal(prev => ({ ...prev, currentDesc: newDesc, loading: false }));
      refresh();
    } catch (error: any) {
      console.error('Generate description failed:', error);
      alert(`Failed to generate description: ${error?.message || error}`);
      setDescriptionModal(prev => ({ ...prev, loading: false }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">Data Catalog</h1>
                {isLoading && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 rounded-full">
                    <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
                    <span className="text-xs text-blue-700 font-medium">Syncing</span>
                  </div>
                )}
              </div>
              <p className="text-gray-600">
                {filteredAssets.length < assets.length ? (
                  <>
                    Showing <strong className="text-gray-900">{filteredAssets.length.toLocaleString()}</strong> of{' '}
                    <strong className="text-gray-900">{assets.length.toLocaleString()}</strong> assets
                    {filters.dataSourceId && <> from <strong className="text-gray-900">{getDataSourceInfo(filters.dataSourceId).name}</strong></>}
                  </>
                ) : (
                  <>
                    Explore <strong className="text-gray-900">{stats.totalAssets.toLocaleString()}</strong> assets
                    across <strong className="text-gray-900">{stats.totalSources}</strong> data sources
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {selectedAssets.size > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm font-medium text-blue-900">{selectedAssets.size} selected</span>
                  <button onClick={() => setSelectedAssets(new Set())} className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Clear
                  </button>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={refresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>

              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" />
                Export
              </Button>

              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                {(['grid', 'table', 'compact'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`p-2 ${mode !== 'grid' && 'border-l border-gray-300'} ${
                      viewMode === mode ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50'
                    }`}
                  >
                    {mode === 'grid' && <Grid3x3 className="h-4 w-4" />}
                    {mode === 'table' && <LayoutList className="h-4 w-4" />}
                    {mode === 'compact' && <TableIcon className="h-4 w-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
            <StatCard
              label="Total Assets"
              value={stats.totalAssets.toLocaleString()}
              icon={<Database className="h-5 w-5" />}
              gradient="from-blue-500 to-blue-600"
            />
            <StatCard
              label="Tables"
              value={stats.byType.tables.toLocaleString()}
              icon={<TableIcon className="h-5 w-5" />}
              gradient="from-purple-500 to-purple-600"
            />
            <StatCard
              label="Views"
              value={stats.byType.views.toLocaleString()}
              icon={<Eye className="h-5 w-5" />}
              gradient="from-green-500 to-green-600"
            />
            <StatCard
              label="Total Rows"
              value={formatNumber(stats.totalRows)}
              icon={<TrendingUp className="h-5 w-5" />}
              gradient="from-cyan-500 to-cyan-600"
            />
            <StatCard
              label="Data Sources"
              value={stats.totalSources.toString()}
              icon={<Database className="h-5 w-5" />}
              gradient="from-orange-500 to-orange-600"
            />
          </div>

          {/* Search & Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by table name, schema, or description..."
                  value={filters.search}
                  onChange={(e) => {
                    const newSearch = e.target.value;
                    setFilters(prev => ({ ...prev, search: newSearch }));
                    // Reset to first page when search changes
                    updateFilters({ page: 1, search: newSearch });
                  }}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {filters.search && (
                  <button
                    onClick={() => {
                      setFilters(prev => ({ ...prev, search: '' }));
                      // Reset to first page when clearing search
                      updateFilters({ page: 1, search: undefined });
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={filters.dataSourceId || ''}
                onChange={(e) => {
                  const newValue = e.target.value || undefined;
                  console.log('📝 Data source changed:', newValue);
                  // Reset databases and schema filters when changing server
                  setFilters(prev => ({ ...prev, dataSourceId: newValue, databases: [], schema: undefined }));
                  // Reset to first page and clear database/schema filters immediately
                  updateFilters({
                    page: 1,
                    dataSourceId: newValue,
                    databases: undefined,
                    schema: undefined
                  });
                }}
                className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[200px]"
              >
                <option value="">All Servers ({uniqueDataSources.length})</option>
                {uniqueDataSources.map(ds => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name}
                  </option>
                ))}
              </select>

              <div
                className="relative"
                onBlur={(e) => {
                  // Close picker when clicking outside
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setShowDatabasePicker(false);
                  }
                }}
              >
                <button
                  onClick={() => setShowDatabasePicker(!showDatabasePicker)}
                  className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[240px] bg-white flex items-center justify-between"
                  disabled={!filters.dataSourceId && databasesByDataSource.length > 1}
                  title={!filters.dataSourceId && databasesByDataSource.length > 1 ? "Select a server first to filter by database" : ""}
                >
                  <span>
                    {(() => {
                      const selectedCount = filters.databases?.length || 0;
                      if (selectedCount === 0) {
                        if (filters.dataSourceId) {
                          const selectedDs = databasesByDataSource.find(ds => ds.dataSourceId === filters.dataSourceId);
                          const count = selectedDs?.databases.filter(db => !db.isSystem).length || 0;
                          return `All Databases${count > 0 ? ` (${count})` : ''}`;
                        }
                        const totalCount = databasesByDataSource.reduce((sum, ds) => sum + ds.databases.filter(db => !db.isSystem).length, 0);
                        return `All Databases (${totalCount})`;
                      }
                      return `${selectedCount} Database${selectedCount !== 1 ? 's' : ''} Selected`;
                    })()}
                  </span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${showDatabasePicker ? 'rotate-180' : ''}`} />
                </button>

                {showDatabasePicker && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2">
                      <div className="flex items-center justify-between px-2 py-1 mb-2 border-b">
                        <span className="text-xs font-semibold text-gray-700">Select Databases</span>
                        {filters.databases && filters.databases.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilters(prev => ({ ...prev, databases: [] }));
                              updateFilters({ page: 1, databases: undefined });
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700"
                          >
                            Clear All
                          </button>
                        )}
                      </div>
                      {filters.dataSourceId ? (
                        // Show only non-system databases for selected data source
                        databasesByDataSource
                          .filter(ds => ds.dataSourceId === filters.dataSourceId)
                          .flatMap(ds =>
                            ds.databases
                              .filter(database => !database.isSystem)
                              .map(database => (
                                <label
                                  key={database.name}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    checked={filters.databases?.includes(database.name) || false}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      const newDatabases = isChecked
                                        ? [...(filters.databases || []), database.name]
                                        : (filters.databases || []).filter(d => d !== database.name);
                                      setFilters(prev => ({ ...prev, databases: newDatabases }));
                                      updateFilters({ page: 1, databases: newDatabases.length > 0 ? newDatabases.join(',') : undefined });
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                  />
                                  <span className="text-sm text-gray-700">{database.name}</span>
                                  {database.isSynced && (
                                    <span className="ml-auto text-xs text-green-600">✓ Synced</span>
                                  )}
                                </label>
                              ))
                          )
                      ) : (
                        // Show grouped by data source when no source is selected
                        databasesByDataSource.map(ds => (
                          <div key={ds.dataSourceId}>
                            <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">{ds.dataSourceName}</div>
                            {ds.databases
                              .filter(database => !database.isSystem)
                              .map(database => (
                                <label
                                  key={`${ds.dataSourceId}-${database.name}`}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer ml-2"
                                >
                                  <input
                                    type="checkbox"
                                    checked={filters.databases?.includes(database.name) || false}
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      const newDatabases = isChecked
                                        ? [...(filters.databases || []), database.name]
                                        : (filters.databases || []).filter(d => d !== database.name);
                                      setFilters(prev => ({ ...prev, databases: newDatabases }));
                                      updateFilters({ page: 1, databases: newDatabases.length > 0 ? newDatabases.join(',') : undefined });
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                                  />
                                  <span className="text-sm text-gray-700">{database.name}</span>
                                  {database.isSynced && (
                                    <span className="ml-auto text-xs text-green-600">✓ Synced</span>
                                  )}
                                </label>
                              ))}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <select
                value={filters.type}
                onChange={(e) => {
                  const newType = e.target.value as any;
                  setFilters(prev => ({ ...prev, type: newType }));
                  // Reset to first page when changing type
                  updateFilters({ page: 1, type: newType !== 'all' ? newType : undefined });
                }}
                className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types ({stats.byType.tables + stats.byType.views})</option>
                <option value="table">Tables ({stats.byType.tables})</option>
                <option value="view">Views ({stats.byType.views})</option>
              </select>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {pagination.total || 0} result{pagination.total !== 1 ? 's' : ''} found
                </span>
                <button
                  onClick={() => {
                    setFilters({ search: '', type: 'all', dataSourceId: undefined, databases: [], schema: undefined });
                    // Reset to first page when clearing all filters
                    updateFilters({ page: 1, search: undefined, dataSourceId: undefined, databases: undefined, schema: undefined, type: undefined, objectType: 'user' });
                  }}
                  className="text-blue-600 hover:text-blue-700 font-medium"
                >
                  Clear all filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-6 py-6">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredAssets.length === 0 ? (
          <EmptyState
            hasFilters={hasActiveFilters}
            onReset={() => {
              setFilters({ search: '', type: 'all', dataSourceId: undefined, databases: [], schema: undefined });
              updateFilters({ page: 1, search: undefined, dataSourceId: undefined, databases: undefined, schema: undefined, type: undefined, objectType: 'user' });
            }}
          />
        ) : (
          <div className="space-y-4">
            {viewMode === 'grid' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                  {filteredAssets.map(asset => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      selected={selectedAssets.has(asset.id)}
                      onSelect={setSelectedAsset}
                      onToggleSelect={toggleAssetSelection}
                      getDataSourceInfo={getDataSourceInfo}
                      onBookmark={handleBookmark}
                      onRate={handleRate}
                      onShare={handleShare}
                    />
                  ))}
                </div>
                {pagination.totalPages > 1 && (
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    hasNext={pagination.hasNext}
                    hasPrev={pagination.hasPrev}
                    onPageChange={(page) => updateFilters({ page })}
                  />
                )}
              </>
            )}

            {viewMode === 'table' && (
              <>
                <TableView
                  assets={filteredAssets}
                  selectedAssets={selectedAssets}
                  onSelect={setSelectedAsset}
                  onToggleSelect={toggleAssetSelection}
                  getDataSourceInfo={getDataSourceInfo}
                  onBookmark={handleBookmark}
                />
                {pagination.totalPages > 1 && (
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    hasNext={pagination.hasNext}
                    hasPrev={pagination.hasPrev}
                    onPageChange={(page) => updateFilters({ page })}
                  />
                )}
              </>
            )}

            {viewMode === 'compact' && (
              <>
                <CompactView
                  assets={filteredAssets}
                  selectedAssets={selectedAssets}
                  onSelect={setSelectedAsset}
                  onToggleSelect={toggleAssetSelection}
                  getDataSourceInfo={getDataSourceInfo}
                />
                {pagination.totalPages > 1 && (
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    hasNext={pagination.hasNext}
                    hasPrev={pagination.hasPrev}
                    onPageChange={(page) => updateFilters({ page })}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Details Panel */}
      {selectedAsset && (
        <AssetDetailsPanel
          asset={selectedAsset}
          getDataSourceInfo={getDataSourceInfo}
          onClose={() => setSelectedAsset(null)}
          onPreview={handlePreview}
          onQuery={handleQuery}
          onBookmark={handleBookmark}
          onEditDescription={(id, desc) => setDescriptionModal({ open: true, assetId: id, currentDesc: desc, loading: false })}
          onSelectAsset={setSelectedAsset}
        />
      )}

      {/* Preview Modal */}
      {previewModal.open && (
        <PreviewModal
          loading={previewModal.loading}
          data={previewModal.data}
          onClose={() => setPreviewModal({ open: false, data: null, loading: false })}
        />
      )}

      {/* Query Modal */}
      {queryModal.open && (
        <QueryModal
          loading={queryModal.loading}
          query={queryModal.query}
          onClose={() => setQueryModal({ open: false, query: '', loading: false })}
        />
      )}

      {/* Description Editor Modal */}
      {descriptionModal.open && (
        <DescriptionModal
          loading={descriptionModal.loading}
          currentDescription={descriptionModal.currentDesc}
          onSave={(desc) => handleSaveDescription(descriptionModal.assetId, desc)}
          onGenerate={() => handleGenerateDescription(descriptionModal.assetId)}
          onClose={() => setDescriptionModal({ open: false, assetId: '', currentDesc: '', loading: false })}
        />
      )}
    </div>
  );
};

// Components
const Pagination: React.FC<{
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, hasNext, hasPrev, onPageChange }) => {
  const pageNumbers: (number | 'ellipsis')[] = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    if (currentPage <= 3) {
      pageNumbers.push(1, 2, 3, 4, 'ellipsis', totalPages);
    } else if (currentPage >= totalPages - 2) {
      pageNumbers.push(1, 'ellipsis', totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pageNumbers.push(1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages);
    }
  }

  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 rounded-b-lg">
      <div className="flex flex-1 justify-between sm:hidden">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={!hasPrev}
          className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={!hasNext}
          className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>

      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Page <span className="font-medium">{currentPage}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={!hasPrev}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {pageNumbers.map((page, idx) =>
              page === 'ellipsis' ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300"
                >
                  ...
                </span>
              ) : (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ring-1 ring-inset ring-gray-300 ${
                    currentPage === page
                      ? 'z-10 bg-blue-600 text-white'
                      : 'text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              )
            )}

            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={!hasNext}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  quality?: number;
  gradient?: string;
}> = ({ label, value, icon, quality, gradient = 'from-blue-500 to-blue-600' }) => (
  <div className="group relative bg-white rounded-xl p-5 border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-lg overflow-hidden">
    {/* Gradient background on hover */}
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-200`} />

    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</span>
        <div className={`p-2.5 bg-gradient-to-br ${gradient} rounded-xl shadow-sm group-hover:scale-110 transition-transform duration-200`}>
          <div className="text-white">
            {icon}
          </div>
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
      {quality !== undefined && (
        <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              quality >= 80 ? 'bg-gradient-to-r from-green-400 to-green-600' :
              quality >= 60 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
              'bg-gradient-to-r from-red-400 to-red-600'
            }`}
            style={{ width: `${quality}%` }}
          />
        </div>
      )}
    </div>
  </div>
);

const AssetCard: React.FC<{
  asset: any;
  selected: boolean;
  onSelect: (asset: any) => void;
  onToggleSelect: (id: string) => void;
  getDataSourceInfo: (id: string) => any;
  onBookmark?: (id: string) => void;
  onRate?: (id: string, rating: number) => void;
  onShare?: (id: string) => void;
}> = ({ asset, selected, onSelect, onToggleSelect, getDataSourceInfo, onBookmark, onRate, onShare }) => {
  const trustScore = asset.trust_score || asset.trustScore || asset.quality_score || asset.qualityScore || 0;
  const rating = asset.ratingAvg || asset.rating_avg || asset.rating || 0;
  const dsInfo = getDataSourceInfo(asset.dataSourceId);
  const isBookmarked = asset.isBookmarked || false;

  return (
    <div
      className={`bg-white rounded-lg border-2 transition-all cursor-pointer group relative ${
        selected ? 'border-blue-500 shadow-lg' : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />

      <div className="absolute top-3 left-3 z-10">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(asset.id)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-gray-300 text-blue-600"
        />
      </div>

      <div onClick={() => onSelect(asset)} className="p-4 pl-10">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold flex-shrink-0 ${
                  asset.type === 'table' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}
              >
                {asset.type === 'table' ? <TableIcon className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                {asset.type.toUpperCase()}
              </span>
            </div>

            <h3 className="text-base font-bold text-gray-900 truncate group-hover:text-blue-600 mb-1.5" title={asset.name || asset.table}>
              {asset.name || asset.table}
            </h3>

            <div className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
              <Database className="h-3 w-3 flex-shrink-0 text-gray-400" />
              <div className="flex items-center gap-1 min-w-0 overflow-hidden">
                <span className="font-medium truncate max-w-[80px]" title={dsInfo.name}>{dsInfo.name}</span>
                {(asset.databaseName || dsInfo.database) && (
                  <>
                    <span className="text-gray-400 flex-shrink-0">/</span>
                    <span className="font-mono text-blue-600 truncate max-w-[60px]" title={asset.databaseName || dsInfo.database}>
                      {asset.databaseName || dsInfo.database}
                    </span>
                  </>
                )}
                <span className="text-gray-400 flex-shrink-0">·</span>
                <span className="font-mono text-purple-600 truncate" title={asset.schema}>{asset.schema}</span>
              </div>
            </div>
          </div>

          <TrustScoreRing score={trustScore} size="sm" showLabel={false} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="bg-blue-50 rounded-md p-2 border border-blue-100">
            <div className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold mb-1">
              <TableIcon className="h-3 w-3" />
              Rows
            </div>
            <div className="text-sm font-bold text-blue-900">
              {asset.rowCount === null || asset.rowCount === undefined
                ? <span className="text-xs text-gray-400">Not scanned</span>
                : formatNumber(asset.rowCount)
              }
            </div>
            {asset.rowCount === 0 && (
              <div className="text-[10px] text-gray-500 mt-0.5">Empty</div>
            )}
          </div>

          <div className="bg-purple-50 rounded-md p-2 border border-purple-100">
            <div className="flex items-center gap-1 text-[10px] text-purple-600 font-semibold mb-1">
              <Grid3x3 className="h-3 w-3" />
              Columns
            </div>
            <div className="text-sm font-bold text-purple-900">
              {asset.columnCount === null || asset.columnCount === undefined ? '—' : asset.columnCount}
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="min-h-[36px]">
          {asset.description ? (
            <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{asset.description}</p>
          ) : (
            <p className="text-xs text-gray-400 italic">No description</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
              <RatingStars
                rating={rating}
                count={0}
                size="sm"
                showCount={false}
                interactive={true}
                onChange={(newRating) => {
                  if (onRate) onRate(asset.id, newRating);
                }}
              />
            </div>
            <div className={`flex items-center gap-1 transition-opacity flex-shrink-0 ${isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onBookmark) onBookmark(asset.id);
                }}
                className={`p-1.5 hover:bg-yellow-100 rounded-md transition-colors ${isBookmarked ? 'bg-yellow-50' : ''}`}
                title={isBookmarked ? "Bookmarked" : "Bookmark"}
              >
                <Star className={`h-4 w-4 ${isBookmarked ? 'fill-yellow-400 text-yellow-600' : 'text-yellow-600'}`} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onShare) onShare(asset.id);
                }}
                className="p-1.5 hover:bg-blue-100 rounded-md transition-colors"
                title="Share"
              >
                <Share2 className="h-4 w-4 text-blue-600" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-gray-500 flex-shrink-0">
            <Clock className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">{formatDate(asset.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    {[...Array(8)].map((_, i) => (
      <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-20 mb-4" />
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-4" />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="h-16 bg-gray-100 rounded" />
          <div className="h-16 bg-gray-100 rounded" />
        </div>
        <div className="h-12 bg-gray-100 rounded" />
      </div>
    ))}
  </div>
);

const EmptyState: React.FC<{ hasFilters: boolean; onReset: () => void }> = ({ hasFilters, onReset }) => (
  <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
    <Database className="h-16 w-16 mx-auto mb-4 text-gray-400" />
    <h3 className="text-lg font-semibold text-gray-900 mb-2">{hasFilters ? 'No assets match filters' : 'No assets found'}</h3>
    <p className="text-gray-600 mb-6">{hasFilters ? 'Try adjusting your filters.' : 'Connect data sources to discover assets.'}</p>
    {hasFilters && (
      <Button onClick={onReset} variant="outline">
        Clear filters
      </Button>
    )}
  </div>
);

const AssetDetailsPanel: React.FC<{
  asset: any;
  getDataSourceInfo: (id: string) => any;
  onClose: () => void;
  onPreview: (id: string) => void;
  onQuery: (id: string) => void;
  onBookmark: (id: string) => void;
  onEditDescription: (id: string, desc: string) => void;
  onSelectAsset: (asset: any) => void;
}> = ({ asset, getDataSourceInfo, onClose, onPreview, onQuery, onBookmark, onEditDescription, onSelectAsset }) => {
  const dsInfo = getDataSourceInfo(asset.dataSourceId);
  const trustScore = asset.trustScore || asset.trust_score || asset.qualityScore || asset.quality_score || 0;
  const [activeTab, setActiveTab] = useState<'overview' | 'columns' | 'lineage' | 'usage'>('overview');
  const [columns, setColumns] = useState<any[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [lineage, setLineage] = useState<any>(null);
  const [loadingLineage, setLoadingLineage] = useState(false);

  // Reset columns and lineage when asset changes
  useEffect(() => {
    setColumns([]);
    setLineage(null);
    setLoadingColumns(false);
    setLoadingLineage(false);
  }, [asset.id]);

  // Fetch columns when Columns tab is active
  useEffect(() => {
    if (activeTab === 'columns' && columns.length === 0 && !loadingColumns) {
      setLoadingColumns(true);
      fetch(`/api/catalog/assets/${asset.id}/columns`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setColumns(data.data || []);
          }
        })
        .catch(err => console.error('Failed to load columns:', err))
        .finally(() => setLoadingColumns(false));
    }
  }, [activeTab, asset.id, columns.length, loadingColumns]);

  // Fetch lineage when Lineage tab is active
  useEffect(() => {
    if (activeTab === 'lineage' && !lineage && !loadingLineage) {
      setLoadingLineage(true);
      fetch(`/api/catalog/assets/${asset.id}/lineage`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setLineage(data.data);
          }
        })
        .catch(err => console.error('Failed to load lineage:', err))
        .finally(() => setLoadingLineage(false));
    }
  }, [activeTab, asset.id, lineage, loadingLineage]);

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-4xl bg-white shadow-2xl z-50 overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{asset.name || asset.table}</h2>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Database className="h-4 w-4" />
                <span>{dsInfo.name}</span>
                {dsInfo.database && (
                  <>
                    <span>·</span>
                    <span className="font-mono">{dsInfo.database}</span>
                  </>
                )}
                <span>·</span>
                <span className="font-mono">{asset.schema}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              ✕
            </button>
          </div>

          <div className="flex gap-3 mb-4">
            <Button className="flex-1" onClick={() => onPreview(asset.id)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => onQuery(asset.id)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              Query
            </Button>
            <Button
              variant="outline"
              onClick={() => onBookmark(asset.id)}
              className={asset.isBookmarked ? 'bg-yellow-50 border-yellow-300' : ''}
            >
              <Star className={`h-4 w-4 ${asset.isBookmarked ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
            </Button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200">
            {[
              { id: 'overview', label: 'Overview', icon: BookOpen },
              { id: 'columns', label: 'Columns', icon: TableIcon, badge: asset.columnCount },
              { id: 'lineage', label: 'Lineage', icon: Zap },
              { id: 'usage', label: 'Usage', icon: TrendingUp }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
          <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold mb-4">Trust Score</h3>
            <div className="bg-gray-50 rounded-lg p-6">
              <TrustScoreRing score={trustScore} size="lg" showBreakdown />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Statistics</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="text-sm text-blue-700 mb-1">Rows</div>
                <div className="text-xl font-bold text-blue-900">
                  {asset.rowCount !== null && asset.rowCount !== undefined ? formatNumber(asset.rowCount) : '—'}
                </div>
                {(asset.rowCount === null || asset.rowCount === undefined) && (
                  <div className="text-xs text-blue-600 mt-1">Not scanned</div>
                )}
              </div>
              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <div className="text-sm text-purple-700 mb-1">Columns</div>
                <div className="text-xl font-bold text-purple-900">{asset.columnCount || '—'}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="text-sm text-green-700 mb-1">Type</div>
                <div className="text-xl font-bold text-green-900 uppercase">{asset.type}</div>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Description</h3>
              <Button variant="outline" size="sm" onClick={() => onEditDescription(asset.id, asset.description || '')}>
                Edit
              </Button>
            </div>
            {asset.description ? (
              <p className="text-gray-700 leading-relaxed">{asset.description}</p>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900 mb-1">No description</h4>
                  <p className="text-sm text-yellow-700">Add a description to help others understand this asset.</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-4">Metadata</h3>
            <div className="bg-white rounded-lg border divide-y">
              <MetadataRow label="Data Source" value={dsInfo.name} />
              <MetadataRow label="Database" value={asset.databaseName || dsInfo.database || '—'} />
              <MetadataRow label="Schema" value={asset.schema} />
              <MetadataRow label="Created" value={new Date(asset.createdAt).toLocaleString()} icon={<Calendar className="h-4 w-4" />} />
              <MetadataRow label="Updated" value={new Date(asset.updatedAt).toLocaleString()} icon={<Clock className="h-4 w-4" />} />
              {asset.owner && <MetadataRow label="Owner" value={asset.owner} icon={<Users className="h-4 w-4" />} />}
            </div>
          </div>
          </div>
          )}

          {activeTab === 'columns' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-gray-900">Columns ({columns.length})</h3>
                {columns.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {columns.filter((c: any) => c.is_nullable).length} nullable • {columns.filter((c: any) => !c.is_nullable).length} required
                  </span>
                )}
              </div>

              {loadingColumns ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">Loading columns...</span>
                </div>
              ) : columns.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <TableIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No columns found</p>
                  <p className="text-sm text-gray-500 mt-1">Column metadata has not been synced yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {columns.map((column: any, index: number) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-md transition-all">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-semibold text-gray-900">{column.column_name}</span>
                            {column.is_primary_key && (
                              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded">PK</span>
                            )}
                            {!column.is_nullable && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs font-semibold rounded">REQUIRED</span>
                            )}
                            {/* PII Badge */}
                            {(column as any).pii_type && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded flex items-center gap-1">
                                <Shield className="w-3 h-3" />
                                PII: {(column as any).pii_type.toUpperCase()}
                              </span>
                            )}
                            {/* Quality Issue Indicator */}
                            {(column as any).profile_json?.quality_issues && (column as any).profile_json.quality_issues.length > 0 ? (
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                {(column as any).profile_json.quality_issues.length} Issue(s)
                              </span>
                            ) : (column as any).pii_type ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Protected
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{column.data_type}</span>
                          </div>
                        </div>
                        {/* Action Buttons - Always Visible */}
                        <div className="flex gap-2 ml-4">
                          {(column as any).pii_type && (
                            <button
                              onClick={() => {
                                // Navigate to Data Quality page filtered by this column
                                const params = new URLSearchParams({
                                  tab: 'profiling',
                                  assetId: asset.id,
                                  search: asset.name,
                                  dataSourceId: asset.dataSourceId || '',
                                  database: asset.databaseName || ''
                                });
                                window.location.href = `/quality?${params.toString()}`;
                              }}
                              className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 rounded border border-blue-600 shadow-sm transition-colors"
                            >
                              View Issues
                            </button>
                          )}
                        </div>
                      </div>
                      {column.description && (
                        <p className="text-sm text-gray-700 mt-2">{column.description}</p>
                      )}
                      {/* Show PII Protection Details */}
                      {(column as any).pii_type && (
                        <div className="mt-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Shield className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                            <div className="text-xs text-purple-900">
                              <div className="font-semibold mb-1">PII Detected: {(column as any).pii_type}</div>
                              {(column as any).is_sensitive && (
                                <div className="text-purple-700">
                                  This column contains sensitive personal data and requires protection.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'lineage' && (
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Data Lineage</h3>

              {loadingLineage ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                  <span className="ml-3 text-gray-600">Loading lineage...</span>
                </div>
              ) : lineage ? (
                <div className="space-y-6">
                  {lineage.upstream && lineage.upstream.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <ChevronLeft className="h-5 w-5 text-blue-600" />
                        Upstream Dependencies ({lineage.upstream.length})
                      </h4>
                      <div className="space-y-2">
                        {lineage.upstream.map((item: any, index: number) => (
                          <button
                            key={index}
                            onClick={async () => {
                              // Fetch full asset details before navigating
                              try {
                                console.log('[Upstream Click] Fetching asset:', item.id);
                                const response = await fetch(`/api/catalog/assets/${item.id}`);
                                const data = await response.json();
                                console.log('[Upstream Click] Response:', data);

                                if (data.success && data.data) {
                                  // Transform snake_case to camelCase and map field names for frontend compatibility
                                  const asset = {
                                    ...data.data,
                                    // Map data source fields
                                    dataSourceId: data.data.datasource_id || data.data.dataSourceId,
                                    dataSourceName: data.data.datasource_name || data.data.dataSourceName,
                                    dataSourceType: data.data.datasource_type || data.data.dataSourceType,
                                    // Map asset name fields (panel expects 'name' or 'table', API returns 'table_name')
                                    name: data.data.name || data.data.table_name,
                                    table: data.data.table || data.data.table_name,
                                    // Map schema (panel expects 'schema', API returns 'schema_name')
                                    schema: data.data.schema || data.data.schema_name,
                                    // Map database name
                                    databaseName: data.data.database_name || data.data.databaseName,
                                    // Map other common fields
                                    trustScore: data.data.trust_score || data.data.trustScore,
                                    qualityScore: data.data.quality_score || data.data.qualityScore,
                                  };
                                  console.log('[Upstream Click] Navigating to asset:', asset.id, asset.name);
                                  onSelectAsset(asset);
                                } else {
                                  console.error('[Upstream Click] Invalid response:', data);
                                }
                              } catch (err) {
                                console.error('[Upstream Click] Error:', err);
                              }
                            }}
                            className="w-full bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 hover:border-blue-300 transition-all cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-3">
                              <Database className="h-5 w-5 text-blue-600 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.name || item.table_name}</div>
                                <div className="text-sm text-gray-600">{item.schema} • {item.type}</div>
                                {item.metadata?.columns && item.metadata.columns.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.metadata.columns.map((col: any, colIdx: number) => (
                                      <span key={colIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-300 rounded text-xs font-mono">
                                        <span className="text-blue-700">{col.from}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-blue-900">{col.to}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="h-5 w-5 text-blue-600 flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {lineage.downstream && lineage.downstream.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <ChevronRight className="h-5 w-5 text-green-600" />
                        Downstream Dependencies ({lineage.downstream.length})
                      </h4>
                      <div className="space-y-2">
                        {lineage.downstream.map((item: any, index: number) => (
                          <button
                            key={index}
                            onClick={async () => {
                              // Fetch full asset details before navigating
                              try {
                                console.log('[Downstream Click] Fetching asset:', item.id);
                                const response = await fetch(`/api/catalog/assets/${item.id}`);
                                const data = await response.json();
                                console.log('[Downstream Click] Response:', data);

                                if (data.success && data.data) {
                                  // Transform snake_case to camelCase and map field names for frontend compatibility
                                  const asset = {
                                    ...data.data,
                                    // Map data source fields
                                    dataSourceId: data.data.datasource_id || data.data.dataSourceId,
                                    dataSourceName: data.data.datasource_name || data.data.dataSourceName,
                                    dataSourceType: data.data.datasource_type || data.data.dataSourceType,
                                    // Map asset name fields (panel expects 'name' or 'table', API returns 'table_name')
                                    name: data.data.name || data.data.table_name,
                                    table: data.data.table || data.data.table_name,
                                    // Map schema (panel expects 'schema', API returns 'schema_name')
                                    schema: data.data.schema || data.data.schema_name,
                                    // Map database name
                                    databaseName: data.data.database_name || data.data.databaseName,
                                    // Map other common fields
                                    trustScore: data.data.trust_score || data.data.trustScore,
                                    qualityScore: data.data.quality_score || data.data.qualityScore,
                                  };
                                  console.log('[Downstream Click] Navigating to asset:', asset.id, asset.name);
                                  onSelectAsset(asset);
                                } else {
                                  console.error('[Downstream Click] Invalid response:', data);
                                }
                              } catch (err) {
                                console.error('[Downstream Click] Error:', err);
                              }
                            }}
                            className="w-full bg-green-50 border border-green-200 rounded-lg p-4 hover:bg-green-100 hover:border-green-300 transition-all cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-3">
                              <Database className="h-5 w-5 text-green-600 flex-shrink-0" />
                              <div className="flex-1">
                                <div className="font-medium text-gray-900">{item.name || item.table_name}</div>
                                <div className="text-sm text-gray-600">{item.schema} • {item.type}</div>
                                {item.metadata?.columns && item.metadata.columns.length > 0 && (
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {item.metadata.columns.map((col: any, colIdx: number) => (
                                      <span key={colIdx} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-green-300 rounded text-xs font-mono">
                                        <span className="text-green-700">{col.from}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-green-900">{col.to}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <ChevronRight className="h-5 w-5 text-green-600 flex-shrink-0" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(!lineage.upstream || lineage.upstream.length === 0) && (!lineage.downstream || lineage.downstream.length === 0) && (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">No lineage data available</p>
                      <p className="text-sm text-gray-500 mt-1">Lineage relationships have not been discovered yet</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No lineage data available</p>
                  <p className="text-sm text-gray-500 mt-1">Lineage relationships have not been discovered yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'usage' && (
            <div className="space-y-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Usage & Popularity</h3>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Eye className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">Total Views</span>
                  </div>
                  <div className="text-3xl font-bold text-blue-900">{asset.viewCount || 0}</div>
                  <p className="text-xs text-blue-700 mt-2">
                    {asset.viewCount === 0 ? 'No views yet - be the first to explore!' : 'Views from all users'}
                  </p>
                </div>

                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border border-yellow-200 rounded-lg p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Star className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-900">Bookmarks</span>
                  </div>
                  <div className="text-3xl font-bold text-yellow-900">{asset.bookmarkCount || 0}</div>
                  <p className="text-xs text-yellow-700 mt-2">
                    {asset.bookmarkCount === 0 ? 'Not bookmarked yet' : `Saved by ${asset.bookmarkCount} user${asset.bookmarkCount > 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>

              {/* Asset Metadata */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="font-semibold text-gray-900">Asset Information</h4>
                </div>
                <div className="divide-y divide-gray-200">
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Type</span>
                    <span className="text-sm text-gray-900 font-medium uppercase">{asset.type || 'table'}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Row Count</span>
                    <span className="text-sm text-gray-900 font-mono">{(asset.rowCount || 0).toLocaleString()}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Column Count</span>
                    <span className="text-sm text-gray-900 font-mono">{asset.columnCount || 0}</span>
                  </div>
                  <div className="px-4 py-3 flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Average Rating</span>
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm text-gray-900 font-medium">
                        {asset.ratingAvg ? `${asset.ratingAvg.toFixed(1)}/5` : 'Not rated'}
                      </span>
                    </div>
                  </div>
                  {asset.lastProfiledAt && (
                    <div className="px-4 py-3 flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Last Profiled</span>
                      <span className="text-sm text-gray-900">{new Date(asset.lastProfiledAt).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Coming Soon Section */}
              <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-8 text-center">
                <TrendingUp className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                <p className="text-purple-900 font-semibold text-lg mb-2">Advanced Analytics Coming Soon</p>
                <p className="text-sm text-purple-700 mb-4">We're building powerful usage insights for you</p>
                <div className="flex flex-wrap justify-center gap-3 text-xs text-purple-600">
                  <span className="bg-white px-3 py-1 rounded-full">Query History</span>
                  <span className="bg-white px-3 py-1 rounded-full">User Access Patterns</span>
                  <span className="bg-white px-3 py-1 rounded-full">Peak Usage Times</span>
                  <span className="bg-white px-3 py-1 rounded-full">Popular Queries</span>
                  <span className="bg-white px-3 py-1 rounded-full">Performance Metrics</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

const MetadataRow: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-medium text-gray-600">{label}</span>
    </div>
    <span className="text-sm text-gray-900">{value}</span>
  </div>
);

const TableView: React.FC<{
  assets: any[];
  selectedAssets: Set<string>;
  onSelect: (asset: any) => void;
  onToggleSelect: (id: string) => void;
  getDataSourceInfo: (id: string) => any;
  onBookmark: (id: string) => void;
}> = ({ assets, selectedAssets, onSelect, onToggleSelect, getDataSourceInfo, onBookmark }) => {
  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-700 bg-green-100';
    if (score >= 60) return 'text-yellow-700 bg-yellow-100';
    if (score > 0) return 'text-red-700 bg-red-100';
    return 'text-gray-400 bg-gray-100';
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-2 py-2"></th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Name</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Source</th>
            <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Schema</th>
            <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Rows</th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Cols</th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Updated</th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Quality</th>
            <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {assets.map(asset => {
            const dsInfo = getDataSourceInfo(asset.dataSourceId);
            const qualityScore = asset.qualityScore || asset.quality_score || 0;

            return (
              <tr
                key={asset.id}
                className={`hover:bg-gray-50 ${selectedAssets.has(asset.id) ? 'bg-blue-50' : ''}`}
              >
                <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedAssets.has(asset.id)}
                    onChange={() => onToggleSelect(asset.id)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
                  />
                </td>
                <td className="px-3 py-2 cursor-pointer" onClick={() => onSelect(asset)}>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0 ${
                      asset.type === 'table' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {asset.type.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{asset.name || asset.table}</div>
                      {asset.description && <div className="text-[10px] text-gray-500 truncate">{asset.description}</div>}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="font-medium text-gray-700 truncate max-w-[120px]">{dsInfo.name}</div>
                  {dsInfo.database && <div className="text-[10px] text-gray-500 truncate font-mono">{dsInfo.database}</div>}
                </td>
                <td className="px-3 py-2 text-xs font-mono text-purple-600 truncate max-w-[100px]">
                  {asset.schema}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold tabular-nums">
                  {asset.rowCount === null || asset.rowCount === undefined
                    ? <span className="text-gray-400">—</span>
                    : asset.rowCount === 0
                      ? <span className="text-gray-400">0</span>
                      : formatNumber(asset.rowCount)
                  }
                </td>
                <td className="px-3 py-2 text-center text-xs font-semibold tabular-nums">
                  {asset.columnCount || <span className="text-gray-400">—</span>}
                </td>
                <td className="px-3 py-2 text-center text-[11px] text-gray-600 tabular-nums">
                  {formatTimeAgo(asset.updatedAt)}
                </td>
                <td className="px-3 py-2 text-center">
                  {qualityScore > 0 ? (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getQualityColor(qualityScore)}`}>
                      {qualityScore}%
                    </span>
                  ) : (
                    <span className="text-gray-400 text-[10px]">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelect(asset); }}
                      className="p-1 hover:bg-blue-100 rounded"
                      title="Preview"
                    >
                      <Eye className="h-3.5 w-3.5 text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onBookmark(asset.id); }}
                      className="p-1 hover:bg-yellow-100 rounded"
                      title="Bookmark"
                    >
                      <Star className="h-3.5 w-3.5 text-yellow-600" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); console.log('Share', asset.id); }}
                      className="p-1 hover:bg-gray-100 rounded"
                      title="Share"
                    >
                      <Share2 className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const CompactView: React.FC<{
  assets: any[];
  selectedAssets: Set<string>;
  onSelect: (asset: any) => void;
  onToggleSelect: (id: string) => void;
  getDataSourceInfo: (id: string) => any;
}> = ({ assets, selectedAssets, onSelect, onToggleSelect, getDataSourceInfo }) => (
  <div className="space-y-1.5">
    {assets.map(asset => {
      const dsInfo = getDataSourceInfo(asset.dataSourceId);
      const trustScore = asset.trust_score || asset.trustScore || asset.quality_score || asset.qualityScore || 0;

      return (
        <div
          key={asset.id}
          className={`bg-white rounded-md border p-2.5 cursor-pointer transition-all hover:shadow-sm ${
            selectedAssets.has(asset.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => onSelect(asset)}
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedAssets.has(asset.id)}
              onChange={() => onToggleSelect(asset.id)}
              onClick={(e) => e.stopPropagation()}
              className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600"
            />

            <div className="flex-1 min-w-0 flex items-center gap-3">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                asset.type === 'table' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
              }`}>
                {asset.type.toUpperCase()}
              </span>

              <h3 className="font-semibold text-sm text-gray-900 truncate">{asset.name || asset.table}</h3>

              <div className="flex items-center gap-2 text-xs text-gray-600 truncate">
                <Database className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{dsInfo.name}</span>
                {dsInfo.database && <><span className="text-gray-400">/</span><span className="font-mono text-blue-600">{dsInfo.database}</span></>}
                <span className="text-gray-400">·</span>
                <span className="font-mono text-purple-600">{asset.schema}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs flex-shrink-0">
              <div className="text-center min-w-[50px]">
                <div className="text-[10px] text-gray-500 mb-0.5">Rows</div>
                <div className="font-semibold text-gray-900">
                  {asset.rowCount === null || asset.rowCount === undefined
                    ? '—'
                    : asset.rowCount === 0
                      ? <span className="text-gray-400">0</span>
                      : formatNumber(asset.rowCount)
                  }
                </div>
              </div>

              <div className="text-center min-w-[40px]">
                <div className="text-[10px] text-gray-500 mb-0.5">Cols</div>
                <div className="font-semibold text-gray-900">{asset.columnCount || '—'}</div>
              </div>

              <TrustScoreRing score={trustScore} size="sm" showLabel={false} />
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

// Modals
const PreviewModal: React.FC<{ loading: boolean; data: any; onClose: () => void }> = ({ loading, data, onClose }) => (
  <>
    <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Data Preview</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">✕</button>
        </div>
        <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="text-center py-12"><RefreshCw className="h-8 w-8 mx-auto animate-spin text-blue-600" /><p className="mt-4 text-gray-600">Loading preview...</p></div>
          ) : data?.error ? (
            <div className="text-center py-12 text-red-600">{data.error}</div>
          ) : data?.rows && data.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(data.rows[0]).map((col: string) => (
                      <th key={col} className="px-4 py-2 text-left text-xs font-semibold text-gray-700 border-b">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.values(row).map((val: any, i: number) => (
                        <td key={i} className="px-4 py-2 text-sm text-gray-900 border-b whitespace-nowrap">{String(val ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-500 mt-2">Showing {data.rowCount} rows</p>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">No data available</div>
          )}
        </div>
      </div>
    </div>
  </>
);

const QueryModal: React.FC<{ loading: boolean; query: string; onClose: () => void }> = ({ loading, query, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const copyQuery = () => {
    navigator.clipboard.writeText(query);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-3xl w-full">
          <div className="border-b border-gray-200 p-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">SQL Query</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">✕</button>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="text-center py-12"><RefreshCw className="h-8 w-8 mx-auto animate-spin text-blue-600" /><p className="mt-4 text-gray-600">Generating query...</p></div>
            ) : (
              <>
                <pre className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm overflow-x-auto">{query}</pre>
                <div className="flex gap-2 mt-4">
                  <Button onClick={copyQuery}>{copied ? 'Copied!' : 'Copy Query'}</Button>
                  <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

const DescriptionModal: React.FC<{
  loading: boolean;
  currentDescription: string;
  onSave: (desc: string) => void;
  onGenerate: () => void;
  onClose: () => void;
}> = ({ loading, currentDescription, onSave, onGenerate, onClose }) => {
  const [description, setDescription] = React.useState(currentDescription);

  React.useEffect(() => {
    setDescription(currentDescription);
  }, [currentDescription]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full">
          <div className="border-b border-gray-200 p-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Edit Description</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">✕</button>
          </div>
          <div className="p-4 space-y-4">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description for this asset..."
              className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={loading}
            />
            <div className="flex gap-2">
              <Button onClick={() => onSave(description)} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
              <Button variant="outline" onClick={onGenerate} disabled={loading}>
                {loading ? 'Generating...' : 'Generate with AI'}
              </Button>
              <Button variant="outline" onClick={onClose} disabled={loading}>
                Cancel
              </Button>
            </div>
            {loading && (
              <p className="text-sm text-gray-500 text-center">
                AI is analyzing the table structure and generating a description...
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Utilities
function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return d.toLocaleDateString();
}

export default DataCatalog;