// Enhanced Asset Row with Expandable Details
import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Table as TableIcon,
  Eye as ViewIcon,
  Shield,
  Eye,
  Bookmark,
  Award,
  Tag,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { Badge } from '@components/ui/Badge';
import DetailedAssetView from './DetailedAssetView';

interface Asset {
  id: string;
  name: string;
  type: string;
  dataSourceName: string;
  schema: string;
  table: string;
  databaseName?: string;
  rowCount: number | null;
  columnCount: number;
  qualityScore: number | null;
  trustScore?: number;
  description?: string;
  tags?: string[];
  viewCount?: number;
  bookmarkCount?: number;
  piiDetected?: boolean;
  lastProfiledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface QualityIssueSummary {
  asset_id: string;
  pii_column_count: number;
  columns_with_issues: number;
  total_issues: number;
  critical_issues: number;
  high_issues: number;
}

interface EnhancedAssetRowProps {
  asset: Asset;
  issueSummary?: QualityIssueSummary;
  autoExpand?: boolean;
}

const EnhancedAssetRow: React.FC<EnhancedAssetRowProps> = ({ asset, issueSummary, autoExpand }) => {
  const [expanded, setExpanded] = useState(autoExpand || false);

  // Auto-expand when autoExpand prop changes
  useEffect(() => {
    if (autoExpand) {
      setExpanded(true);
    }
  }, [autoExpand]);

  const rowCount = asset.rowCount;
  const isProfiled = rowCount !== null && rowCount !== -1;
  const hasData = rowCount && rowCount > 0;

  // Quality score color coding
  const getQualityColor = (score: number | null) => {
    if (!score || score === 0) return 'text-gray-400';
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getQualityBadge = (score: number | null) => {
    if (!score || score === 0) return { label: 'N/A', class: 'bg-gray-100 text-gray-600 border-gray-200' };
    if (score >= 90) return { label: 'Excellent', class: 'bg-green-100 text-green-700 border-green-200' };
    if (score >= 70) return { label: 'Good', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
    if (score >= 50) return { label: 'Fair', class: 'bg-orange-100 text-orange-700 border-orange-200' };
    return { label: 'Poor', class: 'bg-red-100 text-red-700 border-red-200' };
  };

  const qualityBadge = getQualityBadge(asset.qualityScore);

  return (
    <>
      <tr
        className={`hover:bg-gray-50 transition-colors cursor-pointer ${expanded ? 'bg-blue-50/30' : ''}`}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand Icon */}
        <td className="py-3 px-4 w-8">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </td>

        {/* Asset Name with Icon */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {asset.type === 'view' ? (
              <ViewIcon className="w-4 h-4 text-purple-500" />
            ) : (
              <TableIcon className="w-4 h-4 text-blue-500" />
            )}
            <div>
              <div className="font-medium text-gray-900">{asset.name}</div>
              {asset.description && (
                <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">
                  {asset.description}
                </div>
              )}
            </div>
          </div>
        </td>

        {/* Type */}
        <td className="py-3 px-4">
          <Badge className={`text-xs ${asset.type === 'view' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'}`}>
            {asset.type}
          </Badge>
        </td>

        {/* Schema */}
        <td className="py-3 px-4 text-sm text-gray-600">{asset.schema}</td>

        {/* Rows */}
        <td className="py-3 px-4 text-right font-mono text-sm text-gray-900">
          {hasData ? rowCount.toLocaleString() : isProfiled ? '0' : '-'}
        </td>

        {/* Columns */}
        <td className="py-3 px-4 text-right font-mono text-sm text-gray-900">
          {asset.columnCount || 0}
        </td>

        {/* PII Column */}
        <td className="py-3 px-4 text-center">
          {issueSummary && issueSummary.pii_column_count > 0 ? (
            <div className="flex items-center justify-center gap-1">
              <Shield className="w-4 h-4 text-amber-600" />
              <span className="text-sm font-semibold text-amber-700">
                {issueSummary.pii_column_count}
              </span>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">-</span>
          )}
        </td>

        {/* Quality Score */}
        <td className="py-3 px-4 text-center">
          {asset.qualityScore && asset.qualityScore > 0 ? (
            <div className="flex items-center justify-center gap-2">
              <span className={`text-lg font-bold ${getQualityColor(asset.qualityScore)}`}>
                {Math.round(asset.qualityScore)}
              </span>
              <Badge className={`text-xs ${qualityBadge.class}`}>
                {qualityBadge.label}
              </Badge>
            </div>
          ) : (
            <span className="text-gray-400 text-sm">N/A</span>
          )}
        </td>

        {/* Status & Issues */}
        <td className="py-3 px-4 text-center">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {/* Profiled Status - Fixed to check columnCount */}
            {asset.columnCount > 0 ? (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Profiled
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                <Clock className="w-3 h-3 mr-1" />
                Pending
              </Badge>
            )}

            {/* Quality Issues Badges */}
            {issueSummary && issueSummary.total_issues > 0 && (
              <Badge className="bg-red-100 text-red-700 border-red-200 text-xs font-semibold">
                <AlertTriangle className="w-3 h-3 mr-1" />
                {issueSummary.total_issues} Issues
              </Badge>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded Details Row */}
      {expanded && (
        <tr className="bg-gradient-to-r from-blue-50/50 to-gray-50">
          <td colSpan={9} className="py-4 px-4">
            <div className="ml-12 space-y-4">
              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-4">
                {/* Trust Score */}
                {asset.trustScore !== undefined && (
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Award className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-medium text-gray-600">Trust Score</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{asset.trustScore}</div>
                  </div>
                )}

                {/* View Count */}
                {asset.viewCount !== undefined && (
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Eye className="w-4 h-4 text-purple-600" />
                      <span className="text-xs font-medium text-gray-600">Views</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{asset.viewCount}</div>
                  </div>
                )}

                {/* Bookmarks */}
                {asset.bookmarkCount !== undefined && (
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Bookmark className="w-4 h-4 text-yellow-600" />
                      <span className="text-xs font-medium text-gray-600">Bookmarks</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-900">{asset.bookmarkCount}</div>
                  </div>
                )}

                {/* Quality Issues - Red if issues exist, Green if no issues */}
                {issueSummary && issueSummary.pii_column_count > 0 && (
                  <div className={`rounded-lg border p-3 ${
                    issueSummary.total_issues > 0
                      ? 'bg-red-50 border-red-200'
                      : 'bg-green-50 border-green-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`w-4 h-4 ${
                        issueSummary.total_issues > 0 ? 'text-red-600' : 'text-green-600'
                      }`} />
                      <span className={`text-xs font-medium ${
                        issueSummary.total_issues > 0 ? 'text-red-700' : 'text-green-700'
                      }`}>
                        Quality Issues
                      </span>
                    </div>
                    <div className={`text-2xl font-bold ${
                      issueSummary.total_issues > 0 ? 'text-red-900' : 'text-green-900'
                    }`}>
                      {issueSummary.total_issues}
                    </div>
                    {issueSummary.total_issues === 0 && (
                      <div className="text-xs text-green-600 mt-1">
                        <CheckCircle2 className="w-3 h-3 inline mr-1" />
                        All protected
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tags */}
              {asset.tags && asset.tags.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-4 h-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {asset.tags.map((tag, idx) => (
                      <Badge key={idx} className="bg-blue-100 text-blue-700 border-blue-200 text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Description */}
              {asset.description && (
                <div className="bg-white rounded-lg border border-gray-200 p-3">
                  <span className="text-sm font-medium text-gray-700 block mb-1">Description</span>
                  <p className="text-sm text-gray-600">{asset.description}</p>
                </div>
              )}

              {/* Metadata */}
              <div className="bg-white rounded-lg border border-gray-200 p-3">
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">Database:</span>
                    <span className="ml-2 font-medium text-gray-900">{asset.databaseName || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Updated:</span>
                    <span className="ml-2 font-medium text-gray-900">
                      {new Date(asset.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detailed Column-Level View with PII Detection & Fix Scripts */}
              <DetailedAssetView
                assetId={asset.id}
                assetName={asset.name}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

export default EnhancedAssetRow;
