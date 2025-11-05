import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Info, Clock, Zap } from 'lucide-react';
import { qualityAPI } from '@services/api/quality';
import { CompactCriticalAlertsList } from './CompactCriticalAlertsList';

interface TechnicalOverviewProps {
  dataSourceId?: string;
  databases?: string;
  database?: string;
  assetType?: string;
  onRefresh?: () => void;
}

interface HealthMetrics {
  totalAssets: number;
  tablesCount: number;
  viewsCount: number;
  lastScanTime: string | null;
  openIssues: number;
  criticalIssues: number;
  dimensionScores: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
    uniqueness: number;
    freshness: number;
  };
}

interface RecentActivity {
  id: string;
  timestamp: string;
  type: 'scan' | 'rule_execution' | 'auto_fix';
  description: string;
  status: 'success' | 'failed' | 'warning';
  details?: string;
}

interface RecommendedAction {
  id: string;
  assetName: string;
  issue: string;
  actionType: 'create_rule' | 'run_scan' | 'auto_fix' | 'investigate';
  actionLabel: string;
  priority: 'high' | 'medium' | 'low';
}

const TechnicalOverview: React.FC<TechnicalOverviewProps> = ({
  dataSourceId,
  databases,
  database,
  assetType,
  onRefresh
}) => {
  const [loading, setLoading] = useState(true);
  const [healthMetrics, setHealthMetrics] = useState<HealthMetrics | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [recommendedActions, setRecommendedActions] = useState<RecommendedAction[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [scoreChange, setScoreChange] = useState(0);

  useEffect(() => {
    loadData();
  }, [dataSourceId, databases, database, assetType]);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadHealthMetrics(),
        loadCriticalAlerts(),
        loadRecentActivity(),
        loadRecommendedActions()
      ]);
    } catch (error) {
      console.error('Failed to load overview data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHealthMetrics = async () => {
    try {
      const params = new URLSearchParams();
      if (dataSourceId) params.append('dataSourceId', dataSourceId);
      if (databases) params.append('databases', databases);
      if (assetType && assetType !== 'all') params.append('assetType', assetType);

      const response = await fetch(`/api/quality/summary?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        const summary = data.data;

        setHealthMetrics({
          totalAssets: summary.assetCoverage?.total || 0,
          tablesCount: summary.assetCoverage?.byType?.tables || 0,
          viewsCount: summary.assetCoverage?.byType?.views || 0,
          lastScanTime: summary.lastScanTime || null,
          openIssues: summary.activeIssues || 0,
          criticalIssues: summary.criticalIssues || 0,
          dimensionScores: summary.dimensionScores || {
            completeness: 0,
            accuracy: 0,
            consistency: 0,
            validity: 0,
            uniqueness: 0,
            freshness: 0
          }
        });

        setOverallScore(summary.overallScore || 0);
        setScoreChange(summary.scoreChange || 0);
      }
    } catch (error) {
      console.error('Failed to load health metrics:', error);
    }
  };

  const loadCriticalAlerts = async () => {
    try {
      const alerts = await qualityAPI.getCriticalAlerts({
        dataSourceId,
        databases,
        limit: 50
      });
      setCriticalAlerts(alerts);
    } catch (error) {
      console.error('Failed to load critical alerts:', error);
      setCriticalAlerts([]);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const params = new URLSearchParams();
      if (dataSourceId) params.append('dataSourceId', dataSourceId);
      params.append('limit', '10');

      const response = await fetch(`/api/quality/recent-activity?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setRecentActivity(data.data);
      } else {
        // If endpoint doesn't exist yet, show empty state
        setRecentActivity([]);
      }
    } catch (error) {
      console.error('Recent activity endpoint not yet implemented:', error);
      setRecentActivity([]);
    }
  };

  const loadRecommendedActions = async () => {
    try {
      const params = new URLSearchParams();
      if (dataSourceId) params.append('dataSourceId', dataSourceId);

      const response = await fetch(`/api/quality/recommended-actions?${params}`);
      const data = await response.json();

      if (data.success && data.data) {
        setRecommendedActions(data.data);
      } else {
        setRecommendedActions([]);
      }
    } catch (error) {
      console.error('Recommended actions endpoint not yet implemented:', error);
      setRecommendedActions([]);
    }
  };

  const handleRefresh = () => {
    loadData();
    onRefresh?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading quality overview...</p>
        </div>
      </div>
    );
  }

  const hasData = healthMetrics && healthMetrics.totalAssets > 0;

  return (
    <div className="space-y-6">
      {/* Compact Header */}
      <div className="bg-white border-b border-gray-200 rounded-lg px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="text-4xl font-bold text-green-600">{overallScore}</div>
            <div>
              <div className="text-sm font-medium text-gray-600">Quality Score</div>
              {scoreChange !== 0 && (
                <div className={`text-xs flex items-center gap-1 ${scoreChange > 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {scoreChange > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {scoreChange > 0 ? '+' : ''}{scoreChange} from last week
                </div>
              )}
            </div>
          </div>

          {hasData && healthMetrics && (
            <>
              <div className="h-10 w-px bg-gray-300" />

              <div className="text-sm">
                <div className="text-gray-500 text-xs">Safe Assets</div>
                <div className="font-semibold text-green-600 text-lg">
                  {healthMetrics.totalAssets - healthMetrics.openIssues}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500 text-xs">With Issues</div>
                <div className="font-semibold text-yellow-600 text-lg">
                  {healthMetrics.openIssues}
                </div>
              </div>

              <div className="text-sm">
                <div className="text-gray-500 text-xs">Critical</div>
                <div className="font-semibold text-red-600 text-lg">
                  {healthMetrics.criticalIssues}
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Empty State - No Data Source Selected */}
      {!dataSourceId && (
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-8 text-center">
          <Info className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Select a Data Source to Get Started
          </h3>
          <p className="text-gray-600 max-w-md mx-auto">
            Choose a data source from the dropdown above to view quality metrics, alerts, and recommendations.
          </p>
        </div>
      )}

      {/* Empty State - No Scans Yet */}
      {dataSourceId && !hasData && (
        <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200 rounded-xl p-8">
          <div className="max-w-2xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              🚀 Get Started with Data Quality
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Follow these steps to set up quality monitoring for your data source:
            </p>

            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 text-green-600 font-bold flex-shrink-0">
                    ✓
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">1. Data Source Selected</h4>
                    <p className="text-sm text-gray-600">You've selected a data source - great start!</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-600 font-bold flex-shrink-0">
                    2
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 mb-1">Run Data Profiling</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Analyze your data structure and automatically generate quality rules
                    </p>
                    <button
                      onClick={() => {
                        const profilingTab = document.querySelector('[data-value="profiling"]') as HTMLElement;
                        profilingTab?.click();
                      }}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700"
                    >
                      Go to Profiling Tab
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200 opacity-60">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Create Quality Rules</h4>
                    <p className="text-sm text-gray-600">
                      Define quality checks for your data (auto-generated from profiling or manual)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-gray-200 opacity-60">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-gray-400 font-bold flex-shrink-0">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Run Quality Scans</h4>
                    <p className="text-sm text-gray-600">
                      Execute quality rules to detect issues and track trends over time
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-900">
                <strong>Once you've completed these steps</strong>, you'll see:
              </p>
              <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
                <li>Critical alerts and quality issues</li>
                <li>Health metrics and dimension scores</li>
                <li>Recent activity and scan history</li>
                <li>Recommended actions to improve quality</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Only Show When We Have Data */}
      {hasData && healthMetrics && (
        <>
          {/* Critical Alerts */}
          <CompactCriticalAlertsList
            alerts={criticalAlerts}
            onAutoFix={(id) => console.log('Auto-fix:', id)}
            onInvestigate={(id) => console.log('Investigate:', id)}
            onSnooze={(id) => console.log('Snooze:', id)}
          />

          {/* Health at a Glance */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4">Health at a Glance</h3>

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div>
                <div className="text-gray-500 text-xs mb-1">Tables</div>
                <div className="text-2xl font-bold">{healthMetrics.tablesCount}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Views</div>
                <div className="text-2xl font-bold">{healthMetrics.viewsCount}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Last Scan</div>
                <div className="text-sm font-semibold">
                  {healthMetrics.lastScanTime
                    ? new Date(healthMetrics.lastScanTime).toLocaleString()
                    : 'Never'}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-xs mb-1">Open Issues</div>
                <div className="text-2xl font-bold text-yellow-600">{healthMetrics.openIssues}</div>
              </div>
            </div>

            {/* Quality Dimensions - Compact Bars */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">Quality Dimensions</h4>
              {Object.entries(healthMetrics.dimensionScores).map(([dimension, score]) => (
                <div key={dimension} className="flex items-center justify-between text-sm">
                  <span className="w-28 capitalize text-gray-700">{dimension}</span>
                  <div className="flex-1 mx-4">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          score >= 90 ? 'bg-green-500' :
                          score >= 70 ? 'bg-blue-500' :
                          score >= 50 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-semibold w-12 text-right">{score}%</span>
                  {score < 70 && <AlertTriangle className="w-4 h-4 text-yellow-600 ml-2" />}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Recent Activity
            </h3>

            {recentActivity.length > 0 ? (
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 text-sm border-l-2 border-gray-200 pl-3 py-1">
                    <div className="text-gray-500 text-xs whitespace-nowrap mt-0.5">
                      {new Date(activity.timestamp).toLocaleTimeString()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{activity.description}</div>
                      {activity.details && (
                        <div className="text-gray-600 text-xs mt-0.5">{activity.details}</div>
                      )}
                    </div>
                    <div>
                      {activity.status === 'success' && (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      )}
                      {activity.status === 'failed' && (
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                      )}
                      {activity.status === 'warning' && (
                        <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Clock className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-sm">No recent activity</p>
                <p className="text-xs mt-1">Run quality scans to see activity here</p>
              </div>
            )}
          </div>

          {/* Recommended Actions */}
          {recommendedActions.length > 0 && (
            <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Recommended Actions
              </h3>
              <div className="space-y-3">
                {recommendedActions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-yellow-100">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{action.assetName}</div>
                      <div className="text-xs text-gray-600 mt-0.5">{action.issue}</div>
                    </div>
                    <button className="ml-4 text-xs px-3 py-1.5 bg-yellow-600 text-white rounded hover:bg-yellow-700">
                      {action.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TechnicalOverview;
