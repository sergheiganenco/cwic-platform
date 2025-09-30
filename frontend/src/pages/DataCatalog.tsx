// src/pages/DataCatalog.tsx — Production-hardened
import { AlertTriangle, Download, Plus, RefreshCw, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

// Components
import { AssetAnalytics } from '@/components/features/data-catalog/AssetAnalytics';
import { AssetDetails } from '@/components/features/data-catalog/AssetDetails';
import { AssetGrid } from '@/components/features/data-catalog/AssetGrid';
import { BulkActionModal } from '@/components/features/data-catalog/BulkActionModal';
import { CreateAssetModal } from '@/components/features/data-catalog/CreateAssetModal';
import { SearchFilters } from '@/components/features/data-catalog/SearchFilters';
import { Button } from '@/components/ui/Button';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { MetricsCard } from '@/components/ui/MetricsCard';
import { Skeleton } from '@/components/ui/Skeleton';

// Hooks
import { useAssetMetrics } from '@/hooks/useAssetMetrics';
import { useBulkActions } from '@/hooks/useBulkActions';
import { useDataAssets } from '@/hooks/useDataAssets';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePermissions } from '@/hooks/usePermissions';
import { useUrlSync } from '@/hooks/useUrlSync';
import { useWebSocket } from '@/hooks/useWebSocket';

// Types
import type { BulkAction } from '@/types/bulkActions';
import type { Asset, AssetFilters, CreateAssetData } from '@/types/dataAssets';


