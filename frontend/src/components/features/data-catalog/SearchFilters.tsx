// src/components/features/data-catalog/SearchFilters.tsx - Enhanced Version
import { Button } from '@/components/ui/Button';
import {
  ChevronDown,
  Clock,
  Filter,
  Grid3x3,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  X
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

interface SearchFiltersProps {
  q: string;
  setQ: (value: string) => void;
  type: string;
  setType: (value: string) => void;
  owner: string;
  setOwner: (value: string) => void;
  quality: string;
  setQuality: (value: string) => void;
  classification: string;
  setClassification: (value: string) => void;
  dataSourceId: string;
  setDataSourceId: (value: string) => void;
  totalResults: number;
  isLoading: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
  onRefresh: () => void;
  viewMode?: 'grid' | 'table' | 'cards';
  onViewModeChange?: (mode: 'grid' | 'table' | 'cards') => void;
  canSelectAll?: boolean;
  selectedCount?: number;
  onSelectAll?: (selected: boolean) => void;
  maxSelections?: number;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  q,
  setQ,
  type,
  setType,
  owner,
  setOwner,
  quality,
  setQuality,
  classification,
  setClassification,
  dataSourceId,
  setDataSourceId,
  totalResults,
  isLoading,
  hasFilters,
  onClearFilters,
  onRefresh,
  viewMode = 'grid',
  onViewModeChange,
  canSelectAll,
  selectedCount = 0,
  onSelectAll,
  maxSelections = 100
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentAssetSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const handleSearchSubmit = (value: string) => {
    if (value.trim() && !recentSearches.includes(value.trim())) {
      const updated = [value.trim(), ...recentSearches.slice(0, 4)];
      setRecentSearches(updated);
      localStorage.setItem('recentAssetSearches', JSON.stringify(updated));
    }
    setQ(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit(e.currentTarget.value);
    }
  };

  const activeFiltersCount = [type, owner, quality, classification, dataSourceId].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Main Search Bar */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              ref={searchInputRef}
              data-search-input
              type="text"
              placeholder="Search assets by name, description, schema, or tags..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Recent Searches Dropdown */}
          {recentSearches.length > 0 && q.length === 0 && (
            <div className="absolute top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="p-2 border-b border-gray-100">
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>Recent searches</span>
                </div>
              </div>
              {recentSearches.map((search, index) => (
                <button
                  key={index}
                  onClick={() => handleSearchSubmit(search)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                >
                  {search}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* View Mode Toggle */}
        {onViewModeChange && (
          <div className="flex items-center border border-gray-300 rounded-lg">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange('table')}
              className={`p-2 ${viewMode === 'table' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <List className="h-4 w-4" />
            </button>
            <button
              onClick={() => onViewModeChange('cards')}
              className={`p-2 ${viewMode === 'cards' ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Advanced Filters Toggle */}
        <Button
          variant="outline"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={activeFiltersCount > 0 ? 'border-blue-500 bg-blue-50' : ''}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="ml-2 bg-blue-600 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
          <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
        </Button>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={onRefresh}
            disabled={isLoading}
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {hasFilters && (
            <Button
              variant="outline"
              onClick={onClearFilters}
              size="sm"
            >
              <X className="mr-1 h-4 w-4" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Asset Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Asset Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Types</option>
                <option value="table">Tables</option>
                <option value="view">Views</option>
                <option value="file">Files</option>
                <option value="api">APIs</option>
                <option value="dashboard">Dashboards</option>
                <option value="report">Reports</option>
              </select>
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Owner
              </label>
              <input
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="Enter owner name or email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Data Quality */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Quality
              </label>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Quality Levels</option>
                <option value="high">High Quality</option>
                <option value="medium">Medium Quality</option>
                <option value="low">Low Quality</option>
              </select>
            </div>

            {/* Classification */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Classification
              </label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Classifications</option>
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="confidential">Confidential</option>
                <option value="restricted">Restricted</option>
              </select>
            </div>

            {/* Data Source */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Data Source
              </label>
              <select
                value={dataSourceId}
                onChange={(e) => setDataSourceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Data Sources</option>
                <option value="ds-1">Production Database</option>
                <option value="ds-2">Analytics Database</option>
                <option value="ds-3">Data Lake</option>
                <option value="ds-4">External APIs</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary and Bulk Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {isLoading ? (
            <span>Searching...</span>
          ) : (
            <span>
              {totalResults.toLocaleString()} assets found
              {hasFilters && ' (filtered)'}
            </span>
          )}
        </div>

        {canSelectAll && onSelectAll && (
          <div className="flex items-center space-x-3">
            {selectedCount > 0 && (
              <span className="text-sm text-gray-600">
                {selectedCount} of {Math.min(totalResults, maxSelections)} selected
              </span>
            )}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="select-all"
                checked={selectedCount > 0}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="select-all" className="text-sm text-gray-700">
                Select all
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};