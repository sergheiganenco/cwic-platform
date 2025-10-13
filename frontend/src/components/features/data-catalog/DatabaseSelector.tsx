import { Check, ChevronDown, Database as DatabaseIcon, Server } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface DataSource {
  id: string;
  name: string;
  type: string;
  status?: string;
}

interface DatabaseSelectorProps {
  dataSources: DataSource[];
  selectedSourceId?: string;
  onSourceChange: (sourceId: string | undefined) => void;
  isLoading?: boolean;
  className?: string;
}

export const DatabaseSelector: React.FC<DatabaseSelectorProps> = ({
  dataSources,
  selectedSourceId,
  onSourceChange,
  isLoading,
  className = '',
}) => {
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedSource = dataSources.find((s) => s.id === selectedSourceId);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 shadow-sm ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-900">Filter by Data Source</h3>
        {selectedSourceId && (
          <button
            onClick={() => {
              onSourceChange(undefined);
              setShowSourceDropdown(false);
            }}
            className="text-xs text-blue-600 hover:text-blue-700"
          >
            Clear selection
          </button>
        )}
      </div>

      <div className="relative" ref={dropdownRef}>
        <label className="block text-xs font-medium text-gray-700 mb-1">Data Source</label>
        <button
          onClick={() => setShowSourceDropdown(!showSourceDropdown)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors"
          disabled={isLoading}
        >
          <span className="flex items-center gap-2">
            <Server className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-900">
              {selectedSource?.name || 'All data sources'}
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
                <span className="text-sm">All data sources</span>
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

            {dataSources.length === 0 && (
              <div className="px-3 py-6 text-center text-sm text-gray-500">
                No data sources available
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Source Info */}
      {selectedSource && (
        <div className="mt-3 bg-blue-50 rounded-md p-3">
          <p className="text-xs text-blue-800">
            <strong>Filtering by:</strong> {selectedSource.name}
            {selectedSource.type && ` (${selectedSource.type})`}
          </p>
        </div>
      )}
    </div>
  );
};
