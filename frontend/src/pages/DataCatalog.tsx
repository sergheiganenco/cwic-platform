// src/pages/DataCatalog.tsx - Updated with backend integration
import { AssetDetails } from '@/components/features/data-catalog/AssetDetails';
import { AssetGrid } from '@/components/features/data-catalog/AssetGrid';
import { SearchFilters } from '@/components/features/data-catalog/SearchFilters';
import { Button } from '@/components/ui/Button';
import { useDataAssets } from '@/hooks/useDataAssets';
import type { Asset } from '@/types/dataAssets';
import { Plus } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';

export const DataCatalog: React.FC = () => {
  // Use the enhanced hook with backend integration
  const {
    assets,
    pagination,
    summary,
    isLoading,
    error,
    isEmpty,
    hasFilters,
    updateFilters,
    clearFilters,
    refresh,
    requestAccess,
    // For the filters
    filters,
  } = useDataAssets({
    autoFetch: true,
    defaultFilters: {
      page: 1,
      limit: 20,
      sortBy: 'updatedAt',
      sortOrder: 'desc'
    }
  });

  // Local state for UI
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Get selected asset
  const selectedAsset = useMemo<Asset | null>(
    () => assets.find(a => a.id === selectedId) ?? null,
    [assets, selectedId]
  );

  // Handle asset selection
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setShowDetails(true);
  }, []);

  // Handle access request
  const handleRequestAccess = useCallback(async (assetId: string, reason?: string) => {
    try {
      const result = await requestAccess(assetId, reason);
      console.log('Access request submitted:', result);
      // You could show a toast notification here
      alert(`Access request submitted with ID: ${result.requestId}`);
    } catch (error: any) {
      console.error('Failed to request access:', error);
      alert(`Failed to request access: ${error.message}`);
    }
  }, [requestAccess]);

  // Handle create asset
  const handleCreateAsset = useCallback(() => {
    setShowCreateModal(true);
    // You would implement the create modal/form here
  }, []);

  // Filter change handlers
  const handleSearchChange = useCallback((search: string) => {
    updateFilters({ search, page: 1 });
  }, [updateFilters]);

  const handleTypeChange = useCallback((type: string) => {
    updateFilters({ type: type || undefined, page: 1 });
  }, [updateFilters]);

  const handleOwnerChange = useCallback((owner: string) => {
    updateFilters({ owner: owner || undefined, page: 1 });
  }, [updateFilters]);

  const handleQualityChange = useCallback((quality: string) => {
    updateFilters({ quality: (quality as any) || undefined, page: 1 });
  }, [updateFilters]);

  const handleClassificationChange = useCallback((classification: string) => {
    updateFilters({ classification: (classification as any) || undefined, page: 1 });
  }, [updateFilters]);

  const handleDataSourceChange = useCallback((dataSourceId: string) => {
    updateFilters({ dataSourceId: dataSourceId || undefined, page: 1 });
  }, [updateFilters]);

  // Error state
  if (error && !isLoading && assets.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Catalog</h1>
            <p className="mt-1 text-gray-600">
              Discover and manage all your data assets across your platform.
            </p>
          </div>
          <Button onClick={handleCreateAsset}>
            <Plus className="mr-2 h-4 w-4" />
            Register Asset
          </Button>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <div className="text-red-600 text-lg font-medium mb-2">
            Failed to load assets
          </div>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Data Catalog</h1>
            <p className="mt-1 text-gray-600">
              Discover and manage all your data assets across your platform.
            </p>
          </div>
          <Button onClick={handleCreateAsset}>
            <Plus className="mr-2 h-4 w-4" />
            Register Asset
          </Button>
        </div>

        {/* Summary Stats */}
        {!isLoading && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-gray-900">{summary.total.toLocaleString()}</div>
              <div className="text-sm text-gray-600">Total Assets</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-gray-900">{summary.byType.table || 0}</div>
              <div className="text-sm text-gray-600">Tables</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-gray-900">{summary.byQuality.high}</div>
              <div className="text-sm text-gray-600">High Quality</div>
            </div>
            <div className="bg-white rounded-lg border p-4">
              <div className="text-2xl font-bold text-gray-900">
                {Object.keys(summary.byType).length}
              </div>
              <div className="text-sm text-gray-600">Asset Types</div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Filters with Backend Integration */}
      <SearchFilters
        q={filters.search || ''}
        setQ={handleSearchChange}
        type={filters.type || ''}
        setType={handleTypeChange}
        owner={filters.owner || ''}
        setOwner={handleOwnerChange}
        quality={filters.quality || ''}
        setQuality={handleQualityChange}
        classification={filters.classification || ''}
        setClassification={handleClassificationChange}
        dataSourceId={filters.dataSourceId || ''}
        setDataSourceId={handleDataSourceChange}
        totalResults={pagination.total}
        isLoading={isLoading}
        hasFilters={hasFilters}
        onClearFilters={clearFilters}
        onRefresh={refresh}
      />

      {/* Asset Grid with Backend Data */}
      <AssetGrid
        items={assets}
        onSelect={handleSelect}
        loading={isLoading}
        pagination={pagination}
        onPageChange={(page) => updateFilters({ page })}
        error={error}
        isEmpty={isEmpty}
        hasFilters={hasFilters}
      />

      {/* Asset Details Modal */}
      <AssetDetails
        asset={selectedAsset}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onRequestAccess={(assetId, reason) => handleRequestAccess(assetId, reason)}
      />
    </div>
  );
};

export default DataCatalog;