// Revolutionary Rules View - Main Container
import React, { useState, useMemo } from 'react';
import { ThreePanelLayout } from './ThreePanelLayout';
import { LeftNavigator } from './LeftNavigator';
import { RuleCard } from './RuleCard';
import { RightInspector } from './RightInspector';
import { SmartCommandBar } from './SmartCommandBar';

interface QualityRule {
  id: string;
  name: string;
  description?: string;
  rule_type: string;
  dimension: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data_source_id?: string;
  asset_id?: number;
  column_name?: string;
  expression?: string;
  enabled: boolean;
  created_at?: string;
  last_executed_at?: string;
  execution_count?: number;
  last_result?: {
    status: 'passed' | 'failed' | 'error';
    issues_found?: number;
    pass_rate?: number;
    execution_time_ms?: number;
    message?: string;
  };
}

interface RevolutionaryRulesViewProps {
  rules: QualityRule[];
  selectedRules: Set<string>;
  onRuleEdit: (rule: QualityRule) => void;
  onRuleDelete: (ruleId: string) => void;
  onRuleExecute: (ruleId: string) => void;
  onRuleSelect?: (ruleId: string) => void;
  onAutopilot?: () => void;
  onNewRule?: () => void;
  onViewIssues?: (ruleId: string) => void;
  executingRules?: Set<string>;
  isLoading?: boolean;
  dataSources?: any[];
  className?: string;
}

