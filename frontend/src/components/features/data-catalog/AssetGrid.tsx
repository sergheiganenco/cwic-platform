// src/components/features/data-catalog/AssetGrid.tsx
import { useState } from 'react';

// Types included directly to avoid import issues
interface Asset {
  id: string;
  name: string;
  type: string;
  description?: string;
  owner?: string;
  tags?: string[];
  dataSourceId: string;
  dataSourceName: string;
  schema?: string;
  database?: string;
  rowCount?: number;
  columnCount?: number;
  sizeBytes?: number;
  quality?: 'high' | 'medium' | 'low';
  classification?: 'public' | 'internal' | 'confidential' | 'restricted';
  sensitivityLevel?: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt?: string;
  lastProfiledAt?: string;
  queryCount?: number;
  accessCount?: number;
  popularityScore?: number;
  customProperties?: Record<string, any>;
}

interface AssetGridProps {
  items: Asset[];
  onSelect: (id: string) => void;
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  onPageChange?: (page: number) => void;
  error?: string | null;
  isEmpty?: boolean;
  hasFilters?: boolean;
  viewMode?: 'grid' | 'list';
  onViewModeChange?: (mode: 'grid' | 'list') => void;
}

export function AssetGrid({
  items,
  onSelect,
  loading = false,
  pagination,
  onPageChange,
  error,
  isEmpty = false,
  hasFilters = false,
  viewMode = 'grid',
  onViewModeChange
}: AssetGridProps) {
  const [localViewMode, setLocalViewMode] = useState<'grid' | 'list'>(viewMode);

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setLocalViewMode(mode);
    onViewModeChange?.(mode);
  };

  // Loading skeleton
  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        {/* View mode toggle skeleton */}
        <div className="flex justify-end">
          <div className="h-10 w-24 bg-gray-200 rounded-lg animate-pulse"></div>
        </div>
        
        {/* Grid skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <AssetCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (isEmpty && !loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
        <p className="text-gray-600 mb-4">
          {hasFilters 
            ? 'Try adjusting your filters or search terms.'
            : 'Assets will appear here after syncing your data sources.'}
        </p>
        {hasFilters && (
          <button 
            onClick={() => window.location.reload()} 
            className="text-blue-600 hover:text-blue-800"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  // Error state
  if (error && !loading) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <div className="text-red-600 text-lg font-medium mb-2">
          Failed to load assets
        </div>
        <p className="text-red-700 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentViewMode = onViewModeChange ? viewMode : localViewMode;

  return (
    <div className="space-y-6">
      {/* Header with view mode toggle */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Loading assets...
            </span>
          ) : (
            <>
              Showing {items.length} of {pagination?.total || 0} assets
              {pagination && pagination.totalPages > 1 && (
                <span className="ml-2">
                  (Page {pagination.page} of {pagination.totalPages})
                </span>
              )}
            </>
          )}
        </div>

        {/* View mode toggle */}
        <div className="flex border border-gray-300 rounded-lg">
          <button
            onClick={() => handleViewModeChange('grid')}
            className={`px-3 py-2 text-sm ${
              currentViewMode === 'grid' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:bg-gray-50'
            } rounded-l-lg`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => handleViewModeChange('list')}
            className={`px-3 py-2 text-sm ${
              currentViewMode === 'list' 
                ? 'bg-blue-600 text-white' 
                : 'text-gray-600 hover:bg-gray-50'
            } rounded-r-lg`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Assets Grid/List */}
      <div className={
        currentViewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
      }>
        {items.map(asset => (
          <AssetCard
            key={asset.id}
            asset={asset}
            onClick={() => onSelect(asset.id)}
            viewMode={currentViewMode}
          />
        ))}
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && onPageChange && (
        <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex flex-1 justify-between sm:hidden">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">{(pagination.page - 1) * pagination.limit + 1}</span>
                {' '}to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </span>
                {' '}of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>

                {/* Page numbers */}
                {getPageNumbers(pagination.page, pagination.totalPages).map((pageNum, index) => (
                  pageNum === '...' ? (
                    <span key={index} className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">
                      ...
                    </span>
                  ) : (
                    <button
                      key={index}
                      onClick={() => onPageChange(pageNum as number)}
                      className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                        pageNum === pagination.page
                          ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                          : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                ))}

                <button
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Asset Card Component
function AssetCard({ asset, onClick, viewMode }: { asset: Asset; onClick: () => void; viewMode: 'grid' | 'list' }) {
  const getAssetIcon = (type: string) => {
    const icons: Record<string, string> = {
      table: '🗃️',
      view: '👁️',
      materialized_view: '👁️',
      file: '📄',
      stream: '🌊',
      api: '🔌',
      dataset: '📊',
      model: '🤖',
      dashboard: '📈',
      report: '📋'
    };
    return icons[type] || '📊';
  };

  const getQualityColor = (quality?: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800'
    };
    return quality ? colors[quality as keyof typeof colors] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800';
  };

  const getClassificationColor = (classification?: string) => {
    const colors = {
      public: 'bg-blue-100 text-blue-800',
      internal: 'bg-purple-100 text-purple-800',
      confidential: 'bg-orange-100 text-orange-800',
      restricted: 'bg-red-100 text-red-800'
    };
    return classification ? colors[classification as keyof typeof colors] || 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800';
  };

  const formatNumber = (num?: number) => {
    return num ? new Intl.NumberFormat().format(num) : '—';
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
  };

  if (viewMode === 'list') {
    return (
      <div 
        onClick={onClick}
        className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            <div className="text-2xl">{getAssetIcon(asset.type)}</div>
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className="font-semibold text-gray-900">{asset.name}</h3>
                {asset.quality && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getQualityColor(asset.quality)}`}>
                    {asset.quality}
                  </span>
                )}
                {asset.classification && (
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getClassificationColor(asset.classification)}`}>
                    {asset.classification}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-1">{asset.description}</p>
              <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                <span>{asset.dataSourceName}</span>
                {asset.schema && <span>{asset.schema}</span>}
                <span>{formatNumber(asset.rowCount)} rows</span>
                <span>{asset.columnCount} columns</span>
                <span>Updated {formatRelativeTime(asset.updatedAt)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {asset.tags?.slice(0, 2).map(tag => (
              <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                {tag}
              </span>
            ))}
            {asset.tags && asset.tags.length > 2 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                +{asset.tags.length - 2}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg border p-6 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-2xl">{getAssetIcon(asset.type)}</div>
          <div>
            <h3 className="font-semibold text-gray-900">{asset.name}</h3>
            <p className="text-sm text-gray-600">{asset.dataSourceName} {asset.schema && `• ${asset.schema}`}</p>
          </div>
        </div>
        <div className="flex space-x-1">
          {asset.quality && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getQualityColor(asset.quality)}`}>
              {asset.quality}
            </span>
          )}
          {asset.classification && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getClassificationColor(asset.classification)}`}>
              {asset.classification}
            </span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-600 mb-4 line-clamp-2">{asset.description}</p>

      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <div className="text-gray-500">Rows</div>
          <div className="font-medium">{formatNumber(asset.rowCount)}</div>
        </div>
        <div>
          <div className="text-gray-500">Columns</div>
          <div className="font-medium">{asset.columnCount}</div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">
          Updated {formatRelativeTime(asset.updatedAt)}
        </div>
        <div className="text-xs text-gray-500">
          {asset.owner?.split('@')[0]}
        </div>
      </div>

      {asset.tags && asset.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {asset.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              {tag}
            </span>
          ))}
          {asset.tags.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
              +{asset.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Loading skeleton component
function AssetCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-200 rounded animate-pulse"></div>
          <div>
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
        <div className="flex space-x-1">
          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-6 w-16 bg-gray-200 rounded-full animate-pulse"></div>
        </div>
      </div>

      <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2"></div>
      <div className="h-4 w-3/4 bg-gray-200 rounded animate-pulse mb-4"></div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="h-3 w-8 bg-gray-200 rounded animate-pulse mb-1"></div>
          <div className="h-4 w-12 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div>
          <div className="h-3 w-12 bg-gray-200 rounded animate-pulse mb-1"></div>
          <div className="h-4 w-8 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-20 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-3 w-16 bg-gray-200 rounded animate-pulse"></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="h-6 w-12 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-6 w-16 bg-gray-200 rounded animate-pulse"></div>
        <div className="h-6 w-14 bg-gray-200 rounded animate-pulse"></div>
      </div>
    </div>
  );
}

// Pagination helper
function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  
  if (totalPages <= 7) {
    // Show all pages if 7 or fewer
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Always show first page
    pages.push(1);
    
    if (currentPage <= 4) {
      // Show pages 2-5, then ellipsis, then last page
      for (let i = 2; i <= 5; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      // Show ellipsis, then last 4 pages
      pages.push('...');
      for (let i = totalPages - 4; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show ellipsis, current page area, ellipsis, last page
      pages.push('...');
      for (let i = currentPage - 1; i <= currentPage + 1; i++) {
        pages.push(i);
      }
      pages.push('...');
      pages.push(totalPages);
    }
  }
  
  return pages;
}