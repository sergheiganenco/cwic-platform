// RuleExecutionHistory.tsx - Production-Grade Execution Monitoring
import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Filter,
  Loader2,
  Play,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import type { RuleExecutionResult } from '@services/api/quality';

// ============================================================================
// TYPES
// ============================================================================

interface RuleExecutionHistoryProps {
  ruleId?: string;
  dataSourceId?: string;
  onClose?: () => void;
}

interface ExecutionStats {
  total: number;
  passed: number;
  failed: number;
  errors: number;
  avgExecutionTime: number;
  passRate: number;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const RuleExecutionHistory: React.FC<RuleExecutionHistoryProps> = ({
  ruleId,
  dataSourceId,
  onClose,
}) => {
  // State
  const [executions, setExecutions] = useState<RuleExecutionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ExecutionStats>({
    total: 0,
    passed: 0,
    failed: 0,
    errors: 0,
    avgExecutionTime: 0,
    passRate: 0,
  });
  const [expandedExecution, setExpandedExecution] = useState<string | null>(null);
  const [filter, setFilter] = useState({
    status: '',
    search: '',
    timeRange: '7d',
  });

  // Load executions
  useEffect(() => {
    loadExecutions();
  }, [ruleId, dataSourceId, filter]);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        ...(ruleId && { ruleId }),
        ...(dataSourceId && { dataSourceId }),
        ...(filter.status && { status: filter.status }),
        timeRange: filter.timeRange,
        limit: '100',
      });

      const response = await fetch(`/api/quality/results?${params}`);
      const data = await response.json();

      if (data.success) {
        setExecutions(data.data);
        calculateStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load executions:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (results: RuleExecutionResult[]) => {
    const total = results.length;
    const passed = results.filter((r) => r.status === 'passed').length;
    const failed = results.filter((r) => r.status === 'failed').length;
    const errors = results.filter((r) => r.status === 'error').length;
    const avgExecutionTime =
      results.reduce((sum, r) => sum + (r.executionTimeMs || 0), 0) / total || 0;
    const passRate = total > 0 ? (passed / total) * 100 : 0;

    setStats({
      total,
      passed,
      failed,
      errors,
      avgExecutionTime,
      passRate,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  };

  const exportToCSV = () => {
    const headers = ['Timestamp', 'Rule', 'Status', 'Duration', 'Rows Checked', 'Rows Failed'];
    const rows = executions.map((exec) => [
      new Date(exec.runAt).toISOString(),
      exec.ruleName || exec.ruleId,
      exec.status,
      exec.executionTimeMs,
      exec.rowsChecked || 0,
      exec.rowsFailed || 0,
    ]);

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rule-executions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-gray-600">Total Runs</p>
              </div>
              <Activity className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
                <p className="text-xs text-gray-600">Passed</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
                <p className="text-xs text-gray-600">Failed</p>
              </div>
              <XCircle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.passRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600">Pass Rate</p>
              </div>
              <Zap className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{formatDuration(stats.avgExecutionTime)}</p>
                <p className="text-xs text-gray-600">Avg Duration</p>
              </div>
              <Clock className="h-8 w-8 text-purple-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search executions..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Status</option>
                <option value="passed">Passed</option>
                <option value="failed">Failed</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>

              <select
                value={filter.timeRange}
                onChange={(e) => setFilter({ ...filter, timeRange: e.target.value })}
                className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
              </select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadExecutions}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportToCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pass Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pass Rate Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <Progress value={stats.passRate} className="flex-1 h-3" />
            <span className="text-sm font-medium">{stats.passRate.toFixed(1)}%</span>
          </div>
          <p className="text-xs text-gray-600">
            {stats.passed} passed, {stats.failed} failed, {stats.errors} errors out of {stats.total}{' '}
            total runs
          </p>
        </CardContent>
      </Card>

      {/* Execution List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Execution History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600">Loading execution history...</p>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600">No executions found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {executions
                .filter((exec) => {
                  if (!filter.search) return true;
                  const searchLower = filter.search.toLowerCase();
                  return (
                    exec.ruleName?.toLowerCase().includes(searchLower) ||
                    exec.ruleId.toLowerCase().includes(searchLower)
                  );
                })
                .map((exec) => (
                  <div
                    key={exec.id}
                    className={`p-4 border rounded-lg transition-all ${
                      expandedExecution === exec.id ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <button
                          onClick={() =>
                            setExpandedExecution(expandedExecution === exec.id ? null : exec.id)
                          }
                          className="mt-1"
                        >
                          {expandedExecution === exec.id ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusIcon(exec.status)}
                            <span className="font-medium">{exec.ruleName || exec.ruleId}</span>
                            <Badge
                              className={`text-xs ${getStatusColor(exec.status)}`}
                            >
                              {exec.status}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-4 text-xs text-gray-600">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(exec.runAt).toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDuration(exec.executionTimeMs || 0)}
                            </span>
                            {exec.rowsChecked !== undefined && (
                              <span>
                                {exec.rowsChecked?.toLocaleString()} rows checked
                              </span>
                            )}
                            {exec.rowsFailed !== undefined && exec.rowsFailed > 0 && (
                              <span className="text-red-600">
                                {exec.rowsFailed?.toLocaleString()} failed
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {exec.metricValue !== undefined && exec.thresholdValue !== undefined && (
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {exec.metricValue.toFixed(2)} / {exec.thresholdValue.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">Metric / Threshold</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedExecution === exec.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        {exec.errorMessage && (
                          <div className="p-3 bg-red-50 rounded-lg">
                            <p className="text-sm font-medium text-red-900 mb-1">Error Message:</p>
                            <p className="text-sm text-red-800 font-mono">{exec.errorMessage}</p>
                          </div>
                        )}

                        {exec.sampleFailures && exec.sampleFailures.length > 0 && (
                          <div className="p-3 bg-amber-50 rounded-lg">
                            <p className="text-sm font-medium text-amber-900 mb-2">
                              Sample Failures:
                            </p>
                            <div className="overflow-x-auto">
                              <pre className="text-xs font-mono text-amber-800">
                                {JSON.stringify(exec.sampleFailures, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {exec.anomalyScore !== undefined && (
                          <div className="p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm font-medium text-blue-900 mb-1">
                              Anomaly Score:
                            </p>
                            <div className="flex items-center gap-2">
                              <Progress value={exec.anomalyScore * 100} className="flex-1 h-2" />
                              <span className="text-sm font-medium text-blue-800">
                                {(exec.anomalyScore * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div className="p-2 bg-gray-100 rounded">
                            <p className="text-gray-600">Execution ID</p>
                            <p className="font-mono">{exec.id.substring(0, 8)}...</p>
                          </div>
                          <div className="p-2 bg-gray-100 rounded">
                            <p className="text-gray-600">Rule ID</p>
                            <p className="font-mono">{exec.ruleId.substring(0, 8)}...</p>
                          </div>
                          <div className="p-2 bg-gray-100 rounded">
                            <p className="text-gray-600">Asset ID</p>
                            <p className="font-mono">
                              {exec.assetId ? exec.assetId : 'N/A'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
