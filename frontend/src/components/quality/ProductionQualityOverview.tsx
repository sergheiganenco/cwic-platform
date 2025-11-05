// frontend/src/components/quality/ProductionQualityOverview.tsx
// Production-Ready Data Quality Overview with Modern Enterprise Design

import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Activity,
  Database,
  BarChart3,
  AlertCircle,
  Clock,
  Target,
  Zap,
  Shield
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';
import { Progress } from '@components/ui/Progress';
import { Alert, AlertDescription } from '@components/ui/Alert';

// ============================================================================
// TYPES
// ============================================================================

interface QualityData {
  overallScore: number;
  totals: {
    total: number;
    passed: number;
    failed: number;
    error: number;
    passRate: number;
    avgExecMs: number;
    overallScore?: number;
  };
  ruleCounts?: {
    total: number;
    active: number;
    disabled: number;
  };
  dimensions: {
    completeness: number;
    accuracy: number;
    consistency: number;
    validity: number;
    freshness: number;
    uniqueness: number;
  };
  assetCoverage?: {
    total: number;
    monitored: number;
    unmonitored: number;
    byType?: {
      tables: number;
      views: number;
    };
  };
  timeframe: string;
  from: string;
  to: string;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    value: string;
    isPositive: boolean;
  };
  subtitle?: string;
  status?: 'success' | 'warning' | 'error' | 'info';
  onClick?: () => void;
}

interface ProductionQualityOverviewProps {
  dataSourceId?: string;
  databases?: string;
  database?: string;
  assetType?: string;
  onRefresh?: () => void;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getScoreStatus(score: number): 'success' | 'warning' | 'error' {
  if (score >= 90) return 'success';
  if (score >= 70) return 'warning';
  return 'error';
}

function getScoreLabel(score: number): string {
  if (score >= 95) return 'Excellent';
  if (score >= 90) return 'Very Good';
  if (score >= 80) return 'Good';
  if (score >= 70) return 'Fair';
  if (score >= 60) return 'Needs Improvement';
  return 'Critical';
}

function getScoreGradient(score: number): string {
  if (score >= 90) return 'from-green-500 to-emerald-600';
  if (score >= 70) return 'from-yellow-500 to-orange-600';
  return 'from-red-500 to-rose-600';
}

function getScoreRingColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#f59e0b';
  return '#ef4444';
}

