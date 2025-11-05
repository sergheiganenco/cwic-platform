// Revolutionary Rule Card - Visual Status Display
import React from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  Play,
  Edit,
  BarChart3,
  Clock,
  Database,
  Circle
} from 'lucide-react';
import { Button } from '@components/ui/Button';

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
  enabled: boolean;
  created_at?: string;
  last_executed_at?: string;
  execution_count?: number;
  last_result?: {
    status: 'passed' | 'failed' | 'error';
    issues_found?: number;
    pass_rate?: number;
    execution_time_ms?: number;
  };
}

interface RuleCardProps {
  rule: QualityRule;
  onEdit: (rule: QualityRule) => void;
  onExecute: (ruleId: string) => void;
  onViewIssues?: (ruleId: string) => void;
  onClick?: (ruleId: string) => void;
  isSelected?: boolean;
  isExecuting?: boolean;
  viewMode?: 'compact' | 'normal' | 'detailed';
  showCheckbox?: boolean;
  isChecked?: boolean;
  onCheckChange?: (ruleId: string, checked: boolean) => void;
}

export const RuleCard: React.FC<RuleCardProps> = ({
  rule,
  onEdit,
  onExecute,
  onViewIssues,
  onClick,
  isSelected = false,
  isExecuting = false,
  viewMode = 'normal',
  showCheckbox = false,
  isChecked = false,
  onCheckChange
}) => {
  // Determine card status
  const getStatus = () => {
    if (!rule.enabled) return 'disabled';
    if (isExecuting) return 'running';
    if (!rule.last_result) return 'never_run';
    if (rule.last_result.status === 'error') return 'error';
    if (rule.last_result.status === 'failed') return 'failing';
    return 'passing';
  };

  const status = getStatus();

  // Status styling
  const statusStyles = {
    passing: {
      border: 'border-l-green-500',
      bg: 'bg-green-50',
      icon: <CheckCircle className="h-5 w-5 text-green-600" />,
      badge: 'bg-green-100 text-green-700'
    },
    failing: {
      border: 'border-l-red-500',
      bg: 'bg-red-50',
      icon: <XCircle className="h-5 w-5 text-red-600" />,
      badge: 'bg-red-100 text-red-700'
    },
    error: {
      border: 'border-l-orange-500',
      bg: 'bg-orange-50',
      icon: <AlertTriangle className="h-5 w-5 text-orange-600" />,
      badge: 'bg-orange-100 text-orange-700'
    },
    running: {
      border: 'border-l-blue-500',
      bg: 'bg-blue-50',
      icon: <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />,
      badge: 'bg-blue-100 text-blue-700'
    },
    disabled: {
      border: 'border-l-gray-400',
      bg: 'bg-gray-50',
      icon: <Circle className="h-5 w-5 text-gray-400" />,
      badge: 'bg-gray-100 text-gray-600'
    },
    never_run: {
      border: 'border-l-gray-400',
      bg: 'bg-white',
      icon: <Circle className="h-5 w-5 text-gray-400" />,
      badge: 'bg-gray-100 text-gray-600'
    }
  };

  const style = statusStyles[status];

  // Severity stars
  const getSeverityStars = () => {
    const counts = { low: 1, medium: 2, high: 3, critical: 3 };
    const count = counts[rule.severity] || 1;
    return '⭐'.repeat(count);
  };

  // Format time ago
  const formatTimeAgo = (date?: string) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Calculate pass rate (clamp to 0-100 to handle backend errors)
  const rawPassRate = rule.last_result?.pass_rate ?? 0;
  const passRate = Math.min(100, Math.max(0, rawPassRate));

  // Height based on view mode
  const heights = {
    compact: 'min-h-[120px]',
    normal: 'min-h-[180px]',
    detailed: 'min-h-[240px]'
  };

  return (
    <div
      className={`
        relative rounded-lg border-l-4 ${style.border} ${style.bg}
        border shadow-sm hover:shadow-md
        transition-all duration-200 cursor-pointer
        ${isSelected ? 'ring-4 ring-blue-500 border-blue-500' : 'border-gray-200'}
        ${heights[viewMode]}
        p-4
      `}
      onClick={() => onClick?.(rule.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Checkbox for multiple selection */}
          {showCheckbox && (
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                onCheckChange?.(rule.id, e.target.checked);
              }}
              onClick={(e) => e.stopPropagation()}
              className="mt-1 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
          )}

          {/* Status Icon - Shows checkmark when selected, otherwise shows status */}
          <div className="flex-shrink-0 mt-0.5">
            {isSelected ? (
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-white fill-current" />
              </div>
            ) : (
              style.icon
            )}
          </div>

          {/* Title and Metadata */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-gray-900 text-sm truncate">
                {rule.name}
              </h3>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {getSeverityStars()}
              </span>
            </div>

            {/* Subtitle */}
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
              {rule.column_name && (
                <>
                  <Database className="h-3 w-3" />
                  <span className="truncate">{rule.column_name}</span>
                  <span>•</span>
                </>
              )}
              <span className="capitalize">{rule.dimension}</span>
              <span>•</span>
              <span className="uppercase text-xs font-medium">
                {rule.severity}
              </span>
            </div>
          </div>
        </div>

        {/* Live Badge */}
        {status === 'running' && (
          <span className={`px-2 py-1 rounded-full text-xs font-bold ${style.badge}`}>
            LIVE
          </span>
        )}
      </div>

      {/* Stats Bar */}
      {rule.last_result && viewMode !== 'compact' && (
        <div className="mb-3">
          {/* Progress Bar */}
          <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                passRate >= 90
                  ? 'bg-green-500'
                  : passRate >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${passRate}%` }}
            />
          </div>

          {/* Stats */}
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-4">
              <span className="font-semibold text-gray-900">
                {passRate.toFixed(1)}% Pass
              </span>
              {rule.last_result.issues_found !== undefined && (
                <span className="text-red-600 font-medium">
                  {rule.last_result.issues_found} issues
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{formatTimeAgo(rule.last_executed_at)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Latest Finding (Detailed View) */}
      {viewMode === 'detailed' && rule.last_result?.issues_found && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          ⚠️ Found {rule.last_result.issues_found} issues in last scan
        </div>
      )}

      {/* Execution Stats (Normal/Detailed) */}
      {viewMode !== 'compact' && (
        <div className="text-xs text-gray-600 mb-3">
          {rule.execution_count ? (
            <span>Executed {rule.execution_count.toLocaleString()} times</span>
          ) : (
            <span className="text-gray-500 italic">Never executed</span>
          )}
          {rule.last_result?.execution_time_ms && (
            <span> • {rule.last_result.execution_time_ms}ms</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onExecute(rule.id);
          }}
          disabled={isExecuting || !rule.enabled}
          className="flex-1"
        >
          {isExecuting ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Play className="h-3 w-3 mr-1" />
          )}
          {isExecuting ? 'Running...' : 'Run'}
        </Button>

        {rule.last_result?.issues_found && onViewIssues ? (
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              onViewIssues(rule.id);
            }}
            className="flex-1"
          >
            <BarChart3 className="h-3 w-3 mr-1" />
            Issues
          </Button>
        ) : null}

        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(rule);
          }}
          className="flex-shrink-0"
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>

      {/* Disabled Overlay */}
      {!rule.enabled && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-10 rounded-lg flex items-center justify-center">
          <span className="bg-gray-700 text-white px-3 py-1 rounded-full text-xs font-semibold">
            DISABLED
          </span>
        </div>
      )}
    </div>
  );
};
