// Revolutionary Rules Page - Left Navigator with Smart Filters
import React, { useMemo } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  PauseCircle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  User,
  Database,
  Target
} from 'lucide-react';

interface QualityRule {
  id: string;
  name: string;
  dimension: string;
  severity: string;
  enabled: boolean;
  last_result?: {
    status: 'passed' | 'failed' | 'error';
  };
}

interface LeftNavigatorProps {
  rules: QualityRule[];
  activeFilter?: string;
  onFilterChange?: (filter: string) => void;
  className?: string;
}

export const LeftNavigator: React.FC<LeftNavigatorProps> = ({
  rules,
  activeFilter,
  onFilterChange,
  className = ''
}) => {
  // Calculate stats
  const stats = useMemo(() => {
    const total = rules.length;
    const enabled = rules.filter(r => r.enabled).length;
    const disabled = total - enabled;

    const passing = rules.filter(
      r => r.enabled && r.last_result?.status === 'passed'
    ).length;
    const failing = rules.filter(
      r => r.enabled && r.last_result?.status === 'failed'
    ).length;
    const errors = rules.filter(
      r => r.enabled && r.last_result?.status === 'error'
    ).length;
    const neverRun = rules.filter(r => r.enabled && !r.last_result).length;

    // Group by dimension
    const byDimension = rules.reduce((acc, rule) => {
      const dimension = rule.dimension || 'Uncategorized';
      acc[dimension] = (acc[dimension] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Check for autopilot rules
    const autopilotRules = rules.filter(r => r.name.startsWith('[Autopilot]'));

    return {
      total,
      enabled,
      disabled,
      passing,
      failing,
      errors,
      neverRun,
      byDimension,
      autopilotCount: autopilotRules.length,
      passingPercent: enabled > 0 ? Math.round((passing / enabled) * 100) : 0,
      failingPercent: enabled > 0 ? Math.round((failing / enabled) * 100) : 0,
      errorsPercent: enabled > 0 ? Math.round((errors / enabled) * 100) : 0
    };
  }, [rules]);

  const [expandedSections, setExpandedSections] = React.useState<Set<string>>(
    new Set(['status', 'dimensions'])
  );

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const isExpanded = (section: string) => expandedSections.has(section);

  // Section component
  const Section: React.FC<{
    id: string;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ id, title, icon, children }) => (
    <div className="mb-4">
      <button
        onClick={() => toggleSection(id)}
        className="flex items-center justify-between w-full text-left py-2 px-3 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-sm text-gray-700">
          {icon}
          <span>{title}</span>
        </div>
        {isExpanded(id) ? (
          <ChevronDown className="h-4 w-4 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500" />
        )}
      </button>
      {isExpanded(id) && <div className="mt-2 ml-2">{children}</div>}
    </div>
  );

  // Filter item component
  const FilterItem: React.FC<{
    label: string;
    count: number;
    percent?: number;
    icon: React.ReactNode;
    color: string;
    filter: string;
  }> = ({ label, count, percent, icon, color, filter }) => (
    <button
      onClick={() => onFilterChange?.(filter)}
      className={`
        w-full flex items-center justify-between py-2 px-3 rounded-lg
        hover:bg-gray-100 transition-colors text-left
        ${activeFilter === filter ? 'bg-blue-50 border border-blue-200' : ''}
      `}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className={`flex-shrink-0 ${color}`}>{icon}</div>
        <span className="text-sm text-gray-700 truncate flex-1">{label}</span>
        <span className="text-xs text-gray-500 flex-shrink-0">({count})</span>
      </div>
      {percent !== undefined && (
        <div className="flex-shrink-0 ml-2 w-16">
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full ${color.replace('text-', 'bg-')}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );

  // Dimension colors
  const dimensionColors: Record<string, string> = {
    completeness: 'text-blue-600',
    accuracy: 'text-green-600',
    consistency: 'text-purple-600',
    validity: 'text-indigo-600',
    freshness: 'text-orange-600',
    uniqueness: 'text-yellow-600'
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Quick Status */}
      <Section id="status" title="QUICK STATUS" icon={<Target className="h-4 w-4" />}>
        <div className="space-y-1">
          <FilterItem
            label="Passing"
            count={stats.passing}
            percent={stats.passingPercent}
            icon={<CheckCircle className="h-4 w-4" />}
            color="text-green-600"
            filter="status:passing"
          />
          <FilterItem
            label="Failing"
            count={stats.failing}
            percent={stats.failingPercent}
            icon={<XCircle className="h-4 w-4" />}
            color="text-red-600"
            filter="status:failing"
          />
          <FilterItem
            label="Errors"
            count={stats.errors}
            percent={stats.errorsPercent}
            icon={<AlertTriangle className="h-4 w-4" />}
            color="text-orange-600"
            filter="status:error"
          />
          <FilterItem
            label="Disabled"
            count={stats.disabled}
            icon={<PauseCircle className="h-4 w-4" />}
            color="text-gray-600"
            filter="status:disabled"
          />
        </div>
      </Section>

      {/* Smart Groups */}
      {stats.autopilotCount > 0 && (
        <Section id="groups" title="SMART GROUPS" icon={<Sparkles className="h-4 w-4" />}>
          <div className="space-y-1">
            <FilterItem
              label="Autopilot"
              count={stats.autopilotCount}
              icon={<Sparkles className="h-4 w-4" />}
              color="text-purple-600"
              filter="group:autopilot"
            />
            <FilterItem
              label="My Rules"
              count={stats.total - stats.autopilotCount}
              icon={<User className="h-4 w-4" />}
              color="text-blue-600"
              filter="group:custom"
            />
          </div>
        </Section>
      )}

      {/* By Dimension */}
      <Section id="dimensions" title="BY DIMENSION" icon={<Database className="h-4 w-4" />}>
        <div className="space-y-1">
          {Object.entries(stats.byDimension)
            .sort(([, a], [, b]) => b - a)
            .map(([dimension, count]) => (
              <FilterItem
                key={dimension}
                label={dimension.charAt(0).toUpperCase() + dimension.slice(1)}
                count={count}
                percent={Math.round((count / stats.total) * 100)}
                icon={<div className="w-2 h-2 rounded-full bg-current" />}
                color={dimensionColors[dimension] || 'text-gray-600'}
                filter={`dimension:${dimension}`}
              />
            ))}
        </div>
      </Section>

      {/* Smart Insights */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-blue-600" />
          <h3 className="font-semibold text-sm text-blue-900">SMART INSIGHTS</h3>
        </div>

        <div className="space-y-3 text-sm">
          {stats.neverRun > 0 && (
            <div className="bg-white rounded p-2 border border-blue-100">
              <div className="text-blue-900 font-medium mb-1">
                ⚠️ {stats.neverRun} rules never executed
              </div>
              <button
                onClick={() => onFilterChange?.('status:never_run')}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium hover:underline"
              >
                View unexecuted rules →
              </button>
            </div>
          )}

          {stats.failing > 10 && (
            <div className="bg-white rounded p-2 border border-blue-100">
              <div className="text-blue-900 font-medium mb-1">
                🔴 {stats.failing} rules failing
              </div>
              <button
                onClick={() => onFilterChange?.('status:failing')}
                className="text-blue-600 hover:text-blue-700 text-xs font-medium hover:underline"
              >
                Investigate issues →
              </button>
            </div>
          )}

          {stats.passingPercent >= 95 && (
            <div className="bg-white rounded p-2 border border-blue-100">
              <div className="text-green-700 font-medium mb-1">
                ✅ Excellent quality!
              </div>
              <div className="text-gray-600 text-xs">
                {stats.passingPercent}% of rules passing
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="text-xs text-gray-600 p-3 bg-gray-50 rounded-lg">
        <div className="font-semibold mb-2">Summary</div>
        <div className="space-y-1">
          <div className="flex justify-between">
            <span>Total Rules:</span>
            <span className="font-medium">{stats.total}</span>
          </div>
          <div className="flex justify-between">
            <span>Enabled:</span>
            <span className="font-medium">{stats.enabled}</span>
          </div>
          <div className="flex justify-between">
            <span>Health Score:</span>
            <span className={`font-medium ${
              stats.passingPercent >= 90 ? 'text-green-600' :
              stats.passingPercent >= 70 ? 'text-yellow-600' :
              'text-red-600'
            }`}>
              {stats.passingPercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
