// Revolutionary Rules Page - Smart Command Bar
import React from 'react';
import {
  Search,
  Plus,
  Play,
  Grid,
  List,
  LayoutGrid,
  Settings,
  Sparkles,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { Button } from '@components/ui/Button';

interface SmartCommandBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'cards' | 'list' | 'kanban';
  onViewModeChange: (mode: 'cards' | 'list' | 'kanban') => void;
  selectedCount: number;
  onRunSelected?: () => void;
  onNewRule?: () => void;
  onAutopilot?: () => void;
  activeFilters?: Array<{ label: string; value: string }>;
  onRemoveFilter?: (value: string) => void;
  className?: string;
  showCheckboxes?: boolean;
  onToggleCheckboxes?: () => void;
  onSelectAll?: () => void;
  allSelected?: boolean;
}

export const SmartCommandBar: React.FC<SmartCommandBarProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  selectedCount,
  onRunSelected,
  onNewRule,
  onAutopilot,
  activeFilters = [],
  onRemoveFilter,
  className = '',
  showCheckboxes = false,
  onToggleCheckboxes,
  onSelectAll,
  allSelected = false
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Main Command Bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search rules, tables, or type..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <kbd className="absolute right-3 top-1/2 transform -translate-y-1/2 px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded">
            Cmd+K
          </kbd>
        </div>

        {/* Multi-select Toggle */}
        {onToggleCheckboxes && (
          <Button
            variant="outline"
            onClick={onToggleCheckboxes}
            className={showCheckboxes ? "bg-blue-50 border-blue-500" : ""}
          >
            {showCheckboxes ? (
              <CheckSquare className="h-4 w-4 mr-2" />
            ) : (
              <Square className="h-4 w-4 mr-2" />
            )}
            Select
          </Button>
        )}

        {/* Select All (when checkboxes shown) */}
        {showCheckboxes && onSelectAll && (
          <Button
            variant="outline"
            onClick={onSelectAll}
            size="sm"
          >
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
        )}

        {/* Autopilot Button */}
        {onAutopilot && (
          <Button
            variant="outline"
            onClick={onAutopilot}
            className="border-purple-300 text-purple-700 hover:bg-purple-50"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Autopilot
          </Button>
        )}

        {/* New Rule Button */}
        {onNewRule && (
          <Button onClick={onNewRule}>
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        )}

        {/* Run Selected */}
        {selectedCount > 0 && onRunSelected && (
          <Button onClick={onRunSelected} variant="outline">
            <Play className="h-4 w-4 mr-2" />
            Run Selected ({selectedCount})
          </Button>
        )}

        {/* View Mode Selector */}
        <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
          <button
            onClick={() => onViewModeChange('cards')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'cards'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Cards View"
          >
            <Grid className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="List View"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            onClick={() => onViewModeChange('kanban')}
            className={`p-2 rounded transition-colors ${
              viewMode === 'kanban'
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            title="Kanban View"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>

        {/* Settings */}
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Active Filters */}
      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-600">Active Filters:</span>
          {activeFilters.map((filter) => (
            <span
              key={filter.value}
              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
            >
              {filter.label}
              {onRemoveFilter && (
                <button
                  onClick={() => onRemoveFilter(filter.value)}
                  className="hover:bg-blue-200 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
