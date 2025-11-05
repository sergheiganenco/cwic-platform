// Rule Details Modal - View rule execution results and details
import React from 'react';
import {
  X,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Database,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Pause,
  History
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import type { QualityRule } from '@services/api/quality';

interface RuleDetailsModalProps {
  rule: QualityRule;
  onClose: () => void;
  onEdit: (rule: QualityRule) => void;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
}

export const RuleDetailsModal: React.FC<RuleDetailsModalProps> = ({
  rule,
  onClose,
  onEdit,
  onDelete,
  onExecute
}) => {
  const getStatusIcon = () => {
    if (!rule.last_result) return <AlertCircle className="w-6 h-6 text-gray-400" />;

    switch (rule.last_result.status) {
      case 'passed':
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case 'failed':
        return <XCircle className="w-6 h-6 text-red-500" />;
      default:
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'red';
      case 'high': return 'orange';
      case 'medium': return 'yellow';
      case 'low': return 'green';
      default: return 'gray';
    }
  };

  const severityColor = getSeverityColor(rule.severity);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-4 flex-1">
            {getStatusIcon()}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{rule.name}</h2>
              <p className="text-sm text-gray-600 mt-1">{rule.description || 'No description'}</p>
            </div>
            <Badge className={`bg-${severityColor}-100 text-${severityColor}-700 border-${severityColor}-200`}>
              {rule.severity}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rule Overview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Type</div>
                    <div className="text-sm text-gray-900">{rule.rule_type}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Dimension</div>
                    <div className="text-sm text-gray-900">{rule.dimension}</div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-700">Status</div>
                    <div className="text-sm">
                      <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                        {rule.enabled ? 'Active' : 'Paused'}
                      </Badge>
                    </div>
                  </div>
                  {rule.table_name && (
                    <div>
                      <div className="text-sm font-medium text-gray-700">Target</div>
                      <div className="text-sm font-mono text-gray-900">
                        {rule.table_name}
                        {rule.column_name && `.${rule.column_name}`}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expression */}
              {rule.expression && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Rule Expression</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="bg-gray-50 p-3 rounded text-xs font-mono overflow-x-auto">
                      {rule.expression}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {/* Execution History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Execution History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Total Executions</span>
                      <span className="font-medium">{rule.execution_count || 0}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Last Executed</span>
                      <span className="font-medium">
                        {rule.last_executed_at
                          ? new Date(rule.last_executed_at).toLocaleString()
                          : 'Never'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Created</span>
                      <span className="font-medium">
                        {rule.created_at
                          ? new Date(rule.created_at).toLocaleDateString()
                          : 'Unknown'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Latest Results */}
              {rule.last_result ? (
                <Card className={
                  rule.last_result.status === 'passed'
                    ? 'border-green-200 bg-green-50'
                    : rule.last_result.status === 'failed'
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" />
                      Latest Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Status */}
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Status</div>
                      <Badge
                        variant={
                          rule.last_result.status === 'passed'
                            ? 'default'
                            : 'destructive'
                        }
                        className="text-sm"
                      >
                        {rule.last_result.status === 'passed' ? '✓ Passed' : '✗ Failed'}
                      </Badge>
                    </div>

                    {/* Pass Rate */}
                    {rule.last_result.pass_rate !== undefined && (
                      <div>
                        <div className="flex items-center justify-between text-sm mb-2">
                          <span className="font-medium text-gray-700">Pass Rate</span>
                          <span className={`font-bold ${
                            rule.last_result.pass_rate >= 95 ? 'text-green-600' :
                            rule.last_result.pass_rate >= 80 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {rule.last_result.pass_rate.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={rule.last_result.pass_rate} className="h-2" />
                      </div>
                    )}

                    {/* Issues Found */}
                    {rule.last_result.issues_found !== undefined && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Issues Found</span>
                        <span className={`text-2xl font-bold ${
                          rule.last_result.issues_found === 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {rule.last_result.issues_found.toLocaleString()}
                        </span>
                      </div>
                    )}

                    {/* Execution Time */}
                    {rule.last_result.execution_time_ms !== undefined && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          Execution Time
                        </span>
                        <span className="font-medium">
                          {rule.last_result.execution_time_ms < 1000
                            ? `${rule.last_result.execution_time_ms}ms`
                            : `${(rule.last_result.execution_time_ms / 1000).toFixed(2)}s`}
                        </span>
                      </div>
                    )}

                    {/* Message */}
                    {rule.last_result.message && (
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="text-xs text-gray-600 mb-1">Message</div>
                        <div className="text-sm text-gray-900">{rule.last_result.message}</div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-gray-200 bg-gray-50">
                  <CardContent className="p-6 text-center">
                    <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Yet</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      This rule hasn't been executed yet. Run it to see results.
                    </p>
                    <Button onClick={() => onExecute(rule.id)} size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Run Now
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Configuration */}
              {rule.threshold !== undefined && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Configuration</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Pass Threshold</span>
                      <span className="text-sm font-medium text-gray-900">{rule.threshold}%</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(rule)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit Rule
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm(`Are you sure you want to delete "${rule.name}"?`)) {
                  onDelete(rule.id);
                  onClose();
                }
              }}
              className="text-red-600 hover:bg-red-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => onExecute(rule.id)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Play className="w-4 h-4 mr-2" />
              Run Rule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
