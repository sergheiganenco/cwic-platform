// Standard Filters Component - Consistent across all pages
import React from 'react';
import { Search, Filter } from 'lucide-react';

interface StandardFiltersProps {
  // Data Source Filter
  dataSources: Array<{ id: string; name: string }>;
  selectedDataSource: string;
  onDataSourceChange: (value: string) => void;

  // Database Filter
  databases: string[];
  selectedDatabase: string;
  onDatabaseChange: (value: string) => void;

  // Table Type Filter
  showSystemTables: boolean;
  onSystemTablesToggle: (value: boolean) => void;

  // Search
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;

  // Optional filters
  showTableTypeFilter?: boolean;
  tableType?: string;
  onTableTypeChange?: (value: string) => void;
}

export const StandardFilters: React.FC<StandardFiltersProps> = ({
  dataSources,
  selectedDataSource,
  onDataSourceChange,
  databases,
  selectedDatabase,
  onDatabaseChange,
  showSystemTables,
  onSystemTablesToggle,
  searchTerm,
  onSearchChange,
  searchPlaceholder = "Search by table name, schema, or description...",
  showTableTypeFilter = false,
  tableType = 'all',
  onTableTypeChange,
}) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-4">
      {/* Row 1: Data Source, Database, Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Data Source Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Data Source
          </label>
          <select
            value={selectedDataSource}
            onChange={(e) => onDataSourceChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All Data Sources</option>
            {dataSources.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </select>
        </div>

        {/* Database Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Database
          </label>
          <select
            value={selectedDatabase}
            onChange={(e) => onDatabaseChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={!selectedDataSource}
          >
            <option value="">All Databases</option>
            {databases.map((db) => (
              <option key={db} value={db}>
                {db}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Row 2: Additional Filters */}
      <div className="flex items-center gap-4 pt-2 border-t border-gray-200">
        {/* System Tables Toggle */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!showSystemTables}
            onChange={(e) => onSystemTablesToggle(!e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Hide System Tables</span>
        </label>

        {/* Optional Table Type Filter */}
        {showTableTypeFilter && onTableTypeChange && (
          <>
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <select
                value={tableType}
                onChange={(e) => onTableTypeChange(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="table">Tables</option>
                <option value="view">Views</option>
                <option value="materialized_view">Materialized Views</option>
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default StandardFilters;
