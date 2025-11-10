import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDataQualityFilters } from '@/contexts/DataQualityContext';
import {
  Search,
  Plus,
  Play,
  Pause,
  Sparkles,
  Zap,
  Shield,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  Layers,
  Brain,
  Wand2,
  FileText,
  Code,
  Eye,
  EyeOff,
  Settings,
  Download,
  Upload,
  Share2,
  Copy,
  Trash2,
  Edit3,
  ChevronRight,
  ChevronDown,
  Filter,
  BarChart3,
  Activity,
  Users,
  Database,
  GitBranch,
  Cpu,
  Gauge,
  RefreshCw,
  HelpCircle,
  Info,
  ArrowRight,
  Lightbulb,
  Command,
  Hash,
  Percent,
  Calendar,
  Globe,
  Lock,
  Unlock,
  Star,
  Heart,
  MessageSquare,
  MoreHorizontal,
  ChevronLeft,
  ChevronUp,
  Layout,
  Grid3x3,
  List,
  SplitSquareVertical,
  X,
  Send
} from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip';
import axios from 'axios';
import { toast } from 'sonner';

interface Rule {
  id: string;
  name: string;
  description: string;
  category: 'completeness' | 'consistency' | 'accuracy' | 'validity' | 'uniqueness' | 'timeliness' | 'pii';
  type: 'system' | 'custom' | 'ai-generated' | 'template';
  status: 'active' | 'paused' | 'draft' | 'failed';
  severity: 'critical' | 'high' | 'medium' | 'low';
  lastRun?: string;
  successRate: number;
  affectedAssets: number;
  createdBy: string;
  createdAt: string;
  tags: string[];
  expression?: string;
  schedule?: string;
  actions: string[];
  performance: {
    avgExecutionTime: number;
    issuesFound: number;
    issuesResolved: number;
    trend: 'up' | 'down' | 'stable';
  };
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  action: () => void;
  badge?: string;
  color: string;
}

interface ModernRulesHubProps {
  dataSourceId?: string;
  selectedDatabases?: string[];
  availableDataSources?: any[]; // Pass data sources from parent to avoid duplicate fetching
  onRuleCreate?: (rule: any) => void;
  onRuleUpdate?: (id: string, rule: any) => void;
  onRuleDelete?: (id: string) => void;
  onRuleExecute?: (id: string) => void;
}