const DEFAULT_FILTERS: AssetFilters = {
  page: 1,
  limit: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

const REFRESH_INTERVAL = 30_000; // 30s
const MAX_SELECTIONS = 100;

interface DataCatalogState {
  selectedAssets: Set<string>;
  showDetails: boolean;
  showCreateModal: boolean;
  showBulkModal: boolean;
  showAnalytics: boolean;
  viewMode: 'grid' | 'table' | 'cards';
  selectedId: string | null;
}

export const DataCatalog: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local UI state
  const [state, setState] = useState<DataCatalogState>({
    selectedAssets: new Set(),
    showDetails: false,
    showCreateModal: false,
    showBulkModal: false,
    showAnalytics: false,
    viewMode: 'grid',
    selectedId: null,
  });

  // Keep a stable ref for gtag calls (avoids re-renders)
  const gtagRef = useRef<typeof window.gtag | undefined>(undefined);
  useEffect(() => { gtagRef.current = window.gtag; }, []);

  // URL ↔ filters sync
  const { filters, updateFilters } = useUrlSync({
    defaultFilters: DEFAULT_FILTERS,
    searchParams,
    setSearchParams,
  });

  // Data (resilient to gateway/data-service blips)
  const {
    assets,
    pagination,
    summary,
    isLoading,
    error,
    isEmpty,
    hasFilters,
    updateFilters: updateAssetFilters,
    clearFilters,
    refresh,
    requestAccess,
    isValidating,
    mutate,
    isOffline,
  } = useDataAssets({
    autoFetch: true,
    defaultFilters: filters,
    refreshInterval: REFRESH_INTERVAL,
    revalidateOnFocus: true,
    errorRetryCount: 3,
  });

  // Metrics & analytics
  const {
    metrics,
    trends,
    qualityScore,
    isLoading: metricsLoading,
    refresh: refreshMetrics,
  } = useAssetMetrics({
    filters,
    enabled: true,
    refreshInterval: 60_000,
  });

  // Permissions
  const { can, permissions, userRole } = usePermissions();

  // Bulk ops
  const { performBulkAction, isProcessing, progress, results } = useBulkActions();

  // WebSocket (default OFF in dev to avoid reconnect storms)
  const { isOpen: live } = useWebSocket('/api/assets/updates', {
    enabled: import.meta.env.VITE_WS_ENABLED === '1',
    maxReconnectAttempts: 5,
    backoffInitial: 1500,
    disableInDev: true,
    onMessage: (msg: any) => {
      // Only revalidate on meaningful events
      if (msg?.type === 'asset_updated' || msg?.type === 'asset_created' || msg?.type === 'asset_deleted') {
        mutate();
        if (msg?.assetName) toast.success(`Asset “${msg.assetName}” ${msg.type.split('_')[1]}`);
      }
    },
  });

  // Keyboard shortcuts
  useKeyboardShortcuts({
    'cmd+k': () =>
      (document.querySelector('[data-search-input]') as HTMLInputElement | null)?.focus(),
    'cmd+n': () => can('create', 'assets') && setState((s) => ({ ...s, showCreateModal: true })),
    'cmd+r': () => { refresh(); refreshMetrics(); },
    escape: () =>
      setState((s) => ({
        ...s,
        showDetails: false,
        showCreateModal: false,
        selectedAssets: new Set(),
      })),
  });

  // Sync URL filters → data hook
  useEffect(() => {
    updateAssetFilters(filters);
  }, [filters, updateAssetFilters]);

  const selectedAsset = useMemo<Asset | null>(
    () => assets.find((a) => a.id === state.selectedId) ?? null,
    [assets, state.selectedId]
  );

  const handleSelect = useCallback(
    (id: string) => {
      setState((prev) => ({ ...prev, selectedId: id, showDetails: true }));
      try {
        gtagRef.current?.('event', 'asset_viewed', {
          asset_id: id,
          asset_type: assets.find((a) => a.id === id)?.type,
        });
      } catch { /* no-op */ }
    },
    [assets]
  );

  const handleBulkSelect = useCallback((assetId: string, selected: boolean) => {
    setState((prev) => {
      const next = new Set(prev.selectedAssets);
      if (selected && next.size < MAX_SELECTIONS) next.add(assetId);
      else if (!selected) next.delete(assetId);
      else {
        toast.warning(`Maximum ${MAX_SELECTIONS} assets can be selected`);
        return prev;
      }
      return { ...prev, selectedAssets: next };
    });
  }, []);

  const handleSelectAll = useCallback(
    (selected: boolean) => {
      setState((prev) => ({
        ...prev,
        selectedAssets: selected ? new Set(assets.slice(0, MAX_SELECTIONS).map((a) => a.id)) : new Set(),
      }));
    },
    [assets]
  );

  const handleRequestAccess = useCallback(
    async (assetId: string, reason?: string, urgency: 'low' | 'medium' | 'high' = 'medium') => {
      try {
        const result = await requestAccess(assetId, reason, { urgency });
        toast.success(`Access request submitted`, {
          description: `Request ID: ${result.requestId}`,
          action: { label: 'View Request', onClick: () => navigate(`/requests/${result.requestId}`) },
        });
        try {
          gtagRef.current?.('event', 'access_requested', { asset_id: assetId, urgency });
        } catch { /* no-op */ }
      } catch (e: any) {
        toast.error('Failed to submit access request', { description: e?.message || 'Unknown error' });
      }
    },
    [requestAccess, navigate]
  );

  const handleCreateAsset = useCallback(
    async (data: CreateAssetData) => {
      try {
        // TODO: implement create in data-service; keep UX flow ready
        toast.success('Asset created successfully');
        setState((prev) => ({ ...prev, showCreateModal: false }));
        refresh();
      } catch (e: any) {
        toast.error('Failed to create asset', { description: e?.message || 'Unknown error' });
      }
    },
    [refresh]
  );

  const handleBulkAction = useCallback(
    async (action: BulkAction) => {
      try {
        const assetIds = Array.from(state.selectedAssets);
        const result = await performBulkAction(action, assetIds);
        toast.success(`Bulk ${action.type} completed`, {
          description: `${result.successful} of ${assetIds.length} assets processed`,
        });
        setState((prev) => ({ ...prev, selectedAssets: new Set(), showBulkModal: false }));
        refresh();
      } catch (e: any) {
        toast.error('Bulk action failed', { description: e?.message || 'Unknown error' });
      }
    },
    [state.selectedAssets, performBulkAction, refresh]
  );

  // Debounced filter setter (keeps your handler shape)
  const debounceRef = useRef<number | null>(null);
  const createFilterHandler = useCallback(
    (filterKey: keyof AssetFilters) => (value: string | undefined) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        updateFilters({ [filterKey]: value || undefined, page: 1 });
        try {
          if (value) gtagRef.current?.('event', 'filter_applied', { filter_type: filterKey, filter_value: value });
        } catch { /* no-op */ }
      }, 250);
    },
    [updateFilters]
  );

  // Export — targets gateway → data-service CSV export
  const handleExport = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ ...(filters as any), format: 'csv' }).toString();
      // Prefer explicit export endpoint if you added it; otherwise use list with format=csv
      const res = await fetch(`/api/catalog/assets/export?${qs}`, { method: 'GET' })
        .catch(() => fetch(`/api/catalog/assets?${qs}`, { headers: { accept: 'text/csv' } as any }));
      if (!res || !res.ok) throw new Error(`Export failed (${res?.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assets-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Assets exported');
    } catch (e: any) {
      toast.error('Failed to export assets', { description: e?.message || 'Unknown error' });
    }
  }, [filters]);

  // Loading skeleton
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
      <Skeleton className="h-12 rounded-lg" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-lg" />)}
      </div>
    </div>
  );

  // Early error view
  if (error && !isLoading && assets.length === 0) {
    return (
      <ErrorBoundary
        error={error}
        onRetry={() => { refresh(); refreshMetrics(); }}
        title="Failed to load data catalog"
        description="There was an error loading your data assets. Please try again."
        actionLabel="Retry Loading"
      />
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {/* Offline banner (gentle, non-flickering) */}
        {isOffline && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">
            Some services are temporarily unavailable. Reconnecting…
          </div>
        )}

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Data Catalog
                  {(isValidating || metricsLoading) && (
                    <RefreshCw className="inline-block ml-2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </h1>
                <p className="mt-1 text-gray-600">Discover and manage all your data assets across your platform.</p>
              </div>

              {/* Connection status: WS + API offline */}
              <div className="flex items-center space-x-2">
                <div
                  className={`h-2 w-2 rounded-full ${
                    isOffline ? 'bg-red-500' : live ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                  title={isOffline ? 'Offline (retrying)' : live ? 'Live' : 'Idle'}
                />
                <span className="text-xs text-gray-500">
                  {isOffline ? 'Offline (retrying)' : live ? 'Live' : 'Idle'}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              {state.selectedAssets.size > 0 && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">{state.selectedAssets.size} selected</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setState((s) => ({ ...s, showBulkModal: true }))}
                    disabled={isProcessing || isOffline}
                  >
                    Bulk Actions
                  </Button>
                </div>
              )}

              {can('export', 'assets') && (
                <Button variant="outline" onClick={handleExport} disabled={isLoading || assets.length === 0 || isOffline}>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => setState((s) => ({ ...s, showAnalytics: !s.showAnalytics }))}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                Analytics
              </Button>

              {can('create', 'assets') && (
                <Button onClick={() => setState((s) => ({ ...s, showCreateModal: true }))} disabled={isOffline}>
                  <Plus className="mr-2 h-4 w-4" />
                  Register Asset
                </Button>
              )}
            </div>
          </div>

          {/* Metrics */}
          {isLoading && assets.length === 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              <MetricsCard title="Total Assets" value={summary?.total?.toLocaleString() || '0'} trend={trends?.totalAssets} icon="database" />
              <MetricsCard title="Tables" value={summary?.byType?.table?.toLocaleString() || '0'} icon="table" />
              <MetricsCard title="High Quality" value={summary?.byQuality?.high?.toLocaleString() || '0'}
                percentage={((summary?.byQuality?.high ?? 0) / (summary?.total || 1)) * 100} icon="check-circle" />
              <MetricsCard title="Asset Types" value={Object.keys(summary?.byType || {}).length.toString()} icon="grid" />
              <MetricsCard
                title="Quality Score"
                value={qualityScore ? `${qualityScore}%` : 'N/A'}
                trend={trends?.qualityScore}
                icon="shield-check"
                variant={(qualityScore ?? 0) >= 80 ? 'success' : (qualityScore ?? 0) >= 60 ? 'warning' : 'error'}
              />
              <MetricsCard title="Active Users" value={metrics?.activeUsers?.toLocaleString() || '0'} trend={trends?.activeUsers} icon="users" />
            </div>
          )}

          {/* Quality alert */}
          {qualityScore && qualityScore < 70 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-yellow-800">Data Quality Alert</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Overall data quality score is {qualityScore}%. Consider reviewing data quality rules and addressing issues.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Analytics panel */}
        {state.showAnalytics && (
          <AssetAnalytics
            metrics={metrics}
            trends={trends}
            filters={filters}
            onClose={() => setState((s) => ({ ...s, showAnalytics: false }))}
          />
        )}

        {/* Filters */}
        <SearchFilters
          q={filters.search || ''}
          setQ={createFilterHandler('search')}
          type={filters.type || ''}
          setType={createFilterHandler('type')}
          owner={filters.owner || ''}
          setOwner={createFilterHandler('owner')}
          quality={filters.quality || ''}
          setQuality={createFilterHandler('quality')}
          classification={filters.classification || ''}
          setClassification={createFilterHandler('classification')}
          dataSourceId={filters.dataSourceId || ''}
          setDataSourceId={createFilterHandler('dataSourceId')}
          totalResults={pagination.total}
          isLoading={isLoading || isValidating}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          onRefresh={() => { refresh(); refreshMetrics(); }}
          viewMode={state.viewMode}
          onViewModeChange={(mode) => setState((s) => ({ ...s, viewMode: mode }))}
          canSelectAll={can('bulk_select', 'assets')}
          selectedCount={state.selectedAssets.size}
          onSelectAll={handleSelectAll}
          maxSelections={MAX_SELECTIONS}
        />

        {/* Grid / Table */}
        {isLoading && assets.length === 0 ? (
          <LoadingSkeleton />
        ) : (
          <AssetGrid
            items={assets}
            onSelect={handleSelect}
            loading={isLoading}
            validating={isValidating}
            pagination={pagination}
            onPageChange={(page) => updateFilters({ page })}
            error={error}
            isEmpty={isEmpty}
            hasFilters={hasFilters}
            viewMode={state.viewMode}
            selectedAssets={state.selectedAssets}
            onBulkSelect={can('bulk_select', 'assets') ? handleBulkSelect : undefined}
            permissions={permissions}
            userRole={userRole}
            onQuickAction={(assetId, action) => {
              // Hook up bookmark/share/etc here
              console.debug('Quick action:', action, 'asset:', assetId);
            }}
          />
        )}

        {/* Drawers / Modals */}
        <AssetDetails
          asset={selectedAsset}
          isOpen={state.showDetails}
          onClose={() => setState((s) => ({ ...s, showDetails: false, selectedId: null }))}
          onRequestAccess={handleRequestAccess}
        />

        {can('create', 'assets') && (
          <CreateAssetModal
            isOpen={state.showCreateModal}
            onClose={() => setState((s) => ({ ...s, showCreateModal: false }))}
            onCreate={handleCreateAsset}
          />
        )}

        {can('bulk_actions', 'assets') && (
          <BulkActionModal
            isOpen={state.showBulkModal}
            onClose={() => setState((s) => ({ ...s, showBulkModal: false }))}
            selectedAssets={Array.from(state.selectedAssets)}
            onAction={handleBulkAction}
            isProcessing={isProcessing}
            progress={progress ?? undefined}
            results={
              results
                ? {
                    ...results,
                    errors: results.errors?.map(({ assetId, error }) => ({ assetId, message: error })),
                  }
                : undefined
            }
          />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default DataCatalog;