// ============================================================================
// METRIC CARD COMPONENT
// ============================================================================

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  trend,
  subtitle,
  status = 'info',
  onClick
}) => {
  const statusStyles = {
    success: 'from-green-50 to-emerald-50 border-green-200 hover:border-green-300',
    warning: 'from-yellow-50 to-orange-50 border-yellow-200 hover:border-orange-300',
    error: 'from-red-50 to-rose-50 border-red-200 hover:border-red-300',
    info: 'from-blue-50 to-indigo-50 border-blue-200 hover:border-indigo-300'
  };

  const iconStyles = {
    success: 'bg-gradient-to-br from-green-500 to-emerald-600 text-white',
    warning: 'bg-gradient-to-br from-yellow-500 to-orange-600 text-white',
    error: 'bg-gradient-to-br from-red-500 to-rose-600 text-white',
    info: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br shadow-sm
        transition-all duration-300 ease-in-out
        ${statusStyles[status]}
        ${onClick ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-xl shadow-md ${iconStyles[status]}`}>
            {icon}
          </div>
          {trend && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold ${
              trend.isPositive
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {trend.direction === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
              {trend.direction === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
              {trend.direction === 'neutral' && <Minus className="w-3.5 h-3.5" />}
              <span>{trend.value}</span>
            </div>
          )}
        </div>

        <div className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">
          {title}
        </div>

        <div className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">
          {value}
        </div>

        {subtitle && (
          <div className="text-sm text-gray-600 font-medium">
            {subtitle}
          </div>
        )}
      </div>

      {/* Decorative gradient overlay */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/40 to-transparent rounded-full -translate-y-16 translate-x-16 blur-2xl" />
    </div>
  );
};

// ============================================================================
// DIMENSION SCORE BAR
// ============================================================================

const DimensionBar: React.FC<{
  name: string;
  score: number;
  icon?: React.ReactNode;
}> = ({ name, score, icon }) => {
  const status = getScoreStatus(score);

  const gradients = {
    success: 'from-green-500 to-emerald-600',
    warning: 'from-yellow-500 to-orange-600',
    error: 'from-red-500 to-rose-600'
  };

  const textColors = {
    success: 'text-green-700',
    warning: 'text-orange-700',
    error: 'text-red-700'
  };

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {icon && (
            <div className="text-gray-500 group-hover:text-gray-700 transition-colors">
              {icon}
            </div>
          )}
          <span className="text-base font-semibold text-gray-800 capitalize">
            {name}
          </span>
        </div>
        <span className={`text-lg font-bold ${textColors[status]}`}>
          {score.toFixed(1)}%
        </span>
      </div>

      <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
        <div
          className={`h-full bg-gradient-to-r ${gradients[status]} rounded-full transition-all duration-1000 ease-out shadow-md relative`}
          style={{ width: `${score}%` }}
        >
          {/* Shine effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProductionQualityOverview: React.FC<ProductionQualityOverviewProps> = ({
  dataSourceId,
  databases,
  database,
  assetType,
  onRefresh
}) => {
  const [data, setData] = useState<QualityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const fetchQualityData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (dataSourceId) params.append('dataSourceId', dataSourceId);
      if (databases) params.append('databases', databases);
      if (database) params.append('database', database);
      if (assetType) params.append('assetType', assetType);

      const response = await fetch(`/api/quality/summary?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to fetch quality data');
      }

      if (result.success && result.data) {
        setData(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Failed to fetch quality data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dataSourceId, databases, database, assetType]);

  useEffect(() => {
    fetchQualityData();
  }, [fetchQualityData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchQualityData();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchQualityData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchQualityData();
    onRefresh?.();
  }, [fetchQualityData, onRefresh]);

  // ============================================================================
  // RENDER LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-6" />
            <div className="absolute inset-0 h-16 w-16 rounded-full bg-blue-500/20 blur-xl mx-auto" />
          </div>
          <p className="text-xl font-semibold text-gray-700 mb-2">Loading Quality Data</p>
          <p className="text-sm text-gray-500">Analyzing your data health metrics...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER ERROR STATE
  // ============================================================================

  if (error || !data) {
    return (
      <Alert className="border-2 border-red-200 bg-gradient-to-br from-red-50 to-rose-50">
        <AlertTriangle className="h-6 w-6 text-red-600" />
        <AlertDescription className="ml-3">
          <div className="font-bold text-red-900 text-lg mb-3">Failed to Load Quality Data</div>
          <div className="text-red-700 mb-4">{error || 'No data available'}</div>
          <Button
            onClick={handleRefresh}
            className="bg-red-600 hover:bg-red-700 text-white"
            size="sm"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry Loading
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // ============================================================================
  // RENDER MAIN UI
  // ============================================================================

  const overallScore = data.totals?.overallScore || 0;
  const scoreStatus = getScoreStatus(overallScore);
  const scoreLabel = getScoreLabel(overallScore);
  const scoreGradient = getScoreGradient(overallScore);
  const ringColor = getScoreRingColor(overallScore);

  const circumference = 2 * Math.PI * 55;
  const strokeDashoffset = circumference - (overallScore / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Compact Hero Score Section - Horizontal Layout */}
      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-r from-white to-gray-50/50 shadow-md">
        <div className="flex items-center gap-8 p-6">
          {/* Left: Score Circle */}
          <div className="flex-shrink-0">
            <div className="relative">
              <svg width="140" height="140" className="transform -rotate-90">
                {/* Background circle */}
                <circle
                  cx="70"
                  cy="70"
                  r="55"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="10"
                />
                {/* Progress circle */}
                <circle
                  cx="70"
                  cy="70"
                  r="55"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000 ease-out"
                />
              </svg>

              {/* Score Number */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div
                  className={`text-4xl font-black bg-gradient-to-br ${scoreGradient} bg-clip-text text-transparent leading-none`}
                >
                  {Math.round(overallScore)}
                </div>
                <div className="text-gray-400 text-xs font-medium mt-0.5">/ 100</div>
              </div>
            </div>
          </div>

          {/* Right: Info and Stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">
                  Overall Quality Health Score
                </h3>
                <p className="text-xs text-gray-500">
                  Real-time assessment across all monitored assets
                </p>
              </div>

              {/* Status Badge */}
              <div className={`
                flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide
                ${scoreStatus === 'success' ? 'bg-green-100 text-green-700 border border-green-200' :
                  scoreStatus === 'warning' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                  'bg-red-100 text-red-700 border border-red-200'}
              `}>
                <div className={`w-1.5 h-1.5 rounded-full ${scoreStatus === 'success' ? 'bg-green-500' : scoreStatus === 'warning' ? 'bg-yellow-500' : 'bg-red-500'} animate-pulse`} />
                {scoreLabel}
                {scoreStatus === 'success' && <CheckCircle2 className="w-3.5 h-3.5" />}
                {scoreStatus === 'warning' && <AlertCircle className="w-3.5 h-3.5" />}
                {scoreStatus === 'error' && <XCircle className="w-3.5 h-3.5" />}
              </div>
            </div>

            {/* Compact Stats Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100">
                <Activity className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">{data.ruleCounts?.total || 0}</div>
                  <div className="text-xs text-gray-600 truncate">Rules Monitored</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg border border-purple-100">
                <Database className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">{data.assetCoverage?.monitored || 0}</div>
                  <div className="text-xs text-gray-600 truncate">Assets Tracked</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg border border-green-100">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">{data.totals.passRate.toFixed(1)}%</div>
                  <div className="text-xs text-gray-600 truncate">Pass Rate</div>
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg border border-red-100">
                <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-gray-900">{data.totals.failed + data.totals.error}</div>
                  <div className="text-xs text-gray-600 truncate">Issues Found</div>
                </div>
              </div>
            </div>
          </div>

          {/* Refresh Button */}
          <div className="flex-shrink-0">
            <Button
              onClick={handleRefresh}
              disabled={refreshing}
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </div>

      {/* Key Metrics Grid - Production Design */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Rules Executed Card */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            {/* Icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 mb-4 shadow-lg">
              <Zap className="w-7 h-7 text-white" />
            </div>

            {/* Title */}
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              RULES EXECUTED
            </div>

            {/* Value */}
            <div className="text-4xl font-black text-gray-900 mb-2">
              {data.totals.total}
            </div>

            {/* Subtitle */}
            <div className="text-sm text-gray-600">
              Avg execution: {data.totals.avgExecMs}ms
            </div>
          </div>
        </div>

        {/* Passed Rules Card */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            {/* Icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4 shadow-lg">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>

            {/* Title */}
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              PASSED RULES
            </div>

            {/* Value */}
            <div className="text-4xl font-black text-gray-900 mb-2">
              {data.totals.passed}
            </div>

            {/* Subtitle */}
            <div className="text-sm text-gray-600">
              {data.totals.passRate.toFixed(1)}% pass rate
            </div>
          </div>
        </div>

        {/* Failed Rules Card */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-red-50 to-rose-50 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            {/* Icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-rose-600 mb-4 shadow-lg">
              <XCircle className="w-7 h-7 text-white" />
            </div>

            {/* Title */}
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              FAILED RULES
            </div>

            {/* Value */}
            <div className="text-4xl font-black text-gray-900 mb-2">
              {data.totals.failed}
            </div>

            {/* Subtitle */}
            <div className="text-sm text-gray-600">
              {data.totals.error || 0} with errors
            </div>
          </div>
        </div>

        {/* Asset Coverage Card */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-6">
            {/* Icon */}
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4 shadow-lg">
              <Database className="w-7 h-7 text-white" />
            </div>

            {/* Title */}
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
              ASSET COVERAGE
            </div>

            {/* Value */}
            <div className="text-4xl font-black text-gray-900 mb-2">
              {data.assetCoverage?.monitored || 0}/{data.assetCoverage?.total || 0}
            </div>

            {/* Subtitle */}
            <div className="text-sm text-gray-600">
              {data.assetCoverage?.unmonitored || 0} unmonitored
            </div>
          </div>
        </div>
      </div>

      {/* Quality Dimensions */}
      <div className="rounded-3xl border-2 border-gray-200 bg-gradient-to-br from-white to-gray-50 shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-white">Quality Dimensions</h3>
              <p className="text-blue-100 text-sm">Comprehensive data quality metrics across all dimensions</p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <DimensionBar
            name="Completeness"
            score={data.dimensions.completeness}
            icon={<Target className="w-5 h-5" />}
          />
          <DimensionBar
            name="Accuracy"
            score={data.dimensions.accuracy}
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <DimensionBar
            name="Consistency"
            score={data.dimensions.consistency}
            icon={<Activity className="w-5 h-5" />}
          />
          <DimensionBar
            name="Validity"
            score={data.dimensions.validity}
            icon={<Shield className="w-5 h-5" />}
          />
          <DimensionBar
            name="Freshness"
            score={data.dimensions.freshness}
            icon={<Clock className="w-5 h-5" />}
          />
          <DimensionBar
            name="Uniqueness"
            score={data.dimensions.uniqueness}
            icon={<Zap className="w-5 h-5" />}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductionQualityOverview;
