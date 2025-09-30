// src/components/features/data-catalog/AssetGrid.tsx - Enhanced Version
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { Asset, PaginationInfo } from '@/types/dataAssets';
import {
  BarChart3,
  Clock,
  Database,
  Eye,
  FileText,
  Globe,
  MoreHorizontal,
  Share,
  Shield,
  Star
} from 'lucide-react';
import React from 'react';

interface AssetGridProps {
  items: Asset[];
  onSelect: (id: string) => void;
  loading: boolean;
  validating?: boolean;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  error: string | null;
  isEmpty: boolean;
  hasFilters: boolean;
  viewMode?: 'grid' | 'table' | 'cards';
  selectedAssets?: Set<string>;
  onBulkSelect?: (assetId: string, selected: boolean) => void;
  permissions?: string[];
  userRole?: string;
  onQuickAction?: (assetId: string, action: string) => void;
}

export const AssetGrid: React.FC<AssetGridProps> = ({
  items,
  onSelect,
  loading,
  validating = false,
  pagination,
  onPageChange,
  error,
  isEmpty,
  hasFilters,
  viewMode = 'grid',
  selectedAssets,
  onBulkSelect,
  permissions = [],
  userRole = 'user',
  onQuickAction
}) => {
  const getAssetIcon = (type: Asset['type']) => {
    const icons = {
      table: Database,
      view: Database,
      file: FileText,
      api: Globe,
      dashboard: BarChart3,
      report: FileText
    };
    return icons[type] || Database;
  };

  const getQualityColor = (quality: Asset['quality']) => {
    const colors = {
      high: 'text-green-600 bg-green-100',
      medium: 'text-yellow-600 bg-yellow-100',
      low: 'text-red-600 bg-red-100'
    };
    return colors[quality];
  };

  const getClassificationColor = (classification: Asset['classification']) => {
    const colors = {
      public: 'text-blue-600 bg-blue-100',
      internal: 'text-gray-600 bg-gray-100',
      confidential: 'text-orange-600 bg-orange-100',
      restricted: 'text-red-600 bg-red-100'
    };
    return colors[classification];
  };

  const formatLastUpdated = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  // Loading state
  if (loading && items.length === 0) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border p-6 space-y-4">
              <div className="flex items-start justify-between">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-4 w-16 rounded" />
              </div>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <div className="flex justify-between items-center">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {hasFilters ? 'No assets match your filters' : 'No assets found'}
        </h3>
        <p className="text-gray-500 mb-6">
          {hasFilters 
            ? 'Try adjusting your search criteria or clearing filters'
            : 'Get started by registering your first data asset'
          }
        </p>
        {hasFilters && (
          <Button variant="outline" onClick={() => window.location.reload()}>
            Clear all filters
          </Button>
        )}
      </div>
    );
  }

  const AssetCard = ({ asset }: { asset: Asset }) => {
    const IconComponent = getAssetIcon(asset.type);
    const isSelected = selectedAssets?.has(asset.id) || false;

    return (
      <div
        className={`bg-white rounded-lg border hover:border-blue-300 transition-all duration-200 cursor-pointer group relative ${
          isSelected ? 'ring-2 ring-blue-500 border-blue-300' : ''
        } ${validating ? 'opacity-75' : ''}`}
        onClick={() => onSelect(asset.id)}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              {onBulkSelect && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    onBulkSelect(asset.id, e.target.checked);
                  }}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              )}
              <IconComponent className="h-5 w-5 text-gray-600" />
            </div>
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getQualityColor(asset.quality)}`}>
                {asset.quality}
              </span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickAction?.(asset.id, 'bookmark');
                  }}
                  className="p-1 text-gray-400 hover:text-yellow-500"
                  title="Bookmark"
                >
                  {asset.isBookmarked ? <Star className="h-4 w-4 fill-current text-yellow-500" /> : <Star className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Asset Info */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
              {asset.name}
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              {asset.schema}.{asset.table}
            </p>
            {asset.description && (
              <p className="text-sm text-gray-600 line-clamp-2">
                {asset.description}
              </p>
            )}
          </div>

          {/* Tags */}
          {asset.tags && asset.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-4">
              {asset.tags.slice(0, 3).map((tag, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
              {asset.tags.length > 3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded-full">
                  +{asset.tags.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-gray-500">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <Shield className="h-3 w-3" />
                <span className={`px-1 py-0.5 text-xs rounded ${getClassificationColor(asset.classification)}`}>
                  {asset.classification}
                </span>
              </div>
              {asset.viewCount && (
                <div className="flex items-center space-x-1">
                  <Eye className="h-3 w-3" />
                  <span>{asset.viewCount}</span>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>{formatLastUpdated(asset.lastUpdated)}</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Menu */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                // You could implement a dropdown menu here
              }}
              className="p-1 text-gray-400 hover:text-gray-600 bg-white rounded-full shadow-sm"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const TableRow = ({ asset }: { asset: Asset }) => {
    const IconComponent = getAssetIcon(asset.type);
    const isSelected = selectedAssets?.has(asset.id) || false;

    return (
      <tr
        className={`hover:bg-gray-50 cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
        onClick={() => onSelect(asset.id)}
      >
        {onBulkSelect && (
          <td className="px-6 py-4">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onBulkSelect(asset.id, e.target.checked);
              }}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          </td>
        )}
        <td className="px-6 py-4">
          <div className="flex items-center space-x-3">
            <IconComponent className="h-5 w-5 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900">{asset.name}</div>
              <div className="text-sm text-gray-500">{asset.schema}.{asset.table}</div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4">
          <span className="capitalize text-sm text-gray-700">{asset.type}</span>
        </td>
        <td className="px-6 py-4">
          <span className="text-sm text-gray-700">{asset.owner}</span>
        </td>
        <td className="px-6 py-4">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getQualityColor(asset.quality)}`}>
            {asset.quality}
          </span>
        </td>
        <td className="px-6 py-4">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getClassificationColor(asset.classification)}`}>
            {asset.classification}
          </span>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          {formatLastUpdated(asset.lastUpdated)}
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction?.(asset.id, 'bookmark');
              }}
              className="text-gray-400 hover:text-yellow-500"
            >
              {asset.isBookmarked ? <Star className="h-4 w-4 fill-current text-yellow-500" /> : <Star className="h-4 w-4" />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAction?.(asset.id, 'share');
              }}
              className="text-gray-400 hover:text-blue-500"
            >
              <Share className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const Pagination = () => {
    if (pagination.totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 7;
    const halfVisible = Math.floor(maxVisiblePages / 2);
    
    let startPage = Math.max(1, pagination.page - halfVisible);
    let endPage = Math.min(pagination.totalPages, pagination.page + halfVisible);
    
    if (endPage - startPage + 1 < maxVisiblePages) {
      if (startPage === 1) {
        endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
      } else {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex items-center justify-between px-6 py-4 border-t">
        <div className="text-sm text-gray-700">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} results
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasPrev || loading}
            onClick={() => onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          
          {startPage > 1 && (
            <>
              <button
                onClick={() => onPageChange(1)}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                1
              </button>
              {startPage > 2 && <span className="text-gray-500">...</span>}
            </>
          )}
          
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              disabled={loading}
              className={`px-3 py-1 text-sm border rounded ${
                page === pagination.page
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {page}
            </button>
          ))}
          
          {endPage < pagination.totalPages && (
            <>
              {endPage < pagination.totalPages - 1 && <span className="text-gray-500">...</span>}
              <button
                onClick={() => onPageChange(pagination.totalPages)}
                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
              >
                {pagination.totalPages}
              </button>
            </>
          )}
          
          <Button
            variant="outline"
            size="sm"
            disabled={!pagination.hasNext || loading}
            onClick={() => onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {onBulkSelect && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Asset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quality
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Classification
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((asset) => (
                <TableRow key={asset.id} asset={asset} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cards View */}
      {viewMode === 'cards' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {items.map((asset) => {
            const IconComponent = getAssetIcon(asset.type);
            const isSelected = selectedAssets?.has(asset.id) || false;

            return (
              <div
                key={asset.id}
                className={`bg-white border rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer ${
                  isSelected ? 'ring-2 ring-blue-500 border-blue-300' : ''
                }`}
                onClick={() => onSelect(asset.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    {onBulkSelect && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          onBulkSelect(asset.id, e.target.checked);
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                    )}
                    <IconComponent className="h-5 w-5 text-gray-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{asset.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{asset.schema}.{asset.table}</p>
                      {asset.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-1">{asset.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getQualityColor(asset.quality)}`}>
                      {asset.quality}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded ${getClassificationColor(asset.classification)}`}>
                      {asset.classification}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      <Pagination />
    </div>
  );
};