export const RevolutionaryRulesView: React.FC<RevolutionaryRulesViewProps> = ({
  rules,
  selectedRules,
  onRuleEdit,
  onRuleDelete,
  onRuleExecute,
  onRuleSelect,
  onAutopilot,
  onNewRule,
  onViewIssues,
  executingRules = new Set(),
  isLoading = false,
  dataSources = [],
  className = ''
}) => {
  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list' | 'kanban'>('cards');
  const [checkedRules, setCheckedRules] = useState<Set<string>>(new Set());
  const [showCheckboxes, setShowCheckboxes] = useState(false);

  // Filter rules based on search and active filter
  const filteredRules = useMemo(() => {
    let filtered = rules;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (rule) =>
          rule.name.toLowerCase().includes(query) ||
          rule.description?.toLowerCase().includes(query) ||
          rule.column_name?.toLowerCase().includes(query)
      );
    }

    // Active filter
    if (activeFilter) {
      const [filterType, filterValue] = activeFilter.split(':');

      switch (filterType) {
        case 'status':
          if (filterValue === 'passing') {
            filtered = filtered.filter(
              (r) => r.enabled && r.last_result?.status === 'passed'
            );
          } else if (filterValue === 'failing') {
            filtered = filtered.filter(
              (r) => r.enabled && r.last_result?.status === 'failed'
            );
          } else if (filterValue === 'error') {
            filtered = filtered.filter(
              (r) => r.enabled && r.last_result?.status === 'error'
            );
          } else if (filterValue === 'disabled') {
            filtered = filtered.filter((r) => !r.enabled);
          } else if (filterValue === 'never_run') {
            filtered = filtered.filter((r) => r.enabled && !r.last_result);
          }
          break;

        case 'dimension':
          filtered = filtered.filter((r) => r.dimension === filterValue);
          break;

        case 'group':
          if (filterValue === 'autopilot') {
            filtered = filtered.filter((r) => r.name.startsWith('[Autopilot]'));
          } else if (filterValue === 'custom') {
            filtered = filtered.filter((r) => !r.name.startsWith('[Autopilot]'));
          }
          break;
      }
    }

    return filtered;
  }, [rules, searchQuery, activeFilter]);

  // Get selected rule object
  const selectedRule = useMemo(() => {
    if (!selectedRuleId) return null;
    return rules.find((r) => r.id === selectedRuleId);
  }, [selectedRuleId, rules]);

  // Active filters for display
  const activeFilters = useMemo(() => {
    const filters = [];
    if (activeFilter) {
      const [filterType, filterValue] = activeFilter.split(':');
      filters.push({
        label: `${filterType}: ${filterValue}`,
        value: activeFilter
      });
    }
    return filters;
  }, [activeFilter]);

  // Handle filter change
  const handleFilterChange = (filter: string) => {
    // Toggle filter if same one clicked
    if (activeFilter === filter) {
      setActiveFilter('');
    } else {
      setActiveFilter(filter);
    }
  };

  // Handle remove filter
  const handleRemoveFilter = (filterValue: string) => {
    if (activeFilter === filterValue) {
      setActiveFilter('');
    }
  };

  // Handle checkbox toggle
  const handleCheckChange = (ruleId: string, checked: boolean) => {
    const newCheckedRules = new Set(checkedRules);
    if (checked) {
      newCheckedRules.add(ruleId);
    } else {
      newCheckedRules.delete(ruleId);
    }
    setCheckedRules(newCheckedRules);
  };

  // Handle select all/none
  const handleSelectAll = () => {
    if (checkedRules.size === filteredRules.length) {
      // All selected, deselect all
      setCheckedRules(new Set());
    } else {
      // Select all visible rules
      setCheckedRules(new Set(filteredRules.map(r => r.id)));
    }
  };

  // Handle run selected
  const handleRunSelected = () => {
    // Run all checked rules
    checkedRules.forEach((ruleId) => {
      onRuleExecute(ruleId);
    });
  };

  // Handle rule click
  const handleRuleClick = (ruleId: string) => {
    // Toggle selection: if clicking the same rule, unselect it
    if (selectedRuleId === ruleId) {
      setSelectedRuleId(null);
    } else {
      setSelectedRuleId(ruleId);
    }

    onRuleSelect?.(ruleId);
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Command Bar */}
      <div className="mb-4">
        <SmartCommandBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedCount={checkedRules.size}
          onRunSelected={checkedRules.size > 0 ? handleRunSelected : undefined}
          onNewRule={onNewRule}
          onAutopilot={onAutopilot}
          activeFilters={activeFilters}
          onRemoveFilter={handleRemoveFilter}
          showCheckboxes={showCheckboxes}
          onToggleCheckboxes={() => {
            setShowCheckboxes(!showCheckboxes);
            setCheckedRules(new Set());
          }}
          onSelectAll={handleSelectAll}
          allSelected={checkedRules.size === filteredRules.length && filteredRules.length > 0}
        />
      </div>

      {/* Three Panel Layout */}
      <div className="flex-1 overflow-hidden">
        <ThreePanelLayout
          left={
            <LeftNavigator
              rules={rules}
              activeFilter={activeFilter}
              onFilterChange={handleFilterChange}
            />
          }
          center={
            <div className="space-y-4">
              {/* Results Header */}
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>
                  Showing {filteredRules.length} of {rules.length} rules
                </span>
                {searchQuery && (
                  <span>
                    Search: "<span className="font-medium text-gray-900">{searchQuery}</span>"
                  </span>
                )}
              </div>

              {/* Loading State */}
              {isLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading rules...</p>
                </div>
              ) : /* Rules Grid/List */
              filteredRules.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-4">
                    <svg
                      className="mx-auto h-12 w-12"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-600 font-medium">No rules found</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {searchQuery
                      ? 'Try adjusting your search or filters'
                      : 'Create your first quality rule to get started'}
                  </p>
                  {onNewRule && !searchQuery && (
                    <button
                      onClick={onNewRule}
                      className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      + Create Rule
                    </button>
                  )}
                </div>
              ) : (
                <div
                  className={
                    viewMode === 'cards'
                      ? 'grid grid-cols-1 xl:grid-cols-2 gap-4'
                      : 'space-y-2'
                  }
                >
                  {filteredRules.map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onEdit={onRuleEdit}
                      onExecute={onRuleExecute}
                      onViewIssues={onViewIssues}
                      onClick={handleRuleClick}
                      isSelected={selectedRuleId === rule.id}
                      isExecuting={executingRules.has(rule.id)}
                      viewMode={viewMode === 'cards' ? 'normal' : 'compact'}
                      showCheckbox={showCheckboxes}
                      isChecked={checkedRules.has(rule.id)}
                      onCheckChange={handleCheckChange}
                    />
                  ))}
                </div>
              )}
            </div>
          }
          right={
            selectedRuleId ? (
              <RightInspector
                rule={selectedRule}
                onEdit={onRuleEdit}
                onDelete={(ruleId) => {
                  onRuleDelete(ruleId);
                  setSelectedRuleId(null); // Close inspector after delete
                }}
                onExecute={onRuleExecute}
                onViewIssues={onViewIssues}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );
};
