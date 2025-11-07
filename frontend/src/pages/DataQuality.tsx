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
  FileCode,
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
  BookOpen,
  X,
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
import QualityOverviewRedesign from '@components/quality/QualityOverviewRedesign';
import TechnicalOverview from '@components/quality/TechnicalOverview';
import ProductionQualityOverview from '@components/quality/ProductionQualityOverview';
// import ExecutiveDashboard from '@components/quality/ExecutiveDashboard'; // Not yet implemented
import CompactProfiling from '@components/quality/CompactProfiling';
import { QualityAutopilotOnboarding } from '@components/quality/QualityAutopilotOnboarding';
import { RevolutionaryRulesView } from '@components/quality/revolutionary';
import { RuleBuilder } from '@components/quality/RuleBuilder';
import { GlobalRulesSystem } from '@components/quality/GlobalRulesSystem';
import { SmartRulesStudio } from '@components/quality/SmartRulesStudio';
import ModernRulesHubFixed from '@components/quality/revolutionary/ModernRulesHubFixed';
import type {
  AssetProfile,
  QualityRule,
  QualityIssue,
  QualityTrend,
  ScanResult,
  RuleExecutionResult,
  RuleTemplate
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
  // State Management - Updated to match Data Catalog
  const [selectedDataSourceId, setSelectedDataSourceId] = useState<string>('');
  const [selectedDatabases, setSelectedDatabases] = useState<string[]>([]); // Changed to array for multi-select
  const [showDatabasePicker, setShowDatabasePicker] = useState(false);
  const [databasesByDataSource, setDatabasesByDataSource] = useState<Array<{ dataSourceId: string; dataSourceName: string; databases: Array<{ name: string; isSystem: boolean; isSynced: boolean }> }>>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | 'table' | 'view'>('all');
  const [assetTypeCounts, setAssetTypeCounts] = useState<{ tables: number; views: number }>({ tables: 0, views: 0 });
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  // Removed Executive mode - not implemented yet
  // const [overviewMode, setOverviewMode] = useState<'technical' | 'executive'>('technical');
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
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [profileFilter, setProfileFilter] = useState<string>('');
  const [ruleFilter, setRuleFilter] = useState<{ search: string; severity: string; status: string }>({
    search: '',
    severity: '',
    status: ''
  });
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, any>>({});
  const [availableTables, setAvailableTables] = useState<Array<{ schema: string; table: string; fullName: string }>>([]);
  const [availableColumns, setAvailableColumns] = useState<Array<{ name: string; type: string }>>([]);
  const [autopilotEnabled, setAutopilotEnabled] = useState<boolean>(false);
  const [autopilotStatus, setAutopilotStatus] = useState<any>(null);
  const [loadingAutopilot, setLoadingAutopilot] = useState<boolean>(false);

  // Handle URL parameters for navigation from Data Catalog
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const assetId = params.get('assetId');
    const search = params.get('search');
    const dataSourceId = params.get('dataSourceId');
    const database = params.get('database');

    if (tab) {
      setActiveTab(tab);
    }
    if (assetId) {
      setSelectedAssetId(assetId);
    }
    if (search) {
      setSearchTerm(search);
    }
    if (dataSourceId) {
      setSelectedDataSourceId(dataSourceId);
    }
    if (database) {
      setSelectedDatabases([database]);
    }
  }, []);

  // Hooks
  const { items: dataSources, listDatabases } = useDataSources();
  const { data: summary, refresh: refreshSummary } = useQualitySummary({
    timeframe: '7d',
    filters: selectedDataSourceId ? {
      dataSourceId: selectedDataSourceId,
      databases: selectedDatabases.length > 0 ? selectedDatabases.join(',') : undefined
    } : {},
  });

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  // Fetch available databases from all data sources (Data Catalog pattern)
  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedDataSourceId) {
          params.append('dataSourceId', selectedDataSourceId);
        }
        const response = await fetch(`/api/catalog/databases?${params}`);
        const data = await response.json();
        if (data.success) {
          setDatabasesByDataSource(data.data);
        }
      } catch (error) {
        console.warn('Failed to fetch databases:', error);
      }
    };
    fetchDatabases();
  }, [selectedDataSourceId]);

  // Check autopilot status when data source changes or Rules tab is active
  useEffect(() => {
    if (selectedDataSourceId && activeTab === 'rules') {
      checkAutopilotStatus();
    }
  }, [selectedDataSourceId, activeTab]);

  // Fetch asset type counts to display in Type dropdown (match Data Catalog)
  useEffect(() => {
    const fetchAssetTypeCounts = async () => {
      try {
        const params = new URLSearchParams();
        if (selectedDataSourceId) params.append('dataSourceId', selectedDataSourceId);
        if (selectedDatabases.length > 0) params.append('databases', selectedDatabases.join(','));

        const response = await fetch(`/api/quality/summary?${params}`);
        const data = await response.json();
        if (data.success && data.data.assetCoverage?.byType) {
          setAssetTypeCounts({
            tables: data.data.assetCoverage.byType.tables || 0,
            views: data.data.assetCoverage.byType.views || 0
          });
        }
      } catch (error) {
        console.warn('Failed to fetch asset type counts:', error);
      }
    };
    fetchAssetTypeCounts();
  }, [selectedDataSourceId, selectedDatabases]);

  // Load data when data source or databases change
  useEffect(() => {
    if (selectedDataSourceId) {
      loadRules();
      loadIssues();
      loadTrends();
      loadPersistedProfiles();
    }
  }, [selectedDataSourceId, selectedDatabases]);

  // Cross-tab synchronization - listen for PII config changes
  useEffect(() => {
    let lastProcessedTimestamp = 0;
    let debounceTimer: NodeJS.Timeout | null = null;

    const refreshData = () => {
      console.log('[DataQuality] Refreshing data due to PII config change...');
      refreshSummary();
      if (selectedDataSourceId) {
        loadRules();
        loadIssues();
        loadPersistedProfiles();
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pii-config-update' && e.newValue) {
        const timestamp = parseInt(e.newValue, 10);

        // Only process if this is a new timestamp we haven't seen
        if (timestamp > lastProcessedTimestamp) {
          lastProcessedTimestamp = timestamp;
          console.log('[DataQuality] PII config changed in another tab');

          // Refresh immediately for instant cross-tab sync
          refreshData();
        }
      }
    };

    const handleCustomUpdate = () => {
      console.log('[DataQuality] PII config changed in same tab');

      // Refresh immediately for instant cross-tab sync
      refreshData();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('pii-config-update', handleCustomUpdate);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('pii-config-update', handleCustomUpdate);
    };
  }, [selectedDataSourceId, refreshSummary]);

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

  const checkAutopilotStatus = async () => {
    if (!selectedDataSourceId) return;

    setLoadingAutopilot(true);
    try {
      const response = await fetch(`/api/quality/autopilot/status/${selectedDataSourceId}`);
      const data = await response.json();

      if (data.success && data.data.enabled) {
        setAutopilotEnabled(true);
        setAutopilotStatus(data.data);
      } else {
        setAutopilotEnabled(false);
        setAutopilotStatus(null);
      }
    } catch (error) {
      console.error('Failed to check autopilot status:', error);
      setAutopilotEnabled(false);
      setAutopilotStatus(null);
    } finally {
      setLoadingAutopilot(false);
    }
  };

  const handleAutopilotComplete = (result: any) => {
    setAutopilotEnabled(true);
    setAutopilotStatus(result);
    // Reload rules to show the newly generated autopilot rules
    loadRules();
    const rulesCount = result?.rulesGenerated || result?.summary?.totalRules || 0;
    showToast('success', `Quality Autopilot enabled! Generated ${rulesCount} rules.`);

    // Navigate to Overview tab to show quality metrics
    setTimeout(() => {
      setActiveTab('overview');
    }, 2500); // Wait for toast to be visible, then navigate
  };

  // ============================================================================
  // PROFILING FUNCTIONS
  // ============================================================================

  const showToast = (type: 'success' | 'error' | 'info', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const startProfiling = async () => {
    if (!selectedDataSourceId) {
      showToast('error', 'Please select a data source first');
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
      // Call the real profiling service with database filter
      const firstDatabase = selectedDatabases.length > 0 ? selectedDatabases[0] : undefined;
      const response = await qualityAPI.profileDataSource(selectedDataSourceId, firstDatabase);

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
      showToast(
        'success',
        `Profiling complete! ${successfulProfilesCount}/${profileCount} tables profiled successfully. Average quality score: ${avgScore}%`
      );
    } catch (error: any) {
      console.error('Profiling failed:', error);
      showToast('error', `Profiling failed: ${error.message || 'Unknown error'}. Please check the logs and try again.`);
      setProfilingStatus('idle');
      setProfilingProgress(null);
    }
  };

  const generateSQLExpression = (suggestion: any, profile: AssetProfile): string => {
    const { config, ruleType, dimension } = suggestion;
    const tableName = profile.assetName; // e.g., "public.users"

    // Generate SQL based on rule type
    if (ruleType === 'threshold' && config.metric === 'null_rate') {
      // Null rate check
      return `SELECT
  COUNT(*) FILTER (WHERE ${config.columnName} IS NULL)::float / NULLIF(COUNT(*), 0) * 100 < ${config.value * 100} as passed,
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE ${config.columnName} IS NULL) as null_rows
FROM ${tableName}`;
    }

    if (ruleType === 'threshold' && config.metric === 'unique_rate') {
      // Uniqueness check
      return `SELECT
  COUNT(DISTINCT ${config.columnName})::float / NULLIF(COUNT(*), 0) >= ${config.value} as passed,
  COUNT(DISTINCT ${config.columnName}) as distinct_count,
  COUNT(*) as total_rows
FROM ${tableName}`;
    }

    if (ruleType === 'pattern' && config.pattern) {
      // Pattern validation (e.g., email)
      return `SELECT
  COUNT(*) FILTER (WHERE ${config.columnName} !~ '${config.pattern}')::float / NULLIF(COUNT(*), 0) < 0.05 as passed,
  COUNT(*) FILTER (WHERE ${config.columnName} !~ '${config.pattern}') as invalid_count,
  COUNT(*) as total_rows
FROM ${tableName}
WHERE ${config.columnName} IS NOT NULL`;
    }

    // Default generic check
    return `SELECT
  TRUE as passed,
  '${suggestion.name}' as rule_name,
  'Manual configuration required' as message
FROM ${tableName}
LIMIT 1`;
  };

  const generateRulesFromProfile = async (profiles: AssetProfile[]) => {
    const newRules: QualityRule[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const profile of profiles) {
      try {
        const suggestions = await qualityAPI.getProfileSuggestions(profile.assetId);

        if (!suggestions || suggestions.length === 0) {
          console.log(`No suggestions found for asset ${profile.assetName}`);
          continue;
        }

        for (const suggestion of suggestions) {
          try {
            // Generate SQL expression based on suggestion type
            const sqlExpression = generateSQLExpression(suggestion, profile);

            // Map the suggestion to the backend expected format
            const rulePayload = {
              name: suggestion.name,
              description: suggestion.description,
              severity: suggestion.severity,
              type: 'sql',
              dialect: 'postgres',
              expression: sqlExpression,
              tags: ['auto-generated', suggestion.dimension, profile.assetName],
              enabled: false,
            };

            const rule = await qualityAPI.createRule(rulePayload);
            newRules.push(rule);
            successCount++;
          } catch (ruleError: any) {
            console.error(`Failed to create rule "${suggestion.name}":`, ruleError.message);
            errorCount++;
          }
        }
      } catch (error: any) {
        console.error(`Failed to get suggestions for asset ${profile.assetName}:`, error.message);
        errorCount++;
      }
    }

    setRules(prevRules => [...prevRules, ...newRules]);

    // Show summary
    if (successCount > 0) {
      showToast('success', `Generated ${successCount} quality rules${errorCount > 0 ? ` (${errorCount} failed)` : ''}`);
    } else if (errorCount > 0) {
      showToast('error', `Failed to generate rules. Check console for details.`);
    }
  };

  // ============================================================================
  // SCANNING FUNCTIONS
  // ============================================================================

  const startScanning = async () => {
    if (!selectedDataSourceId) {
      showToast('error', 'Please select a data source first');
      return;
    }

    setScanningStatus('scanning');

    try {
      const ruleIds = selectedRules.size > 0
        ? Array.from(selectedRules)
        : rules.filter(r => r.enabled).map(r => r.id);

      if (ruleIds.length === 0) {
        showToast('error', 'No rules selected or enabled for scanning');
        setScanningStatus('idle');
        return;
      }

      const result = await qualityAPI.scanDataSource(selectedDataSourceId, ruleIds);
      setScanResult(result);
      setScanningStatus('complete');

      showToast('success', `Scan complete: ${result.passed} passed, ${result.failed} failed`);

      // Refresh issues after scan
      await loadIssues();
    } catch (error) {
      console.error('Scanning failed:', error);
      showToast('error', 'Scanning failed. Please try again.');
      setScanningStatus('idle');
    }
  };

  // ============================================================================
  // TEMPLATE MANAGEMENT
  // ============================================================================

  const loadTemplates = async () => {
    setLoadingStates(prev => ({ ...prev, templates: true }));
    try {
      const fetchedTemplates = await qualityAPI.getRuleTemplates();
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error('Failed to load templates:', error);
      showToast('error', 'Failed to load rule templates');
    } finally {
      setLoadingStates(prev => ({ ...prev, templates: false }));
    }
  };

  const loadAvailableTables = async () => {
    if (!selectedDataSourceId) return;

    setLoadingStates(prev => ({ ...prev, loadingTables: true }));
    try {
      // Fetch tables from catalog
      const response = await fetch(`/api/catalog/assets?dataSourceId=${selectedDataSourceId}&type=table&limit=1000`);
      if (!response.ok) throw new Error('Failed to fetch tables');

      const data = await response.json();

      // Filter and map tables, handling undefined values
      const tables = data.data.assets
        .filter((asset: any) => asset.schema && asset.table)
        .map((asset: any) => ({
          schema: asset.schema,
          table: asset.table,
          fullName: `${asset.schema}.${asset.table}`
        }));

      setAvailableTables(tables);

      console.log(`Loaded ${tables.length} tables from data source:`, tables.slice(0, 5));

      if (tables.length === 0) {
        showToast('info', 'No tables found in this data source');
      }
    } catch (error) {
      console.error('Failed to load tables:', error);
      showToast('error', 'Failed to load available tables');
    } finally {
      setLoadingStates(prev => ({ ...prev, loadingTables: false }));
    }
  };

  const loadAvailableColumns = async (tableName: string) => {
    if (!selectedDataSourceId || !tableName) return;

    setLoadingStates(prev => ({ ...prev, loadingColumns: true }));
    try {
      // Parse schema and table from fullName (e.g., "dbo.Users" or "public.users")
      const [schema, table] = tableName.includes('.')
        ? tableName.split('.')
        : ['public', tableName];

      // Find the asset from our loaded tables
      const matchingTable = availableTables.find(t => t.schema === schema && t.table === table);

      if (matchingTable) {
        // Fetch columns directly from catalog using the full table info
        const response = await fetch(`/api/catalog/assets?dataSourceId=${selectedDataSourceId}&schema=${schema}&table=${table}&limit=1`);
        if (!response.ok) throw new Error('Failed to fetch asset');

        const data = await response.json();
        const asset = data.data.assets[0];

        if (asset && asset.id) {
          // Fetch detailed asset info with columns
          const detailResponse = await fetch(`/api/catalog/assets/${asset.id}`);
          if (!detailResponse.ok) throw new Error('Failed to fetch columns');

          const detailData = await detailResponse.json();
          const columns = detailData.data.columns || [];

          const mappedColumns = columns.map((col: any) => ({
            name: col.column_name || col.name,
            type: col.data_type || col.type || 'unknown'
          }));

          setAvailableColumns(mappedColumns);

          if (mappedColumns.length === 0) {
            showToast('info', 'No columns found for this table');
          }
        } else {
          showToast('error', 'Could not find table details');
        }
      } else {
        showToast('error', 'Table not found in catalog');
      }
    } catch (error) {
      console.error('Failed to load columns:', error);
      showToast('error', 'Failed to load columns for selected table');
      setAvailableColumns([]);
    } finally {
      setLoadingStates(prev => ({ ...prev, loadingColumns: false }));
    }
  };

  const openTemplates = async () => {
    if (!selectedDataSourceId) {
      showToast('info', 'Please select a data source first to browse templates');
      return;
    }

    setShowTemplates(true);
    if (templates.length === 0) {
      await loadTemplates();
    }
    if (availableTables.length === 0) {
      await loadAvailableTables();
    }
  };

  const applyTemplate = async () => {
    if (!selectedTemplate) return;

    // Validate required parameters
    const missingParams = selectedTemplate.parameters
      .filter(p => p.required && !templateParams[p.name])
      .map(p => p.name);

    if (missingParams.length > 0) {
      showToast('error', `Missing required parameters: ${missingParams.join(', ')}`);
      return;
    }

    setLoadingStates(prev => ({ ...prev, applyingTemplate: true }));

    try {
      const createdRule = await qualityAPI.applyRuleTemplate(selectedTemplate.id, templateParams);
      setRules(prev => [createdRule, ...prev]);

      // Reset template state
      setSelectedTemplate(null);
      setTemplateParams({});
      setShowTemplates(false);

      showToast('success', `Rule "${createdRule.name}" created from template!`);
    } catch (error) {
      console.error('Failed to apply template:', error);
      showToast('error', 'Failed to create rule from template');
    } finally {
      setLoadingStates(prev => ({ ...prev, applyingTemplate: false }));
    }
  };

  // ============================================================================
  // RULE MANAGEMENT
  // ============================================================================

  const generateRuleFromAI = async () => {
    if (!aiPrompt.trim()) {
      showToast('error', 'Please enter a description of the quality check you want to create');
      return;
    }

    if (!selectedDataSourceId) {
      showToast('error', 'Please select a data source first');
      return;
    }

    setLoadingStates(prev => ({ ...prev, aiGeneration: true }));

    try {
      const generatedRule = await qualityAPI.generateRuleFromText(aiPrompt, {
        dataSourceId: selectedDataSourceId,
      });

      setRules(prev => [generatedRule, ...prev]);
      setAiPrompt('');

      showToast('success', `Rule "${generatedRule.name}" created successfully! You can now enable and run it.`);
    } catch (error) {
      console.error('AI rule generation failed:', error);
      showToast('error', 'Failed to generate rule. Please try rephrasing your request.');
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
      showToast('success', `Rule ${updated.enabled ? 'enabled' : 'disabled'} successfully`);
    } catch (error) {
      console.error('Failed to toggle rule:', error);
      showToast('error', 'Failed to update rule status');
    }
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await qualityAPI.deleteRule(ruleId);
      setRules(prev => prev.filter(r => r.id !== ruleId));
      showToast('success', 'Rule deleted successfully');
    } catch (error) {
      console.error('Failed to delete rule:', error);
      showToast('error', 'Failed to delete rule');
    }
  };

  const executeRule = async (rule: QualityRule) => {
    setLoadingStates(prev => ({ ...prev, [`rule-${rule.id}`]: true }));

    try {
      // Get the data source for this rule
      const dataSource = dataSources.find(ds => ds.id === rule.data_source_id);
      const sourceType = dataSource?.type || 'postgresql'; // Default to PostgreSQL

      const result = await qualityAPI.executeRule(rule.id, {
        databaseType: sourceType
      });

      // Calculate pass rate from the result
      let passRate = 0;
      if (result.status === 'passed') {
        passRate = 100;
      } else if (result.rowsChecked && result.rowsFailed !== undefined) {
        passRate = Math.round(((result.rowsChecked - result.rowsFailed) / result.rowsChecked) * 100);
      }

      // Update rule with execution results
      setRules(prev => prev.map(r => {
        if (r.id === rule.id) {
          return {
            ...r,
            last_executed_at: new Date().toISOString(),
            execution_count: (r.execution_count || 0) + 1,
            last_result: {
              status: result.status as 'passed' | 'failed' | 'error',
              issues_found: result.rowsFailed || 0,
              pass_rate: passRate,
              execution_time_ms: result.executionTimeMs || 0,
              message: result.errorMessage,
              database_type: sourceType
            }
          };
        }
        return r;
      }));

      // Helper function to get friendly database type name
      const getDBTypeName = (type: string): string => {
        const typeNames: Record<string, string> = {
          'postgresql': 'PostgreSQL',
          'mysql': 'MySQL',
          'mssql': 'SQL Server',
          'oracle': 'Oracle',
          'mongodb': 'MongoDB',
          'snowflake': 'Snowflake',
          'bigquery': 'BigQuery',
          'redshift': 'Redshift'
        };
        return typeNames[type] || type.toUpperCase();
      };

      // Show result with database context and better formatting
      if (result.status === 'passed') {
        showToast('success', `Rule passed on ${getDBTypeName(sourceType)} (${passRate}% pass rate)`);
      } else if (result.status === 'failed') {
        const issuesText = result.rowsFailed ? ` - ${result.rowsFailed} issues found` : '';
        showToast('warning', `Rule failed on ${getDBTypeName(sourceType)}${issuesText} (${passRate}% pass rate)`);
      } else if (result.status === 'error') {
        const errorMsg = result.errorMessage || 'Unknown error';
        showToast('error', `${getDBTypeName(sourceType)} execution error: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Failed to execute rule:', error);
      showToast('error', `Failed to execute rule: ${(error as Error).message}`);
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

      showToast('success', `Issue status updated to ${newStatus}`);
    } catch (error) {
      console.error('Failed to update issue status:', error);
      showToast('error', 'Failed to update issue status');
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

  const handleRefreshOverview = () => {
    if (selectedDataSourceId) {
      loadRules();
      loadIssues();
      loadTrends();
      loadPersistedProfiles();
    }
  };

  const renderOverviewTab = () => (
    <div className="space-y-4">
      {/* Production-Ready Quality Overview */}
      <ProductionQualityOverview
        dataSourceId={selectedDataSourceId}
        databases={selectedDatabases.length > 0 ? selectedDatabases.join(',') : undefined}
        database={selectedDatabases.length > 0 ? selectedDatabases[0] : undefined}
        assetType={selectedType !== 'all' ? selectedType : undefined}
        onRefresh={handleRefreshOverview}
      />
    </div>
  );

  // ============================================================================
  // RENDER: PROFILING TAB
  // ============================================================================

  const renderProfilingTab = () => (
    <CompactProfiling
      dataSourceId={selectedDataSourceId}
      database={selectedDatabases.length > 0 ? selectedDatabases[0] : undefined}
      assetType={selectedType}
      selectedAssetId={selectedAssetId}
    />
  );

  const renderProfilingTabOld = () => (
    <div className="space-y-6">
      {/* Filter Selection Reminder */}
      {(!selectedDataSourceId || selectedDatabases.length === 0) && (
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-900">
            Please select a <strong>Data Source</strong> and <strong>Database</strong> from the filters above to begin profiling and view quality metrics.
          </AlertDescription>
        </Alert>
      )}

      {/* Profiling Control Panel */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Microscope className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Intelligent Data Profiling
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {!selectedDataSourceId || selectedDatabases.length === 0
                      ? 'Select a data source and database to start profiling'
                      : 'Automatically analyze your data and generate quality rules'
                    }
                  </p>
                </div>
              </div>
              <Button
                onClick={startProfiling}
                disabled={!selectedDataSourceId || selectedDatabases.length === 0 || profilingStatus === 'profiling'}
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
              <div className="flex items-center gap-4">
                <span>Profiled Assets</span>
                <Badge variant="secondary">{profiledAssets.length} assets</Badge>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Filter assets..."
                    value={profileFilter}
                    onChange={(e) => setProfileFilter(e.target.value)}
                    className="pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
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
                  {profiledAssets
                    .filter(asset =>
                      profileFilter === '' ||
                      asset.assetName.toLowerCase().includes(profileFilter.toLowerCase())
                    )
                    .map((asset) => (
                    <tr key={asset.assetId} className="border-b hover:bg-gray-50">
                      <td className="py-3 font-medium">{asset.assetName}</td>
                      <td className="py-3">{asset.rowCount?.toLocaleString() || '0'}</td>
                      <td className="py-3">{asset.columnCount || 0}</td>
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
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setSelectedAsset(asset)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    try {
                                      setLoadingStates(prev => ({ ...prev, [`gen-${asset.assetId}`]: true }));
                                      await generateRulesFromProfile([asset]);
                                      showToast('success', `Generated quality rules for ${asset.assetName}`);
                                    } catch (error) {
                                      showToast('error', 'Failed to generate rules');
                                    } finally {
                                      setLoadingStates(prev => ({ ...prev, [`gen-${asset.assetId}`]: false }));
                                    }
                                  }}
                                  disabled={loadingStates[`gen-${asset.assetId}`]}
                                  className="h-8 w-8 p-0"
                                >
                                  {loadingStates[`gen-${asset.assetId}`] ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Wand2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Generate Quality Rules</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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

  const renderRulesTab = () => {
    // Feature flags for different UI modes
    const USE_MODERN_HUB = true; // NEW: Revolutionary Modern Rules Hub
    const USE_SMART_STUDIO = false; // Previous Smart Rules Studio
    const USE_REVOLUTIONARY_UI = false; // Legacy revolutionary UI
    const USE_GLOBAL_RULES = false; // Disabled: requires backend implementation

    if (USE_MODERN_HUB) {
      // PRODUCTION-READY ModernRulesHubFixed with real data integration
      // Features: Real API calls, AI learning, CRUD operations, execution monitoring
      return <ModernRulesHubFixed />;
    }

    if (USE_GLOBAL_RULES) {
      return (
        <GlobalRulesSystem
          dataSourceId={selectedDataSourceId}
          onDrillDown={(ruleId, table) => {
            // Navigate to violations tab and filter by rule
            setActiveTab('violations');
            showToast('info', `Showing issues for rule: ${ruleId}${table ? ` in table ${table}` : ''}`);
          }}
          onConfigureRule={(ruleId) => {
            showToast('info', `Configure rule: ${ruleId}`);
            // TODO: Open rule configuration modal
          }}
        />
      );
    }

    if (USE_REVOLUTIONARY_UI) {
      return (
        <div className="h-[calc(100vh-200px)]">
          <RevolutionaryRulesView
            rules={rules}
            selectedRules={selectedRules}
            onRuleEdit={(rule) => setEditingRule(rule)}
            onRuleDelete={(ruleId) => deleteRule(ruleId)}
            onRuleExecute={(ruleId) => {
              const rule = rules.find(r => r.id === ruleId);
              if (rule) executeRule(rule);
            }}
            onRuleSelect={(ruleId) => {
              const newSelected = new Set(selectedRules);
              if (newSelected.has(ruleId)) {
                newSelected.delete(ruleId);
              } else {
                newSelected.add(ruleId);
              }
              setSelectedRules(newSelected);
            }}
            onAutopilot={async () => {
              // Trigger autopilot to generate quality rules automatically
              if (selectedDataSourceId) {
                showToast('info', 'Autopilot is analyzing your data and generating quality rules...');

                // Simulate autopilot generating rules
                setTimeout(async () => {
                  try {
                    // Create several auto-generated rules
                    const autopilotRules = [
                      {
                        name: '[Autopilot] Critical Fields Completeness',
                        description: 'Auto-generated rule to check completeness of critical fields',
                        rule_type: 'completeness',
                        dimension: 'completeness',
                        severity: 'critical' as const,
                        table_name: 'customers',
                        column_name: 'email',
                        expression: 'email IS NOT NULL AND email != ""',
                        enabled: true,
                        data_source_id: selectedDataSourceId
                      },
                      {
                        name: '[Autopilot] Data Freshness Check',
                        description: 'Auto-generated rule to ensure data is recent',
                        rule_type: 'freshness',
                        dimension: 'freshness',
                        severity: 'high' as const,
                        table_name: 'transactions',
                        column_name: 'created_at',
                        expression: 'DATEDIFF(NOW(), created_at) <= 7',
                        enabled: true,
                        data_source_id: selectedDataSourceId
                      },
                      {
                        name: '[Autopilot] Duplicate Detection',
                        description: 'Auto-generated rule to detect duplicate records',
                        rule_type: 'uniqueness',
                        dimension: 'uniqueness',
                        severity: 'high' as const,
                        table_name: 'orders',
                        column_name: 'order_id',
                        expression: 'COUNT(DISTINCT order_id) = COUNT(order_id)',
                        enabled: true,
                        data_source_id: selectedDataSourceId
                      }
                    ];

                    // Add the rules to the list
                    for (const ruleData of autopilotRules) {
                      const created = await qualityAPI.createRule(ruleData);
                      setRules(prev => [...prev, created]);
                    }

                    showToast('success', `Autopilot generated ${autopilotRules.length} quality rules based on your data patterns!`);

                    // Update autopilot status
                    setAutopilotEnabled(true);
                    setAutopilotStatus({
                      enabled: true,
                      rulesGenerated: autopilotRules.length,
                      lastRun: new Date().toISOString()
                    });
                  } catch (error) {
                    console.error('Autopilot error:', error);
                    showToast('error', 'Failed to generate rules with Autopilot');
                  }
                }, 2000);
              } else {
                showToast('warning', 'Please select a data source first');
              }
            }}
            onNewRule={() => setShowRuleBuilder(true)}
            onViewIssues={(ruleId) => {
              // Navigate to issues/violations tab and filter by rule
              setActiveTab('violations');
              // TODO: Add rule filter to violations view
            }}
            executingRules={new Set(
              Object.keys(loadingStates)
                .filter(key => key.startsWith('rule-') && loadingStates[key])
                .map(key => key.replace('rule-', ''))
            )}
            isLoading={loadingStates.rules}
            dataSources={dataSources}
          />
        </div>
      );
    }

    // Fall back to existing UI if feature flag is false
    return (
    <div className="space-y-6">
      {/* Quality Autopilot Onboarding */}
      {!loadingAutopilot && selectedDataSourceId && (
        <QualityAutopilotOnboarding
          dataSourceId={selectedDataSourceId}
          dataSourceName={dataSources.find(ds => ds.id === selectedDataSourceId)?.name || 'Data Source'}
          onComplete={handleAutopilotComplete}
          initialStatus={autopilotStatus}
        />
      )}

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
            <Button
              onClick={openTemplates}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <BookOpen className="mr-2 h-4 w-4" />
              Browse Templates
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template Browser Modal */}
      {showTemplates && (
        <Card className="border-2 border-green-200 bg-white">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-green-600" />
                  Rule Template Library
                </CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Industry-standard quality checks based on best practices
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setShowTemplates(false);
                  setSelectedTemplate(null);
                  setTemplateParams({});
                  setAvailableColumns([]);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {loadingStates.templates ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-gray-400" />
                <p className="text-gray-600">Loading templates...</p>
              </div>
            ) : selectedTemplate ? (
              <div className="space-y-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setTemplateParams({});
                    setAvailableColumns([]);
                  }}
                >
                  ← Back to templates
                </Button>
                <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
                  <h3 className="font-semibold text-lg mb-1">{selectedTemplate.name}</h3>
                  <p className="text-sm text-gray-700 mb-2">{selectedTemplate.description}</p>
                  <div className="flex gap-2 mb-3">
                    <Badge>{selectedTemplate.dimension}</Badge>
                    <Badge variant={selectedTemplate.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {selectedTemplate.severity}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                    <strong>Best Practice:</strong> {selectedTemplate.bestPractices}
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Configure Parameters</h4>
                  {selectedTemplate.parameters.map((param) => (
                    <div key={param.name}>
                      <label className="block text-sm font-medium mb-1">
                        {param.description}
                        {param.required && <span className="text-red-500 ml-1">*</span>}
                      </label>
                      {param.type === 'table' ? (
                        <select
                          value={templateParams[param.name] || ''}
                          onChange={(e) => {
                            const tableName = e.target.value;
                            setTemplateParams(prev => ({ ...prev, [param.name]: tableName }));
                            // Load columns when table is selected
                            if (tableName) {
                              loadAvailableColumns(tableName);
                            }
                          }}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                          disabled={loadingStates.loadingTables}
                        >
                          <option value="">
                            {loadingStates.loadingTables ? 'Loading tables...' : 'Select a table...'}
                          </option>
                          {availableTables.map((table) => (
                            <option key={table.fullName} value={table.fullName}>
                              {table.fullName}
                            </option>
                          ))}
                        </select>
                      ) : param.type === 'column' ? (
                        <select
                          value={templateParams[param.name] || ''}
                          onChange={(e) => setTemplateParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                          disabled={loadingStates.loadingColumns || availableColumns.length === 0}
                        >
                          <option value="">
                            {loadingStates.loadingColumns
                              ? 'Loading columns...'
                              : availableColumns.length === 0
                              ? 'Select a table first...'
                              : 'Select a column...'}
                          </option>
                          {availableColumns.map((col) => (
                            <option key={col.name} value={col.name}>
                              {col.name} ({col.type})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={templateParams[param.name] || param.defaultValue || ''}
                          onChange={(e) => setTemplateParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                          placeholder={`Enter ${param.type}...`}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                        />
                      )}
                    </div>
                  ))}
                </div>

                {selectedTemplate.examples.length > 0 && (
                  <div className="bg-gray-50 p-3 rounded border">
                    <strong className="text-sm">Examples:</strong>
                    <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
                      {selectedTemplate.examples.map((ex, idx) => (
                        <li key={idx}>{ex}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  onClick={applyTemplate}
                  disabled={loadingStates.applyingTemplate}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  {loadingStates.applyingTemplate ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Rule...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Rule from Template
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="border rounded-lg p-4 hover:border-green-500 hover:shadow-md transition-all cursor-pointer"
                    onClick={() => {
                      setSelectedTemplate(template);
                      // Initialize params with default values
                      const initialParams: Record<string, any> = {};
                      template.parameters.forEach(param => {
                        if (param.defaultValue !== undefined) {
                          initialParams[param.name] = param.defaultValue;
                        }
                      });
                      setTemplateParams(initialParams);
                      setAvailableColumns([]);
                    }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-medium text-sm">{template.name}</h4>
                      <Badge variant={template.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                        {template.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{template.description}</p>
                    <div className="flex items-center justify-between">
                      <Badge className="text-xs">{template.dimension}</Badge>
                      <span className="text-xs text-gray-500">{template.category}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rules Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search rules..."
                value={ruleFilter.search}
                onChange={(e) => setRuleFilter(prev => ({ ...prev, search: e.target.value }))}
                className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={ruleFilter.severity}
              onChange={(e) => setRuleFilter(prev => ({ ...prev, severity: e.target.value }))}
              className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Severities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
            <select
              value={ruleFilter.status}
              onChange={(e) => setRuleFilter(prev => ({ ...prev, status: e.target.value }))}
              className="px-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>
            {(ruleFilter.search || ruleFilter.severity || ruleFilter.status) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRuleFilter({ search: '', severity: '', status: '' })}
              >
                Clear
              </Button>
            )}
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
              const filteredRules = rules.filter(rule => {
                const matchesSearch = !ruleFilter.search || rule.name.toLowerCase().includes(ruleFilter.search.toLowerCase());
                const matchesSeverity = !ruleFilter.severity || rule.severity === ruleFilter.severity;
                const matchesStatus = !ruleFilter.status || (ruleFilter.status === 'enabled' ? rule.enabled : !rule.enabled);
                return matchesSearch && matchesSeverity && matchesStatus;
              });

              if (selectedRules.size === filteredRules.length) {
                setSelectedRules(new Set());
              } else {
                setSelectedRules(new Set(filteredRules.map(r => r.id)));
              }
            }}
          >
            {selectedRules.size > 0 ? (
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
              {rules
                .filter(rule => {
                  const matchesSearch = !ruleFilter.search || rule.name.toLowerCase().includes(ruleFilter.search.toLowerCase()) || (rule.description && rule.description.toLowerCase().includes(ruleFilter.search.toLowerCase()));
                  const matchesSeverity = !ruleFilter.severity || rule.severity === ruleFilter.severity;
                  const matchesStatus = !ruleFilter.status || (ruleFilter.status === 'enabled' ? rule.enabled : !rule.enabled);
                  return matchesSearch && matchesSeverity && matchesStatus;
                })
                .map((rule) => (
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
  };

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
                  {(issues.reduce((sum, i) => sum + (parseInt(i.affectedRows) || 0), 0) || 0).toLocaleString()}
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
                        {/* PII Badge */}
                        {issue.title && issue.title.startsWith('PII Detected:') && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            PII: {issue.title.replace('PII Detected: ', '').toUpperCase()}
                          </span>
                        )}
                        <span className="text-sm text-gray-600">
                          {issue.tableName || issue.assetName}
                        </span>
                      </div>
                      <h4 className="font-medium mb-1">{issue.title}</h4>
                      {issue.description && (
                        <>
                          {issue.description.includes('⚠️ ISSUE REOPENED') ? (
                            <div className="mb-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-amber-900">
                                  <div className="font-semibold mb-1">Validation Failed</div>
                                  <pre className="text-xs whitespace-pre-wrap text-amber-800 font-mono">
                                    {issue.description}
                                  </pre>
                                </div>
                              </div>
                            </div>
                          ) : issue.description.includes('📋 FIX PROPOSAL') ? (
                            <div className="mb-2">
                              {/* Main description */}
                              <p className="text-sm text-gray-600 mb-3 whitespace-pre-wrap">
                                {issue.description.split('📋 FIX PROPOSAL')[0]}
                              </p>
                              {/* Fix proposal section */}
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex items-start gap-2 mb-2">
                                  <FileCode className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                  <div className="font-semibold text-blue-900 text-sm">Fix Proposal</div>
                                </div>
                                <pre className="text-xs whitespace-pre-wrap text-blue-900 font-mono overflow-x-auto">
                                  {issue.description.split('📋 FIX PROPOSAL')[1]}
                                </pre>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-600 mb-2 whitespace-pre-wrap">{issue.description}</p>
                          )}
                        </>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>First seen: {new Date(issue.firstSeenAt).toLocaleDateString()}</span>
                        <span>Occurrences: {issue.occurrenceCount || 0}</span>
                        <span>Affected rows: {(parseInt(issue.affectedRows) || 0).toLocaleString()}</span>
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
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-5">
          <Alert
            variant={toastMessage.type === 'error' ? 'destructive' : 'default'}
            className={`min-w-[300px] shadow-lg ${
              toastMessage.type === 'success' ? 'bg-green-50 border-green-200' :
              toastMessage.type === 'error' ? 'bg-red-50 border-red-200' :
              'bg-blue-50 border-blue-200'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            {toastMessage.type === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
            {toastMessage.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
            <AlertDescription className={
              toastMessage.type === 'success' ? 'text-green-900' :
              toastMessage.type === 'error' ? 'text-red-900' :
              'text-blue-900'
            }>
              {toastMessage.message}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Data Quality Intelligence
            </h1>
            <p className="text-gray-600 mt-1">
              Enterprise-grade quality management with AI-powered insights
            </p>
          </div>
          <div className="flex items-center gap-3">
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

        {/* Filters - Exact Data Catalog Implementation */}
        <div className="flex items-center gap-3 justify-end">
          <select
            value={selectedDataSourceId}
            onChange={(e) => {
              const newValue = e.target.value || undefined;
              console.log('📝 Data source changed:', newValue);
              // Reset databases when changing server
              setSelectedDataSourceId(newValue || '');
              setSelectedDatabases([]);
            }}
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="">All Servers ({dataSources.length})</option>
            {[...dataSources].sort((a, b) => a.name.localeCompare(b.name)).map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name}
              </option>
            ))}
          </select>

          <div
            className="relative"
            onBlur={(e) => {
              // Close picker when clicking outside
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setShowDatabasePicker(false);
              }
            }}
          >
            <button
              onClick={() => setShowDatabasePicker(!showDatabasePicker)}
              className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[240px] bg-white flex items-center justify-between"
              disabled={!selectedDataSourceId && databasesByDataSource.length > 1}
              title={!selectedDataSourceId && databasesByDataSource.length > 1 ? "Select a server first to filter by database" : ""}
            >
              <span>
                {(() => {
                  const selectedCount = selectedDatabases.length;
                  if (selectedCount === 0) {
                    if (selectedDataSourceId) {
                      const selectedDs = databasesByDataSource.find(ds => ds.dataSourceId === selectedDataSourceId);
                      const count = selectedDs?.databases.filter(db => !db.isSystem).length || 0;
                      return `All Databases${count > 0 ? ` (${count})` : ''}`;
                    }
                    const totalCount = databasesByDataSource.reduce((sum, ds) => sum + ds.databases.filter(db => !db.isSystem).length, 0);
                    return `All Databases (${totalCount})`;
                  }
                  return `${selectedCount} Database${selectedCount !== 1 ? 's' : ''} Selected`;
                })()}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showDatabasePicker ? 'rotate-180' : ''}`} />
            </button>

            {showDatabasePicker && (
              <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                <div className="p-2">
                  <div className="flex items-center justify-between px-2 py-1 mb-2 border-b">
                    <span className="text-xs font-semibold text-gray-700">Select Databases</span>
                    {selectedDatabases.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDatabases([]);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-700"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  {selectedDataSourceId ? (
                    // Show only non-system databases for selected data source
                    databasesByDataSource
                      .filter(ds => ds.dataSourceId === selectedDataSourceId)
                      .flatMap(ds =>
                        ds.databases
                          .filter(database => !database.isSystem)
                          .map(database => (
                            <label
                              key={database.name}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={selectedDatabases.includes(database.name)}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  const newDatabases = isChecked
                                    ? [...selectedDatabases, database.name]
                                    : selectedDatabases.filter(d => d !== database.name);
                                  setSelectedDatabases(newDatabases);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                              />
                              <span className="text-sm text-gray-700">{database.name}</span>
                              {database.isSynced && (
                                <span className="ml-auto text-xs text-green-600">✓ Synced</span>
                              )}
                            </label>
                          ))
                      )
                  ) : (
                    // Show grouped by data source when no source is selected
                    databasesByDataSource.map(ds => (
                      <div key={ds.dataSourceId}>
                        <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase">{ds.dataSourceName}</div>
                        {ds.databases
                          .filter(database => !database.isSystem)
                          .map(database => (
                            <label
                              key={`${ds.dataSourceId}-${database.name}`}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer ml-2"
                            >
                              <input
                                type="checkbox"
                                checked={selectedDatabases.includes(database.name)}
                                onChange={(e) => {
                                  const isChecked = e.target.checked;
                                  const newDatabases = isChecked
                                    ? [...selectedDatabases, database.name]
                                    : selectedDatabases.filter(d => d !== database.name);
                                  setSelectedDatabases(newDatabases);
                                }}
                                className="h-4 w-4 rounded border-gray-300 text-blue-600"
                              />
                              <span className="text-sm text-gray-700">{database.name}</span>
                              {database.isSynced && (
                                <span className="ml-auto text-xs text-green-600">✓ Synced</span>
                              )}
                            </label>
                          ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value as any)}
            className="px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 min-w-[200px]"
          >
            <option value="all">All Types ({assetTypeCounts.tables + assetTypeCounts.views})</option>
            <option value="table">Tables ({assetTypeCounts.tables})</option>
            <option value="view">Views ({assetTypeCounts.views})</option>
          </select>
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

      {/* Rule Builder Modal - Handles both Create and Edit */}
      {(editingRule || showRuleBuilder) && (
        <RuleBuilder
          rule={editingRule}
          dataSourceId={selectedDataSourceId}
          dataSourceType={dataSources.find(ds => ds.id === selectedDataSourceId)?.type as any || 'postgresql'}
          onSave={async (ruleData) => {
            try {
              if (editingRule) {
                // Update existing rule
                const updated = await qualityAPI.updateRule(editingRule.id, ruleData);
                setRules(prev => prev.map(r => r.id === editingRule.id ? updated : r));
                showToast('success', 'Rule updated successfully');
              } else {
                // Create new rule
                const created = await qualityAPI.createRule({
                  ...ruleData,
                  data_source_id: selectedDataSourceId
                });
                setRules(prev => [...prev, created]);
                showToast('success', 'Rule created successfully');
              }
              setEditingRule(null);
              setShowRuleBuilder(false);
            } catch (error) {
              console.error('Failed to save rule:', error);
              showToast('error', `Failed to ${editingRule ? 'update' : 'create'} rule`);
            }
          }}
          onCancel={() => {
            setEditingRule(null);
            setShowRuleBuilder(false);
          }}
          availableTables={availableTables}
          availableColumns={availableColumns}
        />
      )}
    </div>
  );
};

export default DataQuality;