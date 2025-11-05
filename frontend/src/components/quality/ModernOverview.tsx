// frontend/src/components/quality/ModernOverview.tsx
// Modern Data Quality Overview with Real-Time Updates, ML Predictions, and Business Impact

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Loader2,
  Zap,
  Brain,
  DollarSign,
  Users,
  FileText,
  Activity,
  Database,
  BarChart3,
  RefreshCw,
  Download,
  Play,
  Sparkles,
  Info
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { Progress } from '@components/ui/Progress';
import { Alert, AlertDescription } from '@components/ui/Alert';

// ============================================================================
// TYPES
// ============================================================================

interface LiveQualityScore {
  current: number;
  previous: number;
  trend: 'up' | 'down' | 'stable';
  change: number;
  changePercent: number;
  lastUpdated: Date;
  status: 'excellent' | 'good' | 'warning' | 'critical';
  benchmarks: {
    industry: number;
    yourAvg: number;
  };
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
    freshness: number;
    uniqueness: number;
  };
}

interface QuickStats {
  monitoring: {
    tables: number;
    columns: number;
    dataSources: number;
    totalRows: number;
  };
  activity: {
    rowsScannedToday: number;
    rulesExecutedToday: number;
    alertsTriggered: number;
    issuesResolved: number;
  };
  rules: {
    total: number;
    enabled: number;
    passing: number;
    failing: number;
  };
  health: {
    overallCompliance: number;
    criticalIssues: number;
    warnings: number;
    healthy: number;
  };
  liveMetrics: {
    rowsScannedPerSecond: number;
    alertsPerHour: number;
    averageResponseTime: number;
  };
}

interface ActiveAlert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  table: string;
  column?: string;
  metric: string;
  threshold: number;
  current: number;
  businessImpact: {
    revenueAtRisk: number;
    affectedUsers: number;
    slaViolations: string[];
  };
  rootCause?: string;
  prediction?: string;
  recommendations: Array<{
    action: string;
    confidence: number;
    estimatedImpact: string;
    autoApplicable: boolean;
  }>;
  createdAt: Date;
  trending: 'worsening' | 'improving' | 'stable';
  priority: number;
}

interface MLPrediction {
  type: string;
  table: string;
  metric: string;
  forecast: {
    timeframe: string;
    predicted: Array<{ date: Date; score: number; confidence: number }>;
    trend: 'improving' | 'declining' | 'stable';
    expectedChange: number;
  };
  confidence: number;
  recommendation: string;
}

interface ModernOverviewProps {
  dataSourceId?: string;
  databases?: string;
  database?: string;
  assetType?: string;
  onRefresh?: () => void;
}

// ============================================================================
// WEBSOCKET HOOK
// ============================================================================

