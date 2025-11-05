/**
 * PII Rules Filter Component
 *
 * Provides comprehensive filtering capabilities for PII rules to avoid scrolling
 * through many rules. Supports filtering by category, sensitivity, compliance,
 * rule type, and text search.
 */

import React from 'react';
import {
  Search,
  Filter,
  X,
  ChevronDown,
  Shield,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';

interface PIIRulesFilterProps {
  // Filter state
  searchText: string;
  selectedCategories: string[];
  selectedSensitivity: string[];
  selectedCompliance: string[];
  showSystemRules: boolean;
  showCustomRules: boolean;
  showEnabledOnly: boolean;

  // Filter update handlers
  onSearchTextChange: (text: string) => void;
  onCategoryToggle: (category: string) => void;
  onSensitivityToggle: (level: string) => void;
  onComplianceToggle: (standard: string) => void;
  onSystemRulesToggle: () => void;
  onCustomRulesToggle: () => void;
  onEnabledOnlyToggle: () => void;
  onClearFilters: () => void;

  // Statistics
  totalRules: number;
  filteredRules: number;
}

export const PIIRulesFilter: React.FC<PIIRulesFilterProps> = ({
  searchText,
  selectedCategories,
  selectedSensitivity,
  selectedCompliance,
  showSystemRules,
  showCustomRules,
  showEnabledOnly,
  onSearchTextChange,
  onCategoryToggle,
  onSensitivityToggle,
  onComplianceToggle,
  onSystemRulesToggle,
  onCustomRulesToggle,
  onEnabledOnlyToggle,
  onClearFilters,
  totalRules,
  filteredRules
}) => {
  const [showFilters, setShowFilters] = React.useState(false);

  const categories = [
    { value: 'personal', label: 'Personal', icon: '👤' },
    { value: 'contact', label: 'Contact', icon: '📧' },
    { value: 'financial', label: 'Financial', icon: '💳' },
    { value: 'identifier', label: 'Identifier', icon: '🔑' },
    { value: 'health', label: 'Health', icon: '⚕️' },
    { value: 'education', label: 'Education', icon: '🎓' },
    { value: 'employment', label: 'Employment', icon: '💼' },
    { value: 'authentication', label: 'Authentication', icon: '🔐' },
    { value: 'biometric', label: 'Biometric', icon: '👁️' },
  ];

  const sensitivityLevels = [
    { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800 border-red-300' },
    { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800 border-orange-300' },
    { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  ];

  const complianceStandards = [
    'GDPR', 'CCPA', 'HIPAA', 'PCI-DSS', 'SOX', 'FERPA', 'GLBA'
  ];

  const hasActiveFilters =
    searchText.trim() !== '' ||
    selectedCategories.length > 0 ||
    selectedSensitivity.length > 0 ||
    selectedCompliance.length > 0 ||
    !showSystemRules ||
    !showCustomRules ||
    showEnabledOnly;

  return (
    <div className="bg-white border border-gray-300 rounded-lg shadow-sm mb-6">
      {/* Search Bar & Filter Toggle */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => onSearchTextChange(e.target.value)}
              placeholder="Search PII rules by name..."
              className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchText && (
              <button
                onClick={() => onSearchTextChange('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter Toggle Button */}
          <Button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 border-2 ${
              hasActiveFilters
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700'
            } hover:bg-gray-50 flex items-center gap-2`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <Badge className="bg-blue-600 text-white text-xs px-2 py-0.5">
                {[
                  selectedCategories.length,
                  selectedSensitivity.length,
                  selectedCompliance.length,
                  searchText ? 1 : 0,
                  !showSystemRules ? 1 : 0,
                  !showCustomRules ? 1 : 0,
                  showEnabledOnly ? 1 : 0
                ].reduce((a, b) => a + b, 0)}
              </Badge>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </Button>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button
              onClick={onClearFilters}
              className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300 flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Clear All
            </Button>
          )}
        </div>

        {/* Results Count */}
        <div className="mt-3 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <strong className="text-gray-900">{filteredRules}</strong> of{' '}
            <strong className="text-gray-900">{totalRules}</strong> rules
            {hasActiveFilters && (
              <span className="ml-2 text-blue-600">
                ({totalRules - filteredRules} filtered out)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Filters */}
      {showFilters && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Category Filter */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="text-lg">📂</span>
                Category
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {categories.map((category) => (
                  <label
                    key={category.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(category.value)}
                      onChange={() => onCategoryToggle(category.value)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-lg">{category.icon}</span>
                    <span className="text-sm text-gray-700">{category.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Sensitivity Filter */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Sensitivity Level
              </div>
              <div className="space-y-2">
                {sensitivityLevels.map((level) => (
                  <label
                    key={level.value}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSensitivity.includes(level.value)}
                      onChange={() => onSensitivityToggle(level.value)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Badge className={`${level.color} text-xs px-2 py-1 uppercase`}>
                      {level.label}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            {/* Compliance Filter */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Compliance Standard
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {complianceStandards.map((standard) => (
                  <label
                    key={standard}
                    className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCompliance.includes(standard)}
                      onChange={() => onComplianceToggle(standard)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <Badge className="bg-purple-100 text-purple-800 text-xs px-2 py-1">
                      {standard}
                    </Badge>
                  </label>
                ))}
              </div>
            </div>

            {/* Rule Type Filter */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Rule Type
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={showSystemRules}
                    onChange={onSystemRulesToggle}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">System Rules</span>
                  <Badge className="bg-gray-100 text-gray-600 text-xs">Built-in</Badge>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={showCustomRules}
                    onChange={onCustomRulesToggle}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Custom Rules</span>
                  <Badge className="bg-blue-100 text-blue-800 text-xs">User-defined</Badge>
                </label>
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Rule Status
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded">
                  <input
                    type="checkbox"
                    checked={showEnabledOnly}
                    onChange={onEnabledOnlyToggle}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Show Enabled Only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="text-xs font-semibold text-gray-700 mb-2">Active Filters:</div>
              <div className="flex flex-wrap gap-2">
                {searchText && (
                  <Badge className="bg-blue-100 text-blue-800 text-xs flex items-center gap-1">
                    Search: "{searchText}"
                    <button onClick={() => onSearchTextChange('')} className="ml-1 hover:bg-blue-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {selectedCategories.map((cat) => (
                  <Badge key={cat} className="bg-green-100 text-green-800 text-xs flex items-center gap-1">
                    Category: {categories.find(c => c.value === cat)?.label}
                    <button onClick={() => onCategoryToggle(cat)} className="ml-1 hover:bg-green-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedSensitivity.map((level) => (
                  <Badge key={level} className="bg-orange-100 text-orange-800 text-xs flex items-center gap-1">
                    Sensitivity: {level}
                    <button onClick={() => onSensitivityToggle(level)} className="ml-1 hover:bg-orange-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {selectedCompliance.map((standard) => (
                  <Badge key={standard} className="bg-purple-100 text-purple-800 text-xs flex items-center gap-1">
                    {standard}
                    <button onClick={() => onComplianceToggle(standard)} className="ml-1 hover:bg-purple-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {!showSystemRules && (
                  <Badge className="bg-gray-100 text-gray-800 text-xs flex items-center gap-1">
                    Hiding System Rules
                    <button onClick={onSystemRulesToggle} className="ml-1 hover:bg-gray-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {!showCustomRules && (
                  <Badge className="bg-gray-100 text-gray-800 text-xs flex items-center gap-1">
                    Hiding Custom Rules
                    <button onClick={onCustomRulesToggle} className="ml-1 hover:bg-gray-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
                {showEnabledOnly && (
                  <Badge className="bg-gray-100 text-gray-800 text-xs flex items-center gap-1">
                    Enabled Only
                    <button onClick={onEnabledOnlyToggle} className="ml-1 hover:bg-gray-200 rounded-full">
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PIIRulesFilter;