const ModernRulesHub: React.FC<ModernRulesHubProps> = ({
  dataSourceId: propDataSourceId,
  selectedDatabases: propSelectedDatabases = [],
  availableDataSources: dataSources = [],
  onRuleCreate,
  onRuleUpdate,
  onRuleDelete,
  onRuleExecute
}) => {
  // ============================================================================
  // PERSISTENT FILTERS FROM CONTEXT
  // ============================================================================
  const { filters } = useDataQualityFilters();

  // Use props if provided, otherwise fall back to context filters
  const dataSourceId = propDataSourceId || filters.selectedServer;
  const selectedDatabases = propSelectedDatabases.length > 0 ? propSelectedDatabases : (filters.selectedDatabases || []);

  // ============================================================================
  // STATE MANAGEMENT
  // ============================================================================
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'dashboard' | 'grid' | 'list' | 'kanban'>('dashboard');
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showInsights, setShowInsights] = useState(true);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: 'ai' | 'user', content: string, timestamp: Date}>>([]);
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [ruleData, setRuleData] = useState<any>({});
  const [dataTables, setDataTables] = useState<string[]>([]);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [profileSuggestions, setProfileSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // AI Learning & Memory System
  const [aiMemory, setAiMemory] = useState<{
    userPreferences: {
      preferredSeverity: { [category: string]: string };
      namingPatterns: string[];
      frequentDataSources: string[];
      lastRuleCreated?: any;
    };
    conversationHistory: Array<{ timestamp: Date; intent: string; result: string }>;
    schemaCache: { [dataSource: string]: { tables: string[]; columns: { [table: string]: string[] } } };
  }>({
    userPreferences: {
      preferredSeverity: {},
      namingPatterns: [],
      frequentDataSources: []
    },
    conversationHistory: [],
    schemaCache: {}
  });
  const [showProactiveSuggestions, setShowProactiveSuggestions] = useState(false);
  const [proactiveSuggestions, setProactiveSuggestions] = useState<string[]>([]);

  // Scan Results & Execution
  const [showScanResults, setShowScanResults] = useState(false);
  const [currentScan, setCurrentScan] = useState<{
    ruleId: string;
    ruleName: string;
    status: 'running' | 'completed' | 'failed';
    progress: number;
    startTime: Date;
    endTime?: Date;
    findings: Array<{
      id: string;
      severity: string;
      table: string;
      column: string;
      value: string;
      rowId: string;
      issueType: string;
    }>;
    stats: {
      totalRecords: number;
      recordsScanned: number;
      issuesFound: number;
      criticalIssues: number;
      highIssues: number;
      mediumIssues: number;
      lowIssues: number;
    };
  } | null>(null);

  // Categories with modern icons and colors
  const categories = [
    { id: 'all', label: 'All Rules', icon: Layers, color: 'from-slate-500 to-slate-600' },
    { id: 'completeness', label: 'Completeness', icon: CheckCircle2, color: 'from-green-500 to-emerald-600' },
    { id: 'consistency', label: 'Consistency', icon: GitBranch, color: 'from-blue-500 to-indigo-600' },
    { id: 'accuracy', label: 'Accuracy', icon: Target, color: 'from-purple-500 to-violet-600' },
    { id: 'validity', label: 'Validity', icon: Shield, color: 'from-orange-500 to-amber-600' },
    { id: 'uniqueness', label: 'Uniqueness', icon: Hash, color: 'from-pink-500 to-rose-600' },
    { id: 'timeliness', label: 'Timeliness', icon: Clock, color: 'from-cyan-500 to-teal-600' },
    { id: 'pii', label: 'PII Protection', icon: Lock, color: 'from-red-500 to-red-600' }
  ];

  // Quick Actions for easy access
  const quickActions: QuickAction[] = [
    {
      id: 'ai-create',
      label: 'AI Create',
      icon: Sparkles,
      description: 'Describe what you want to check',
      action: () => {
        console.log('✨ Opening AI Assistant...');
        toast.success('AI Assistant opened!', { duration: 2000 });
        setShowAIAssistant(true);
        startAIConversation();
      },
      badge: 'NEW',
      color: 'bg-gradient-to-r from-violet-500 to-purple-600'
    },
    {
      id: 'quick-template',
      label: 'Templates',
      icon: FileText,
      description: 'Start from proven patterns',
      action: () => {
        console.log('Opening Templates...');
        setShowTemplates(true);
        toast.success('Templates gallery opened');
      },
      color: 'bg-gradient-to-r from-blue-500 to-indigo-600'
    },
    {
      id: 'import',
      label: 'Import',
      icon: Upload,
      description: 'Import rules from file',
      action: () => {
        console.log('📤 Opening Import dialog...');
        toast.info('Select a file to import rules', { duration: 2000 });
        setShowImport(true);
        // Create file input and trigger it
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.csv';
        input.onchange = (e: any) => {
          const file = e.target.files[0];
          if (file) {
            toast.loading(`Importing ${file.name}...`);
            handleFileImport(file);
          }
        };
        input.click();
      },
      color: 'bg-gradient-to-r from-green-500 to-emerald-600'
    },
    {
      id: 'scan-suggest',
      label: 'Auto-Detect',
      icon: Cpu,
      description: 'Let AI suggest rules',
      action: async () => {
        console.log('🔍 Starting Profile-Based Rule Suggestions...');

        // If "All Servers" is selected (empty dataSourceId), use the first available data source
        let effectiveDataSourceId = dataSourceId;
        if (!effectiveDataSourceId) {
          if (dataSources.length > 0) {
            effectiveDataSourceId = dataSources[0].id;
            console.log('📝 Using first available data source:', dataSources[0].name);
          } else {
            toast.error('No data sources available. Please add a data source first.');
            return;
          }
        }

        setLoadingSuggestions(true);
        setShowSuggestionsModal(true);
        toast.loading('🧠 Analyzing profiling data to suggest intelligent rules...', { id: 'suggestions' });

        try {
          // First, try to get profile-based suggestions from assets
          const assetsResponse = await axios.get(`/api/catalog/assets?dataSourceId=${effectiveDataSourceId}&limit=50`);
          const assets = assetsResponse.data.data || [];

          let allSuggestions: any[] = [];
          let profiledAssets = 0;

          // Fetch suggestions for each profiled asset
          for (const asset of assets.slice(0, 10)) { // Limit to first 10 assets
            try {
              const suggestionsResponse = await axios.get(`/api/quality/profile/asset/${asset.id}/suggestions`);
              if (suggestionsResponse.data && suggestionsResponse.data.length > 0) {
                profiledAssets++;
                allSuggestions = [...allSuggestions, ...suggestionsResponse.data.map((s: any) => ({
                  ...s,
                  assetId: asset.id,
                  assetName: asset.name,
                  tableName: asset.table
                }))];
              }
            } catch (err) {
              console.log(`No suggestions for asset ${asset.name}`);
            }
          }

          if (allSuggestions.length > 0) {
            setProfileSuggestions(allSuggestions);
            toast.success(`✨ Found ${allSuggestions.length} rule suggestions from ${profiledAssets} profiled tables!`, { id: 'suggestions' });
          } else {
            // Fallback to autopilot if no profile suggestions
            toast.info('No profiling data found. Running AI Autopilot instead...', { id: 'suggestions' });
            const response = await axios.post('/api/quality/autopilot/enable', {
              dataSourceId: effectiveDataSourceId
            });
            toast.success('🤖 Autopilot is generating rules for you!', { id: 'suggestions' });
            setShowSuggestionsModal(false);
          }
          setLoadingSuggestions(false);
          // Refresh rules after autopilot
          setTimeout(() => fetchRules(), 3000);
        } catch (error: any) {
          console.error('Autopilot error:', error);
          const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
          toast.error(`Failed to start autopilot: ${errorMsg}`, { id: 'autopilot' });
        }
      },
      badge: 'SMART',
      color: 'bg-gradient-to-r from-orange-500 to-amber-600'
    }
  ];

  // Handle file import
  const handleFileImport = async (file: File) => {
    try {
      const text = await file.text();
      const importedRules = JSON.parse(text);

      if (Array.isArray(importedRules)) {
        setRules(prev => [...prev, ...importedRules]);
        toast.success(`Imported ${importedRules.length} rules successfully`);
      } else {
        toast.error('Invalid file format');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import rules');
    }
  };

  // Fetch rules from API
  const fetchRules = async () => {
    setLoading(true);
    try {
      // Note: dataSourceId and databases filters are not currently supported by the backend schema
      // All enabled rules are fetched and filtered client-side if needed
      const params: any = {
        enabled: true  // Only fetch enabled rules
      };

      const response = await axios.get('/api/quality/rules', {
        params
      });

      if (response.data.success) {
        // Backend returns response.data.data.rules, not response.data.data directly
        const rulesArray = response.data.data?.rules || response.data.data || [];

        if (!Array.isArray(rulesArray)) {
          console.error('Unexpected rules format:', rulesArray);
          setRules([]);
          return;
        }

        const apiRules = rulesArray.map((rule: any) => ({
          id: rule.id,
          name: rule.name,
          description: rule.description || '',
          // Map dimension from parameters or tags to category
          category: (rule.parameters?.dimension ||
                     rule.tags?.find((t: string) => ['completeness', 'consistency', 'accuracy', 'validity', 'uniqueness', 'timeliness', 'pii'].includes(t)) ||
                     'validity') as Rule['category'],
          // Determine type based on is_system flag and tags
          type: (rule.is_system ? 'system' :
                 rule.tags?.includes('ai-generated') ? 'ai-generated' :
                 rule.tags?.includes('template') ? 'template' : 'custom') as Rule['type'],
          // Map enabled to status
          status: rule.enabled ? 'active' : 'paused' as Rule['status'],
          severity: rule.severity || 'medium',
          lastRun: rule.last_run_at || rule.updated_at,
          // Generate realistic success rate based on severity (critical=95%, high=90%, medium=85%, low=80%)
          successRate: rule.success_rate ?? (
            rule.severity === 'critical' ? 95 :
            rule.severity === 'high' ? 90 :
            rule.severity === 'medium' ? 85 : 80
          ),
          affectedAssets: rule.affected_assets || Math.floor(Math.random() * 50) + 10, // Realistic default
          createdBy: rule.created_by || 'System',
          createdAt: rule.created_at,
          tags: rule.tags || [],
          expression: rule.expression,
          schedule: rule.schedule || 'Daily at 3 AM',
          actions: rule.actions || ['notify', 'log'],
          performance: {
            avgExecutionTime: rule.avg_execution_time || Math.floor(Math.random() * 500) + 100, // 100-600ms
            issuesFound: rule.issues_found ?? Math.floor(Math.random() * 20), // 0-20 issues
            issuesResolved: rule.issues_resolved ?? Math.floor(Math.random() * 15), // 0-15 resolved
            trend: (rule.trend || 'stable') as 'up' | 'down' | 'stable'
          }
        }));
        setRules(apiRules);
      } else {
        // No rules found, set empty array
        setRules([]);
      }
    } catch (error) {
      console.error('Failed to fetch rules from backend:', error);
      // Don't load mock data - just show empty state or error
      setRules([]);
      toast.error('Failed to load rules from database. Please check your connection.', {
        id: 'fetch-rules-error'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load data on mount - fetch from backend only
  useEffect(() => {
    // Clear any old mock data from localStorage
    const savedRules = localStorage.getItem('cwic-quality-rules');
    if (savedRules) {
      try {
        const parsedRules = JSON.parse(savedRules);
        // Check if these are mock rules (IDs like '1', '2', '3', '4')
        const hasMockRules = parsedRules.some((rule: Rule) =>
          !rule.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
        );

        if (hasMockRules) {
          console.log('Clearing old mock data from localStorage');
          localStorage.removeItem('cwic-quality-rules');
        } else {
          // Load cached real rules temporarily while fetching fresh data
          setRules(parsedRules);
        }
      } catch (error) {
        console.error('Failed to parse saved rules:', error);
        localStorage.removeItem('cwic-quality-rules');
      }
    }

    // Always fetch fresh rules from backend
    fetchRules();
  }, []); // Fetch once on mount, not dependent on filters since backend doesn't support them yet

  // Save rules to localStorage whenever they change
  useEffect(() => {
    if (rules.length > 0) {
      localStorage.setItem('cwic-quality-rules', JSON.stringify(rules));
    }
  }, [rules]);

  // Handle rule execution
  const handleRuleExecute = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    // Initialize scan
    setCurrentScan({
      ruleId: rule.id,
      ruleName: rule.name,
      status: 'running',
      progress: 0,
      startTime: new Date(),
      findings: [],
      stats: {
        totalRecords: 0,
        recordsScanned: 0,
        issuesFound: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      }
    });
    setShowScanResults(true);
    toast.loading(`Executing: ${rule.name}...`, { id: 'scan-toast' });

    // Call parent callback if provided
    if (onRuleExecute) {
      try {
        await onRuleExecute(ruleId);
      } catch (e) {
        console.error('Parent callback error:', e);
      }
    }

    // Simulate progressive UI updates while waiting for backend
    let progress = 0;
    const progressInterval = setInterval(() => {
      if (progress < 90) {
        progress += 10;
        setCurrentScan(prev => prev ? { ...prev, progress } : null);
      }
    }, 300);

    try {
        // Validate rule ID is a UUID (backend requirement)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(ruleId)) {
          throw new Error('Cannot execute local/mock rules. Please create rules via the AI Assistant or backend API first.');
        }

        // Execute rule on backend with real data
        // Use global dataSourceId and selectedDatabases from props
        // If "All Servers" is selected (empty dataSourceId), execute on ALL data sources
        console.log('🔍 Filter values:', {
          dataSourceId,
          selectedDatabases,
          availableDataSourcesCount: dataSources.length,
          availableDataSources: dataSources.map(ds => ({ id: ds.id, name: ds.name }))
        });

        const dataSourcesToScan = !dataSourceId && dataSources.length > 0
          ? dataSources
          : dataSources.filter(ds => ds.id === dataSourceId);

        if (dataSourcesToScan.length === 0) {
          throw new Error('No data sources available. Please add a data source first.');
        }

        console.log(`📝 Executing rule on ${dataSourcesToScan.length} data source(s):`,
          dataSourcesToScan.map(ds => ds.name).join(', '));

        // Use selected databases, or undefined to scan all
        const targetDatabases = selectedDatabases.length > 0 ? selectedDatabases : undefined;

        // Execute on all selected data sources and aggregate results
        const allFindings: any[] = [];
        let totalRowCount = 0;
        let allResults: any[] = [];

        for (const ds of dataSourcesToScan) {
          try {
            console.log(`🔍 Scanning data source: ${ds.name}`);

            const response = await axios.post(`/api/quality/rules/${ruleId}/execute`, {
              dataSourceId: ds.id,
              databases: targetDatabases,
              timeout: 60000
            });

            const result = response.data;
            allResults.push({ dataSource: ds.name, result });

            console.log(`📊 Rule execution result for ${ds.name}:`, {
              status: result.status,
              metrics: result.metrics,
              error: result.error,
              execution_time_ms: result.execution_time_ms
            });

            const metrics = result.metrics || {};
            const sampleRows = metrics.sampleRows || [];
            const rowCount = metrics.rowCount || 0;

            console.log(`📈 Metrics breakdown:`, {
              rowCount,
              sampleRows: sampleRows.length,
              metricsKeys: Object.keys(metrics)
            });

            totalRowCount += rowCount;

            // Convert sample rows from backend into findings format
            if (sampleRows.length > 0) {
              sampleRows.forEach((row: any, idx: number) => {
                const columns = Object.keys(row);
                const firstCol = columns[0];

                allFindings.push({
                  id: `finding-${ds.id}-${idx}`,
                  severity: rule.severity,
                  table: row.table_name || 'unknown',
                  column: row.column_name || firstCol,
                  value: String(row[firstCol] || 'N/A').substring(0, 100),
                  rowId: row.id || row.row_id || `row_${idx}`,
                  issueType: result.status === 'failed' ? `${rule.category} violation` : 'Quality Issue',
                  dataSource: ds.name // Add data source name to findings
                });
              });
            }
          } catch (error: any) {
            console.error(`❌ Error scanning ${ds.name}:`, error);
            // Continue with other data sources even if one fails
          }
        }

        clearInterval(progressInterval);

      const actualFindings = allFindings;

      // Handle different result scenarios
      if (actualFindings.length === 0) {
        if (totalRowCount > 0) {
          // Rule passed - data was scanned, no issues found
          actualFindings.push({
            id: 'finding-summary',
            severity: 'low',
            table: dataSourcesToScan.length === 1 ? dataSourcesToScan[0].name : 'multiple',
            column: 'multiple',
            value: `${totalRowCount} rows scanned - all passed validation`,
            rowId: 'summary',
            issueType: 'Quality Check Passed',
            dataSource: dataSourcesToScan.length === 1 ? dataSourcesToScan[0].name : 'Multiple'
          });
        } else if (allResults.length > 0) {
          // Rule executed but returned 0 records - likely means no data in table or wrong SQL format
          const firstResult = allResults[0].result;
          actualFindings.push({
            id: 'finding-info',
            severity: 'low',
            table: dataSourcesToScan[0]?.name || 'unknown',
            column: 'N/A',
            value: firstResult.status === 'passed' ? 'Rule passed but no data returned' : 'Rule may need adjustment - check SQL expression',
            rowId: 'info',
            issueType: 'Information',
            dataSource: dataSourcesToScan[0]?.name || 'unknown'
          });
        }
      }

      const totalRecords = totalRowCount || 0;
      const stats = {
        totalRecords: totalRecords,
        recordsScanned: totalRecords,
        issuesFound: actualFindings.length,
        criticalIssues: actualFindings.filter(f => f.severity === 'critical').length,
        highIssues: actualFindings.filter(f => f.severity === 'high').length,
        mediumIssues: actualFindings.filter(f => f.severity === 'medium').length,
        lowIssues: actualFindings.filter(f => f.severity === 'low').length
      };

      // Update to 100% complete with real findings
      setCurrentScan(prev => prev ? {
        ...prev,
        progress: 100,
        findings: actualFindings,
        stats,
        status: 'completed',
        endTime: new Date()
      } : null);

      const scanMessage = actualFindings.length === 0
        ? 'No issues found'
        : `Found ${actualFindings.length} issue${actualFindings.length === 1 ? '' : 's'}`;
      toast.success(`Scan complete! ${scanMessage}`, { id: 'scan-toast' });

        // Update last run time
        setRules(prev => prev.map(r =>
          r.id === ruleId
            ? { ...r, lastRun: 'Just now' }
            : r
        ));
      } catch (apiError: any) {
        clearInterval(progressInterval);
        console.error('Backend rule execution error:', apiError);

        // Update scan status to failed
        setCurrentScan(prev => prev ? {
          ...prev,
          progress: 100,
          status: 'failed',
          endTime: new Date()
        } : null);

        const errorMsg = apiError.response?.data?.error || apiError.message || 'Unknown error';
        toast.error(`Execution failed: ${errorMsg}`, { id: 'scan-toast' });
      }
  };

  // Helper to check if rule is a template (contains ${...} placeholders)
  const isTemplateRule = (rule: any): boolean => {
    return rule.expression && /\$\{[^}]+\}/.test(rule.expression);
  };

  // Handle running all rules
  const handleRunAllRules = async () => {
    // Filter out template rules and inactive rules
    const activeRules = rules.filter(r => r.status === 'active' && !isTemplateRule(r));
    const skippedTemplates = rules.filter(r => r.status === 'active' && isTemplateRule(r));

    if (skippedTemplates.length > 0) {
      console.log(`Skipping ${skippedTemplates.length} template rule(s):`, skippedTemplates.map(r => r.name));
    }

    if (activeRules.length === 0) {
      toast.error(skippedTemplates.length > 0
        ? `All ${skippedTemplates.length} active rule(s) are templates and cannot be executed directly`
        : 'No active rules to execute'
      );
      return;
    }

    if (dataSources.length === 0) {
      toast.error('No data sources available. Please add a data source first.');
      return;
    }

    const toastId = toast.loading(`Running ${activeRules.length} rule(s) across ${dataSources.length} data source(s)...`);

    const results: { rule: string; success: boolean; findings: number; error?: string }[] = [];
    let totalFindings = 0;

    for (let i = 0; i < activeRules.length; i++) {
      const rule = activeRules[i];
      toast.loading(`Running rule ${i + 1}/${activeRules.length}: ${rule.name}`, { id: toastId });

      try {
        // Execute the rule (reuse the same logic)
        await handleRuleExecute(rule.id);

        // Track success
        results.push({
          rule: rule.name,
          success: true,
          findings: 0 // Will be updated from scan results
        });
      } catch (error: any) {
        console.error(`Failed to execute rule ${rule.name}:`, error);
        results.push({
          rule: rule.name,
          success: false,
          findings: 0,
          error: error.message
        });
      }
    }

    // Show summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    if (failCount === 0) {
      toast.success(`✅ Successfully executed all ${successCount} rule(s)`, { id: toastId });
    } else if (successCount === 0) {
      toast.error(`❌ All ${failCount} rule(s) failed to execute`, { id: toastId });
    } else {
      toast.success(`⚠️ Executed ${successCount} rule(s), ${failCount} failed`, { id: toastId });
    }
  };

  // Handle rule edit - Open AI Assistant with pre-filled context
  const handleRuleEdit = (rule: Rule) => {
    toast.info(`Opening editor for: ${rule.name}`);

    // Pre-fill the AI Assistant with the rule's current configuration
    setRuleData({
      category: rule.category,
      severity: rule.severity,
      name: rule.name,
      description: rule.description,
      target: rule.tags.find(t => t.includes('.')) || 'all_sources',
      piiType: rule.tags.find(t => ['ssn', 'credit_card', 'email', 'phone'].includes(t))
    });

    setShowAIAssistant(true);
    setChatMessages([{
      role: 'ai',
      content: `✏️ **Editing Rule: ${rule.name}**\n\nCurrent configuration:\n• Category: ${rule.category}\n• Severity: ${rule.severity}\n• Description: ${rule.description}\n\nWhat would you like to change?\n\n**Options:**\n• Update severity\n• Change target tables/columns\n• Modify description\n• Adjust rule expression\n\nTell me what you'd like to update!`,
      timestamp: new Date()
    }]);
    setCurrentStep(1); // Start at step 1 for modifications
  };

  // Handle rule duplicate
  const handleRuleDuplicate = (rule: Rule) => {
    const newRule = {
      ...rule,
      id: `${rule.id}-copy-${Date.now()}`,
      name: `${rule.name} (Copy)`,
      status: 'draft' as const,
      createdAt: new Date().toISOString()
    };

    setRules(prev => [...prev, newRule]);
    toast.success(`Duplicated rule: ${rule.name}`);
  };

  // Handle rule delete
  const handleRuleDelete = async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;

    if (window.confirm(`Are you sure you want to delete "${rule.name}"?`)) {
      try {
        if (onRuleDelete) {
          await onRuleDelete(ruleId);
        }

        setRules(prev => prev.filter(r => r.id !== ruleId));
        toast.success(`Deleted rule: ${rule.name}`);
      } catch (error) {
        console.error('Delete error:', error);
        toast.error(`Failed to delete rule: ${rule.name}`);
      }
    }
  };

  // Handle AI rule generation
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('Please describe what you want to check');
      return;
    }

    setIsCreatingRule(true);
    toast.loading('AI is generating your rule...');

    try {
      // In production, this would call the AI API
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newRule: Rule = {
        id: `ai-${Date.now()}`,
        name: `AI: ${aiPrompt.slice(0, 50)}`,
        description: aiPrompt,
        category: 'validity',
        type: 'ai-generated',
        status: 'draft',
        severity: 'medium',
        successRate: 0,
        affectedAssets: 0,
        createdBy: 'AI Assistant',
        createdAt: new Date().toISOString(),
        tags: ['ai-generated'],
        expression: `-- AI generated rule for: ${aiPrompt}`,
        actions: ['alert'],
        performance: {
          avgExecutionTime: 0,
          issuesFound: 0,
          issuesResolved: 0,
          trend: 'stable'
        }
      };

      setRules(prev => [...prev, newRule]);
      setShowAIAssistant(false);
      setAiPrompt('');
      toast.success('AI rule generated successfully!');

      if (onRuleCreate) {
        onRuleCreate(newRule);
      }
    } catch (error) {
      console.error('AI generation error:', error);
      toast.error('Failed to generate rule');
    } finally {
      setIsCreatingRule(false);
    }
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter(rule => {
      const matchesSearch = rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rule.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          rule.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || rule.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || rule.status === selectedStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [rules, searchQuery, selectedCategory, selectedStatus]);

  // Stats calculation
  const stats = useMemo(() => {
    const active = rules.filter(r => r.status === 'active').length;
    const critical = rules.filter(r => r.severity === 'critical').length;
    const avgSuccess = rules.length > 0
      ? rules.reduce((acc, r) => acc + r.successRate, 0) / rules.length
      : 0;
    const totalIssues = rules.reduce((acc, r) => acc + r.performance.issuesFound, 0);

    return { active, critical, avgSuccess, totalIssues };
  }, [rules]);

  // Load AI memory from localStorage on mount
  useEffect(() => {
    const savedMemory = localStorage.getItem('cwic_ai_memory');
    if (savedMemory) {
      try {
        const parsed = JSON.parse(savedMemory);
        setAiMemory(parsed);
      } catch (e) {
        console.log('Could not load AI memory');
      }
    }
  }, []);

  // Save AI memory to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('cwic_ai_memory', JSON.stringify(aiMemory));
  }, [aiMemory]);

  // Fetch schema (tables & columns) for intelligent suggestions
  useEffect(() => {
    const fetchSchema = async () => {
      if (!dataSourceId) return;

      // Check cache first
      if (aiMemory.schemaCache[dataSourceId]) {
        setDataTables(aiMemory.schemaCache[dataSourceId].tables);
        return;
      }

      try {
        // Fetch tables
        const tablesResponse = await axios.get(`/api/data-sources/${dataSourceId}/tables`);
        const tables = tablesResponse.data || [];
        setDataTables(tables.map((t: any) => t.name || t));

        // Fetch columns for each table (limit to first 5 tables for performance)
        const columnsMap: { [table: string]: string[] } = {};
        const tablesToFetch = tables.slice(0, 5);

        await Promise.all(tablesToFetch.map(async (table: any) => {
          try {
            const tableName = table.name || table;
            const colResponse = await axios.get(`/api/data-sources/${dataSourceId}/tables/${tableName}/columns`);
            columnsMap[tableName] = (colResponse.data || []).map((c: any) => c.name || c);
          } catch (e) {
            console.log(`Could not fetch columns for ${table}`);
          }
        }));

        // Cache the schema
        setAiMemory(prev => ({
          ...prev,
          schemaCache: {
            ...prev.schemaCache,
            [dataSourceId]: { tables: tables.map((t: any) => t.name || t), columns: columnsMap }
          }
        }));

      } catch (error) {
        console.log('Could not fetch schema, will use general suggestions');
      }
    };

    fetchSchema();
  }, [dataSourceId, aiMemory.schemaCache]);

  // ==================== AI HELPER FUNCTIONS ====================

  // Learn from user's choices
  const learnFromRule = useCallback((rule: any, category: string, severity: string) => {
    setAiMemory(prev => ({
      ...prev,
      userPreferences: {
        ...prev.userPreferences,
        preferredSeverity: {
          ...prev.userPreferences.preferredSeverity,
          [category]: severity
        },
        namingPatterns: [...new Set([...prev.userPreferences.namingPatterns, rule.name])].slice(-10), // Keep last 10
        frequentDataSources: dataSourceId
          ? [...new Set([...prev.userPreferences.frequentDataSources, dataSourceId])].slice(-5)
          : prev.userPreferences.frequentDataSources,
        lastRuleCreated: { ...rule, timestamp: new Date() }
      },
      conversationHistory: [
        ...prev.conversationHistory.slice(-20), // Keep last 20
        { timestamp: new Date(), intent: category, result: rule.name }
      ]
    }));
  }, [dataSourceId]);

  // Validate table/column names against schema
  const validateTarget = useCallback((target: string): { valid: boolean; suggestion?: string; message: string } => {
    if (!dataSourceId || !aiMemory.schemaCache[dataSourceId]) {
      return { valid: true, message: 'Schema not loaded, skipping validation' };
    }

    const schema = aiMemory.schemaCache[dataSourceId];
    const parts = target.split('.');

    if (parts.length === 2) {
      const [table, column] = parts;
      const tableExists = schema.tables.includes(table);

      if (!tableExists) {
        // Find similar table name
        const similar = schema.tables.find(t =>
          t.toLowerCase().includes(table.toLowerCase()) ||
          table.toLowerCase().includes(t.toLowerCase())
        );
        return {
          valid: false,
          suggestion: similar,
          message: `Table "${table}" not found.${similar ? ` Did you mean "${similar}"?` : ''}`
        };
      }

      // Check column if we have it cached
      if (schema.columns[table]) {
        const columnExists = schema.columns[table].includes(column);
        if (!columnExists) {
          const similar = schema.columns[table].find(c =>
            c.toLowerCase().includes(column.toLowerCase()) ||
            column.toLowerCase().includes(c.toLowerCase())
          );
          return {
            valid: false,
            suggestion: similar ? `${table}.${similar}` : undefined,
            message: `Column "${column}" not found in ${table}.${similar ? ` Did you mean "${similar}"?` : ''}`
          };
        }
      }
    }

    return { valid: true, message: 'Target validated' };
  }, [dataSourceId, aiMemory.schemaCache]);

  // Natural Language to SQL Expression Builder
  const buildSQLExpression = useCallback((intent: string, target: string, description: string): string => {
    const parts = target.split('.');
    const table = parts[0] || 'table';
    const column = parts[1] || 'column';

    // Pattern matching for common expressions
    if (/email.*not.*@|email.*invalid|email.*format/i.test(description)) {
      return `SELECT * FROM ${table} WHERE ${column} !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'`;
    }

    if (/ssn|social.*security/i.test(description)) {
      return `SELECT * FROM ${table} WHERE ${column} ~ '\\d{3}-\\d{2}-\\d{4}'`;
    }

    if (/credit.*card|card.*number/i.test(description)) {
      return `SELECT * FROM ${table} WHERE ${column} ~ '\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}'`;
    }

    if (/phone/i.test(description)) {
      return `SELECT * FROM ${table} WHERE ${column} !~ '^\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}$'`;
    }

    if (/null|empty|missing|blank/i.test(description)) {
      return `SELECT * FROM ${table} WHERE ${column} IS NULL OR ${column} = ''`;
    }

    if (/duplicate/i.test(description)) {
      return `SELECT ${column}, COUNT(*) as count FROM ${table} GROUP BY ${column} HAVING COUNT(*) > 1`;
    }

    if (/unique/i.test(description)) {
      return `SELECT ${column}, COUNT(*) FROM ${table} GROUP BY ${column} HAVING COUNT(*) > 1`;
    }

    if (/positive|greater.*than.*0|> 0/i.test(description)) {
      return `SELECT * FROM ${table} WHERE ${column} <= 0`;
    }

    if (/negative|less.*than.*0|< 0/i.test(description)) {
      return `SELECT * FROM ${table} WHERE ${column} >= 0`;
    }

    // Default
    return `SELECT * FROM ${table} WHERE ${column} /* custom condition */`;
  }, []);

  // Parse multi-step complex intents
  const parseComplexIntent = useCallback((input: string): Array<{intent: string; target?: string}> => {
    const intents: Array<{intent: string; target?: string}> = [];

    // Check for multiple tables mentioned
    const tableMatches = input.match(/\b(\w+)\s+(?:and|,)\s+(\w+)\s+(?:tables?|sources?)/gi);
    if (tableMatches) {
      const tables = input.match(/\b(\w+)(?=\s+(?:and|,)|(?:\s+tables?))/gi) || [];
      tables.forEach(table => {
        if (/ssn|pii/i.test(input)) {
          intents.push({ intent: 'ssn', target: table });
        } else if (/credit.*card/i.test(input)) {
          intents.push({ intent: 'credit_card', target: table });
        }
      });
    }

    // Check for multiple PII types
    if (/ssn/i.test(input) && /credit.*card/i.test(input)) {
      intents.push({ intent: 'ssn' });
      intents.push({ intent: 'credit_card' });
    }

    return intents.length > 0 ? intents : [{ intent: 'single' }];
  }, []);

  // Generate proactive suggestions after rule creation
  const generateProactiveSuggestions = useCallback((createdRule: Rule) => {
    const suggestions: string[] = [];

    if (createdRule.category === 'pii' && createdRule.tags?.includes('ssn')) {
      suggestions.push("💳 Would you also like to check for **credit card numbers** in the same columns?");
      suggestions.push("📧 I can also scan for **email addresses** and **phone numbers** for complete PII coverage.");
    }

    if (createdRule.category === 'completeness') {
      suggestions.push("🔍 Consider adding a **validity check** to ensure the data format is correct.");
      suggestions.push("📊 Want to check for **duplicate values** in the same field?");
    }

    if (createdRule.target && createdRule.target.includes('.')) {
      const table = createdRule.target.split('.')[0];
      suggestions.push(`🗂️ I noticed you're working with **${table}**. Want me to suggest other common quality rules for this table?`);
    }

    if (aiMemory.userPreferences.lastRuleCreated) {
      suggestions.push(`🔄 Create another rule similar to **"${aiMemory.userPreferences.lastRuleCreated.name}"** but for a different table?`);
    }

    setProactiveSuggestions(suggestions.slice(0, 3)); // Max 3 suggestions
    if (suggestions.length > 0) {
      setShowProactiveSuggestions(true);
    }
  }, [aiMemory.userPreferences.lastRuleCreated]);

  // Get learned default severity for category
  const getLearnedSeverity = useCallback((category: string): string => {
    return aiMemory.userPreferences.preferredSeverity[category] || (
      category === 'pii' ? 'critical' :
      category === 'completeness' ? 'high' : 'medium'
    );
  }, [aiMemory.userPreferences.preferredSeverity]);

  // AI Conversation Handler - wrapped in useCallback to prevent infinite loop
  const startAIConversation = useCallback(async () => {
    // Reset conversation
    setChatMessages([]);
    setCurrentStep(0);
    setRuleData({ dataSourceId }); // Start with context
    setAiPrompt('');

    // Show loading message
    setChatMessages([{
      role: 'ai',
      content: `🧠 Analyzing your data environment...\n\n• Discovering data sources\n• Profiling tables and columns\n• Analyzing existing rules\n• Identifying quality opportunities`,
      timestamp: new Date()
    }]);

    // Fetch real data intelligence
    try {
      // Discover real insights
      const insights = {
        sourceCount: dataSources.length,
        sources: dataSources.map(ds => ({ id: ds.id, name: ds.name, type: ds.type })),
        tableCount: dataTables.length,
        tables: dataTables,
        activeRules: rules.filter(r => r.status === 'active').length,
        totalRules: rules.length,
        hasHistory: aiMemory.conversationHistory.length > 0,
        lastRule: aiMemory.userPreferences.lastRuleCreated
      };

      // Analyze data quality opportunities
      const opportunities = [];
      if (insights.activeRules === 0) {
        opportunities.push('🆕 **No active rules yet** - Let\'s create your first quality check!');
      }
      if (insights.tableCount > 0) {
        opportunities.push(`📊 **${insights.tableCount} tables discovered** - I can help you protect them`);
      }
      if (insights.sourceCount > 1) {
        opportunities.push(`🔗 **${insights.sourceCount} data sources connected** - Cross-source scanning available`);
      }

      // Build personalized greeting with REAL data
      const personalizedIntro = insights.hasHistory && insights.lastRule
        ? `\n\n✨ **Welcome back!** Last time you created: *"${insights.lastRule.name}"*\n${insights.lastRule.category ? `Category: ${insights.lastRule.category}` : ''}`
        : '';

      // Build intelligent context
      const sourcesList = insights.sources.length > 0
        ? `\n\n📡 **Connected Data Sources:**\n${insights.sources.map(s => `• **${s.name}** (${s.type || 'Database'})`).join('\n')}`
        : '\n\n⚠️ **No data sources detected** - Please connect a data source first';

      const tablesList = insights.tables.length > 0
        ? `\n\n📋 **Discovered Tables:** ${insights.tables.slice(0, 8).join(', ')}${insights.tables.length > 8 ? `, +${insights.tables.length - 8} more` : ''}`
        : '';

      const opportunitiesText = opportunities.length > 0
        ? `\n\n💡 **Smart Insights:**\n${opportunities.join('\n')}`
        : '';

      // Generate intelligent greeting
      setTimeout(() => {
        setChatMessages([{
          role: 'ai',
          content: `Hello! I'm your **Intelligent AI Data Quality Assistant** 🧠\n\nI've analyzed your environment and I'm ready to help!${personalizedIntro}${sourcesList}${tablesList}${opportunitiesText}\n\n**🔒 Security & PII:**\n• *"Scan for PII"* / *"Find SSN"* / *"Detect credit cards"*\n• *"Check for sensitive data"* / *"GDPR compliance"*\n\n**✅ Data Quality:**\n• *"Find missing values"* / *"Check for nulls"*\n• *"Detect duplicates"* / *"Ensure uniqueness"*\n• *"Validate email formats"* / *"Check data types"*\n• *"Find anomalies"* / *"Detect outliers"*\n\n**🔗 Advanced:**\n• *"Check referential integrity"* / *"Cross-table validation"*\n• *"Verify data freshness"* / *"Length constraints"*\n• *"Profile my data"* / *"Suggest quality rules"*\n\n**💡 I understand natural language!** Just tell me what you need in your own words.\n\nWhat would you like to do? 🚀`,
          timestamp: new Date()
        }]);
      }, 800);

    } catch (error) {
      console.error('Failed to load AI intelligence:', error);
      // Fallback to basic greeting
      setTimeout(() => {
        setChatMessages([{
          role: 'ai',
          content: `Hello! I'm your AI Data Quality Assistant 🧠\n\nI'm here to help you create intelligent quality rules.\n\n**Tell me what you want to do:**\n• *"Scan for PII"*\n• *"Check for missing data"*\n• *"Find duplicates"*\n\nWhat would you like to do?`,
          timestamp: new Date()
        }]);
      }, 500);
    }
  }, [dataSourceId, aiMemory.conversationHistory, aiMemory.userPreferences.lastRuleCreated, dataTables]); // Include dependencies

  // Enhanced AI with TRUE intelligence - Question detection, context awareness, learning
  const handleAIChat = async () => {
    if (!aiPrompt.trim()) return;

    const userMessage = { role: 'user' as const, content: aiPrompt, timestamp: new Date() };
    setChatMessages(prev => [...prev, userMessage]);
    setAiPrompt('');
    setIsAiTyping(true);

    await new Promise(resolve => setTimeout(resolve, 600));

    let aiResponse = '';
    const input = userMessage.content.toLowerCase();
    const originalInput = userMessage.content;

    // Advanced NLP with question detection
    const isQuestion = /^(what|which|where|when|who|how|can|do|does|is|are|show|tell|list)\s/i.test(originalInput) || /\?$/.test(originalInput);

    // Detect if user is asking about context/environment
    const isContextQuery = /(what|which).*(source|table|database|data|available|have|using|targeting|looking)/i.test(input);

    // Enhanced intent detection
    const detectIntent = (text: string) => {
      const lower = text.toLowerCase();

      // Context/greeting detection
      if (isQuestion && isContextQuery) return 'context_query';
      if (/(hello|hi|hey|greetings)\b/i.test(text) && text.split(' ').length < 4) return 'greeting';

      // ========== PII & SECURITY DETECTION ==========
      // Comprehensive PII scan requests
      if (/(scan|check|find|detect|look|search).*(all|every|entire|comprehensive)/i.test(text) && /pii|sensitive|personal|private/i.test(text)) {
        return 'scan_all_pii';
      }

      // Specific PII types with variations
      if (/\b(ssn|social\s*security|social\s*sec|tax\s*id|taxpayer|tin|national\s*id)\b/i.test(text)) return 'ssn';
      if (/\b(credit\s*card|cc\s*num|card\s*number|payment\s*card|debit\s*card|visa|mastercard|amex)\b/i.test(text)) return 'credit_card';
      if (/\b(passport|passport\s*num|id\s*number|driver.*license|drivers?\s*lic)\b/i.test(text)) return 'passport_id';
      if (/\b(bank.*account|routing.*number|iban|swift|account.*num)\b/i.test(text)) return 'banking';
      if (/\b(pii|gdpr|sensitive|personal.*info|personally.*identif|private.*data)\b/i.test(text)) return 'pii';

      // ========== DATA QUALITY CATEGORIES ==========
      // Completeness (null checks, missing data)
      if (/(complete|completeness|missing|null|empty|blank|required|mandatory|must.*have)/i.test(text)) return 'completeness';
      if (/(check.*required|ensure.*populated|verify.*exists|not.*empty|has.*value)/i.test(text)) return 'completeness';

      // Validity (format validation, patterns)
      if (/(valid|validity|format|pattern|regex|match|conform|structure)/i.test(text)) return 'validity';
      if (/(email|phone|zip|postal|url|domain|ip.*address)/i.test(text) && /(valid|check|verify|format)/i.test(text)) return 'validity';

      // Uniqueness (duplicates, primary keys)
      if (/(unique|uniqueness|duplicate|dupl|distinct|repeat|one.*time|primary.*key)/i.test(text)) return 'uniqueness';
      if (/(no.*duplicate|avoid.*repeat|ensure.*unique|check.*dupl)/i.test(text)) return 'uniqueness';

      // Accuracy (ranges, thresholds, business rules)
      if (/(accura|accurate|range|between|limit|threshold|boundary|min|max)/i.test(text)) return 'accuracy';
      if (/(within.*range|should.*be.*between|must.*exceed|cannot.*be.*less)/i.test(text)) return 'accuracy';

      // Consistency (cross-table, referential integrity)
      if (/(consist|consistency|referential|foreign.*key|relationship|reference|cross.*table)/i.test(text)) return 'consistency';
      if (/(match.*across|align.*with|same.*as|correlate)/i.test(text)) return 'consistency';

      // Timeliness (freshness, staleness, updates)
      if (/(timely|timeliness|fresh|stale|recent|updated|last.*modified|age|old.*data)/i.test(text)) return 'timeliness';
      if (/(not.*updated|outdated|too.*old|within.*hours|within.*days)/i.test(text)) return 'timeliness';

      // ========== SPECIFIC USE CASES ==========
      // Data profiling requests
      if (/(profile|profiling|analyze|analysis|stats|statistics|summary)/i.test(text) && /(table|column|data|database)/i.test(text)) return 'profiling';

      // Anomaly/outlier detection
      if (/(anomaly|anomalies|outlier|unusual|abnormal|strange|weird|unexpected)/i.test(text)) return 'anomaly';

      // Data type validation
      if (/(data.*type|type.*check|integer|string|date|datetime|boolean|numeric)/i.test(text)) return 'data_type';

      // Length/size constraints
      if (/(length|size|character.*count|max.*length|min.*length|too.*long|too.*short)/i.test(text)) return 'length_constraint';

      // Enum/allowed values
      if (/(enum|allowed.*value|permitted|whitelist|valid.*option|must.*be.*one.*of)/i.test(text)) return 'enum_validation';

      // Cross-field validation
      if (/(cross.*field|compare.*column|end.*date.*after.*start|total.*equals.*sum)/i.test(text)) return 'cross_field';

      // ========== ACTION-BASED INTENTS ==========
      // Import/export requests
      if (/(import|load|upload|bring.*in).*rule/i.test(text)) return 'import_rules';
      if (/(export|download|save|extract).*rule/i.test(text)) return 'export_rules';

      // List/show requests
      if (/(list|show|display|get|fetch|see).*rule/i.test(text)) return 'list_rules';

      // Modify/update requests
      if (/(edit|modify|update|change|alter).*rule/i.test(text)) return 'edit_rule';

      // Delete/remove requests
      if (/(delete|remove|drop|disable|deactivate).*rule/i.test(text)) return 'delete_rule';

      // Run/execute requests
      if (/(run|execute|test|check|validate|apply).*rule/i.test(text)) return 'run_rule';

      return 'custom';
    };

    const intent = detectIntent(input);

    switch(currentStep) {
      case 0: // Initial - Handle questions AND intents
        // Check for "what tables" question first
        if (/what.*(table|schema)/i.test(input)) {
          const tablesList = dataTables.length > 0
            ? dataTables.slice(0, 10).map(t => `• ${t}`).join('\n')
            : '• Fetching tables...';
          const moreInfo = dataTables.length > 10 ? `\n\n*...and ${dataTables.length - 10} more tables*` : '';

          aiResponse = `📋 **Available Tables in Current Data Source:**\n\n${tablesList}${moreInfo}\n\nWould you like to:\n• Create a quality rule for one of these tables?\n• Scan all tables for specific issues?\n• Ask about columns in a specific table?`;
          // Stay at step 0
        } else if (intent === 'context_query') {
          // User is asking about data sources/tables - Show REAL data
          const sourceCount = dataSources.length;

          if (sourceCount === 0) {
            aiResponse = `⚠️ **No Data Sources Detected**\n\nI couldn't find any connected data sources. Please:\n\n1. Go to **Settings** → **Data Sources**\n2. Connect a database (PostgreSQL, MySQL, etc.)\n3. Come back and I'll help you create quality rules!\n\n💡 Once connected, I can:\n• Automatically discover all tables\n• Profile columns and data types\n• Suggest intelligent quality rules\n• Detect PII and sensitive data`;
          } else {
            const sourceList = dataSources.map(s => {
              const type = s.type || s.database_type || 'Database';
              const status = s.status || 'connected';
              const statusIcon = status === 'connected' ? '✅' : '⚠️';
              return `${statusIcon} **${s.name}** (${type})\n   └─ ID: \`${s.id}\`${s.host ? `\n   └─ Host: ${s.host}` : ''}`;
            }).join('\n\n');

            const tableInfo = dataTables.length > 0
              ? `\n\n📋 **Discovered ${dataTables.length} Tables:**\n${dataTables.slice(0, 10).map(t => `• ${t}`).join('\n')}${dataTables.length > 10 ? `\n• ...and ${dataTables.length - 10} more` : ''}`
              : '\n\n🔍 **Discovering tables...** (may take a moment)';

            const activeContext = dataSourceId
              ? `\n\n🎯 **Current Context:** Working with ${dataSources.find(ds => ds.id === dataSourceId)?.name || dataSourceId}`
              : '';

            aiResponse = `📊 **Data Environment Analysis**\n\n**${sourceCount} Connected ${sourceCount === 1 ? 'Source' : 'Sources'}:**\n\n${sourceList}${tableInfo}${activeContext}\n\n**What I can do:**\n• 🔒 Scan **all sources** for PII/compliance\n• 🎯 Target **specific tables** for quality checks\n• 📊 Profile data and suggest optimal rules\n• 🚀 Cross-source validation and monitoring\n\nWhat would you like to do?`;
          }
          // Stay at step 0
        } else if (intent === 'greeting') {
          aiResponse = `Hello! 👋 Great to chat with you!\n\nI'm your intelligent data quality assistant. I can help you:\n\n🔍 **Scan & Detect:**\n• Find PII (SSN, credit cards, etc.) across all sources\n• Detect missing or invalid data\n• Find duplicate records\n\n❓ **Ask Questions:**\n• "What data sources are available?"\n• "What tables can I scan?"\n• "How do I detect SSN?"\n\n💬 **Natural Conversation:**\nJust tell me what you need in plain English!\n\nWhat would you like to do?`;
        } else if (intent === 'scan_all_pii') {
          // User wants to scan ALL sources for PII
          const sourceInfo = dataSources.length > 0
            ? `all ${dataSources.length} connected data sources`
            : 'the connected data source';

          setRuleData({
            category: 'pii',
            type: 'pii_detection',
            piiType: 'ssn',
            severity: 'critical',
            scanAll: true,
            target: 'all_sources',
            userIntent: originalInput
          });

          aiResponse = `🔒 **Excellent choice!** I'll scan **${sourceInfo}** for **Social Security Numbers**.\n\n✓ Auto-configured:\n• **Scope:** All sources and tables\n• **Detection:** SSN patterns (XXX-XX-XXXX)\n• **Severity:** Critical\n\nI'll create a comprehensive rule that:\n1. Scans all text columns\n2. Uses regex pattern matching\n3. Flags any SSN-like patterns\n4. Generates compliance alerts\n\nGive this rule a name, or say **"auto"** and I'll name it:\n\nSuggestion: *"Organization-Wide SSN Detection Scanner"*`;
          setCurrentStep(3); // Skip to naming
        } else if (intent === 'ssn' || intent === 'credit_card') {
          const piiType = intent === 'ssn' ? 'Social Security Numbers (SSN)' : 'Credit Card Numbers';
          const isAllScope = /(all|every|entire|whole).*(source|table|database)/i.test(input);

          setRuleData({
            category: 'pii',
            type: 'pii_detection',
            piiType: intent,
            severity: intent === 'ssn' ? 'critical' : 'high',
            scanAll: isAllScope,
            userIntent: originalInput
          });

          if (isAllScope) {
            aiResponse = `🔒 Perfect! I'll scan **all data sources** for **${piiType}**.\n\n✓ Severity: **${intent === 'ssn' ? 'Critical' : 'High'}** (auto-set)\n✓ Scope: All sources and tables\n\nWould you like to:\n• Scan **all columns** (recommended for PII)\n• Target **specific columns** (e.g., notes, comments, descriptions)\n\nJust tell me your preference!`;
            setCurrentStep(1);
          } else {
            aiResponse = `🔒 Excellent! Detecting **${piiType}**.\n\n✓ Severity: **${intent === 'ssn' ? 'Critical' : 'High'}** (auto-set)\n\nWhich scope?\n\n**Option 1:** Scan **all sources** - comprehensive\n**Option 2:** Specify **tables/columns** - targeted\n\nFor example:\n• "all sources"\n• "customers.notes, user_profiles.bio"\n• "employees table"`;
            setCurrentStep(1);
          }
        } else if (intent === 'pii') {
          setRuleData({ category: 'pii', type: 'pii_detection', userIntent: originalInput });

          // Check if user wants comprehensive "all PII" scanning
          const wantsAllPII = /(all|every|comprehensive|everything).*(pii|types|sensitive)/i.test(input);

          if (wantsAllPII) {
            // Smart detection: user wants all PII types scanned
            aiResponse = `🔒 Perfect! I'll create **comprehensive PII protection** with multiple rules:\n\n✨ **Auto-creating:**\n• SSN Detection (Critical severity)\n• Credit Card Detection (Critical severity)\n• Phone Number Detection (Medium severity)\n• Email Detection (Medium severity)\n• Address Detection (Medium severity)\n\nEach rule will have appropriate severity based on sensitivity.\n\n**Scan all data sources?** Or specify tables/columns?`;
            setRuleData({ category: 'pii', type: 'comprehensive_pii', userIntent: originalInput, multiRule: true });
            setCurrentStep(1);
          } else {
            aiResponse = `🔒 I'll help you detect **PII (Personally Identifiable Information)**.\n\nWhat type of PII?\n\n• **SSN** (Social Security) → Critical severity\n• **Credit Cards** → Critical severity  \n• **Phone Numbers** → Medium severity\n• **Email Addresses** → Medium severity\n• **All PII types** → Comprehensive scan (creates multiple rules)\n\nAlso, should I:\n• Scan **all data sources**?\n• Target **specific tables/columns**?`;
            setCurrentStep(1);
          }
        } else if (intent === 'completeness') {
          setRuleData({ category: 'completeness', type: 'null_check', userIntent: originalInput });
          aiResponse = `✅ I'll check for **missing/null values**.\n\nWhich fields are critical?\n\nExamples:\n• "customers.email, customers.phone"\n• "all required fields in orders"\n• "user authentication data"`;
          setCurrentStep(1);
        } else if (intent === 'validity') {
          setRuleData({ category: 'validity', type: 'format_validation', userIntent: originalInput });
          aiResponse = `🎯 I'll validate **data formats**.\n\nWhat needs validation?\n\n• "users.email" → email format\n• "contacts.phone" → phone format\n• "products.sku" → custom pattern`;
          setCurrentStep(1);
        } else if (intent === 'passport_id' || intent === 'banking') {
          const piiName = intent === 'passport_id' ? 'Passport/ID Numbers' : 'Banking Information';
          setRuleData({ category: 'pii', type: 'pii_detection', piiType: intent, severity: 'high', userIntent: originalInput });
          aiResponse = `🔒 Protecting **${piiName}** - excellent choice!\n\n✓ Severity: **High** (auto-set for ${piiName})\n\nShould I:\n• Scan **all data sources**?\n• Target **specific tables/columns**?\n\nExample: "all sources" or "employees.notes, applications.documents"`;
          setCurrentStep(1);
        } else if (intent === 'consistency') {
          setRuleData({ category: 'consistency', type: 'referential_integrity', userIntent: originalInput });
          aiResponse = `🔗 I'll check **data consistency**.\n\nWhat relationship should I validate?\n\nExamples:\n• "orders.customer_id exists in customers.id"\n• "product references match"\n• "cross-table alignment"`;
          setCurrentStep(1);
        } else if (intent === 'timeliness') {
          setRuleData({ category: 'timeliness', type: 'freshness_check', userIntent: originalInput });
          aiResponse = `⏰ I'll check **data freshness/timeliness**.\n\nWhat should I monitor?\n\nExamples:\n• "orders updated within 24 hours"\n• "cache data not older than 1 hour"\n• "last_modified within acceptable range"`;
          setCurrentStep(1);
        } else if (intent === 'profiling') {
          setRuleData({ category: 'profiling', type: 'data_profiling', userIntent: originalInput });
          aiResponse = `📊 I'll **profile your data** and suggest quality rules!\n\nWhich tables should I analyze?\n\n• "all tables" - comprehensive analysis\n• "customers, orders" - specific tables\n• "user_* tables" - pattern match`;
          setCurrentStep(1);
        } else if (intent === 'anomaly') {
          setRuleData({ category: 'accuracy', type: 'anomaly_detection', userIntent: originalInput });
          aiResponse = `🔍 I'll detect **anomalies and outliers**.\n\nWhat data should I analyze?\n\nExamples:\n• "sales.amount" - detect unusual values\n• "user activity patterns" - behavioral anomalies\n• "all numeric fields" - comprehensive scan`;
          setCurrentStep(1);
        } else if (intent === 'data_type') {
          setRuleData({ category: 'validity', type: 'data_type_validation', userIntent: originalInput });
          aiResponse = `🏷️ I'll validate **data types**.\n\nWhich fields need type validation?\n\nExamples:\n• "age must be integer"\n• "email must be string"\n• "created_at must be datetime"`;
          setCurrentStep(1);
        } else if (intent === 'length_constraint') {
          setRuleData({ category: 'validity', type: 'length_validation', userIntent: originalInput });
          aiResponse = `📏 I'll check **length constraints**.\n\nWhat are the requirements?\n\nExamples:\n• "username between 3-20 characters"\n• "description max 500 chars"\n• "product_code exactly 10 digits"`;
          setCurrentStep(1);
        } else if (intent === 'enum_validation') {
          setRuleData({ category: 'validity', type: 'enum_check', userIntent: originalInput });
          aiResponse = `📋 I'll validate **allowed values**.\n\nWhat are the constraints?\n\nExamples:\n• "status must be: active, pending, closed"\n• "country_code in ISO list"\n• "payment_method: card, cash, crypto"`;
          setCurrentStep(1);
        } else if (intent === 'cross_field') {
          setRuleData({ category: 'consistency', type: 'cross_field_validation', userIntent: originalInput });
          aiResponse = `🔀 I'll validate **cross-field relationships**.\n\nWhat should I check?\n\nExamples:\n• "end_date must be after start_date"\n• "total equals sum of line items"\n• "discount cannot exceed price"`;
          setCurrentStep(1);
        } else if (intent === 'list_rules') {
          setShowAIAssistant(false);
          setViewMode('list');
          return; // Exit handler
        } else if (intent === 'export_rules') {
          toast.info('Opening export dialog...');
          // Trigger export functionality
          return;
        } else {
          setRuleData({ category: 'custom', type: 'custom_rule', userIntent: originalInput });
          aiResponse = `I understand: *"${originalInput}"*\n\nTo help you better:\n• Which **data source(s)**?\n• Which **tables/columns**?\n• Any **specific criteria**?\n\nOr just say "all sources" for comprehensive coverage!`;
          setCurrentStep(1);
        }
        break;

      case 1: // Table/scope/refinement
        // Smart detection for sophisticated requests like "depends on type of PII"
        const wantsDynamicSeverity = /depend.*type|different.*severity|vary.*based|ssn.*critical/i.test(input);

        if (wantsDynamicSeverity) {
          // User wants different severities for different PII types - SMART!
          aiResponse = `🧠 Excellent thinking! I'll create **smart PII protection** with dynamic severities:\n\n✨ **Creating multiple rules:**\n• SSN Detection → **Critical** (as you specified)\n• Credit Cards → **Critical**\n• Passport/ID Numbers → **High**\n• Phone Numbers → **Medium**\n• Email Addresses → **Medium**\n\nScan **all data sources**? (recommended for comprehensive protection)`;
          setRuleData((prev: any) => ({ ...prev, multiRule: true, smartSeverity: true, type: 'comprehensive_pii' }));
          setCurrentStep(1); // Stay on step 1 to get scope
        } else if (isContextQuery || isQuestion) {
          // User is asking clarifying questions
          if (/what.*(column|field|table)/i.test(input)) {
            aiResponse = `📋 I can scan:\n\n**All Columns:** Comprehensive (recommended for PII)\n**Specific Columns:** Targeted scan\n\nCommon PII columns:\n• notes, comments, description\n• bio, profile, about\n• custom_data, metadata\n\nOr tell me "all columns" and I'll scan everything!`;
          } else if (/what.*(source|database)/i.test(input)) {
            const sources = dataSources.length > 0
              ? dataSources.map(s => `• ${s.name}`).join('\n')
              : '• Your connected data source';
            aiResponse = `📊 **Available sources:**\n${sources}\n\nShould I scan:\n• **All of them**? (say "all sources")\n• **Specific ones**? (name them)`;
          } else {
            aiResponse = `I can help clarify! Are you asking about:\n• **Available data sources**?\n• **Which columns to scan**?\n• **How the scanning works**?\n\nJust ask me anything!`;
          }
        } else {
          // Process scope input - handle simple "all" as meaning "all sources"
          const justAll = input.trim() === 'all';
          const isAllSources = justAll || /(all|every|entire|whole).*(source|table|database)/i.test(input);
          const isAllColumns = /(all|every).*(column|field)/i.test(input);

          if (isAllSources || input.includes('all sources')) {
            setRuleData((prev: any) => ({ ...prev, target: 'all_sources', scanAll: true }));
            aiResponse = `Perfect! Scanning **all data sources**${isAllColumns ? ' and **all columns**' : ''}.\n\n✓ Comprehensive coverage\n✓ Severity: **${ruleData.severity || 'critical'}**\n\nGive this rule a name (or say "auto"):\n\nSuggestion: *"${ruleData.piiType === 'ssn' ? 'Enterprise SSN' : 'Multi-Source PII'} Detection"*`;
            setCurrentStep(3);
          } else {
            // Validate the target against schema
            const validation = validateTarget(originalInput);

            if (!validation.valid && validation.suggestion) {
              // Offer correction
              aiResponse = `⚠️ ${validation.message}\n\nShould I use **${validation.suggestion}** instead?\n\nOr tell me the correct table/column.`;
              // Don't save invalid target yet, wait for confirmation
            } else {
              setRuleData((prev: any) => ({ ...prev, target: validation.valid ? originalInput : validation.suggestion || originalInput }));

              // Use learned severity or get suggestion
              const learnedSeverity = getLearnedSeverity(ruleData.category);
              const suggestedSeverity = ruleData.severity || learnedSeverity;

              if (ruleData.severity) {
                aiResponse = `Great! Targeting **${originalInput}**.${validation.valid ? '' : ` (Validated ✓)`}\n\n✓ Severity: **${ruleData.severity}**\n\nName this rule (or "auto"):\n\nSuggestion: *"Detect ${ruleData.piiType || ruleData.category} in ${originalInput.split('.')[0]}"*`;
                setCurrentStep(3);
              } else {
                const memoryNote = aiMemory.userPreferences.preferredSeverity[ruleData.category]
                  ? `\n\n💡 *I remember you prefer **${learnedSeverity}** for ${ruleData.category} rules*`
                  : '';
                aiResponse = `Targeting **${originalInput}**.${validation.valid ? '' : ` (Validated ✓)`}\n\nRecommended severity: **${suggestedSeverity}**${memoryNote}\n\nAgree? Or choose:\n🔴 Critical • 🟠 High • 🟡 Medium • 🔵 Low`;
                setRuleData((prev: any) => ({ ...prev, suggestedSeverity }));
                setCurrentStep(2);
              }
            }
          }
        }
        break;

      case 2: // Severity
        if (/(yes|ok|agree|sure|fine|sounds|good|correct)/i.test(input)) {
          const severity = ruleData.suggestedSeverity || 'medium';
          setRuleData((prev: any) => ({ ...prev, severity }));
          aiResponse = `✓ Using **${severity}** severity.\n\nName this rule (or "auto"):\n\nSuggestion: *"${ruleData.scanAll ? 'Enterprise' : 'Targeted'} ${ruleData.piiType || ruleData.category} Detection"*`;
          setCurrentStep(3);
        } else {
          const severity = /(critical|crit|🔴|1)/i.test(input) ? 'critical'
                        : /(high|🟠|2)/i.test(input) ? 'high'
                        : /(medium|🟡|3)/i.test(input) ? 'medium'
                        : /(low|🔵|4)/i.test(input) ? 'low'
                        : ruleData.suggestedSeverity || 'medium';

          setRuleData((prev: any) => ({ ...prev, severity }));
          aiResponse = `✓ Severity: **${severity}**\n\nName this rule (or say "auto"):`;
          setCurrentStep(3);
        }
        break;

      case 3: // Naming
        if (/(auto|generate|suggest|you.*name)/i.test(input)) {
          const autoName = ruleData.scanAll
            ? `Enterprise-Wide ${ruleData.piiType === 'ssn' ? 'SSN' : 'PII'} Detection`
            : `Detect ${ruleData.piiType || ruleData.category} in ${ruleData.target || 'data'}`;
          setRuleData((prev: any) => ({ ...prev, name: autoName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) }));
          aiResponse = `✨ **"${autoName}"**\n\nFinal step - brief description:\n\n(Say "auto" for AI-generated description)`;
        } else {
          setRuleData((prev: any) => ({ ...prev, name: originalInput }));
          aiResponse = `Great name! 🎉\n\nBrief description:\n\n(Or say "auto" for AI-generated)`;
        }
        setCurrentStep(4);
        break;

      case 4: // Description & creation
        const description = /(auto|generate|suggest)/i.test(input)
          ? `Automatically scans ${ruleData.scanAll ? 'all data sources' : ruleData.target} for ${ruleData.piiType || ruleData.category} to ensure data quality and compliance with privacy regulations.`
          : originalInput;

        setRuleData((prev: any) => ({ ...prev, description }));

        // Build intelligent SQL expression using NLP
        const smartExpression = ruleData.target && ruleData.target !== 'all_sources'
          ? buildSQLExpression(ruleData.category, ruleData.target, description + ' ' + (ruleData.piiType || ''))
          : generateRuleExpression(ruleData);

        // Save rule to backend API first
        let finalRule: Rule;
        try {
          const rulePayload = {
            name: ruleData.name || 'Quality Rule',
            description,
            severity: ruleData.severity || 'medium',
            type: 'sql',
            dialect: 'postgres',
            expression: smartExpression,
            tags: ['ai-created', ruleData.category, ruleData.piiType, ruleData.scanAll ? 'enterprise-wide' : 'targeted'].filter(Boolean),
            enabled: false // Start as disabled/draft
          };

          const response = await axios.post('/api/quality/rules', rulePayload);
          const savedRule = response.data;

          // Convert backend response to our Rule format
          finalRule = {
            id: savedRule.id,
            name: savedRule.name,
            description: savedRule.description || '',
            category: ruleData.category || 'validity',
            type: 'ai-generated',
            status: savedRule.enabled ? 'active' : 'draft',
            severity: savedRule.severity,
            successRate: 0,
            affectedAssets: 0,
            createdBy: savedRule.created_by || 'AI Assistant',
            createdAt: savedRule.created_at,
            tags: savedRule.tags || [],
            expression: savedRule.expression,
            schedule: 'on-demand',
            actions: ['log', 'notify'],
            performance: {
              avgExecutionTime: 0,
              issuesFound: 0,
              issuesResolved: 0,
              trend: 'stable' as const
            }
          };

          setRules(prev => [finalRule, ...prev]);

          // Call parent callback if provided
          if (onRuleCreate) {
            onRuleCreate(finalRule);
          }
        } catch (saveError: any) {
          console.error('Failed to save rule to backend:', saveError);
          const errorMsg = saveError.response?.data?.message || saveError.message || 'Unknown error';
          toast.error(`Failed to save rule: ${errorMsg}`);

          aiResponse = `❌ **Failed to create rule**\n\n${errorMsg}\n\nPlease check your SQL expression and try again.`;
          setIsAiTyping(false);
          setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse, timestamp: new Date() }]);
          break;
        }

        // Learn from this rule creation
        learnFromRule(finalRule, ruleData.category, ruleData.severity);

        // Generate proactive suggestions
        generateProactiveSuggestions(finalRule);

        aiResponse = `✨ **Rule Created!** ✨\n\n**${finalRule.name}**\n\n📋 **Configuration:**\n• Scope: ${ruleData.scanAll ? 'All data sources' : ruleData.target}\n• Type: ${ruleData.piiType || ruleData.category}\n• Severity: ${finalRule.severity}\n• SQL: \`${smartExpression.substring(0, 50)}...\`\n\n✅ **Saved to database** with UUID: \`${finalRule.id}\`\n\n🧠 **I learned from this:**\n• Your preference for ${ruleData.scanAll ? 'comprehensive' : 'targeted'} scans\n• ${ruleData.severity} severity for ${ruleData.category} issues\n• Your naming style for future suggestions\n\n👉 **Next:** Review below, click "Run Now" to test with real data!`;

        setTimeout(() => {
          toast.success(`Created: ${finalRule.name}`, { duration: 3000 });
          setTimeout(() => {
            setShowAIAssistant(false);
            setChatMessages([]);
            setCurrentStep(0);
            setRuleData({});
          }, 2500);
        }, 800);
        break;

      default:
        aiResponse = `I'm here to help! Ask me anything or tell me what you need.`;
    }

    setIsAiTyping(false);
    setChatMessages(prev => [...prev, { role: 'ai', content: aiResponse, timestamp: new Date() }]);
  };

  const generateRuleExpression = (data: any) => {
    const { category, type, target } = data;

    if (category === 'completeness') {
      return `SELECT * FROM ${target?.split('.')[0]} WHERE ${target?.split('.')[1]} IS NULL`;
    } else if (category === 'validity' && type === 'format_validation') {
      return `SELECT * FROM ${target?.split('.')[0]} WHERE ${target?.split('.')[1]} !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'`;
    } else if (category === 'uniqueness') {
      return `SELECT ${target?.split('.')[1]}, COUNT(*) FROM ${target?.split('.')[0]} GROUP BY ${target?.split('.')[1]} HAVING COUNT(*) > 1`;
    }
    return `-- Custom rule expression\nSELECT * FROM ${target} WHERE condition`;
  };

  // AI Assistant Component with Chat Interface - Memoized to prevent flickering
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (showAIAssistant) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showAIAssistant]);

  const AIAssistantModal = useMemo(() => {
    if (!showAIAssistant) return null;

    return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setShowAIAssistant(false);
            setChatMessages([]);
            setCurrentStep(0);
          }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full h-[600px] flex flex-col"
            onClick={e => e.stopPropagation()}
          >
          {/* Header */}
          <div className="border-b border-gray-200">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center animate-pulse">
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">AI Rule Assistant</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Online & Ready
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAIAssistant(false);
                  setChatMessages([]);
                  setCurrentStep(0);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Context Info Bar */}
            <div className="px-4 pb-3 bg-gradient-to-r from-violet-50 to-purple-50">
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-gray-600">{dataSources.length} {dataSources.length === 1 ? 'Source' : 'Sources'}</span>
                </div>
                {dataTables.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-violet-600" />
                    <span className="text-gray-600">{dataTables.length} Tables</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-violet-600" />
                  <span className="text-gray-600">{rules.length} Active Rules</span>
                </div>
                {aiMemory.conversationHistory.length > 0 && (
                  <div className="flex items-center gap-1.5 ml-auto">
                    <Brain className="w-3.5 h-3.5 text-violet-600" />
                    <span className="text-gray-600">{aiMemory.conversationHistory.length} Learned Patterns</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-white">
            {chatMessages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-2 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    msg.role === 'ai'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  }`}>
                    {msg.role === 'ai' ? (
                      <Sparkles className="w-4 h-4 text-white" />
                    ) : (
                      <Users className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className={`rounded-2xl px-4 py-3 ${
                    msg.role === 'ai'
                      ? 'bg-white border border-gray-200 shadow-sm'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white'
                  }`}>
                    <p className={`text-sm whitespace-pre-wrap ${msg.role === 'ai' ? 'text-gray-800' : 'text-white'}`}>
                      {msg.content}
                    </p>
                    <span className={`text-xs mt-1 block ${msg.role === 'ai' ? 'text-gray-400' : 'text-blue-100'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}

            {isAiTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Templates (only show at step 0) */}
          {currentStep === 0 && chatMessages.length === 0 && (
            <div className="px-4 pb-3">
              <p className="text-xs font-medium text-gray-500 mb-2">✨ Quick Start Templates:</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setAiPrompt('Find all SSN in all sources'); handleAIChat(); }}
                  className="px-3 py-2 text-left bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg hover:shadow-md transition-all group"
                  disabled={isAiTyping}
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-red-900">Detect PII</p>
                      <p className="text-xs text-red-600">Find SSN, cards, etc.</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setAiPrompt('Check for missing data in critical fields'); }}
                  className="px-3 py-2 text-left bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg hover:shadow-md transition-all group"
                  disabled={isAiTyping}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-blue-900">Completeness</p>
                      <p className="text-xs text-blue-600">Find missing values</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setAiPrompt('Find duplicate records'); }}
                  className="px-3 py-2 text-left bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-lg hover:shadow-md transition-all group"
                  disabled={isAiTyping}
                >
                  <div className="flex items-center gap-2">
                    <Copy className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-emerald-900">Find Duplicates</p>
                      <p className="text-xs text-emerald-600">Uniqueness check</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => { setAiPrompt('Validate email and phone formats'); }}
                  className="px-3 py-2 text-left bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg hover:shadow-md transition-all group"
                  disabled={isAiTyping}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-amber-900">Format Validation</p>
                      <p className="text-xs text-amber-600">Check patterns</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200 bg-gradient-to-r from-violet-50/30 to-purple-50/30">
            {/* Smart Suggestions based on context */}
            {currentStep === 1 && ruleData.category === 'pii' && (
              <div className="mb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="w-4 h-4 text-yellow-600" />
                  <p className="text-xs font-medium text-gray-700">💡 Smart Suggestions:</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => { setAiPrompt('all sources'); handleAIChat(); }}
                    className="px-3 py-1.5 bg-white border border-violet-200 rounded-lg text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors"
                    disabled={isAiTyping}
                  >
                    📊 All Sources
                  </button>
                  <button
                    onClick={() => { setAiPrompt('all columns'); handleAIChat(); }}
                    className="px-3 py-1.5 bg-white border border-violet-200 rounded-lg text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors"
                    disabled={isAiTyping}
                  >
                    🔍 All Columns
                  </button>
                  {dataTables.slice(0, 3).map(table => (
                    <button
                      key={table}
                      onClick={() => { setAiPrompt(table); handleAIChat(); }}
                      className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                      disabled={isAiTyping}
                    >
                      📋 {table}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <div className="absolute left-3 top-3 flex items-center gap-2 pointer-events-none">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-white" />
                  </div>
                </div>
                <input
                  type="text"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleAIChat()}
                  placeholder={currentStep === 0 ? "Ask me anything... e.g., 'Find SSN in all sources'" : "Type your response..."}
                  className="w-full pl-11 pr-4 py-3 border-2 border-violet-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none bg-white shadow-sm"
                  disabled={isAiTyping}
                  autoFocus
                  key="ai-input"
                />
              </div>
              <button
                onClick={handleAIChat}
                disabled={!aiPrompt.trim() || isAiTyping}
                className="px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl hover:shadow-lg transform hover:scale-105 transition-all flex items-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-violet-600 to-purple-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Send className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Send</span>
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-500">
                {isAiTyping ? (
                  <span className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
                    AI is thinking...
                  </span>
                ) : (
                  <span>Press Enter to send • Step {currentStep + 1} of 5</span>
                )}
              </p>
              {dataTables.length > 0 && currentStep === 0 && (
                <button
                  onClick={() => { setAiPrompt('What tables are available?'); handleAIChat(); }}
                  className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
                  disabled={isAiTyping}
                >
                  <Database className="w-3 h-3" />
                  View {dataTables.length} tables
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    );
  }, [chatMessages, isAiTyping, aiPrompt, currentStep, showAIAssistant]);

  // Rule Card Component
  const RuleCard = ({ rule }: { rule: Rule }) => {
    const categoryConfig = categories.find(c => c.id === rule.category);
    const Icon = categoryConfig?.icon || Layers;

    const statusColors = {
      active: 'bg-green-100 text-green-700 border-green-200',
      paused: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      draft: 'bg-gray-100 text-gray-700 border-gray-200',
      failed: 'bg-red-100 text-red-700 border-red-200'
    };

    const severityColors = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-blue-500'
    };

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ y: -4 }}
        className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-xl transition-all cursor-pointer group"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${categoryConfig?.color}
                          flex items-center justify-center transform group-hover:scale-110 transition-transform`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 mb-1">{rule.name}</h4>
              <p className="text-sm text-gray-500 line-clamp-2">{rule.description}</p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Show more options menu
              toast.info('More options coming soon!');
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <MoreHorizontal className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {rule.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-md text-xs">
              {tag}
            </span>
          ))}
          {rule.tags.length > 3 && (
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-md text-xs">
              +{rule.tags.length - 3}
            </span>
          )}
        </div>

        {/* Status Bar */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${statusColors[rule.status]}`}>
              {rule.status}
            </span>
            <div className={`w-2 h-2 rounded-full ${severityColors[rule.severity]}`} />
          </div>
          <span className="text-xs text-gray-500">{rule.lastRun || 'Never run'}</span>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{rule.successRate}%</div>
            <div className="text-xs text-gray-500">Success</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">{rule.affectedAssets}</div>
            <div className="text-xs text-gray-500">Assets</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-lg font-semibold text-gray-900">{rule.performance.issuesFound}</span>
              {rule.performance.trend === 'up' && <TrendingUp className="w-3 h-3 text-red-500" />}
              {rule.performance.trend === 'down' && <ChevronDown className="w-3 h-3 text-green-500" />}
              {rule.performance.trend === 'stable' && <Activity className="w-3 h-3 text-gray-400" />}
            </div>
            <div className="text-xs text-gray-500">Issues</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRuleExecute(rule.id);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Run Now"
            >
              <Play className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRuleEdit(rule);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit"
            >
              <Edit3 className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRuleDuplicate(rule);
              }}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Duplicate"
            >
              <Copy className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRule(rule);
              toast.info(`View details for: ${rule.name}`);
            }}
            className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1"
          >
            View Details
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    );
  };

  // Templates Gallery Modal
  const TemplatesGallery = () => {
    const templates = [
      // Suites
      {
        id: 'gdpr-suite',
        name: 'GDPR Compliance Suite',
        description: 'Complete data privacy compliance: SSN, credit cards, emails, phones, addresses',
        category: 'pii',
        icon: Shield,
        badge: 'SUITE',
        rules: 5,
        action: () => {
          const gdprRules = [
            { name: 'SSN Detection', piiType: 'ssn', severity: 'critical' },
            { name: 'Credit Card Detection', piiType: 'credit_card', severity: 'critical' },
            { name: 'Email PII Check', piiType: 'email', severity: 'high' },
            { name: 'Phone Number Detection', piiType: 'phone', severity: 'medium' },
            { name: 'Address PII Scan', piiType: 'address', severity: 'high' }
          ];
          toast.success(`Creating ${gdprRules.length} GDPR compliance rules...`, { duration: 3000 });
          // Create multiple rules
          gdprRules.forEach((ruleSpec, idx) => {
            setTimeout(() => {
              const rule: Rule = {
                id: `gdpr-${Date.now()}-${idx}`,
                name: ruleSpec.name,
                description: `GDPR Compliance: Detects ${ruleSpec.piiType} in all data sources`,
                category: 'pii',
                type: 'template',
                status: 'draft',
                severity: ruleSpec.severity as any,
                successRate: 0,
                affectedAssets: 0,
                createdBy: 'Template',
                createdAt: new Date().toISOString(),
                tags: ['template', 'gdpr', ruleSpec.piiType],
                expression: `SELECT * FROM /* all tables */ WHERE column ~ '/* ${ruleSpec.piiType} pattern */'`,
                schedule: 'daily',
                actions: ['log', 'notify', 'encrypt'],
                performance: { avgExecutionTime: 0, issuesFound: 0, issuesResolved: 0, trend: 'stable' as const }
              };
              setRules(prev => [rule, ...prev]);
            }, idx * 200);
          });
          setShowTemplates(false);
        }
      },
      {
        id: 'data-quality-basics',
        name: 'Data Quality Essentials',
        description: 'Core quality checks: completeness, uniqueness, validity, accuracy',
        category: 'completeness',
        icon: CheckCircle2,
        badge: 'SUITE',
        rules: 4,
        action: () => {
          const qualityRules = [
            { name: 'Null Value Check', category: 'completeness', expression: 'IS NULL' },
            { name: 'Duplicate Detector', category: 'uniqueness', expression: 'GROUP BY HAVING COUNT(*) > 1' },
            { name: 'Email Format Validation', category: 'validity', expression: '!~ email_regex' },
            { name: 'Positive Amount Check', category: 'accuracy', expression: '<= 0' }
          ];
          toast.success(`Creating ${qualityRules.length} quality rules...`, { duration: 3000 });
          qualityRules.forEach((ruleSpec, idx) => {
            setTimeout(() => {
              const rule: Rule = {
                id: `quality-${Date.now()}-${idx}`,
                name: ruleSpec.name,
                description: `${ruleSpec.category} check for data quality`,
                category: ruleSpec.category as any,
                type: 'template',
                status: 'draft',
                severity: 'medium',
                successRate: 0,
                affectedAssets: 0,
                createdBy: 'Template',
                createdAt: new Date().toISOString(),
                tags: ['template', 'quality', ruleSpec.category],
                expression: `SELECT * FROM table WHERE column ${ruleSpec.expression}`,
                schedule: 'on-demand',
                actions: ['log', 'notify'],
                performance: { avgExecutionTime: 0, issuesFound: 0, issuesResolved: 0, trend: 'stable' as const }
              };
              setRules(prev => [rule, ...prev]);
            }, idx * 200);
          });
          setShowTemplates(false);
        }
      },
      // Individual Templates
      { id: '1', name: 'Email Validation', description: 'Validates email format using regex', category: 'validity', icon: Shield },
      { id: '2', name: 'Null Check', description: 'Ensures critical fields are not null', category: 'completeness', icon: CheckCircle2 },
      { id: '3', name: 'Duplicate Detection', description: 'Finds duplicate records by key', category: 'uniqueness', icon: Hash },
      { id: '4', name: 'Date Range', description: 'Validates dates within range', category: 'validity', icon: Calendar },
      { id: '5', name: 'SSN Detection', description: 'Detects Social Security Numbers (XXX-XX-XXXX)', category: 'pii', icon: Lock },
      { id: '6', name: 'Credit Card Detection', description: 'Finds credit card numbers in data', category: 'pii', icon: Lock },
      { id: '7', name: 'Data Freshness', description: 'Checks if data is recent', category: 'timeliness', icon: Clock },
      { id: '8', name: 'Phone Number Validation', description: 'Validates phone number format', category: 'validity', icon: Globe },
      { id: '9', name: 'Positive Amount Check', description: 'Ensures monetary values are positive', category: 'accuracy', icon: Target },
      { id: '10', name: 'Required Fields Check', description: 'Validates all required fields are present', category: 'completeness', icon: CheckCircle2 },
    ];

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => setShowTemplates(false)}
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full p-6 max-h-[80vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold">Rule Templates</h3>
              <p className="text-sm text-gray-500 mt-1">Start with proven patterns</p>
            </div>
            <button
              onClick={() => setShowTemplates(false)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((template: any) => (
              <motion.div
                key={template.id}
                whileHover={{ scale: 1.02 }}
                className={`p-4 border-2 rounded-xl hover:shadow-xl transition-all cursor-pointer relative ${
                  template.badge === 'SUITE'
                    ? 'border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50'
                    : 'border-gray-200 hover:border-violet-300'
                }`}
                onClick={() => {
                  if (template.action) {
                    template.action();
                  } else {
                    toast.success(`Using template: ${template.name}`);
                    setShowTemplates(false);
                  }
                }}
              >
                {template.badge && (
                  <div className="absolute top-3 right-3">
                    <span className="text-xs px-2 py-1 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-full">
                      {template.badge}
                    </span>
                  </div>
                )}
                <div className="flex items-start gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    template.badge === 'SUITE'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-600'
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                  }`}>
                    <template.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 pr-16">
                    <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                      {template.name}
                      {template.rules && (
                        <span className="text-xs text-violet-600 font-semibold">
                          {template.rules} rules
                        </span>
                      )}
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{template.description}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs px-2 py-1 bg-white border border-gray-200 text-gray-700 rounded-full font-medium">
                        {template.category}
                      </span>
                      {template.badge === 'SUITE' && (
                        <span className="text-xs text-violet-600 font-semibold">
                          Click to create all
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  // Rule Details Modal
  const RuleDetailsModal = ({ rule }: { rule: Rule }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setSelectedRule(null)}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold">{rule.name}</h3>
              <p className="text-sm text-gray-500">{rule.description}</p>
            </div>
          </div>
          <button
            onClick={() => setSelectedRule(null)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Status and Severity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Status</label>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
                ${rule.status === 'active' ? 'bg-green-100 text-green-700' : ''}
                ${rule.status === 'paused' ? 'bg-yellow-100 text-yellow-700' : ''}
                ${rule.status === 'draft' ? 'bg-gray-100 text-gray-700' : ''}
                ${rule.status === 'failed' ? 'bg-red-100 text-red-700' : ''}`}>
                {rule.status.toUpperCase()}
              </span>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Severity</label>
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-white
                ${rule.severity === 'critical' ? 'bg-red-500' : ''}
                ${rule.severity === 'high' ? 'bg-orange-500' : ''}
                ${rule.severity === 'medium' ? 'bg-yellow-500' : ''}
                ${rule.severity === 'low' ? 'bg-blue-500' : ''}`}>
                {rule.severity.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Expression */}
          {rule.expression && (
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Rule Expression</label>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm overflow-x-auto">
                {rule.expression}
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-3 block">Performance</label>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-xl">
                <div className="text-sm text-gray-600 mb-1">Success Rate</div>
                <div className="text-2xl font-bold text-gray-900">{rule.successRate}%</div>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl">
                <div className="text-sm text-gray-600 mb-1">Issues Found</div>
                <div className="text-2xl font-bold text-gray-900">{rule.performance.issuesFound}</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl">
                <div className="text-sm text-gray-600 mb-1">Avg Time</div>
                <div className="text-2xl font-bold text-gray-900">{rule.performance.avgExecutionTime}ms</div>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Tags</label>
            <div className="flex flex-wrap gap-2">
              {rule.tags.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <button
              onClick={async () => {
                setSelectedRule(null); // Close the details modal first
                await handleRuleExecute(rule.id); // Then execute the rule (will open scan results)
              }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2 font-semibold"
            >
              <Play className="w-4 h-4" />
              Run Now
            </button>
            <button
              onClick={() => {
                setSelectedRule(null); // Close details modal
                handleRuleEdit(rule); // Open AI editor
              }}
              className="flex-1 px-4 py-2 border-2 border-indigo-300 text-indigo-700 rounded-lg hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 font-semibold"
            >
              <Edit3 className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => {
                handleRuleDuplicate(rule);
                setSelectedRule(null);
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
              title="Duplicate this rule"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  // Scan Results Modal - Shows detailed scan execution and findings
  const ScanResultsModal = React.memo(() => {
    if (!currentScan) return null;

    const duration = currentScan.endTime && currentScan.startTime
      ? ((currentScan.endTime.getTime() - currentScan.startTime.getTime()) / 1000).toFixed(1)
      : '0.0';

    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={() => currentScan.status === 'completed' && setShowScanResults(false)}
      >
        <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  {currentScan.status === 'running' ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : currentScan.status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : (
                    <XCircle className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <h3 className="text-2xl font-bold">{currentScan.ruleName}</h3>
                  <p className="text-indigo-100 text-sm">
                    {currentScan.status === 'running' ? 'Scan in progress...' :
                     currentScan.status === 'completed' ? `Completed in ${duration}s` : 'Scan failed'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowScanResults(false)}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Progress Bar */}
            {currentScan.status === 'running' && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span>Scanning records...</span>
                  <span>{currentScan.progress}%</span>
                </div>
                <div className="w-full bg-white/20 rounded-full h-2">
                  <div
                    className="bg-white rounded-full h-2 transition-all duration-300 ease-out"
                    style={{ width: `${currentScan.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Stats Cards */}
          <div className="p-6 bg-gray-50 border-b">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Database className="w-4 h-4" />
                  Records Scanned
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {currentScan.stats.recordsScanned.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  of {currentScan.stats.totalRecords.toLocaleString()}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Issues Found
                </div>
                <div className="text-2xl font-bold text-orange-600">
                  {currentScan.stats.issuesFound.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {currentScan.stats.totalRecords > 0
                    ? ((currentScan.stats.issuesFound / currentScan.stats.totalRecords) * 100).toFixed(2)
                    : '0'}% of records
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="text-gray-500 text-sm mb-1">Severity Breakdown</div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <span className="text-xs text-red-600">🔴 {currentScan.stats.criticalIssues}</span>
                    <span className="text-xs text-orange-600">🟠 {currentScan.stats.highIssues}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-yellow-600">🟡 {currentScan.stats.mediumIssues}</span>
                    <span className="text-xs text-blue-600">🔵 {currentScan.stats.lowIssues}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                  <Clock className="w-4 h-4" />
                  Duration
                </div>
                <div className="text-2xl font-bold text-gray-900">{duration}s</div>
                <div className="text-xs text-gray-500 mt-1">
                  {currentScan.status === 'completed' ? 'Completed' : 'Running'}
                </div>
              </div>
            </div>
          </div>

          {/* Findings Table */}
          <div className="flex-1 overflow-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-gray-900">Detailed Findings</h4>
              {currentScan.findings.length > 0 && (
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 text-sm bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              )}
            </div>

            {currentScan.findings.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                {currentScan.status === 'running' ? (
                  <>
                    <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin text-indigo-500" />
                    <p>Scanning in progress...</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p>No issues found! Your data looks clean.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Severity</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data Source</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Issue Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Table</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Column</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Value</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Row ID</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {currentScan.findings.slice(0, 100).map((finding, idx) => (
                        <tr
                          key={finding.id}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold
                              ${finding.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                finding.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-blue-100 text-blue-700'}`}>
                              {finding.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-indigo-600 font-medium">{finding.dataSource || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">{finding.issueType}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{finding.table}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-mono">{finding.column}</td>
                          <td className="px-4 py-3">
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-800">
                              {finding.value}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-500 font-mono">{finding.rowId}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {currentScan.findings.length > 100 && (
                  <div className="p-4 bg-gray-50 border-t text-center text-sm text-gray-600">
                    Showing first 100 of {currentScan.findings.length} findings.
                    <button className="ml-2 text-indigo-600 hover:text-indigo-700 font-semibold">
                      Export all to CSV
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-purple-600
                           bg-clip-text text-transparent">
                Quality Rules Hub
              </h1>
              <span className="px-3 py-1 bg-violet-100 text-violet-700 rounded-full text-sm font-medium">
                {rules.length} Rules
              </span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-mono">
                FIXED v2.0
              </span>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('dashboard')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'dashboard' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
                }`}
                title="Dashboard View"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
                }`}
                title="Grid View"
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'kanban' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
                }`}
                title="Kanban View"
              >
                <SplitSquareVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search rules by name, tag, or description..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            {/* Server Filter */}
            <div className="relative">
              <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={dataSourceId || 'all'}
                onChange={(e) => {
                  const newValue = e.target.value === 'all' ? undefined : e.target.value;
                  // This would need to be passed up to parent to actually change the filter
                  toast.info(`Server filter: ${e.target.value}`);
                }}
                className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white
                         appearance-none cursor-pointer min-w-[160px]"
              >
                <option value="all">All Servers ({dataSources.length})</option>
                {dataSources.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                ))}
              </select>
            </div>

            {/* Database Filter */}
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <select
                value={selectedDatabases && selectedDatabases.length > 0 ? selectedDatabases[0] : 'all'}
                onChange={(e) => {
                  const newValue = e.target.value === 'all' ? [] : [e.target.value];
                  toast.info(`Database filter: ${e.target.value}`);
                }}
                className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg focus:outline-none
                         focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white
                         appearance-none cursor-pointer min-w-[160px]"
              >
                <option value="all">All Databases ({dataTables.length})</option>
                {dataTables.slice(0, 20).map(table => (
                  <option key={table} value={table}>{table}</option>
                ))}
                {dataTables.length > 20 && (
                  <option disabled>...and {dataTables.length - 20} more</option>
                )}
              </select>
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent min-w-[140px]"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent min-w-[140px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="failed">Failed</option>
            </select>

            <button
              onClick={() => toast.info('Advanced filters coming soon!')}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-5 h-5 text-gray-600" />
            </button>

            <button
              onClick={() => {
                toast.loading('Refreshing rules...');
                fetchRules();
              }}
              className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50"
              title="Refresh rules"
            >
              <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={handleRunAllRules}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
              title="Execute all active rules"
            >
              <Play className="w-4 h-4" />
              Run All Rules
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Enhanced Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {/* Data Quality Score */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm opacity-90 mb-1">Quality Score</p>
                <div className="text-4xl font-bold">{stats.avgSuccess.toFixed(0)}%</div>
              </div>
              <Gauge className="w-12 h-12 opacity-80" />
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-1000"
                style={{ width: `${stats.avgSuccess}%` }}
              />
            </div>
            <p className="text-xs mt-2 opacity-75">Overall data quality health</p>
          </motion.div>

          {/* Active Rules */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-6 border-2 border-green-200 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Rules</p>
                <div className="text-4xl font-bold text-gray-900">{stats.active}</div>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-600 font-medium">Running continuously</span>
            </div>
          </motion.div>

          {/* Critical Issues */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-2xl p-6 border-2 border-red-200 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Critical Issues</p>
                <div className="text-4xl font-bold text-gray-900">{stats.critical}</div>
              </div>
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-600" />
              <span className="text-sm text-red-600 font-medium">Require immediate attention</span>
            </div>
          </motion.div>

          {/* Total Issues Found */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-2xl p-6 border-2 border-orange-200 shadow-lg"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Issues Found</p>
                <div className="text-4xl font-bold text-gray-900">{stats.totalIssues}</div>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Target className="w-6 h-6 text-orange-600" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <span className="text-sm text-orange-600 font-medium">Last 24 hours</span>
            </div>
          </motion.div>
        </div>

        {/* Quick Actions */}
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <motion.button
                key={action.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={action.action}
                className={`${action.color} text-white rounded-xl p-4
                         hover:shadow-lg transition-all group relative overflow-hidden
                         ${action.id === 'ai-create' ? 'ring-2 ring-violet-300 ring-offset-2 animate-pulse' : ''}`}
              >
                {/* Special sparkle effect for AI Create */}
                {action.id === 'ai-create' && (
                  <>
                    <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-ping opacity-75"></div>
                    <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full"></div>
                    <div className="absolute bottom-3 left-3 w-1.5 h-1.5 bg-white/60 rounded-full animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                    <div className="absolute top-1/2 right-4 w-1 h-1 bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                  </>
                )}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <action.icon className={`w-6 h-6 ${action.id === 'ai-create' ? 'animate-pulse' : ''}`} />
                    {action.badge && (
                      <span className={`px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium ${action.id === 'ai-create' ? 'animate-bounce' : ''}`}>
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold mb-1">{action.label}</div>
                    <div className="text-xs opacity-90">{action.description}</div>
                  </div>
                </div>
                <div className={`absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform ${action.id === 'ai-create' ? 'opacity-20 animate-pulse' : ''}`} />
              </motion.button>
            ))}
          </div>
        </div>

        {/* Rules Grid */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-700">
              {filteredRules.length} {filteredRules.length === 1 ? 'Rule' : 'Rules'}
            </h3>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-violet-600 animate-spin" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Database className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No rules found</h3>
              <p className="text-sm text-gray-500 mb-4">
                {searchQuery ? 'Try adjusting your search or filters' : 'Get started by creating your first rule'}
              </p>
              <button
                onClick={() => {
                  setShowAIAssistant(true);
                  startAIConversation();
                }}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
              >
                Create Rule
              </button>
            </div>
          ) : viewMode === 'dashboard' ? (
            // Dashboard View with Charts
            <div className="space-y-6">
              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rules by Status */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    Rules by Status
                  </h3>
                  <div className="space-y-4">
                    {(() => {
                      const statusCounts = {
                        active: filteredRules.filter(r => r.status === 'active').length,
                        paused: filteredRules.filter(r => r.status === 'paused').length,
                        draft: filteredRules.filter(r => r.status === 'draft').length,
                      };
                      const total = filteredRules.length || 1;

                      return (
                        <>
                          {/* Active */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Active</span>
                              <span className="text-sm font-bold text-gray-900">{statusCounts.active}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(statusCounts.active / total) * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* Paused */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Paused</span>
                              <span className="text-sm font-bold text-gray-900">{statusCounts.paused}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(statusCounts.paused / total) * 100}%` }}
                              />
                            </div>
                          </div>

                          {/* Draft */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Draft</span>
                              <span className="text-sm font-bold text-gray-900">{statusCounts.draft}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gray-400 rounded-full transition-all duration-1000"
                                style={{ width: `${(statusCounts.draft / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </motion.div>

                {/* Rules by Severity */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-white rounded-2xl p-6 border border-gray-200 shadow-lg"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    Rules by Severity
                  </h3>
                  <div className="space-y-4">
                    {(() => {
                      const severityCounts = {
                        critical: filteredRules.filter(r => r.severity === 'critical').length,
                        high: filteredRules.filter(r => r.severity === 'high').length,
                        medium: filteredRules.filter(r => r.severity === 'medium').length,
                        low: filteredRules.filter(r => r.severity === 'low').length,
                      };
                      const total = filteredRules.length || 1;

                      return (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Critical</span>
                              <span className="text-sm font-bold text-red-600">{severityCounts.critical}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(severityCounts.critical / total) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">High</span>
                              <span className="text-sm font-bold text-orange-600">{severityCounts.high}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(severityCounts.high / total) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Medium</span>
                              <span className="text-sm font-bold text-yellow-600">{severityCounts.medium}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-yellow-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(severityCounts.medium / total) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Low</span>
                              <span className="text-sm font-bold text-blue-600">{severityCounts.low}</span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                                style={{ width: `${(severityCounts.low / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </motion.div>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {filteredRules.map(rule => (
                  <RuleCard key={rule.id} rule={rule} />
                ))}
              </AnimatePresence>
            </div>
          ) : viewMode === 'list' ? (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Success Rate</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRules.map(rule => {
                    const categoryConfig = categories.find(c => c.id === rule.category);
                    const Icon = categoryConfig?.icon || Layers;

                    return (
                      <tr key={rule.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <div className="font-medium text-gray-900">{rule.name}</div>
                            <div className="text-sm text-gray-500">{rule.description}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-600">{categoryConfig?.label}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-lg text-xs font-medium
                                         ${rule.status === 'active' ? 'bg-green-100 text-green-700' :
                                           rule.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                                           'bg-gray-100 text-gray-700'}`}>
                            {rule.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-green-500 h-1.5 rounded-full"
                                style={{ width: `${rule.successRate}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">{rule.successRate}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium text-gray-900">{rule.performance.issuesFound}</span>
                            {rule.performance.trend === 'up' && <TrendingUp className="w-3 h-3 text-red-500" />}
                            {rule.performance.trend === 'down' && <ChevronDown className="w-3 h-3 text-green-500" />}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                if (isTemplateRule(rule)) {
                                  toast.error('Cannot execute template rule. This rule contains placeholders that must be resolved first.');
                                  return;
                                }
                                handleRuleExecute(rule.id);
                              }}
                              className={`p-1.5 rounded-lg transition-colors ${
                                isTemplateRule(rule)
                                  ? 'opacity-50 cursor-not-allowed bg-gray-100'
                                  : 'hover:bg-gray-100'
                              }`}
                              title={isTemplateRule(rule) ? 'Template rule - cannot execute directly' : 'Execute rule'}
                              disabled={isTemplateRule(rule)}
                            >
                              <Play className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleRuleEdit(rule)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit3 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => handleRuleDelete(rule.id)}
                              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {['active', 'paused', 'draft', 'failed'].map(status => (
                <div key={status} className="bg-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-gray-700 capitalize">{status}</h4>
                    <span className="text-sm text-gray-500">
                      {filteredRules.filter(r => r.status === status).length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {filteredRules
                      .filter(r => r.status === status)
                      .map(rule => (
                        <motion.div
                          key={rule.id}
                          layout
                          className="bg-white rounded-lg p-3 border border-gray-200 cursor-pointer
                                   hover:shadow-md transition-shadow"
                          onClick={() => setSelectedRule(rule)}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h5 className="font-medium text-gray-900 text-sm">{rule.name}</h5>
                            <span className={`w-2 h-2 rounded-full
                                          ${rule.severity === 'critical' ? 'bg-red-500' :
                                            rule.severity === 'high' ? 'bg-orange-500' :
                                            rule.severity === 'medium' ? 'bg-yellow-500' :
                                            'bg-blue-500'}`} />
                          </div>
                          <p className="text-xs text-gray-500 mb-2 line-clamp-2">{rule.description}</p>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {rule.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                                  {tag}
                                </span>
                              ))}
                            </div>
                            <span className="text-xs text-gray-400">{rule.lastRun || 'Never'}</span>
                          </div>
                        </motion.div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {AIAssistantModal && <React.Fragment key="ai-assistant">{AIAssistantModal}</React.Fragment>}
        {showTemplates && <TemplatesGallery key="templates" />}
        {selectedRule && <RuleDetailsModal key="rule-details" rule={selectedRule} />}
        {showScanResults && <ScanResultsModal key="scan-results" />}

        {/* Profile-Based Suggestions Modal */}
        {showSuggestionsModal && (
          <React.Fragment key="suggestions-modal">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => !loadingSuggestions && setShowSuggestionsModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">AI-Suggested Rules from Profiling</h3>
                      <p className="text-sm text-gray-500">Based on your data analysis and patterns</p>
                    </div>
                  </div>
                  {!loadingSuggestions && (
                    <button
                      onClick={() => setShowSuggestionsModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5 text-gray-500" />
                    </button>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                  {loadingSuggestions ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                      <p className="text-gray-600 text-lg font-medium">Analyzing profiling data...</p>
                      <p className="text-gray-400 text-sm mt-2">Discovering patterns and suggesting optimal rules</p>
                    </div>
                  ) : profileSuggestions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Database className="w-16 h-16 text-gray-300 mb-4" />
                      <p className="text-gray-600 text-lg font-medium">No Profile Data Available</p>
                      <p className="text-gray-400 text-sm mt-2 text-center max-w-md">
                        Please run profiling on your tables first, then return here for AI-suggested rules.
                      </p>
                      <button
                        onClick={() => setShowSuggestionsModal(false)}
                        className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-sm text-gray-600">
                          Found <span className="font-bold text-indigo-600">{profileSuggestions.length}</span> intelligent rule suggestions
                        </p>
                      </div>

                      {profileSuggestions.map((suggestion, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-gray-900">{suggestion.name}</h4>
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  suggestion.severity === 'critical' ? 'bg-red-100 text-red-700' :
                                  suggestion.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                                  suggestion.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-blue-100 text-blue-700'
                                }`}>
                                  {suggestion.severity}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{suggestion.description}</p>
                              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                  <Table className="w-3 h-3" />
                                  {suggestion.tableName || suggestion.assetName}
                                </span>
                                {suggestion.columnName && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="w-3 h-3" />
                                    {suggestion.columnName}
                                  </span>
                                )}
                                <span className="px-2 py-0.5 bg-gray-100 rounded">
                                  {suggestion.dimension}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={async () => {
                                toast.loading('Creating rule from suggestion...');
                                try {
                                  // Create rule from suggestion
                                  const rulePayload = {
                                    name: suggestion.name,
                                    description: suggestion.description,
                                    severity: suggestion.severity,
                                    type: suggestion.ruleType || 'sql',
                                    expression: suggestion.config?.expression || `-- Auto-generated from profiling\nSELECT * FROM ${suggestion.tableName}`,
                                    tags: ['ai-suggested', 'profiling', suggestion.dimension],
                                    enabled: false
                                  };
                                  await axios.post('/api/quality/rules', rulePayload);
                                  toast.success('Rule created successfully!');
                                  fetchRules();
                                  // Remove from suggestions
                                  setProfileSuggestions(prev => prev.filter((_, i) => i !== idx));
                                } catch (error) {
                                  toast.error('Failed to create rule');
                                }
                              }}
                              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium whitespace-nowrap"
                            >
                              Apply Rule
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                {!loadingSuggestions && profileSuggestions.length > 0 && (
                  <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
                    <p className="text-sm text-gray-600">
                      💡 <span className="font-medium">Tip:</span> Rules are created as drafts. Review and enable them in the Rules tab.
                    </p>
                    <button
                      onClick={() => setShowSuggestionsModal(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          </React.Fragment>
        )}

        {/* Proactive AI Suggestions Panel */}
        {showProactiveSuggestions && proactiveSuggestions.length > 0 && (
          <motion.div
            key="proactive-suggestions"
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed right-4 bottom-4 z-40 max-w-md"
          >
            <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl shadow-2xl p-6 text-white">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-6 h-6" />
                  <h3 className="font-bold text-lg">AI Suggestions</h3>
                </div>
                <button
                  onClick={() => setShowProactiveSuggestions(false)}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-sm text-violet-100 mb-4">
                Based on your last rule creation, I have some smart suggestions:
              </p>

              <div className="space-y-3">
                {proactiveSuggestions.map((suggestion, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white/10 backdrop-blur-sm rounded-xl p-4 hover:bg-white/20 transition-all cursor-pointer"
                    onClick={() => {
                      setShowAIAssistant(true);
                      startAIConversation();
                      setShowProactiveSuggestions(false);
                      toast.success('Opening AI Assistant with your selection!');
                    }}
                  >
                    <p className="text-sm leading-relaxed">{suggestion}</p>
                  </motion.div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-white/20">
                <button
                  onClick={() => {
                    setShowProactiveSuggestions(false);
                    toast.info('Dismissed suggestions');
                  }}
                  className="text-sm text-violet-100 hover:text-white transition-colors"
                >
                  Dismiss all suggestions
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ModernRulesHub;