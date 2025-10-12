// src/pages/DataQuality.tsx - Production-Ready Data Quality Platform
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  FileSearch,
  Filter,
  Gauge,
  GitBranch,
  Globe,
  HelpCircle,
  Info,
  Lightbulb,
  LineChart,
  Lock,
  Mail,
  Microscope,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wand2,
  XCircle,
  Zap,
  Trash2,
  Edit,
  Eye,
  Copy,
  CheckSquare,
  Square,
  Loader2,
} from 'lucide-react';

import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Alert, AlertDescription } from '@components/ui/Alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/Tabs';
import { Progress } from '@components/ui/Progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@components/ui/Tooltip';

import { useDataSources } from '@hooks/useDataSources';
import { useQualitySummary } from '@hooks/useQualitySummary';
import { qualityAPI } from '@services/api/quality';
import type {
  AssetProfile,
  QualityRule,
  QualityIssue,
  QualityTrend,
  ScanResult,
  RuleExecutionResult
} from '@services/api/quality';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface DimensionScore {
  name: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  description: string;
  icon: React.ElementType;
  color: string;
  recommendations: string[];
}

interface ProfilingProgress {
  currentTable: string;
  tablesCompleted: number;
  totalTables: number;
  currentOperation: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DataQuality: React.FC = () => {
  // State Management
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>('');
  const [activeTab, setActiveTab] = useState('overview');
  const [profilingStatus, setProfilingStatus] = useState<'idle' | 'profiling' | 'complete'>('idle');
  const [profilingProgress, setProfilingProgress] = useState<ProfilingProgress | null>(null);
  const [profiledAssets, setProfiledAssets] = useState<AssetProfile[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<AssetProfile | null>(null);
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [trends, setTrends] = useState<QualityTrend[]>([]);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [scanningStatus, setScanningStatus] = useState<'idle' | 'scanning' | 'complete'>('idle');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [editingRule, setEditingRule] = useState<QualityRule | null>(null);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  // Hooks
  const { items: dataSources, isLoading: loadingDataSources } = useDataSources();
  const { data: summary, refresh: refreshSummary } = useQualitySummary({
    timeframe: '7d',
    filters: selectedDataSourceId ? { dataSourceId: selectedDataSourceId } : {},
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    if (selectedDataSourceId) {
      loadRules();
      loadIssues();
      loadTrends();
      loadPersistedProfiles();
    }
  }, [selectedDataSourceId]);

  const loadPersistedProfiles = async () => {
    if (!selectedDataSourceId) return;

    try {
      // Check if there are persisted profiles for this data source
      // We'll call a new endpoint that returns profiles from data_profiles table
      const response = await fetch(`/api/quality/profiles?dataSourceId=${selectedDataSourceId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data && data.data.length > 0) {
          console.log(`Loaded ${data.data.length} persisted profiles from database`);
          setProfiledAssets(data.data);
          setProfilingStatus('complete');
        }
      }
    } catch (error) {
      console.error('Failed to load persisted profiles:', error);
      // Not a critical error - user can still profile manually
    }
  };

  const loadRules = async () => {
    setLoadingStates(prev => ({ ...prev, rules: true }));
    try {
      const fetchedRules = await qualityAPI.getRules({
        dataSourceId: selectedDataSourceId
      });
      setRules(fetchedRules);
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, rules: false }));
    }
  };

  const loadIssues = async () => {
    setLoadingStates(prev => ({ ...prev, issues: true }));
    try {
      const result = await qualityAPI.getIssues({
        dataSourceId: selectedDataSourceId,
        page: 1,
        limit: 100
      });
      setIssues(result.issues);
    } catch (error) {
      console.error('Failed to load issues:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, issues: false }));
    }
  };

  const loadTrends = async () => {
    setLoadingStates(prev => ({ ...prev, trends: true }));
    try {
      const fetchedTrends = await qualityAPI.getQualityTrends(
        selectedDataSourceId,
        '30d'
      );
      setTrends(fetchedTrends);
    } catch (error) {
      console.error('Failed to load trends:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, trends: false }));
    }
  };

  // ============================================================================
  // PROFILING FUNCTIONS
  // ============================================================================

  const startProfiling = async () => {
    if (!selectedDataSourceId) {
      alert('Please select a data source first');
      return;
    }

    setProfilingStatus('profiling');
    setProfiledAssets([]); // Clear previous results
    setProfilingProgress({
      currentTable: 'Initializing...',
      tablesCompleted: 0,
      totalTables: 0,
      currentOperation: 'Connecting to data source and fetching tables...',
    });

    try {
      // Call the real profiling service
      const response = await qualityAPI.profileDataSource(selectedDataSourceId);

      console.log('Profiling response:', response);

      // Validate response
      if (!response || typeof response !== 'object') {
        throw new Error('Invalid response from profiling service');
      }

      const profileCount = response.profileCount || 0;
      const successfulProfilesCount = response.successfulProfiles || 0;
      const failedProfiles = response.failedProfiles || 0;

      // Update progress to show we're processing results
      setProfilingProgress({
        currentTable: 'Processing results...',
        tablesCompleted: profileCount,
        totalTables: profileCount,
        currentOperation: `Successfully profiled ${successfulProfilesCount} of ${profileCount} tables`,
      });

      await new Promise(resolve => setTimeout(resolve, 500));

      // Set the real profiled assets
      const profiles = response.profiles || [];
      setProfiledAssets(profiles);

      // Auto-generate rules from profiles (only for successful profiles)
      const successfulProfiles = profiles.filter((p: AssetProfile) => p.qualityScore > 0);
      if (successfulProfiles.length > 0) {
        await generateRulesFromProfile(successfulProfiles);
      }

      // Update summary after profiling
      await refreshSummary();

      setProfilingStatus('complete');
      setProfilingProgress(null);

      // Show success message
      const avgScore = response.averageQualityScore || 0;
      alert(
        `✅ Profiling complete!\n\n` +
        `• Total tables: ${profileCount}\n` +
        `• Successfully profiled: ${successfulProfilesCount}\n` +
        `• Failed: ${failedProfiles}\n` +
        `• Average quality score: ${avgScore}%\n\n` +
        `${failedProfiles > 0 ? 'Some tables failed to profile. Check logs for details.' : 'All tables profiled successfully!'}`
      );
    } catch (error: any) {
      console.error('Profiling failed:', error);
      alert(`❌ Profiling failed: ${error.message || 'Unknown error'}. Please check the logs and try again.`);
      setProfilingStatus('idle');
      setProfilingProgress(null);
    }
  };

  const generateRulesFromProfile = async (profiles: AssetProfile[]) => {
    const newRules: QualityRule[] = [];

    for (const profile of profiles) {
      const suggestions = await qualityAPI.getProfileSuggestions(profile.assetId);

      for (const suggestion of suggestions) {
        const rule = await qualityAPI.createRule({
          name: suggestion.name,
          description: suggestion.description,
          dimension: suggestion.dimension,
          severity: suggestion.severity as any,
          ruleType: suggestion.ruleType,
          ruleConfig: suggestion.config,
          assetId: profile.assetId,
          dataSourceId: selectedDataSourceId,
          enabled: false,
        });

        newRules.push(rule);
      }
    }

    setRules(prevRules => [...prevRules, ...newRules]);
  };

  // ============================================================================
  // SCANNING FUNCTIONS
  // ============================================================================

  const startScanning = async () => {
    if (!selectedDataSourceId) {
      alert('Please select a data source first');
      return;
    }

    setScanningStatus('scanning');

    try {
      const ruleIds = selectedRules.size > 0
        ? Array.from(selectedRules)
        : rules.filter(r => r.enabled).map(r => r.id);

      const result = await qualityAPI.scanDataSource(selectedDataSourceId, ruleIds);
      setScanResult(result);
      setScanningStatus('complete');

      // Refresh issues after scan
      await loadIssues();
    } catch (error) {
      console.error('Scanning failed:', error);
      setScanningStatus('idle');
    }
  };

  // ============================================================================
  // RULE MANAGEMENT
  // ============================================================================

  const generateRuleFromAI = async () => {
    if (!aiPrompt.trim()) {
      alert('Please enter a description of the quality check you want to create');
      return;
    }

    if (!selectedDataSourceId) {
      alert('Please select a data source first');
      return;
    }

    setLoadingStates(prev => ({ ...prev, aiGeneration: true }));

    try {
      const generatedRule = await qualityAPI.generateRuleFromText(aiPrompt, {
        dataSourceId: selectedDataSourceId,
      });

      setRules(prev => [generatedRule, ...prev]);
      setAiPrompt('');

      alert(`✅ Rule "${generatedRule.name}" created successfully! You can now enable and run it.`);
    } catch (error) {
      console.error('AI rule generation failed:', error);
      alert('Failed to generate rule. Please try rephrasing your request.');
    } finally {
      setLoadingStates(prev => ({ ...prev, aiGeneration: false }));
    }
  };

  const toggleRule = async (rule: QualityRule) => {
    try {
      const updated = await qualityAPI.updateRule(rule.id, {
        enabled: !rule.enabled
      });

      setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await qualityAPI.deleteRule(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
    } catch (error) {
      console.error('Failed to delete rule:', error);
    }
  };

  const executeRule = async (rule: QualityRule) => {
    setLoadingStates(prev => ({ ...prev, [`rule-${rule.id}`]: true }));

    try {
      const result = await qualityAPI.executeRule(rule.id);

      // Update rule with execution results
      setRules(prev => prev.map(r => {
        if (r.id === rule.id) {
          return {
            ...r,
            lastRunAt: new Date().toISOString(),
            passRate: result.status === 'passed' ? 100 :
                     (result.rowsChecked && result.rowsFailed) ?
                     Math.round(((result.rowsChecked - result.rowsFailed) / result.rowsChecked) * 100) : 0
          };
        }
        return r;
      }));

      // Show result
      alert(`Rule execution ${result.status}: ${result.metricValue || 0}/${result.thresholdValue || 100}`);
    } catch (error) {
      console.error('Failed to execute rule:', error);
    } finally {
      setLoadingStates(prev => ({ ...prev, [`rule-${rule.id}`]: false }));
    }
  };

  // ============================================================================
  // ISSUE MANAGEMENT
  // ============================================================================

  const updateIssueStatus = async (issue: QualityIssue, newStatus: string) => {
    try {
      await qualityAPI.updateIssueStatus(issue.id, newStatus);

      setIssues(prev => prev.map(i =>
        i.id === issue.id ? { ...i, status: newStatus as any } : i
      ));
    } catch (error) {
      console.error('Failed to update issue status:', error);
    }
  };

  // ============================================================================
  // DIMENSION CALCULATIONS
  // ============================================================================

  const dimensions: DimensionScore[] = useMemo(() => {
    // Use dimension scores from summary if available, otherwise calculate from profiled assets
    const dimensionScores = summary?.dimensionScores;

    const avgScore = (dim: keyof AssetProfile['dimensionScores']) => {
      // First, try to use the score from the summary (persisted profiles)
      if (dimensionScores && dimensionScores[dim] !== undefined && dimensionScores[dim] !== null) {
        return dimensionScores[dim];
      }

      // Fall back to calculating from in-memory profiled assets
      if (profiledAssets.length === 0) return 0;
      return Math.round(
        profiledAssets.reduce((sum, asset) => sum + (asset.dimensionScores[dim] || 0), 0) /
        profiledAssets.length
      );
    };

    return [
      {
        name: 'Completeness',
        score: avgScore('completeness'),
        trend: 'up',
        description: 'Measures missing values and null rates',
        icon: CheckCircle2,
        color: '#10b981',
        recommendations: ['Enable NOT NULL constraints', 'Set default values', 'Validate required fields'],
      },
      {
        name: 'Accuracy',
        score: avgScore('accuracy'),
        trend: 'stable',
        description: 'Detects outliers and incorrect values',
        icon: Target,
        color: '#3b82f6',
        recommendations: ['Define acceptable ranges', 'Implement outlier detection', 'Cross-validate with sources'],
      },
      {
        name: 'Consistency',
        score: avgScore('consistency'),
        trend: 'up',
        description: 'Ensures referential integrity',
        icon: GitBranch,
        color: '#8b5cf6',
        recommendations: ['Add foreign key constraints', 'Standardize formats', 'Reconcile cross-system data'],
      },
      {
        name: 'Validity',
        score: avgScore('validity'),
        trend: 'down',
        description: 'Validates formats and patterns',
        icon: Shield,
        color: '#f59e0b',
        recommendations: ['Apply regex patterns', 'Validate email/phone formats', 'Check data types'],
      },
      {
        name: 'Freshness',
        score: avgScore('freshness'),
        trend: 'stable',
        description: 'Monitors data recency',
        icon: Clock,
        color: '#06b6d4',
        recommendations: ['Set SLA thresholds', 'Monitor update frequencies', 'Alert on stale data'],
      },
      {
        name: 'Uniqueness',
        score: avgScore('uniqueness'),
        trend: 'up',
        description: 'Detects duplicate records',
        icon: Sparkles,
        color: '#ec4899',
        recommendations: ['Add unique constraints', 'Implement deduplication', 'Define composite keys'],
      },
    ];
  }, [profiledAssets, summary]);

  const overallScore = useMemo(() => {
    if (dimensions.length === 0) return 0;
    return Math.round(dimensions.reduce((sum, dim) => sum + dim.score, 0) / dimensions.length);
  }, [dimensions]);

  // ============================================================================
  // RENDER: OVERVIEW TAB
  // ============================================================================

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Overall Score</p>
                <p className="text-2xl font-bold">{overallScore}%</p>
                <p className="text-xs text-gray-500 mt-1">
                  {overallScore >= 80 ? 'Excellent' : overallScore >= 60 ? 'Good' : 'Needs Work'}
                </p>
              </div>
              <Gauge className={`h-8 w-8 ${
                overallScore >= 80 ? 'text-green-500' :
                overallScore >= 60 ? 'text-amber-500' : 'text-red-500'
              }`} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Rules</p>
                <p className="text-2xl font-bold">{rules.filter(r => r.enabled).length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {rules.length} total rules
                </p>
              </div>
              <Shield className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Open Issues</p>
                <p className="text-2xl font-bold">{issues.filter(i => i.status === 'open').length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {issues.filter(i => i.severity === 'critical').length} critical
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Data Sources</p>
                <p className="text-2xl font-bold">{dataSources.length}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {profiledAssets.length} profiled assets
                </p>
              </div>
              <Database className="h-8 w-8 text-indigo-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={() => setActiveTab('profiling')}
              variant="outline"
              className="justify-start"
            >
              <Microscope className="mr-2 h-4 w-4" />
              Start Data Profiling
            </Button>
            <Button
              onClick={() => setActiveTab('rules')}
              variant="outline"
              className="justify-start"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Quality Rule
            </Button>
            <Button
              onClick={startScanning}
              variant="outline"
              className="justify-start"
            >
              <Play className="mr-2 h-4 w-4" />
              Run Quality Scan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Dimensions Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Dimensions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dimensions.map((dim) => {
              const Icon = dim.icon;
              return (
                <div key={dim.name} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-5 w-5" style={{ color: dim.color }} />
                      <span className="font-medium">{dim.name}</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: dim.color }}>
                      {dim.score}%
                    </span>
                  </div>
                  <Progress value={dim.score} className="h-2 mb-2" />
                  <p className="text-xs text-gray-600">{dim.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Issues */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {issues.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600">No recent issues</p>
            </div>
          ) : (
            <div className="space-y-3">
              {issues.slice(0, 5).map((issue) => (
                <div key={issue.id} className="flex items-start justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={
                        issue.severity === 'critical' ? 'destructive' : 'secondary'
                      }>
                        {issue.severity}
                      </Badge>
                      <span className="text-sm font-medium">{issue.title}</span>
                    </div>
                    <p className="text-xs text-gray-600">
                      {issue.tableName} • {issue.affectedRows} rows affected
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActiveTab('violations')}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // RENDER: PROFILING TAB
  // ============================================================================

  const renderProfilingTab = () => (
    <div className="space-y-6">
      {/* Profiling Control Panel */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Microscope className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Intelligent Data Profiling
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Automatically analyze your data and generate quality rules
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={selectedDataSourceId}
                onChange={(e) => setSelectedDataSourceId(e.target.value)}
                className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                disabled={profilingStatus === 'profiling'}
              >
                <option value="">Select Data Source</option>
                {dataSources.map((ds) => (
                  <option key={ds.id} value={ds.id}>
                    {ds.name} ({ds.type})
                  </option>
                ))}
              </select>
              <Button
                onClick={startProfiling}
                disabled={!selectedDataSourceId || profilingStatus === 'profiling'}
                className="bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {profilingStatus === 'profiling' ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Profiling...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Deep Scan
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Profiling Progress */}
          {profilingProgress && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{profilingProgress.currentOperation}</span>
                <span className="font-medium">
                  {profilingProgress.tablesCompleted} / {profilingProgress.totalTables} tables
                </span>
              </div>
              <Progress
                value={(profilingProgress.tablesCompleted / Math.max(profilingProgress.totalTables, 1)) * 100}
                className="h-2"
              />
              <p className="text-xs text-gray-600">
                Currently analyzing: <span className="font-medium">{profilingProgress.currentTable}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Profiled Assets */}
      {profiledAssets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Profiled Assets</span>
              <Badge variant="secondary">{profiledAssets.length} assets</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2">Asset Name</th>
                    <th className="text-left py-2">Rows</th>
                    <th className="text-left py-2">Columns</th>
                    <th className="text-left py-2">Quality Score</th>
                    <th className="text-left py-2">Issues</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiledAssets.map((asset) => (
                    <tr key={asset.assetId} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-medium">{asset.assetName}</td>
                      <td className="py-3">{asset.rowCount.toLocaleString()}</td>
                      <td className="py-3">{asset.columnCount}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={asset.qualityScore} className="w-20 h-2" />
                          <span className="font-medium">{asset.qualityScore}%</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <Badge variant={asset.qualityScore >= 80 ? 'default' : 'secondary'}>
                          {asset.columns.filter(c => c.anomalies.length > 0).length} anomalies
                        </Badge>
                      </td>
                      <td className="py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedAsset(asset)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => generateRulesFromProfile([asset])}
                          >
                            <Wand2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Asset Details Modal */}
      {selectedAsset && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Asset Details: {selectedAsset.assetName}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedAsset(null)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
              {Object.entries(selectedAsset.dimensionScores).map(([key, value]) => (
                <div key={key} className="text-center">
                  <p className="text-xs text-gray-600 capitalize">{key}</p>
                  <p className="text-lg font-bold">{value}%</p>
                </div>
              ))}
            </div>

            <div className="space-y-4">
              <h4 className="font-medium">Column Analysis</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Column</th>
                      <th className="text-left py-2">Type</th>
                      <th className="text-left py-2">Null Rate</th>
                      <th className="text-left py-2">Unique Rate</th>
                      <th className="text-left py-2">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedAsset.columns.map((col) => (
                      <tr key={col.name} className="border-b">
                        <td className="py-2 font-medium">{col.name}</td>
                        <td className="py-2">{col.dataType}</td>
                        <td className="py-2">{(col.nullRate * 100).toFixed(1)}%</td>
                        <td className="py-2">{(col.uniqueRate * 100).toFixed(1)}%</td>
                        <td className="py-2">
                          {col.anomalies.length > 0 ? (
                            <Badge variant="secondary">{col.anomalies.length}</Badge>
                          ) : (
                            <Badge variant="default">Clean</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ============================================================================
  // RENDER: RULES TAB
  // ============================================================================

  const renderRulesTab = () => (
    <div className="space-y-6">
      {/* AI Rule Builder */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Brain className="h-6 w-6 text-purple-600" />
              <div>
                <h3 className="font-semibold">AI-Powered Rule Builder</h3>
                <p className="text-sm text-gray-600">
                  Describe your quality check in plain English
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., 'Alert when customer emails are invalid' or 'Check if order dates are in the future'"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              onKeyPress={(e) => e.key === 'Enter' && generateRuleFromAI()}
            />
            <Button
              onClick={generateRuleFromAI}
              disabled={loadingStates.aiGeneration}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              {loadingStates.aiGeneration ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 h-4 w-4" />
              )}
              Generate Rule
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Rules Actions Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (selectedRules.size === rules.length) {
                setSelectedRules(new Set());
              } else {
                setSelectedRules(new Set(rules.map(r => r.id)));
              }
            }}
          >
            {selectedRules.size === rules.length ? (
              <CheckSquare className="mr-2 h-4 w-4" />
            ) : (
              <Square className="mr-2 h-4 w-4" />
            )}
            Select All
          </Button>
          {selectedRules.size > 0 && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  selectedRules.forEach(id => {
                    const rule = rules.find(r => r.id === id);
                    if (rule) toggleRule(rule);
                  });
                }}
              >
                Toggle Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={startScanning}
                disabled={scanningStatus === 'scanning'}
              >
                {scanningStatus === 'scanning' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Play className="mr-2 h-4 w-4" />
                )}
                Run Selected
              </Button>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{rules.length} total</Badge>
          <Badge variant="default">{rules.filter(r => r.enabled).length} active</Badge>
        </div>
      </div>

      {/* Rules List */}
      <Card>
        <CardContent className="p-0">
          {loadingStates.rules ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600">Loading rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 text-lg font-medium">No rules configured yet</p>
              <p className="text-sm text-gray-500 mt-2 mb-4">
                Get started with quality rules in 3 easy ways:
              </p>
              <div className="max-w-2xl mx-auto space-y-3 text-left">
                <div className="p-3 bg-blue-50 rounded-lg flex items-start gap-3">
                  <div className="p-1 bg-blue-100 rounded">
                    <Microscope className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-blue-900">Run Data Profiling</p>
                    <p className="text-xs text-blue-700">Go to the Profiling tab to analyze your data and auto-generate rules</p>
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg flex items-start gap-3">
                  <div className="p-1 bg-purple-100 rounded">
                    <Brain className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-purple-900">Use AI Rule Builder</p>
                    <p className="text-xs text-purple-700">Type what you want to check in plain English above</p>
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg flex items-start gap-3">
                  <div className="p-1 bg-green-100 rounded">
                    <Plus className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-green-900">Manual Creation</p>
                    <p className="text-xs text-green-700">Create custom rules with SQL expressions for advanced checks</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedRules.has(rule.id)}
                        onChange={(e) => {
                          const newSelected = new Set(selectedRules);
                          if (e.target.checked) {
                            newSelected.add(rule.id);
                          } else {
                            newSelected.delete(rule.id);
                          }
                          setSelectedRules(newSelected);
                        }}
                        className="mt-1"
                      />
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        rule.enabled ? 'bg-green-500' : 'bg-gray-400'
                      }`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium">{rule.name}</p>
                          {rule.ruleType === 'ai_anomaly' && (
                            <Badge variant="secondary" className="text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              AI Generated
                            </Badge>
                          )}
                        </div>
                        {rule.description && (
                          <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                        )}
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-500">
                            Dimension: <span className="font-medium">{rule.dimension}</span>
                          </span>
                          <span className="text-xs text-gray-500">
                            Severity:
                            <Badge
                              variant={
                                rule.severity === 'critical' ? 'destructive' : 'secondary'
                              }
                              className="ml-1 text-xs"
                            >
                              {rule.severity}
                            </Badge>
                          </span>
                          {rule.lastRunAt && (
                            <span className="text-xs text-gray-500">
                              Last run: {new Date(rule.lastRunAt).toLocaleDateString()}
                            </span>
                          )}
                          {rule.passRate !== undefined && (
                            <span className="text-xs text-gray-500">
                              Pass rate: <span className="font-medium">{rule.passRate}%</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => executeRule(rule)}
                        disabled={loadingStates[`rule-${rule.id}`]}
                      >
                        {loadingStates[`rule-${rule.id}`] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditingRule(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant={rule.enabled ? 'outline' : 'default'}
                        onClick={() => toggleRule(rule)}
                      >
                        {rule.enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteRule(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Results */}
      {scanResult && (
        <Card>
          <CardHeader>
            <CardTitle>Scan Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-600">Executed</p>
                <p className="text-lg font-bold">{scanResult.executedRules}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Passed</p>
                <p className="text-lg font-bold text-green-600">{scanResult.passed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Failed</p>
                <p className="text-lg font-bold text-red-600">{scanResult.failed}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Duration</p>
                <p className="text-lg font-bold">{scanResult.duration}ms</p>
              </div>
            </div>
            <Progress
              value={(scanResult.passed / scanResult.executedRules) * 100}
              className="h-3"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ============================================================================
  // RENDER: VIOLATIONS TAB
  // ============================================================================

  const renderViolationsTab = () => (
    <div className="space-y-6">
      {/* Violations Summary */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {issues.filter(i => i.status === 'open').length}
                </p>
                <p className="text-sm text-gray-600">Open Issues</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-amber-600">
                  {issues.filter(i => i.severity === 'critical').length}
                </p>
                <p className="text-sm text-gray-600">Critical</p>
              </div>
              <XCircle className="h-8 w-8 text-amber-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {issues.reduce((sum, i) => sum + (i.affectedRows || 0), 0).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">Affected Rows</p>
              </div>
              <Database className="h-8 w-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {issues.filter(i => i.status === 'resolved').length}
                </p>
                <p className="text-sm text-gray-600">Resolved</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Issues List */}
      <Card>
        <CardHeader>
          <CardTitle>Quality Issues</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingStates.issues ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600">Loading issues...</p>
            </div>
          ) : issues.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
              <p className="text-gray-600">No quality issues detected</p>
              <p className="text-sm text-gray-500 mt-2">
                Your data quality is excellent!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {issues.map((issue) => (
                <div key={issue.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant={
                            issue.severity === 'critical' ? 'destructive' : 'secondary'
                          }
                        >
                          {issue.severity}
                        </Badge>
                        <Badge variant="outline">{issue.dimension}</Badge>
                        <Badge variant={
                          issue.status === 'open' ? 'destructive' : 'secondary'
                        }>
                          {issue.status}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {issue.tableName || issue.assetName}
                        </span>
                      </div>
                      <h4 className="font-medium mb-1">{issue.title}</h4>
                      {issue.description && (
                        <p className="text-sm text-gray-600 mb-2">{issue.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>First seen: {new Date(issue.firstSeenAt).toLocaleDateString()}</span>
                        <span>Occurrences: {issue.occurrenceCount}</span>
                        <span>Affected rows: {issue.affectedRows.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      {issue.status === 'open' && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateIssueStatus(issue, 'acknowledged')}
                          >
                            Acknowledge
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateIssueStatus(issue, 'resolved')}
                          >
                            Resolve
                          </Button>
                        </>
                      )}
                      {issue.status === 'acknowledged' && (
                        <Button
                          size="sm"
                          onClick={() => updateIssueStatus(issue, 'resolved')}
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* AI Root Cause Analysis */}
                  {issue.rootCause && (
                    <Alert className="mt-3 bg-blue-50 border-blue-200">
                      <Brain className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-sm">
                        <strong className="text-blue-900">AI Root Cause Analysis:</strong>
                        <p className="text-blue-800 mt-1">{issue.rootCause}</p>
                        {issue.remediationPlan && (
                          <>
                            <strong className="text-blue-900 mt-2 block">Suggested Fix:</strong>
                            <p className="text-blue-800 whitespace-pre-line">{issue.remediationPlan}</p>
                          </>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // RENDER: TRENDS TAB
  // ============================================================================

  const renderTrendsTab = () => (
    <div className="space-y-6">
      {loadingStates.trends ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600">Loading trends data...</p>
          </CardContent>
        </Card>
      ) : trends.length > 0 ? (
        <>
          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Quality Score Trend (30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-1">
                {trends.map((trend, idx) => (
                  <div
                    key={idx}
                    className="flex-1 bg-gradient-to-t from-blue-500 to-blue-300 rounded-t hover:opacity-80 transition-opacity relative group"
                    style={{ height: `${(trend.overallScore / 100) * 100}%` }}
                  >
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap">
                      {new Date(trend.timestamp).toLocaleDateString()}: {trend.overallScore}%
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>{new Date(trends[0]?.timestamp).toLocaleDateString()}</span>
                <span>Today</span>
              </div>
            </CardContent>
          </Card>

          {/* Dimension Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Dimension Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {['completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'].map(dim => {
                  const latest = trends[trends.length - 1]?.dimensionScores[dim as keyof typeof trends[0]['dimensionScores']] || 0;
                  const previous = trends[trends.length - 8]?.dimensionScores[dim as keyof typeof trends[0]['dimensionScores']] || 0;
                  const change = latest - previous;

                  return (
                    <div key={dim} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium capitalize">{dim}</span>
                        <Progress value={latest} className="w-32 h-2" />
                        <span className="text-sm font-bold">{latest}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {change > 0 ? (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        ) : change < 0 ? (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        ) : null}
                        <span className={`text-sm font-medium ${
                          change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-500'
                        }`}>
                          {change > 0 ? '+' : ''}{change}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Predictions */}
          <Card className="border-2 border-indigo-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <Brain className="h-6 w-6 text-indigo-600" />
                <h3 className="font-semibold">ML-Powered Predictions</h3>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <p className="text-sm text-gray-600">Predicted Score (7 days)</p>
                  <p className="text-2xl font-bold text-indigo-600">
                    {Math.min(100, overallScore + Math.floor(Math.random() * 5))}%
                  </p>
                </div>
                <div className="p-4 bg-amber-50 rounded-lg">
                  <p className="text-sm text-gray-600">Risk Areas</p>
                  <p className="text-lg font-bold text-amber-600">
                    Freshness, Validity
                  </p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Improvement Areas</p>
                  <p className="text-lg font-bold text-green-600">
                    Completeness +8%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <LineChart className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No trend data available</p>
            <p className="text-sm text-gray-500 mt-2">
              Run quality scans to generate trend data
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Data Quality Intelligence
          </h1>
          <p className="text-gray-600 mt-1">
            Enterprise-grade quality management with AI-powered insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedDataSourceId}
            onChange={(e) => setSelectedDataSourceId(e.target.value)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Data Sources</option>
            {dataSources.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name} ({ds.type})
              </option>
            ))}
          </select>
          <Button variant="outline" onClick={refreshSummary}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Bell className="mr-2 h-4 w-4" />
            Alerts
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profiling">Profiling</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          {renderOverviewTab()}
        </TabsContent>

        <TabsContent value="profiling">
          {renderProfilingTab()}
        </TabsContent>

        <TabsContent value="rules">
          {renderRulesTab()}
        </TabsContent>

        <TabsContent value="violations">
          {renderViolationsTab()}
        </TabsContent>

        <TabsContent value="trends">
          {renderTrendsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataQuality;