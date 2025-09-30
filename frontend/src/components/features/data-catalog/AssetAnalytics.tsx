// src/components/features/data-catalog/AssetAnalytics.tsx - Fixed version
import { Button } from '@/components/ui/Button';
import { BarChart3, Calendar, PieChart, TrendingDown, TrendingUp, X } from 'lucide-react';
import React, { useState } from 'react';

interface AssetAnalyticsProps {
  metrics: {
    totalAssets: number;
    activeUsers: number;
    dailyViews: number;
    qualityScore: number;
    usageByType: Record<string, number>;
    qualityDistribution: Record<string, number>;
    recentActivity: Array<{
      date: string;
      views: number;
      searches: number;
      creations: number;
    }>;
  } | null;
  trends: {
    totalAssets?: { value: number; direction: 'up' | 'down'; period: string };
    activeUsers?: { value: number; direction: 'up' | 'down'; period: string };
    qualityScore?: { value: number; direction: 'up' | 'down'; period: string };
  } | null;
  filters: any;
  onClose: () => void;
}

export const AssetAnalytics: React.FC<AssetAnalyticsProps> = ({
  metrics,
  trends,
  filters,
  onClose
}) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [chartType, setChartType] = useState('usage');

  if (!metrics) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Analytics Dashboard</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="text-center py-8">
          <BarChart3 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-gray-500">Loading analytics data...</p>
        </div>
      </div>
    );
  }

  const renderUsageChart = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900">Usage by Asset Type</h4>
      <div className="space-y-2">
        {Object.entries(metrics.usageByType).map(([type, count]) => {
          const percentage = (count / metrics.totalAssets) * 100;
          return (
            <div key={type} className="flex items-center space-x-3">
              <div className="w-20 text-sm text-gray-600 capitalize">{type}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="w-16 text-sm text-gray-900 text-right">
                {count} ({percentage.toFixed(1)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderQualityChart = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900">Quality Distribution</h4>
      <div className="space-y-2">
        {Object.entries(metrics.qualityDistribution).map(([quality, count]) => {
          const percentage = (count / metrics.totalAssets) * 100;
          const colorMap: Record<string, string> = {
            high: 'bg-green-600',
            medium: 'bg-yellow-600',
            low: 'bg-red-600'
          };
          return (
            <div key={quality} className="flex items-center space-x-3">
              <div className="w-20 text-sm text-gray-600 capitalize">{quality}</div>
              <div className="flex-1 bg-gray-200 rounded-full h-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${colorMap[quality] || 'bg-gray-400'}`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <div className="w-16 text-sm text-gray-900 text-right">
                {count} ({percentage.toFixed(1)}%)
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderActivityChart = () => (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-900">Recent Activity</h4>
      <div className="space-y-3">
        {metrics.recentActivity.slice(0, 7).map((activity, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">
              {new Date(activity.date).toLocaleDateString()}
            </div>
            <div className="flex space-x-4 text-sm">
              <span className="text-blue-600">{activity.views} views</span>
              <span className="text-green-600">{activity.searches} searches</span>
              <span className="text-purple-600">{activity.creations} created</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-medium text-gray-900">Analytics Dashboard</h3>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1d">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button 
            onClick={onClose} 
            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-900">{metrics.totalAssets.toLocaleString()}</div>
          <div className="text-sm text-blue-700">Total Assets</div>
          {trends?.totalAssets && (
            <div className="flex items-center justify-center mt-1">
              {trends.totalAssets.direction === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className="text-xs text-gray-600">
                {trends.totalAssets.value}% {trends.totalAssets.period}
              </span>
            </div>
          )}
        </div>

        <div className="text-center p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-900">{metrics.activeUsers.toLocaleString()}</div>
          <div className="text-sm text-green-700">Active Users</div>
          {trends?.activeUsers && (
            <div className="flex items-center justify-center mt-1">
              {trends.activeUsers.direction === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className="text-xs text-gray-600">
                {trends.activeUsers.value}% {trends.activeUsers.period}
              </span>
            </div>
          )}
        </div>

        <div className="text-center p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-900">{metrics.dailyViews.toLocaleString()}</div>
          <div className="text-sm text-purple-700">Daily Views</div>
        </div>

        <div className="text-center p-4 bg-yellow-50 rounded-lg">
          <div className="text-2xl font-bold text-yellow-900">{metrics.qualityScore}%</div>
          <div className="text-sm text-yellow-700">Quality Score</div>
          {trends?.qualityScore && (
            <div className="flex items-center justify-center mt-1">
              {trends.qualityScore.direction === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              )}
              <span className="text-xs text-gray-600">
                {trends.qualityScore.value}% {trends.qualityScore.period}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Selection - Fixed variant types */}
      <div className="flex space-x-2 mb-6">
        <Button
          variant={chartType === 'usage' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setChartType('usage')}
        >
          <PieChart className="mr-2 h-4 w-4" />
          Usage
        </Button>
        <Button
          variant={chartType === 'quality' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setChartType('quality')}
        >
          <BarChart3 className="mr-2 h-4 w-4" />
          Quality
        </Button>
        <Button
          variant={chartType === 'activity' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setChartType('activity')}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Activity
        </Button>
      </div>

      {/* Charts */}
      <div className="bg-gray-50 rounded-lg p-4">
        {chartType === 'usage' && renderUsageChart()}
        {chartType === 'quality' && renderQualityChart()}
        {chartType === 'activity' && renderActivityChart()}
      </div>
    </div>
  );
};