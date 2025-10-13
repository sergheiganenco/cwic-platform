import { Badge } from '@components/ui/Badge';
import {
  BookmarkIcon,
  Calendar,
  Clock,
  Database,
  FileText,
  Key,
  Layers,
  Loader2,
  MoreVertical,
  RefreshCw,
  Tag,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import type { Asset, Column } from '@/types/dataAssets';
import { useApi } from '@/hooks/useApi';
import { useLineageDrill } from '@/hooks/useLineageDrill';
import { buildDataUrn } from '@/utils/lineageUrn';
import { LineagePreviewList } from '@/components/lineage/LineagePreviewList';

interface AssetDetailsPanelProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onAction?: (action: string) => void;
}

export const AssetDetailsPanel: React.FC<AssetDetailsPanelProps> = ({
  asset,
  isOpen,
  onClose,
  onAction,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'columns' | 'lineage' | 'usage'>(
    'overview'
  );
  const [columns, setColumns] = useState<Column[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const api = useApi();

  const assetUrn = useMemo(() => {
    if (!asset) return null;
    if (asset.urn) return asset.urn;
    return buildDataUrn({
      platform: asset.dataSourceType ?? 'unknown',
      systemId: asset.dataSourceName ?? asset.dataSourceId,
      database: (asset.metadata as any)?.database ?? asset.dataSourceName ?? undefined,
      schema: asset.schema,
      object: asset.table ?? asset.name,
    });
  }, [asset]);

  const lineageQuery = useLineageDrill(
    { urn: assetUrn, depth: 2, direction: 'both' },
    Boolean(assetUrn) && activeTab === 'lineage',
  );

  // Load columns when columns tab is opened
  useEffect(() => {
    if (activeTab === 'columns' && asset && columns.length === 0 && !asset.columns) {
      setLoadingColumns(true);
      api.get<{success?: boolean; data?: Asset; columns?: Column[]}>(`/api/catalog/assets/${asset.id}`)
        .then((response) => {
          const data = response.data || response;
          const cols = data.columns || [];
          // Transform if needed
          const transformedCols = cols.map((c: any) => ({
            id: c.id,
            name: c.column_name || c.name,
            dataType: c.data_type || c.dataType,
            isNullable: c.is_nullable ?? c.isNullable ?? c.nullable,
            isPrimaryKey: c.is_primary_key ?? c.isPrimaryKey ?? c.primaryKey ?? false,
            description: c.description,
          }));
          setColumns(transformedCols);
        })
        .catch((err) => {
          console.error('Failed to load columns:', err);
        })
        .finally(() => {
          setLoadingColumns(false);
        });
    }
  }, [activeTab, asset, columns.length, api]);

  // Reset columns when asset changes
  useEffect(() => {
    setColumns([]);
    setActiveTab('overview');
  }, [asset?.id]);

  if (!asset) return null;

  const formatDate = (date: string | Date | undefined): string => {
    if (!date) return 'Unknown';
    try {
      return new Date(date).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const formatRowCount = (count: number | string | null | undefined): string => {
    if (count === null || count === undefined) return '—';
    const num = typeof count === 'string' ? parseInt(count) : count;
    if (isNaN(num)) return '—';
    return num.toLocaleString();
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Slide-in Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <Database className="h-5 w-5 text-gray-600 flex-shrink-0" />
                  <h2 className="text-xl font-semibold text-gray-900 truncate">
                    {asset.name || asset.table}
                  </h2>
                  <Badge tone="neutral">{asset.type?.toUpperCase()}</Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {asset.dataSourceName}
                  {asset.schema && ` · ${asset.schema}`}
                  {asset.table && asset.table !== asset.name && ` · ${asset.table}`}
                </p>
              </div>
              <button
                onClick={onClose}
                className="flex-shrink-0 p-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                <X className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => onAction?.('bookmark')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <BookmarkIcon className="h-4 w-4" />
                Bookmark
              </button>
              <button
                onClick={() => onAction?.('query')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <FileText className="h-4 w-4" />
                Query
              </button>
              <button
                onClick={() => onAction?.('preview')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Preview Data
              </button>
              <button
                onClick={() => onAction?.('more')}
                className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-md transition-colors"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex-shrink-0 border-b border-gray-200 bg-white">
            <div className="flex gap-1 px-6">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'columns', label: `Columns (${asset.columnCount || asset.columns?.length || 0})` },
                { id: 'lineage', label: 'Lineage' },
                { id: 'usage', label: 'Usage' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Statistics */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Statistics
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-semibold text-gray-900 mb-1">
                        {formatRowCount(asset.rowCount)}
                      </div>
                      <div className="text-xs text-gray-600">Rows</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-semibold text-gray-900 mb-1">
                        {asset.columnCount || asset.columns?.length || 0}
                      </div>
                      <div className="text-xs text-gray-600">Columns</div>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <div className="text-2xl font-semibold text-gray-900 mb-1">
                        {asset.metadata?.sizeBytes
                          ? `${(asset.metadata.sizeBytes / 1024 / 1024).toFixed(1)} MB`
                          : '—'}
                      </div>
                      <div className="text-xs text-gray-600">Size</div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {asset.description && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Description
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">{asset.description}</p>
                  </div>
                )}

                {/* Tags */}
                {asset.tags && asset.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {asset.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    Metadata
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Data Source</span>
                      <span className="font-medium text-gray-900">
                        {asset.dataSourceName} ({asset.dataSourceType})
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Schema</span>
                      <span className="font-medium text-gray-900">{asset.schema || '—'}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Created
                      </span>
                      <span className="font-medium text-gray-900">{formatDate(asset.createdAt)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Last Updated
                      </span>
                      <span className="font-medium text-gray-900">{formatDate(asset.updatedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'columns' && (
              <div className="space-y-2">
                {loadingColumns ? (
                  <div className="text-center py-12 text-gray-500">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 text-blue-500 animate-spin" />
                    <p>Loading columns...</p>
                  </div>
                ) : (asset.columns || columns).length > 0 ? (
                  (asset.columns || columns).map((column) => (
                    <div
                      key={column.id || column.name}
                      className="p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-900">{column.name}</span>
                            <span className="text-sm text-gray-600 font-mono">{column.dataType}</span>
                            {column.isPrimaryKey && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded">
                                <Key className="h-3 w-3" />
                                PK
                              </span>
                            )}
                            {!column.isNullable && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                NOT NULL
                              </span>
                            )}
                          </div>
                          {column.description && (
                            <p className="text-sm text-gray-600 mt-1">{column.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <Database className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p>No column information available</p>
                    <p className="text-sm mt-1">Run a scan to populate column metadata</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'lineage' && (
              <div className="space-y-4">
                {!assetUrn && (
                  <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-lg">
                    Unable to derive a canonical URN for this asset.
                  </div>
                )}
                {assetUrn && lineageQuery.isLoading && (
                  <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Loading lineage...
                  </div>
                )}
                {assetUrn && lineageQuery.isError && (
                  <div className="text-center text-red-600 py-6 text-sm">
                    Failed to load lineage details.
                  </div>
                )}
                {assetUrn && lineageQuery.data && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <LineagePreviewList
                      title="Upstream"
                      emptyLabel="No upstream relationships detected."
                      edges={lineageQuery.data.edges.filter((edge) => edge.to === lineageQuery.data!.focus.urn)}
                      nodes={lineageQuery.data.nodes}
                      neighbour="from"
                    />
                    <LineagePreviewList
                      title="Downstream"
                      emptyLabel="No downstream relationships detected."
                      edges={lineageQuery.data.edges.filter((edge) => edge.from === lineageQuery.data!.focus.urn)}
                      nodes={lineageQuery.data.nodes}
                      neighbour="to"
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === 'usage' && (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>Usage analytics coming soon</p>
                <p className="text-sm mt-1">See who's using this asset and how often</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

