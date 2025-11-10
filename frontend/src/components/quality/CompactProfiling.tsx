// Compact Modern Profiling Component
import React, { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Table,
  RefreshCw,
  Search,
  BarChart3,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Activity,
  TrendingUp,
  FileText,
  Loader2,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Alert, AlertDescription } from '@components/ui/Alert';
import EnhancedAssetRow from './EnhancedAssetRow';
import { useQualityIssueSummary } from '@hooks/useQualityIssueSummary';

// ============================================================================
// TYPES
// ============================================================================

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

interface ProfilingStats {
  totalAssets: number;
  profiledAssets: number;
  totalRows: number;
  totalColumns: number;
  avgQualityScore: number;
}

interface CompactProfilingProps {
  dataSourceId?: string;
  database?: string;
  assetType?: string;
  selectedAssetId?: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

const CompactProfiling: React.FC<CompactProfilingProps> = ({
  dataSourceId,
  database,
  assetType,
  selectedAssetId,
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [filterPII, setFilterPII] = useState<'all' | 'yes' | 'no'>('all');
  const [filterIssues, setFilterIssues] = useState<'all' | 'yes' | 'no'>('all');
  const { summaries, getIssueSummary } = useQualityIssueSummary();

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchAssets = useCallback(async () => {
    const isRefresh = assets.length > 0;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      // Only add filters if they are selected (not default "all")
      if (dataSourceId) params.append('dataSourceId', dataSourceId);
      if (database) params.append('database', database);
      if (assetType && assetType !== 'all') params.append('type', assetType);
      params.append('limit', '500'); // Increased limit to show more assets

      const response = await fetch(`/api/assets?${params}`);
      const result = await response.json();

      // Handle different API response formats
      // New format: {success: true, data: {assets: [...], pagination: {...}}}
      // Old format: {success: true, data: [...]}
      let assetsArray: Asset[] = [];

      if (result.success && result.data) {
        if (Array.isArray(result.data)) {
          // Old format: data is directly an array
          assetsArray = result.data;
        } else if (result.data.assets && Array.isArray(result.data.assets)) {
          // New format: data.assets is an array
          assetsArray = result.data.assets;
        } else {
          console.error('Unexpected data format:', result.data);
          setAssets([]);
          setError('Invalid data format received from server');
          setLoading(false);
          setRefreshing(false);
          return;
        }

        // Filter to keep tables and views (all schemas)
        const filteredAssets = assetsArray.filter((a: Asset) =>
          a.type === 'table' || a.type === 'view'
        );

        console.log(`📊 Profiling: Showing ${filteredAssets.length} tables/views from ${assetsArray.length} total assets`);
        setAssets(filteredAssets);
        setError(null);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch assets');
      }
    } catch (err) {
      console.error('Failed to fetch assets:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dataSourceId, database, assetType, assets.length]);

  useEffect(() => {
    fetchAssets();
  }, [dataSourceId, database, assetType]);

  // Cross-tab synchronization - listen for PII config changes and refresh seamlessly
  useEffect(() => {
    let lastProcessedTimestamp = 0;

    const refreshDataSeamlessly = () => {
      console.log('[CompactProfiling] PII config changed, refreshing assets in background...');
      // Call fetchAssets directly to refresh data without showing loading states
      fetchAssets();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pii-config-update' && e.newValue) {
        const timestamp = parseInt(e.newValue, 10);

        // Only process if this is a new timestamp we haven't seen
        if (timestamp > lastProcessedTimestamp) {
          lastProcessedTimestamp = timestamp;
          refreshDataSeamlessly();
        }
      }
    };

    const handleCustomUpdate = () => {
      refreshDataSeamlessly();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pii-config-update', handleCustomUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pii-config-update', handleCustomUpdate);
    };
  }, [fetchAssets]);

  // ============================================================================
  // COMPUTED STATS
  // ============================================================================

  const stats: ProfilingStats = React.useMemo(() => {
    const profiledAssets = assets.filter(a =>
      a.rowCount !== null &&
      a.rowCount !== -1
    );

    const totalRows = assets.reduce((sum, a) => {
      const count = a.rowCount || 0;
      return sum + (count > 0 ? count : 0);
    }, 0);

    const totalColumns = assets.reduce((sum, a) =>
      sum + (a.columnCount || 0), 0
    );

    const qualityScores = assets
      .map(a => a.qualityScore)
      .filter((score): score is number => score !== null && score !== undefined && score > 0);

    const avgQualityScore = qualityScores.length > 0
      ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length
      : 0;

    return {
      totalAssets: assets.length,
      profiledAssets: profiledAssets.length,
      totalRows,
      totalColumns,
      avgQualityScore,
    };
  }, [assets]);

  // ============================================================================
  // FILTERED ASSETS
  // ============================================================================

  const filteredAssets = React.useMemo(() => {
    let filtered = assets;

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        a.name.toLowerCase().includes(term) ||
        a.table.toLowerCase().includes(term) ||
        a.schema.toLowerCase().includes(term) ||
        (a.databaseName && a.databaseName.toLowerCase().includes(term))
      );
    }

    // Apply PII filter
    if (filterPII === 'yes') {
      filtered = filtered.filter(a => a.piiDetected === true);
    } else if (filterPII === 'no') {
      filtered = filtered.filter(a => !a.piiDetected);
    }

    // Apply Quality Issues filter
    if (filterIssues === 'yes') {
      filtered = filtered.filter(a => {
        const summary = getIssueSummary(a.id);
        return summary && summary.total_issues > 0;
      });
    } else if (filterIssues === 'no') {
      filtered = filtered.filter(a => {
        const summary = getIssueSummary(a.id);
        return !summary || summary.total_issues === 0;
      });
    }

    return filtered;
  }, [assets, searchTerm, filterPII, filterIssues, getIssueSummary]);

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading Profiling Data</p>
          <p className="text-sm text-gray-500 mt-1">Fetching asset information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-900">
          <div className="font-bold mb-2">Failed to Load Profiling Data</div>
          <div className="text-sm">{error}</div>
          <Button
            onClick={fetchAssets}
            className="mt-3 bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // ============================================================================
  // RENDER MAIN UI
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Compact Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Total Assets</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalAssets}</p>
              </div>
              <div className="p-2 bg-blue-100 rounded-lg">
                <Table className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Profiled</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.profiledAssets}</p>
              </div>
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Total Rows</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.totalRows.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Total Columns</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.totalColumns}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Layers className="w-5 h-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-teal-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600">Avg Quality</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {stats.avgQualityScore > 0 ? Math.round(stats.avgQualityScore) : 'N/A'}
                </p>
              </div>
              <div className="p-2 bg-teal-100 rounded-lg">
                <Activity className="w-5 h-5 text-teal-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assets Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold">Asset Profiles</CardTitle>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
                />
              </div>

              {/* PII Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">PII:</span>
                <select
                  value={filterPII}
                  onChange={(e) => setFilterPII(e.target.value as 'all' | 'yes' | 'no')}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              {/* Quality Issues Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Quality Issues:</span>
                <select
                  value={filterIssues}
                  onChange={(e) => setFilterIssues(e.target.value as 'all' | 'yes' | 'no')}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              {/* Suggest Rules Button - NEW! */}
              <Button
                onClick={() => {
                  // Navigate to Rules tab and trigger suggestions
                  const event = new CustomEvent('openRuleSuggestions', {
                    detail: { dataSourceId, profiledAssets: stats.profiledAssets }
                  });
                  window.dispatchEvent(event);
                }}
                disabled={stats.profiledAssets === 0}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                size="sm"
              >
                <Lightbulb className="w-4 h-4 mr-2" />
                Suggest Rules ({stats.profiledAssets})
              </Button>

              {/* Refresh Button */}
              <Button
                onClick={fetchAssets}
                disabled={refreshing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAssets.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-lg font-medium text-gray-600">No assets found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchTerm ? 'Try adjusting your search terms' : 'No data available for the selected filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="w-8"></th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Asset Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Schema</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Rows</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-700">Columns</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">PII</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Quality Score</th>
                    <th className="text-center py-3 px-4 font-semibold text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <EnhancedAssetRow
                      key={asset.id}
                      asset={asset}
                      issueSummary={getIssueSummary(asset.id)}
                      autoExpand={selectedAssetId === asset.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompactProfiling;
