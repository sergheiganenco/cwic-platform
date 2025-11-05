// Revolutionary Rules Page - Right Inspector Panel
import React from 'react';
import {
  Play,
  Edit,
  Copy,
  Trash2,
  PauseCircle,
  Clock,
  Database,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Sparkles,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent } from '@components/ui/Card';

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

interface RightInspectorProps {
  rule: QualityRule | null | undefined;
  onEdit: (rule: QualityRule) => void;
  onDelete: (ruleId: string) => void;
  onExecute: (ruleId: string) => void;
  onViewIssues?: (ruleId: string) => void;
  onDuplicate?: (rule: QualityRule) => void;
  onToggleEnabled?: (ruleId: string) => void;
  className?: string;
}

export const RightInspector: React.FC<RightInspectorProps> = ({
  rule,
  onEdit,
  onDelete,
  onExecute,
  onViewIssues,
  onDuplicate,
  onToggleEnabled,
  className = ''
}) => {
  if (!rule) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center text-gray-500 p-8">
          <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-sm">Select a rule to view details</p>
        </div>
      </div>
    );
  }

  // Clamp pass rate to 0-100 to handle backend calculation errors
  const rawPassRate = rule.last_result?.pass_rate ?? 0;
  const passRate = Math.min(100, Math.max(0, rawPassRate));
  const healthScore = passRate;

  // Get health status
  const getHealthStatus = () => {
    if (healthScore >= 95) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
    if (healthScore >= 85) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (healthScore >= 70) return { label: 'Fair', color: 'text-yellow-600', bg: 'bg-yellow-50' };
    if (healthScore >= 50) return { label: 'Poor', color: 'text-orange-600', bg: 'bg-orange-50' };
    return { label: 'Critical', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const health = getHealthStatus();

  // Format date
  const formatDate = (date?: string) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleString();
  };

  // Time ago
  const timeAgo = (date?: string) => {
    if (!date) return 'Never';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Rule Header */}
      <div>
        <h2 className="font-bold text-lg text-gray-900 mb-1 break-words">
          {rule.name}
        </h2>
        {rule.description && (
          <p className="text-sm text-gray-600">{rule.description}</p>
        )}
      </div>

      {/* Health at a Glance */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Health at a Glance
            </div>

            {/* Health Ring */}
            <div className="relative inline-flex items-center justify-center mb-3">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke={
                    healthScore >= 90 ? '#10b981' :
                    healthScore >= 70 ? '#f59e0b' :
                    '#ef4444'
                  }
                  strokeWidth="8"
                  strokeDasharray={`${(healthScore / 100) * 351.86} 351.86`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-3xl font-bold text-gray-900">
                  {healthScore.toFixed(0)}%
                </div>
                <div className={`text-xs font-semibold ${health.color}`}>
                  {health.label}
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="font-bold text-gray-900">
                  {rule.execution_count?.toLocaleString() || 0}
                </div>
                <div className="text-gray-600">Executions</div>
              </div>
              <div className="text-center p-2 bg-gray-50 rounded">
                <div className="font-bold text-gray-900">
                  {rule.last_result?.issues_found || 0}
                </div>
                <div className="text-gray-600">Issues</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What It Checks */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-gray-600" />
            <h3 className="font-semibold text-sm">What It Checks</h3>
          </div>

          <div className="space-y-2 text-sm">
            {rule.column_name && (
              <div>
                <span className="text-gray-600">Column:</span>
                <span className="ml-2 font-medium text-gray-900">{rule.column_name}</span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Type:</span>
              <span className="ml-2 font-medium text-gray-900 capitalize">
                {rule.rule_type ? rule.rule_type.replace(/_/g, ' ') : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Dimension:</span>
              <span className="ml-2 font-medium text-gray-900 capitalize">{rule.dimension || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-600">Severity:</span>
              <span className={`ml-2 font-medium uppercase text-xs px-2 py-0.5 rounded ${
                rule.severity === 'critical' ? 'bg-red-100 text-red-700' :
                rule.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                rule.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                {rule.severity}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Execution Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-gray-600" />
            <h3 className="font-semibold text-sm">Execution</h3>
          </div>

          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-600">Last Run:</span>
              <span className="ml-2 font-medium text-gray-900">
                {timeAgo(rule.last_executed_at)}
              </span>
            </div>
            {rule.last_result?.execution_time_ms && (
              <div>
                <span className="text-gray-600">Duration:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {rule.last_result.execution_time_ms}ms
                </span>
              </div>
            )}
            <div>
              <span className="text-gray-600">Status:</span>
              <span className="ml-2">
                {rule.enabled ? (
                  <span className="text-green-600 font-medium">● Enabled</span>
                ) : (
                  <span className="text-gray-600">○ Disabled</span>
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Current Issues */}
      {rule.last_result && rule.last_result.issues_found && rule.last_result.issues_found > 0 && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <h3 className="font-semibold text-sm text-red-900">
                Current Issues ({rule.last_result.issues_found})
              </h3>
            </div>

            <div className="text-sm text-red-800">
              {rule.last_result.message || `Found ${rule.last_result.issues_found} violations in last scan`}
            </div>

            <Button
              size="sm"
              variant="outline"
              className="w-full mt-3 border-red-300 text-red-700 hover:bg-red-100"
              onClick={() => onViewIssues?.(rule.id)}
            >
              <BarChart3 className="h-3 w-3 mr-2" />
              View All Issues
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardContent className="p-4">
          <h3 className="font-semibold text-sm mb-3">Quick Actions</h3>

          <div className="space-y-2">
            <Button
              size="sm"
              className="w-full"
              onClick={() => onExecute(rule.id)}
              disabled={!rule.enabled}
            >
              <Play className="h-3 w-3 mr-2" />
              Run Now
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onEdit(rule)}
            >
              <Edit className="h-3 w-3 mr-2" />
              Edit Rule
            </Button>

            {onDuplicate && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onDuplicate(rule)}
              >
                <Copy className="h-3 w-3 mr-2" />
                Duplicate
              </Button>
            )}

            {onToggleEnabled && (
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => onToggleEnabled(rule.id)}
              >
                <PauseCircle className="h-3 w-3 mr-2" />
                {rule.enabled ? 'Disable' : 'Enable'}
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="w-full text-red-600 border-red-300 hover:bg-red-50"
              onClick={() => {
                if (window.confirm(`Delete rule "${rule.name}"?`)) {
                  onDelete(rule.id);
                }
              }}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI Suggestions (Placeholder) */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-purple-600" />
            <h3 className="font-semibold text-sm text-purple-900">AI Suggestions</h3>
          </div>

          <div className="text-xs text-purple-800">
            <div className="mb-2">
              • Consider adding similar rules for related columns
            </div>
            <div className="mb-2">
              • {healthScore < 80 ? 'Review rule configuration to improve pass rate' : 'Rule is performing well'}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Placeholder Target import
const Target = Database;
