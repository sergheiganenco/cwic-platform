// Quality Score Dashboard - Real-time quality metrics
import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Target, Zap } from 'lucide-react';
import { Progress } from '@components/ui/Progress';
import { Badge } from '@components/ui/Badge';
import type { QualityRule } from '@services/api/quality';

interface QualityScoreDashboardProps {
  metrics: {
    qualityScore: number;
    activeRules: number;
    totalIssues: number;
    trend: 'up' | 'down';
    trendValue: string;
  };
  rules: QualityRule[];
}

export const QualityScoreDashboard: React.FC<QualityScoreDashboardProps> = ({ metrics, rules }) => {
  const scoreColor = metrics.qualityScore >= 90 ? 'green' : metrics.qualityScore >= 70 ? 'yellow' : 'red';
  const TrendIcon = metrics.trend === 'up' ? TrendingUp : TrendingDown;

  // Calculate top contributors/detractors
  const topContributors = rules
    .filter(r => r.last_result?.pass_rate && r.last_result.pass_rate > 90)
    .sort((a, b) => (b.last_result?.pass_rate || 0) - (a.last_result?.pass_rate || 0))
    .slice(0, 2);

  const topDetractors = rules
    .filter(r => r.last_result?.pass_rate && r.last_result.pass_rate < 70)
    .sort((a, b) => (a.last_result?.pass_rate || 0) - (b.last_result?.pass_rate || 0))
    .slice(0, 2);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100">
      <div className="grid grid-cols-6 gap-6">
        {/* Main Quality Score */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-700">Quality Score</h3>
            <Badge className={`bg-${scoreColor}-100 text-${scoreColor}-700`}>
              <TrendIcon className="w-3 h-3 mr-1" />
              {metrics.trend === 'up' ? '+' : '-'}{metrics.trendValue}%
            </Badge>
          </div>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-bold text-gray-900">
              {metrics.qualityScore.toFixed(1)}%
            </div>
            <div className="text-sm text-gray-500 mb-1">
              of {rules.length} rules
            </div>
          </div>
          <Progress value={metrics.qualityScore} className="mt-3" />
        </div>

        {/* Active Rules */}
        <div>
          <div className="text-sm text-gray-600 mb-2">Active Rules</div>
          <div className="text-2xl font-bold text-blue-600">{metrics.activeRules}</div>
          <div className="text-xs text-gray-500">
            {rules.length - metrics.activeRules} paused
          </div>
        </div>

        {/* Total Issues */}
        <div>
          <div className="text-sm text-gray-600 mb-2">Total Issues</div>
          <div className="text-2xl font-bold text-red-600">
            {metrics.totalIssues.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500">
            across all rules
          </div>
        </div>

        {/* Top Contributors */}
        <div>
          <div className="text-sm text-gray-600 mb-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            Top Contributors
          </div>
          <div className="space-y-1">
            {topContributors.map(rule => (
              <div key={rule.id} className="text-xs text-gray-700 truncate">
                {rule.name.split(' ').slice(0, 2).join(' ')}
              </div>
            ))}
            {topContributors.length === 0 && (
              <div className="text-xs text-gray-400">No data</div>
            )}
          </div>
        </div>

        {/* Top Detractors */}
        <div>
          <div className="text-sm text-gray-600 mb-2 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3 text-red-500" />
            Top Detractors
          </div>
          <div className="space-y-1">
            {topDetractors.map(rule => (
              <div key={rule.id} className="text-xs text-gray-700 truncate">
                {rule.name.split(' ').slice(0, 2).join(' ')}
              </div>
            ))}
            {topDetractors.length === 0 && (
              <div className="text-xs text-gray-400">No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
