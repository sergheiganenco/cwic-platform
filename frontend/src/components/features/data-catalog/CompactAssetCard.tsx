import { Database, MoreVertical, Table, FileText, Eye, TrendingUp } from 'lucide-react';
import React from 'react';
import type { Asset } from '@/types/dataAssets';

interface CompactAssetCardProps {
  asset: Asset;
  onClick?: () => void;
  onQuickAction?: (action: string) => void;
  selected?: boolean;
}

export const CompactAssetCard: React.FC<CompactAssetCardProps> = ({
  asset,
  onClick,
  onQuickAction,
  selected = false,
}) => {
  const [showMenu, setShowMenu] = React.useState(false);

  // Calculate quality score (0-100) based on available metadata
  const calculateQualityScore = (): number => {
    let score = 0;
    if (asset.description) score += 30;
    if (asset.tags && asset.tags.length > 0) score += 20;
    if (asset.rowCount !== null && asset.rowCount !== undefined) score += 25;
    if (asset.columns && asset.columns.length > 0) score += 25;
    return Math.min(100, score);
  };

  const qualityScore = calculateQualityScore();

  // Get quality color
  const getQualityColor = (score: number): string => {
    if (score >= 80) return 'text-green-600 border-green-500';
    if (score >= 60) return 'text-blue-600 border-blue-500';
    if (score >= 40) return 'text-yellow-600 border-yellow-500';
    return 'text-red-600 border-red-500';
  };

  // Get type icon
  const getTypeIcon = () => {
    switch (asset.type?.toLowerCase()) {
      case 'table':
        return <Table className="h-4 w-4" />;
      case 'view':
        return <Eye className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  // Format row count
  const formatRowCount = (count: number | string | null | undefined): string => {
    if (count === null || count === undefined) return '—';
    const num = typeof count === 'string' ? parseInt(count) : count;
    if (isNaN(num)) return '—';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Get freshness indicator
  const getFreshnessIndicator = (): { color: string; label: string } => {
    if (!asset.updatedAt) return { color: 'bg-gray-400', label: 'Unknown' };

    const updated = new Date(asset.updatedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);

    if (hoursDiff < 24) return { color: 'bg-green-500', label: 'Fresh' };
    if (hoursDiff < 168) return { color: 'bg-blue-500', label: 'Recent' };
    if (hoursDiff < 720) return { color: 'bg-yellow-500', label: 'Aging' };
    return { color: 'bg-red-500', label: 'Stale' };
  };

  const freshness = getFreshnessIndicator();

  return (
    <div
      className={`
        relative bg-white rounded-lg border-2 p-4 cursor-pointer transition-all
        hover:shadow-lg hover:border-blue-400
        ${selected ? 'border-blue-500 shadow-md' : 'border-gray-200'}
      `}
      onClick={onClick}
    >
      {/* Quality Ring - Top Right */}
      <div className="absolute top-3 right-3 flex flex-col items-center">
        <div className={`relative w-12 h-12 ${getQualityColor(qualityScore)}`}>
          {/* Quality circle */}
          <svg className="w-12 h-12 transform -rotate-90">
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              className="text-gray-200"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${(qualityScore / 100) * 125.6} 125.6`}
              className="transition-all duration-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-semibold">{qualityScore}</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="pr-16 mb-3">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-shrink-0 mt-0.5">
            {getTypeIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {asset.name || asset.table || 'Unnamed Asset'}
            </h3>
            <p className="text-xs text-gray-500 truncate">
              {asset.dataSourceName || asset.schema || 'Unknown Source'}
              {asset.schema && asset.dataSourceName && ` · ${asset.schema}`}
            </p>
          </div>
        </div>

        {/* Type Badge & Freshness */}
        <div className="flex items-center gap-2">
          {asset.type && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded">
              {asset.type.toUpperCase()}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${freshness.color}`} />
            <span className="text-xs text-gray-500">{freshness.label}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-3 pt-3 border-t border-gray-100">
        {/* Row Count */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 mb-1">Rows</span>
          <span className="text-lg font-semibold text-gray-900">
            {formatRowCount(asset.rowCount)}
          </span>
        </div>

        {/* Columns */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 mb-1">Columns</span>
          <span className="text-lg font-semibold text-gray-900">
            {asset.columns?.length || asset.columnCount || '—'}
          </span>
        </div>
      </div>

      {/* Description Preview */}
      {asset.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
          {asset.description}
        </p>
      )}

      {/* Tags */}
      {asset.tags && asset.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {asset.tags.slice(0, 2).map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full"
            >
              {tag}
            </span>
          ))}
          {asset.tags.length > 2 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              +{asset.tags.length - 2}
            </span>
          )}
        </div>
      )}

      {/* Quick Actions Menu */}
      <div className="absolute bottom-3 right-3">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
        >
          <MoreVertical className="h-4 w-4 text-gray-500" />
        </button>

        {showMenu && (
          <div
            className="absolute bottom-full right-0 mb-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                onQuickAction?.('preview');
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
            >
              Preview Data
            </button>
            <button
              onClick={() => {
                onQuickAction?.('lineage');
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
            >
              View Lineage
            </button>
            <button
              onClick={() => {
                onQuickAction?.('query');
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
            >
              Query
            </button>
            <div className="border-t border-gray-200" />
            <button
              onClick={() => {
                onQuickAction?.('bookmark');
                setShowMenu(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
            >
              Bookmark
            </button>
          </div>
        )}
      </div>

      {/* Usage Indicator (if available) */}
      {asset.metadata?.queryCount && (
        <div className="flex items-center gap-1 text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
          <TrendingUp className="h-3 w-3" />
          <span>{asset.metadata.queryCount} queries this week</span>
        </div>
      )}
    </div>
  );
};
