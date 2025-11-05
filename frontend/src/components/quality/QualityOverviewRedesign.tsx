import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Activity,
  Zap,
  Target,
  Database,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  ChevronRight,
  BarChart3,
  PieChart,
  TrendingUpIcon,
  Sparkles,
  Award,
  Users,
  Calendar,
  RefreshCw,
  Download,
  Filter,
  Settings,
  Info,
  ChevronDown,
  Loader2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { qualityAPI } from '@services/api/quality';

interface QualityOverviewProps {
  dataSourceId?: string;
  database?: string;
  assetType?: string;
  onRefresh?: () => void;
}

// Quality dimensions with their colors and icons
const QUALITY_DIMENSIONS = [
  { key: 'completeness', label: 'Completeness', color: '#3B82F6', icon: CheckCircle, description: 'Data without missing values' },
  { key: 'accuracy', label: 'Accuracy', color: '#10B981', icon: Target, description: 'Data correctly represents reality' },
  { key: 'consistency', label: 'Consistency', color: '#8B5CF6', icon: Shield, description: 'Data follows defined standards' },
  { key: 'validity', label: 'Validity', color: '#F59E0B', icon: AlertCircle, description: 'Data conforms to business rules' },
  { key: 'uniqueness', label: 'Uniqueness', color: '#EC4899', icon: Sparkles, description: 'No unwanted duplicates' },
  { key: 'freshness', label: 'Freshness', color: '#06B6D4', icon: Clock, description: 'Data is up-to-date' }
];

