// Smart Rules Studio - Revolutionary Quality Rules Interface
import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  LayoutGrid,
  List,
  BarChart3,
  Sliders,
  TrendingUp,
  TrendingDown,
  Play,
  Pause,
  Target,
  Users,
  Filter,
  ChevronDown,
  Zap,
  Brain,
  MessageSquare
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import type { QualityRule } from '@services/api/quality';

// Import sub-components (we'll create these next)
import { VisualRuleBuilder } from './studio/VisualRuleBuilder';
import { RuleTemplatesMarketplace } from './studio/RuleTemplatesMarketplace';
import { QualityScoreDashboard } from './studio/QualityScoreDashboard';
import { AIRuleAssistant } from './studio/AIRuleAssistant';
import { RuleImpactSimulator } from './studio/RuleImpactSimulator';
import { RuleCanvas } from './studio/RuleCanvas';
import { GamificationPanel } from './studio/GamificationPanel';
import { RuleDetailsModal } from './studio/RuleDetailsModal';

interface SmartRulesStudioProps {
  rules: QualityRule[];
  dataSourceId?: string;
  selectedDatabase?: string;
  onRuleCreate?: (rule: Partial<QualityRule>) => Promise<void>;
  onRuleUpdate?: (id: string, rule: Partial<QualityRule>) => Promise<void>;
  onRuleDelete?: (id: string) => Promise<void>;
  onRuleExecute?: (id: string) => Promise<void>;
}

type ViewMode = 'canvas' | 'list' | 'impact';
type FilterPanel = 'status' | 'impact' | 'teams' | 'dimension';

