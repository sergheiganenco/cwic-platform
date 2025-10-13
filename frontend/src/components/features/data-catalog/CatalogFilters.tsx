import { Check, ChevronDown, Database, Filter, Layers, Server, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface DataSource {
  id: string;
  name: string;
  type: string;
  status?: string;
}

interface CatalogFiltersProps {
  dataSources: DataSource[];
  selectedSourceId?: string;
  selectedSchema?: string;
  selectedObjectType?: 'all' | 'user' | 'system';
  onSourceChange: (sourceId: string | undefined) => void;
  onSchemaChange: (schema: string | undefined) => void;
  onObjectTypeChange: (type: 'all' | 'user' | 'system') => void;
  availableSchemas: string[];
  isLoading?: boolean;
  className?: string;
}

export const CatalogFilters: React.FC<CatalogFiltersProps> = ({
  dataSources,
  selectedSourceId,
  selectedSchema,
  selectedObjectType = 'all',
  onSourceChange,
  onSchemaChange,
  onObjectTypeChange,
  availableSchemas,
  isLoading,
  className = '',
}) => {
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showSchemaDropdown, setShowSchemaDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  const sourceDropdownRef = useRef<HTMLDivElement>(null);
  const schemaDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  const selectedSource = dataSources.find((s) => s.id === selectedSourceId);

  // System schemas that should be filtered out for "user" objects
  const SYSTEM_SCHEMAS = ['sys', 'information_schema', 'pg_catalog', 'pg_toast'];

  // Filter schemas based on object type selection
  const filteredSchemas = selectedObjectType === 'system'
    ? availableSchemas.filter(s => SYSTEM_SCHEMAS.includes(s))
    : selectedObjectType === 'user'
    ? availableSchemas.filter(s => !SYSTEM_SCHEMAS.includes(s))
    : availableSchemas;

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false);
      }
      if (schemaDropdownRef.current && !schemaDropdownRef.current.contains(event.target as Node)) {
        setShowSchemaDropdown(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setShowTypeDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasActiveFilters = selectedSourceId || selectedSchema || selectedObjectType !== 'all';

  const clearAllFilters = () => {
    onSourceChange(undefined);
    onSchemaChange(undefined);
    onObjectTypeChange('all');
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-900">Filters</h3>
        </div>
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
          >
            <X className="h-3 w-3" />
            Clear all
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Data Source Filter */}
        <div className="relative" ref={sourceDropdownRef}>
          <label className="block text-xs font-medium text-gray-700 mb-1">Data Source / Server</label>
          <button
            onClick={() => setShowSourceDropdown(!showSourceDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            <span className="flex items-center gap-2">
              <Server className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">
                {selectedSource?.name || 'All servers'}
              </span>
              {selectedSource?.type && (
                <span className="text-xs text-gray-500">({selectedSource.type})</span>
              )}
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showSourceDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showSourceDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
              <button
                onClick={() => {
                  onSourceChange(undefined);
                  setShowSourceDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">All servers</span>
                </span>
                {!selectedSourceId && <Check className="h-4 w-4 text-blue-600" />}
              </button>

              <div className="border-t border-gray-200" />

              {dataSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => {
                    onSourceChange(source.id);
                    setShowSourceDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 flex-1 min-w-0">
                    <Server className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-900 truncate">{source.name}</span>
                    {source.type && (
                      <span className="text-xs text-gray-500 flex-shrink-0">({source.type})</span>
                    )}
                    {source.status === 'connected' && (
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full flex-shrink-0" />
                    )}
                  </span>
                  {selectedSourceId === source.id && <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Schema Filter */}
        <div className="relative" ref={schemaDropdownRef}>
          <label className="block text-xs font-medium text-gray-700 mb-1">Schema / Database</label>
          <button
            onClick={() => setShowSchemaDropdown(!showSchemaDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
            disabled={isLoading || filteredSchemas.length === 0}
          >
            <span className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900">
                {selectedSchema || 'All schemas'}
              </span>
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showSchemaDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showSchemaDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
              <button
                onClick={() => {
                  onSchemaChange(undefined);
                  setShowSchemaDropdown(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">All schemas</span>
                </span>
                {!selectedSchema && <Check className="h-4 w-4 text-blue-600" />}
              </button>

              <div className="border-t border-gray-200" />

              {filteredSchemas.map((schema) => (
                <button
                  key={schema}
                  onClick={() => {
                    onSchemaChange(schema);
                    setShowSchemaDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{schema}</span>
                    {SYSTEM_SCHEMAS.includes(schema) && (
                      <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">system</span>
                    )}
                  </span>
                  {selectedSchema === schema && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Object Type Filter */}
        <div className="relative" ref={typeDropdownRef}>
          <label className="block text-xs font-medium text-gray-700 mb-1">Object Type</label>
          <button
            onClick={() => setShowTypeDropdown(!showTypeDropdown)}
            className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
            disabled={isLoading}
          >
            <span className="flex items-center gap-2">
              <Database className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-900 capitalize">{selectedObjectType}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showTypeDropdown ? 'rotate-180' : ''}`} />
          </button>

          {showTypeDropdown && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg">
              {(['all', 'user', 'system'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    onObjectTypeChange(type);
                    setShowTypeDropdown(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                >
                  <span className="text-sm text-gray-900 capitalize">{type} objects</span>
                  {selectedObjectType === type && <Check className="h-4 w-4 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p className="text-xs text-gray-600 mb-2">Active filters:</p>
          <div className="flex flex-wrap gap-2">
            {selectedSource && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                {selectedSource.name}
                <button onClick={() => onSourceChange(undefined)} className="hover:bg-blue-100 rounded">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedSchema && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded">
                {selectedSchema}
                <button onClick={() => onSchemaChange(undefined)} className="hover:bg-blue-100 rounded">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedObjectType !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded capitalize">
                {selectedObjectType} objects
                <button onClick={() => onObjectTypeChange('all')} className="hover:bg-blue-100 rounded">
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