const QualityOverviewRedesign: React.FC<QualityOverviewProps> = ({
  dataSourceId,
  database,
  assetType,
  onRefresh
}) => {
  // Always start with loading true - we'll load data for all sources or specific source
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [hoveredDimension, setHoveredDimension] = useState<string | null>(null);

  // Real data state
  const [data, setData] = useState({
    overallScore: 0,
    scoreChange: 0,
    totalAssets: 0,
    assetsScanned: 0,
    totalRules: 0,
    activeRules: 0,
    totalIssues: 0,
    criticalIssues: 0,
    highIssues: 0,
    mediumIssues: 0,
    lowIssues: 0,
    dimensionScores: {
      completeness: 0,
      accuracy: 0,
      consistency: 0,
      validity: 0,
      uniqueness: 0,
      freshness: 0
    },
    trendsData: [] as Array<{ date: string; score: number; issues: number }>,
    recentScans: [] as Array<{ table: string; score: number; issues: number; timestamp: string }>,
    topIssues: [] as Array<{ rule: string; count: number; severity: string; trend: string }>,
    recommendations: [] as Array<{ title: string; impact: string; effort: string; description: string }>
  });

  // Load data when dataSourceId or database changes
  useEffect(() => {
    console.log('[QualityOverview] useEffect triggered, calling loadQualityData');
    loadQualityData();
  }, [dataSourceId, database, assetType, selectedTimeRange]);

  const loadQualityData = async () => {
    console.log('[QualityOverview] loadQualityData called with:', {
      dataSourceId: dataSourceId || 'ALL',
      database: database || 'ALL',
      assetType: assetType || 'ALL',
      selectedTimeRange
    });

    setLoading(true);
    try {
      console.log('[QualityOverview] Starting API calls...');
      // Load all quality data in parallel with individual error handling
      // When dataSourceId is empty, backend should return aggregated data for all sources
      const [summaryResult, rulesResult, issuesResult, trendsResult] = await Promise.allSettled([
        qualityAPI.getQualitySummary({
          dataSourceId: dataSourceId || undefined,
          database: database || undefined,
          assetType: assetType || undefined
        }),
        qualityAPI.getRules({ dataSourceId: dataSourceId || undefined }),
        qualityAPI.getIssues({ dataSourceId: dataSourceId || undefined, database: database || undefined, page: 1, limit: 100 }),
        qualityAPI.getQualityTrends(dataSourceId || undefined, selectedTimeRange)
      ]);

      console.log('[QualityOverview] API calls complete:', {
        summaryStatus: summaryResult.status,
        rulesStatus: rulesResult.status,
        issuesStatus: issuesResult.status,
        trendsStatus: trendsResult.status
      });

      // Extract data with fallbacks
      const summary = summaryResult.status === 'fulfilled' ? summaryResult.value : { dimensions: {} };
      const rules = rulesResult.status === 'fulfilled' ? rulesResult.value : [];
      const issues = issuesResult.status === 'fulfilled' ? issuesResult.value : { issues: [], pagination: { total: 0 } };
      const trends = trendsResult.status === 'fulfilled' ? trendsResult.value : [];

      console.log('[QualityOverview] Extracted data:', {
        summary,
        rulesCount: rules.length,
        issuesCount: issues.issues?.length || 0,
        trendsCount: trends.length
      });

      // Process summary data
      const dimensionScores = summary.dimensions || summary.dimensionScores || {
        completeness: 0,
        accuracy: 0,
        consistency: 0,
        validity: 0,
        uniqueness: 0,
        freshness: 0
      };

      // Calculate overall score from dimensions
      const overallScore = Math.round(
        Object.values(dimensionScores).reduce((sum, score) => sum + score, 0) /
        Object.values(dimensionScores).length
      );

      // Count issues by severity
      const issuesList = issues.issues || [];
      const criticalIssues = issuesList.filter(i => i.severity === 'critical').length;
      const highIssues = issuesList.filter(i => i.severity === 'high').length;
      const mediumIssues = issuesList.filter(i => i.severity === 'medium').length;
      const lowIssues = issuesList.filter(i => i.severity === 'low').length;

      // Get top issues (most frequent rule violations)
      const issuesByRule = issuesList.reduce((acc, issue) => {
        const ruleName = issue.ruleName || 'Unknown Rule';
        if (!acc[ruleName]) {
          acc[ruleName] = {
            rule: ruleName,
            count: 0,
            severity: issue.severity,
            trend: 'stable'
          };
        }
        acc[ruleName].count++;
        return acc;
      }, {} as Record<string, any>);

      const topIssues = Object.values(issuesByRule)
        .sort((a: any, b: any) => b.count - a.count)
        .slice(0, 3);

      // Process trends data
      const trendsData = (trends || []).map((trend: any) => ({
        date: new Date(trend.timestamp || trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score: trend.overallScore || trend.score || 0,
        issues: trend.issueCount || 0
      }));

      // Generate recommendations based on data
      const recommendations = [];
      if (criticalIssues > 0) {
        recommendations.push({
          title: `Fix ${criticalIssues} Critical Issues`,
          impact: 'high',
          effort: 'medium',
          description: `${criticalIssues} critical quality issues require immediate attention`
        });
      }
      if (highIssues > 10) {
        recommendations.push({
          title: `Address ${highIssues} High Priority Issues`,
          impact: 'high',
          effort: 'medium',
          description: `High volume of quality issues affecting data reliability`
        });
      }
      const inactiveRules = rules.filter((r: any) => !r.enabled).length;
      if (inactiveRules > 0) {
        recommendations.push({
          title: `Enable ${inactiveRules} Inactive Rules`,
          impact: 'medium',
          effort: 'low',
          description: 'Improve coverage by activating dormant quality rules'
        });
      }

      // Update state with real data
      const newData = {
        overallScore,
        scoreChange: 0, // Would need historical data to calculate
        totalAssets: summary.assetCoverage?.totalAssets || summary.totalAssets || 0,
        assetsScanned: summary.assetCoverage?.monitoredAssets || summary.assetsScanned || 0,
        totalRules: rules.length,
        activeRules: rules.filter((r: any) => r.enabled).length,
        totalIssues: issues.pagination?.total || issues.total || issues.issues?.length || 0,
        criticalIssues,
        highIssues,
        mediumIssues,
        lowIssues,
        dimensionScores,
        trendsData,
        recentScans: [], // Would need separate API endpoint
        topIssues,
        recommendations: recommendations.slice(0, 3)
      };

      console.log('[QualityOverview] Setting new data:', newData);
      setData(newData);
      console.log('[QualityOverview] Data set successfully');

    } catch (error) {
      console.error('[QualityOverview] Failed to load quality data:', error);
      // Keep previous data or show error state
    } finally {
      console.log('[QualityOverview] Setting loading to false');
      setLoading(false);
      console.log('[QualityOverview] loadQualityData complete');
    }
  };

  const handleRunFullScan = async () => {
    if (!dataSourceId) {
      alert('Please select a data source to run a scan');
      return;
    }

    setScanning(true);
    try {
      console.log('[QualityOverview] Starting full scan for data source:', dataSourceId);

      // Get all enabled rules for this data source
      const rules = await qualityAPI.getRules({ dataSourceId });
      const enabledRuleIds = rules.filter((r: any) => r.enabled).map((r: any) => r.id);

      if (enabledRuleIds.length === 0) {
        alert('No enabled rules found. Please enable some rules first.');
        setScanning(false);
        return;
      }

      console.log('[QualityOverview] Running scan with', enabledRuleIds.length, 'enabled rules');

      // Run the scan
      const result = await qualityAPI.scanDataSource(dataSourceId, enabledRuleIds);

      console.log('[QualityOverview] Scan complete:', result);
      alert(`Scan complete! ${result.passed} passed, ${result.failed} failed`);

      // Refresh the data after scan
      await loadQualityData();
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('[QualityOverview] Scan failed:', error);
      alert('Scan failed. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  // Calculate health status
  const getHealthStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', color: '#10B981', icon: CheckCircle };
    if (score >= 75) return { label: 'Good', color: '#3B82F6', icon: TrendingUp };
    if (score >= 60) return { label: 'Fair', color: '#F59E0B', icon: AlertCircle };
    return { label: 'Poor', color: '#EF4444', icon: AlertTriangle };
  };

  const healthStatus = getHealthStatus(data.overallScore);

  // Prepare radar chart data
  const radarData = QUALITY_DIMENSIONS.map(dim => ({
    dimension: dim.label,
    score: data.dimensionScores[dim.key as keyof typeof data.dimensionScores],
    fullMark: 100
  }));

  // Prepare issue distribution data
  const issueDistribution = [
    { name: 'Critical', value: data.criticalIssues, color: '#EF4444' },
    { name: 'High', value: data.highIssues, color: '#F97316' },
    { name: 'Medium', value: data.mediumIssues, color: '#F59E0B' },
    { name: 'Low', value: data.lowIssues, color: '#3B82F6' }
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Show loading state
  if (loading) {
    return (
      <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading quality data...</p>
            {dataSourceId && (
              <p className="text-sm text-gray-500 mt-2">
                Data Source: {dataSourceId.slice(0, 8)}...
                {database && ` • Database: ${database}`}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Removed empty state check - now shows aggregated data for all sources when no specific source is selected

  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 min-h-screen">
      {/* Header Section */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
            Data Quality Overview
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Real-time quality metrics and insights for your data
            {database && <span className="ml-2 text-blue-600 font-medium">• {database}</span>}
          </p>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm"
            disabled={loading}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={() => {
              loadQualityData();
              onRefresh?.();
            }}
            disabled={loading}
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Refresh data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            title="Export report"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Score Card - Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-xl p-8 text-white"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full translate-y-1/2 -translate-x-1/2" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Overall Score */}
          <div className="text-center lg:text-left">
            <div className="flex items-center justify-center lg:justify-start gap-3 mb-4">
              <div className={`p-3 bg-white/20 rounded-xl`}>
                <healthStatus.icon className="w-8 h-8" />
              </div>
              <div>
                <p className="text-white/80 text-sm">Overall Quality Score</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold">{data.overallScore}%</span>
                  <span className={`flex items-center text-sm ${data.scoreChange >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {data.scoreChange >= 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(data.scoreChange)}%
                  </span>
                </div>
                <p className="text-lg font-medium mt-1">{healthStatus.label} Health</p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Database className="w-5 h-5" />
                <p className="text-white/80 text-sm">Assets Scanned</p>
              </div>
              <p className="text-2xl font-bold">{data.assetsScanned}/{data.totalAssets}</p>
              <div className="mt-2 bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-500"
                  style={{ width: `${(data.assetsScanned / data.totalAssets) * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-5 h-5" />
                <p className="text-white/80 text-sm">Active Rules</p>
              </div>
              <p className="text-2xl font-bold">{data.activeRules}/{data.totalRules}</p>
              <div className="mt-2 bg-white/20 rounded-full h-2">
                <div
                  className="bg-white rounded-full h-2 transition-all duration-500"
                  style={{ width: `${(data.activeRules / data.totalRules) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Issues Summary */}
          <div className="bg-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <p className="text-white/80 text-sm">Active Issues</p>
            </div>
            <p className="text-3xl font-bold mb-3">{data.totalIssues}</p>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-red-300">Critical</span>
                <span className="font-medium">{data.criticalIssues}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-orange-300">High</span>
                <span className="font-medium">{data.highIssues}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-yellow-300">Medium</span>
                <span className="font-medium">{data.mediumIssues}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quality Dimensions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dimension Scores */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quality Dimensions
            </h3>
            <button className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              <Info className="w-4 h-4" />
            </button>
          </div>

          {/* Radar Chart */}
          <div className="h-64 mb-6">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fontSize: 12 }}
                  className="text-gray-600 dark:text-gray-400"
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 10 }}
                  className="text-gray-500"
                />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          {/* Dimension List */}
          <div className="space-y-3">
            {QUALITY_DIMENSIONS.map((dim) => {
              const Icon = dim.icon;
              const score = data.dimensionScores[dim.key as keyof typeof data.dimensionScores];
              const isGood = score >= 80;

              return (
                <motion.div
                  key={dim.key}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  onMouseEnter={() => setHoveredDimension(dim.key)}
                  onMouseLeave={() => setHoveredDimension(null)}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="p-2 rounded-lg"
                      style={{ backgroundColor: `${dim.color}20` }}
                    >
                      <Icon className="w-5 h-5" style={{ color: dim.color }} />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {dim.label}
                      </p>
                      <AnimatePresence>
                        {hoveredDimension === dim.key && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-xs text-gray-500 dark:text-gray-400"
                          >
                            {dim.description}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${isGood ? 'text-green-600' : 'text-orange-600'}`}>
                        {score}%
                      </p>
                    </div>
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${score}%`,
                          backgroundColor: dim.color
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Trend Analysis */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quality Trend
            </h3>
            <div className="flex gap-2">
              <button className="px-3 py-1 text-xs bg-blue-100 text-blue-600 rounded-lg">
                Score
              </button>
              <button className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded-lg">
                Issues
              </button>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.trendsData}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorIssues" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="score"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  fill="url(#colorScore)"
                  name="Quality Score"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="issues"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={{ fill: '#EF4444', r: 3 }}
                  name="Issues"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Issues */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Top Issues
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-700">
              View All
            </button>
          </div>

          <div className="space-y-3">
            {data.topIssues.map((issue, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {issue.rule}
                  </p>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    issue.severity === 'critical' ? 'bg-red-100 text-red-600' :
                    issue.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                    'bg-yellow-100 text-yellow-600'
                  }`}>
                    {issue.severity}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {issue.count}
                  </span>
                  <span className={`flex items-center text-sm ${
                    issue.trend === 'up' ? 'text-red-500' :
                    issue.trend === 'down' ? 'text-green-500' :
                    'text-gray-500'
                  }`}>
                    {issue.trend === 'up' ? <ArrowUp className="w-3 h-3" /> :
                     issue.trend === 'down' ? <ArrowDown className="w-3 h-3" /> :
                     <Minus className="w-3 h-3" />}
                    {issue.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Scans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Scans
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-700">
              History
            </button>
          </div>

          <div className="space-y-3">
            {data.recentScans.map((scan, index) => (
              <div
                key={index}
                className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex justify-between items-center mb-2">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {scan.table}
                  </p>
                  <span className="text-xs text-gray-500">
                    {scan.timestamp}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`text-lg font-bold ${
                      scan.score >= 90 ? 'text-green-600' :
                      scan.score >= 75 ? 'text-blue-600' :
                      'text-orange-600'
                    }`}>
                      {scan.score}%
                    </span>
                    <span className="text-sm text-gray-500">
                      quality
                    </span>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {scan.issues} issues
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recommendations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recommendations
            </h3>
            <Sparkles className="w-5 h-5 text-yellow-500" />
          </div>

          <div className="space-y-3">
            {data.recommendations.map((rec, index) => (
              <div
                key={index}
                className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">
                    {rec.title}
                  </p>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {rec.description}
                </p>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    rec.impact === 'high' ? 'bg-green-100 text-green-600' :
                    rec.impact === 'medium' ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {rec.impact} impact
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    rec.effort === 'low' ? 'bg-green-100 text-green-600' :
                    rec.effort === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {rec.effort} effort
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Quick Actions Bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="bg-gradient-to-r from-gray-800 to-gray-900 dark:from-gray-700 dark:to-gray-800 rounded-xl p-4 flex justify-between items-center"
      >
        <div className="flex items-center gap-4">
          <Activity className="w-5 h-5 text-white" />
          <p className="text-white text-sm">
            Last scan completed <span className="font-medium">2 hours ago</span>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleRunFullScan}
            disabled={scanning || !dataSourceId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              'Run Full Scan'
            )}
          </button>
          <button className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium">
            Configure Rules
          </button>
          <button className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium">
            Export Report
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default QualityOverviewRedesign;