export const SmartRulesStudio: React.FC<SmartRulesStudioProps> = ({
  rules,
  dataSourceId,
  selectedDatabase,
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  onRuleExecute
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [showImpactSimulator, setShowImpactSimulator] = useState(false);
  const [editingRule, setEditingRule] = useState<QualityRule | null>(null);
  const [viewingRule, setViewingRule] = useState<QualityRule | null>(null);

  // Filters state
  const [filters, setFilters] = useState({
    status: new Set(['active']),
    impact: new Set(['high', 'medium']),
    teams: new Set(['mine']),
    dimension: new Set<string>()
  });

  // Calculate quality metrics
  const qualityMetrics = React.useMemo(() => {
    const activeRules = rules.filter(r => r.enabled);
    const totalIssues = rules.reduce((sum, r) => sum + (r.last_result?.issues_found || 0), 0);
    const avgPassRate = rules.length > 0
      ? rules.reduce((sum, r) => sum + (r.last_result?.pass_rate || 0), 0) / rules.length
      : 0;

    return {
      qualityScore: avgPassRate,
      activeRules: activeRules.length,
      totalIssues,
      trend: Math.random() > 0.5 ? 'up' : 'down',
      trendValue: (Math.random() * 5).toFixed(1)
    };
  }, [rules]);

  // Filter rules based on search and filters
  const filteredRules = React.useMemo(() => {
    return rules.filter(rule => {
      // Search filter
      if (searchQuery && !rule.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (filters.status.size > 0) {
        const status = rule.enabled ? 'active' : 'disabled';
        if (!filters.status.has(status) && !filters.status.has('draft')) {
          return false;
        }
      }

      // Impact filter
      if (filters.impact.size > 0 && !filters.impact.has(rule.severity)) {
        return false;
      }

      return true;
    });
  }, [rules, searchQuery, filters]);

  const toggleFilter = (category: FilterPanel, value: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      const filterSet = new Set(newFilters[category]);

      if (filterSet.has(value)) {
        filterSet.delete(value);
      } else {
        filterSet.add(value);
      }

      newFilters[category] = filterSet;
      return newFilters;
    });
  };

  return (
    <div className="flex h-[calc(100vh-200px)] bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Left Sidebar - Filters & Insights */}
      <div className="w-72 bg-white border-r border-gray-200 overflow-y-auto">
        <div className="p-4 space-y-6">
          {/* Gamification Panel */}
          <GamificationPanel rules={rules} />

          {/* Filters */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filters
              </h3>
            </div>

            {/* Status Filter */}
            <div>
              <button
                className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2"
                onClick={() => {}}
              >
                Status
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="space-y-1">
                {[
                  { value: 'active', label: 'Active', count: rules.filter(r => r.enabled).length },
                  { value: 'draft', label: 'Draft', count: 0 },
                  { value: 'paused', label: 'Paused', count: rules.filter(r => !r.enabled).length }
                ].map(item => (
                  <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={filters.status.has(item.value)}
                      onChange={() => toggleFilter('status', item.value)}
                      className="rounded border-gray-300"
                    />
                    <span className="flex-1">{item.label}</span>
                    <span className="text-gray-400">({item.count})</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Impact Filter */}
            <div>
              <button className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                Impact
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="space-y-1">
                {[
                  { value: 'critical', label: 'Critical', color: 'red' },
                  { value: 'high', label: 'High', color: 'orange' },
                  { value: 'medium', label: 'Medium', color: 'yellow' },
                  { value: 'low', label: 'Low', color: 'green' }
                ].map(item => (
                  <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={filters.impact.has(item.value)}
                      onChange={() => toggleFilter('impact', item.value)}
                      className="rounded border-gray-300"
                    />
                    <span className={`w-2 h-2 rounded-full bg-${item.color}-500`}></span>
                    <span className="flex-1">{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Teams Filter */}
            <div>
              <button className="w-full flex items-center justify-between text-sm font-medium text-gray-700 mb-2">
                Teams
                <ChevronDown className="w-4 h-4" />
              </button>
              <div className="space-y-1">
                {[
                  { value: 'mine', label: 'My Rules' },
                  { value: 'shared', label: 'Shared with me' },
                  { value: 'team', label: 'Team Rules' }
                ].map(item => (
                  <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="checkbox"
                      checked={filters.teams.has(item.value)}
                      onChange={() => toggleFilter('teams', item.value)}
                      className="rounded border-gray-300"
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* AI Suggestions */}
          <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Brain className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">AI Suggestions</h4>
                  <p className="text-xs text-gray-600 mb-3">
                    Based on your data patterns, we recommend adding duplicate detection rules.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAIAssistant(true)}
                    className="w-full text-xs"
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Ask AI
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Quality Score */}
        <div className="bg-white border-b border-gray-200 p-4">
          <QualityScoreDashboard metrics={qualityMetrics} rules={rules} />
        </div>

        {/* Toolbar */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search */}
            <div className="flex-1 max-w-md relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search rules, tables, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* View Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('canvas')}
                className={`px-3 py-1.5 rounded ${
                  viewMode === 'canvas'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('impact')}
                className={`px-3 py-1.5 rounded ${
                  viewMode === 'impact'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {selectedRules.size > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const selectedRulesList = Array.from(selectedRules);
                    for (const ruleId of selectedRulesList) {
                      await onRuleExecute?.(ruleId);
                    }
                  }}
                  className="bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Run Selected ({selectedRules.size})
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const activeRules = rules.filter(r => r.enabled);
                  for (const rule of activeRules) {
                    await onRuleExecute?.(rule.id);
                  }
                }}
                disabled={rules.filter(r => r.enabled).length === 0}
              >
                <Zap className="w-4 h-4 mr-2" />
                Run All Rules
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMarketplace(true)}
              >
                <Target className="w-4 h-4 mr-2" />
                Templates
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIAssistant(true)}
              >
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask AI
              </Button>
              <Button
                size="sm"
                onClick={() => setShowRuleBuilder(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Rule
              </Button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'canvas' && (
            <RuleCanvas
              rules={filteredRules}
              selectedRules={selectedRules}
              onRuleSelect={(id) => {
                const newSelected = new Set(selectedRules);
                if (newSelected.has(id)) {
                  newSelected.delete(id);
                } else {
                  newSelected.add(id);
                }
                setSelectedRules(newSelected);
              }}
              onRuleEdit={(rule) => {
                setEditingRule(rule);
                setShowRuleBuilder(true);
              }}
              onRuleExecute={onRuleExecute}
              onRuleView={(rule) => setViewingRule(rule)}
            />
          )}

          {viewMode === 'list' && (
            <div className="space-y-3">
              {filteredRules.map(rule => (
                <Card key={rule.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <input
                          type="checkbox"
                          checked={selectedRules.has(rule.id)}
                          onChange={() => {
                            const newSelected = new Set(selectedRules);
                            if (newSelected.has(rule.id)) {
                              newSelected.delete(rule.id);
                            } else {
                              newSelected.add(rule.id);
                            }
                            setSelectedRules(newSelected);
                          }}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{rule.name}</h3>
                          <p className="text-sm text-gray-500">{rule.description}</p>
                        </div>
                        <Badge variant={rule.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {rule.severity}
                        </Badge>
                        {rule.last_result && (
                          <div className="text-sm text-gray-600">
                            {rule.last_result.issues_found} issues
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onRuleExecute?.(rule.id)}
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {viewMode === 'impact' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Impact Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    Impact view shows which rules have the biggest effect on your data quality score.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRuleBuilder && (
        <VisualRuleBuilder
          rule={editingRule}
          dataSourceId={dataSourceId}
          selectedDatabase={selectedDatabase}
          onSave={async (rule) => {
            if (editingRule) {
              await onRuleUpdate?.(editingRule.id, rule);
            } else {
              await onRuleCreate?.(rule);
            }
            setShowRuleBuilder(false);
            setEditingRule(null);
          }}
          onCancel={() => {
            setShowRuleBuilder(false);
            setEditingRule(null);
          }}
        />
      )}

      {showMarketplace && (
        <RuleTemplatesMarketplace
          onSelectTemplate={(template) => {
            onRuleCreate?.(template);
            setShowMarketplace(false);
          }}
          onClose={() => setShowMarketplace(false)}
        />
      )}

      {showAIAssistant && (
        <AIRuleAssistant
          dataSourceId={dataSourceId}
          existingRules={rules}
          onCreateRule={(rule) => {
            onRuleCreate?.(rule);
          }}
          onClose={() => setShowAIAssistant(false)}
        />
      )}

      {showImpactSimulator && (
        <RuleImpactSimulator
          rule={editingRule}
          onClose={() => setShowImpactSimulator(false)}
        />
      )}

      {viewingRule && (
        <RuleDetailsModal
          rule={viewingRule}
          onClose={() => setViewingRule(null)}
          onEdit={(rule) => {
            setEditingRule(rule);
            setShowRuleBuilder(true);
            setViewingRule(null);
          }}
          onDelete={(id) => {
            onRuleDelete?.(id);
            setViewingRule(null);
          }}
          onExecute={(id) => {
            onRuleExecute?.(id);
          }}
        />
      )}
    </div>
  );
};