function useRealtimeQuality(dataSourceId?: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [qualityScore, setQualityScore] = useState<LiveQualityScore | null>(null);
  const [stats, setStats] = useState<QuickStats | null>(null);
  const [alerts, setAlerts] = useState<ActiveAlert[]>([]);
  const [predictions, setPredictions] = useState<MLPrediction[]>([]);
  const [usePolling, setUsePolling] = useState(false);

  // Fallback: Fetch data from REST API when WebSocket unavailable
  const fetchDataFromAPI = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dataSourceId) params.append('dataSourceId', dataSourceId);

      const response = await fetch(`/api/quality/summary?${params}`);
      const result = await response.json();

      if (result.success && result.data) {
        const data = result.data;

        // Transform REST API data to LiveQualityScore format
        const score: LiveQualityScore = {
          current: data.totals?.overallScore || 0,
          previous: data.totals?.overallScore || 0,
          trend: 'stable',
          change: 0,
          changePercent: 0,
          lastUpdated: new Date(),
          status: data.totals?.overallScore >= 90 ? 'excellent' : data.totals?.overallScore >= 70 ? 'good' : data.totals?.overallScore >= 50 ? 'warning' : 'critical',
          benchmarks: {
            industry: 85,
            yourAvg: data.totals?.overallScore || 0
          },
          dimensionScores: {
            completeness: data.dimensions?.completeness || 0,
            accuracy: data.dimensions?.accuracy || 0,
            consistency: data.dimensions?.consistency || 0,
            validity: data.dimensions?.validity || 0,
            freshness: data.dimensions?.freshness || 0,
            uniqueness: data.dimensions?.uniqueness || 0
          }
        };

        setQualityScore(score);

        // Transform to QuickStats format
        const quickStats: QuickStats = {
          monitoring: {
            tables: data.assetCoverage?.total || 0,
            columns: 0,
            dataSources: 1,
            totalRows: 0
          },
          activity: {
            rowsScannedToday: 0,
            rulesExecutedToday: data.totals?.total || 0,
            alertsTriggered: data.totals?.failed || 0,
            issuesResolved: 0
          },
          rules: {
            total: data.totals?.total || 0,
            enabled: data.totals?.total || 0,
            passing: data.totals?.passed || 0,
            failing: data.totals?.failed || 0
          },
          health: {
            overallCompliance: data.totals?.passRate || 0,
            criticalIssues: data.totals?.failed || 0,
            warnings: 0,
            healthy: data.totals?.passed || 0
          },
          liveMetrics: {
            rowsScannedPerSecond: 0,
            alertsPerHour: 0,
            averageResponseTime: data.totals?.avgExecMs || 0
          }
        };

        setStats(quickStats);
      }
    } catch (error) {
      console.error('Failed to fetch quality data:', error);
    }
  }, [dataSourceId]);

  useEffect(() => {
    // Try WebSocket first
    const socketUrl = 'http://localhost:3002';
    const newSocket = io(socketUrl, {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 3,
      timeout: 5000
    });

    let connectionTimeout: NodeJS.Timeout;

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      setUsePolling(false);
      clearTimeout(connectionTimeout);

      // Subscribe to overview updates
      newSocket.emit('subscribe:overview', { dataSourceId });
    });

    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.warn('⚠️ WebSocket connection failed, falling back to REST API polling:', error.message);
      setUsePolling(true);
      setConnected(false);
    });

    // Listen for real-time updates
    newSocket.on('quality:update', (data: LiveQualityScore) => {
      console.log('📊 Quality score updated:', data);
      setQualityScore(data);
    });

    newSocket.on('stats:update', (data: QuickStats) => {
      console.log('📈 Stats updated:', data);
      setStats(data);
    });

    newSocket.on('alerts:initial', (data: ActiveAlert[]) => {
      console.log('🚨 Initial alerts:', data);
      setAlerts(data);
    });

    newSocket.on('alert:created', (alert: ActiveAlert) => {
      console.log('🆕 New alert:', alert);
      setAlerts(prev => [alert, ...prev]);
    });

    newSocket.on('alert:resolved', ({ alertId }: { alertId: string }) => {
      console.log('✅ Alert resolved:', alertId);
      setAlerts(prev => prev.filter(a => a.id !== alertId));
    });

    newSocket.on('prediction:ready', (prediction: MLPrediction) => {
      console.log('🔮 Prediction ready:', prediction);
      setPredictions(prev => [...prev, prediction]);
    });

    // Timeout to fall back to REST API if WebSocket doesn't connect within 5 seconds
    connectionTimeout = setTimeout(() => {
      if (!connected) {
        console.warn('⚠️ WebSocket timeout, using REST API polling');
        setUsePolling(true);
        fetchDataFromAPI();
      }
    }, 5000);

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      clearTimeout(connectionTimeout);
      newSocket.emit('unsubscribe:overview');
      newSocket.disconnect();
    };
  }, [dataSourceId, connected, fetchDataFromAPI]);

  // Polling fallback when WebSocket unavailable
  useEffect(() => {
    if (usePolling) {
      // Initial fetch
      fetchDataFromAPI();

      // Poll every 30 seconds
      const interval = setInterval(fetchDataFromAPI, 30000);
      return () => clearInterval(interval);
    }
  }, [usePolling, fetchDataFromAPI]);

  const requestPrediction = useCallback((table: string, metric: string) => {
    if (socket) {
      socket.emit('request:prediction', { table, metric });
    }
  }, [socket]);

  const applyRecommendation = useCallback((alertId: string, actionIndex: number) => {
    if (socket) {
      socket.emit('apply:recommendation', { alertId, actionIndex });
    }
  }, [socket]);

  return {
    connected,
    qualityScore,
    stats,
    alerts,
    predictions,
    requestPrediction,
    applyRecommendation
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const ModernOverview: React.FC<ModernOverviewProps> = ({
  dataSourceId,
  databases,
  database,
  assetType,
  onRefresh
}) => {
  const {
    connected,
    qualityScore,
    stats,
    alerts,
    predictions,
    requestPrediction,
    applyRecommendation
  } = useRealtimeQuality(dataSourceId);

  const [timeDisplay, setTimeDisplay] = useState('');

  // Update "last updated" time display
  useEffect(() => {
    const updateTime = () => {
      if (qualityScore?.lastUpdated) {
        const seconds = Math.floor((Date.now() - new Date(qualityScore.lastUpdated).getTime()) / 1000);
        if (seconds < 5) setTimeDisplay('just now');
        else if (seconds < 60) setTimeDisplay(`${seconds}s ago`);
        else setTimeDisplay(`${Math.floor(seconds / 60)}m ago`);
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [qualityScore?.lastUpdated]);

  // ============================================================================
  // RENDER: CONNECTION STATUS
  // ============================================================================

  const renderConnectionStatus = () => (
    <div className="flex items-center gap-2 text-xs">
      <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
      <span className={connected ? 'text-green-700' : 'text-red-700'}>
        {connected ? 'Live' : 'Disconnected'}
      </span>
      {qualityScore && (
        <span className="text-gray-500">• Updated {timeDisplay}</span>
      )}
    </div>
  );

  // ============================================================================
  // RENDER: LIVE QUALITY SCORE
  // ============================================================================

  const renderQualityScore = () => {
    if (!qualityScore) {
      return (
        <Card className="border-2 border-blue-200">
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <span className="ml-3 text-gray-600">Loading quality score...</span>
          </CardContent>
        </Card>
      );
    }

    const statusConfig = {
      excellent: { color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
      good: { color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
      warning: { color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200' },
      critical: { color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200' }
    };

    const config = statusConfig[qualityScore.status];
    const TrendIcon = qualityScore.trend === 'up' ? TrendingUp : qualityScore.trend === 'down' ? TrendingDown : Minus;

    return (
      <Card className={`border-2 ${config.borderColor}`}>
        <CardContent className={`p-6 ${config.bgColor}`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-600 font-medium">Overall Quality Score</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className={`text-5xl font-bold ${config.color}`}>{qualityScore.current}%</span>
                <div className="flex items-center gap-1">
                  <TrendIcon className={`h-5 w-5 ${qualityScore.change >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                  <span className={`text-lg font-semibold ${qualityScore.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {qualityScore.change > 0 ? '+' : ''}{qualityScore.change}
                  </span>
                  <span className="text-sm text-gray-500">
                    ({qualityScore.changePercent > 0 ? '+' : ''}{qualityScore.changePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge variant={qualityScore.status === 'excellent' ? 'default' : qualityScore.status === 'critical' ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
                {qualityScore.status.toUpperCase()}
              </Badge>
              <div className="mt-3 space-y-1 text-xs text-gray-600">
                <div>Industry Avg: {qualityScore.benchmarks.industry}%</div>
                <div>Your Avg: {qualityScore.benchmarks.yourAvg}%</div>
              </div>
            </div>
          </div>

          {/* Dimension Scores */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {Object.entries(qualityScore.dimensionScores).map(([dimension, score]) => (
              <div key={dimension} className="text-center">
                <p className="text-xs text-gray-600 capitalize mb-1">{dimension}</p>
                <p className="text-lg font-bold">{score}%</p>
                <Progress value={score} className="h-1.5 mt-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // RENDER: ACTIVE ALERTS
  // ============================================================================

  const renderActiveAlerts = () => {
    if (!alerts || alerts.length === 0) {
      return (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Active Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600">No active alerts</p>
              <p className="text-sm text-gray-500 mt-1">Your data quality is excellent!</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Active Alerts ({alerts.length})
            </div>
            <Badge variant="destructive">{alerts.filter(a => a.severity === 'critical').length} Critical</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {alerts.slice(0, 5).map((alert) => (
            <div
              key={alert.id}
              className={`border-l-4 p-4 rounded-r-lg ${
                alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
                alert.severity === 'high' ? 'border-orange-500 bg-orange-50' :
                alert.severity === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                'border-blue-500 bg-blue-50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                      {alert.severity.toUpperCase()}
                    </Badge>
                    <span className="text-xs text-gray-600">{alert.table}</span>
                    {alert.trending && (
                      <Badge variant="outline" className="text-xs">
                        {alert.trending === 'worsening' ? '📈 Worsening' : alert.trending === 'improving' ? '📉 Improving' : '→ Stable'}
                      </Badge>
                    )}
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
                  <p className="text-xs text-gray-700 mb-2">{alert.description}</p>

                  {/* Business Impact */}
                  {(alert.businessImpact.revenueAtRisk > 0 || alert.businessImpact.affectedUsers > 0) && (
                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
                      {alert.businessImpact.revenueAtRisk > 0 && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          ${alert.businessImpact.revenueAtRisk.toLocaleString()} at risk
                        </div>
                      )}
                      {alert.businessImpact.affectedUsers > 0 && (
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {alert.businessImpact.affectedUsers.toLocaleString()} users affected
                        </div>
                      )}
                    </div>
                  )}

                  {/* AI Insights */}
                  {alert.rootCause && (
                    <Alert className="bg-blue-50 border-blue-200 p-2 mb-2">
                      <Brain className="h-3 w-3 text-blue-600" />
                      <AlertDescription className="text-xs">
                        <strong>Root Cause:</strong> {alert.rootCause}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Recommendations */}
                  {alert.recommendations && alert.recommendations.length > 0 && (
                    <div className="space-y-1">
                      {alert.recommendations.slice(0, 2).map((rec, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white p-2 rounded border">
                          <div className="flex-1">
                            <p className="text-xs font-medium">{rec.action}</p>
                            <p className="text-xs text-gray-500">{rec.estimatedImpact} • {(rec.confidence * 100).toFixed(0)}% confidence</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => applyRecommendation(alert.id, idx)}
                          >
                            Apply
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // RENDER: QUICK STATS
  // ============================================================================

  const renderQuickStats = () => {
    if (!stats) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Quick Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {/* Monitoring */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg">
              <p className="text-xs text-blue-700 font-medium mb-2">Monitoring</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-blue-600">Tables:</span>
                  <span className="font-semibold">{stats.monitoring.tables}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-600">Data Sources:</span>
                  <span className="font-semibold">{stats.monitoring.dataSources}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-blue-600">Total Rows:</span>
                  <span className="font-semibold">{stats.monitoring.totalRows.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Activity */}
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg">
              <p className="text-xs text-green-700 font-medium mb-2">Today's Activity</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">Rows Scanned:</span>
                  <span className="font-semibold">{stats.activity.rowsScannedToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">Rules Executed:</span>
                  <span className="font-semibold">{stats.activity.rulesExecutedToday}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-green-600">Issues Resolved:</span>
                  <span className="font-semibold">{stats.activity.issuesResolved}</span>
                </div>
              </div>
            </div>

            {/* Rules */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-3 rounded-lg">
              <p className="text-xs text-purple-700 font-medium mb-2">Rules</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-purple-600">Total:</span>
                  <span className="font-semibold">{stats.rules.total}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-purple-600">Enabled:</span>
                  <span className="font-semibold">{stats.rules.enabled}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-purple-600">Passing:</span>
                  <span className="font-semibold text-green-600">{stats.rules.passing}</span>
                </div>
              </div>
            </div>

            {/* Health */}
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg">
              <p className="text-xs text-orange-700 font-medium mb-2">Health</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-orange-600">Compliance:</span>
                  <span className="font-semibold">{stats.health.overallCompliance.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-orange-600">Critical Issues:</span>
                  <span className="font-semibold text-red-600">{stats.health.criticalIssues}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-orange-600">Warnings:</span>
                  <span className="font-semibold text-yellow-600">{stats.health.warnings}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Live Metrics */}
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-600 font-medium mb-2 flex items-center gap-1">
              <Zap className="h-3 w-3" /> Live Metrics
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-lg font-bold text-blue-600">{stats.liveMetrics.rowsScannedPerSecond}</p>
                <p className="text-xs text-gray-500">Rows/sec</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{stats.liveMetrics.alertsPerHour}</p>
                <p className="text-xs text-gray-500">Alerts/hour</p>
              </div>
              <div>
                <p className="text-lg font-bold text-purple-600">{stats.liveMetrics.averageResponseTime}ms</p>
                <p className="text-xs text-gray-500">Avg Response</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* Header with Connection Status */}
      <div className="flex items-center justify-between">
        {renderConnectionStatus()}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Live Quality Score */}
      {renderQualityScore()}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Alerts */}
        {renderActiveAlerts()}

        {/* Quick Stats */}
        {renderQuickStats()}
      </div>

      {/* Empty State when no data source selected */}
      {!dataSourceId && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            Select a <strong>Data Source</strong> from the filters above to view real-time quality metrics and alerts.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default ModernOverview;
