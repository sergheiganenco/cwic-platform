// src/components/features/data-catalog/SearchFilters.tsx
import { useMemo } from 'react';

interface SearchFiltersProps {
  q: string;
  setQ: (query: string) => void;
  type: string;
  setType: (type: string) => void;
  owner: string;
  setOwner: (owner: string) => void;
  onRefresh?: () => void;
  
  // Additional filters for enhanced functionality
  quality?: string;
  setQuality?: (quality: string) => void;
  classification?: string;
  setClassification?: (classification: string) => void;
  dataSourceId?: string;
  setDataSourceId?: (dataSourceId: string) => void;
  
  // Results info
  totalResults?: number;
  isLoading?: boolean;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

const ASSET_TYPES: Array<{ value: string; label: string }> = [
  { value: '', label: 'All types' },
  { value: 'table', label: 'Table' },
  { value: 'view', label: 'View' },
  { value: 'materialized_view', label: 'Materialized View' },
  { value: 'file', label: 'File' },
  { value: 'stream', label: 'Stream' },
  { value: 'api', label: 'API' },
  { value: 'dataset', label: 'Dataset' },
  { value: 'model', label: 'Model' },
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'report', label: 'Report' }
];

const QUALITY_LEVELS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All quality' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' }
];

const CLASSIFICATIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All classifications' },
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' }
];

export function SearchFilters({
  q,
  setQ,
  type,
  setType,
  owner,
  setOwner,
  onRefresh,
  quality = '',
  setQuality,
  classification = '',
  setClassification,
  dataSourceId = '',
  setDataSourceId,
  totalResults = 0,
  isLoading = false,
  hasFilters = false,
  onClearFilters
}: SearchFiltersProps) {
  
  // Determine if we have extended filters available
  const hasExtendedFilters = Boolean(setQuality || setClassification || setDataSourceId);
  
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (q.trim()) count++;
    if (type) count++;
    if (owner.trim()) count++;
    if (quality) count++;
    if (classification) count++;
    if (dataSourceId) count++;
    return count;
  }, [q, type, owner, quality, classification, dataSourceId]);

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      {/* Primary Filters Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search Input */}
        <div className="lg:col-span-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search by name, tag, column..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Type Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {ASSET_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {/* Owner Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Owner</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Owner (email or name)"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {owner && (
              <button
                onClick={() => setOwner('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Extended Filters Row (if available) */}
      {hasExtendedFilters && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          {/* Quality Filter */}
          {setQuality && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quality</label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {QUALITY_LEVELS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Classification Filter */}
          {setClassification && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {CLASSIFICATIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Data Source Filter - would need to be populated from your data sources */}
          {setDataSourceId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
              <select
                value={dataSourceId}
                onChange={(e) => setDataSourceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All sources</option>
                {/* You would populate this with actual data sources */}
                <option value="1">Production PostgreSQL</option>
                <option value="2">Analytics Snowflake</option>
                <option value="3">S3 Data Lake</option>
              </select>
            </div>
          )}
        </div>
      )}

      {/* Filter Actions and Results */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-200">
        <div className="flex items-center space-x-4">
          {/* Results Count */}
          <span className="text-sm text-gray-600">
            {isLoading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading...
              </span>
            ) : (
              <>
                {totalResults.toLocaleString()} asset{totalResults !== 1 ? 's' : ''} found
                {activeFilterCount > 0 && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''}
                  </span>
                )}
              </>
            )}
          </span>

          {/* Clear Filters */}
          {(hasFilters || activeFilterCount > 0) && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              <svg 
                className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}