import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
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
  SplitSquareVertical
} from 'lucide-react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Tooltip } from '@/components/ui/Tooltip';

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

const ModernRulesHub: React.FC = () => {
  // State Management
  const [rules, setRules] = useState<Rule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'kanban'>('grid');
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [selectedRule, setSelectedRule] = useState<Rule | null>(null);
  const [isCreatingRule, setIsCreatingRule] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showInsights, setShowInsights] = useState(true);

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
      action: () => setShowAIAssistant(true),
      badge: 'NEW',
      color: 'bg-gradient-to-r from-violet-500 to-purple-600'
    },
    {
      id: 'quick-template',
      label: 'Templates',
      icon: FileText,
      description: 'Start from proven patterns',
      action: () => setIsCreatingRule(true),
      color: 'bg-gradient-to-r from-blue-500 to-indigo-600'
    },
    {
      id: 'import',
      label: 'Import',
      icon: Upload,
      description: 'Import rules from file',
      action: () => console.log('Import'),
      color: 'bg-gradient-to-r from-green-500 to-emerald-600'
    },
    {
      id: 'scan-suggest',
      label: 'Auto-Detect',
      icon: Cpu,
      description: 'Let AI suggest rules',
      action: () => console.log('Auto-detect'),
      badge: 'SMART',
      color: 'bg-gradient-to-r from-orange-500 to-amber-600'
    }
  ];

  // Load mock data
  useEffect(() => {
    const mockRules: Rule[] = [
      {
        id: '1',
        name: 'Email Format Validation',
        description: 'Ensures all email addresses follow standard format',
        category: 'validity',
        type: 'system',
        status: 'active',
        severity: 'high',
        lastRun: '5 minutes ago',
        successRate: 98.5,
        affectedAssets: 12,
        createdBy: 'System',
        createdAt: '2024-01-15',
        tags: ['email', 'customer', 'critical'],
        expression: "email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$'",
        schedule: 'Every 15 minutes',
        actions: ['alert', 'log', 'quarantine'],
        performance: {
          avgExecutionTime: 230,
          issuesFound: 45,
          issuesResolved: 42,
          trend: 'down'
        }
      },
      {
        id: '2',
        name: 'No Null Primary Keys',
        description: 'Primary key columns must not contain null values',
        category: 'completeness',
        type: 'template',
        status: 'active',
        severity: 'critical',
        lastRun: '1 hour ago',
        successRate: 100,
        affectedAssets: 34,
        createdBy: 'Admin',
        createdAt: '2024-01-10',
        tags: ['database', 'integrity', 'critical'],
        schedule: 'Hourly',
        actions: ['alert', 'block'],
        performance: {
          avgExecutionTime: 150,
          issuesFound: 0,
          issuesResolved: 0,
          trend: 'stable'
        }
      },
      {
        id: '3',
        name: 'SSN Detection',
        description: 'Identifies potential Social Security Numbers in data',
        category: 'pii',
        type: 'ai-generated',
        status: 'active',
        severity: 'critical',
        lastRun: '10 minutes ago',
        successRate: 95.2,
        affectedAssets: 8,
        createdBy: 'AI Assistant',
        createdAt: '2024-01-20',
        tags: ['pii', 'compliance', 'sensitive'],
        schedule: 'Real-time',
        actions: ['mask', 'alert', 'audit'],
        performance: {
          avgExecutionTime: 180,
          issuesFound: 23,
          issuesResolved: 20,
          trend: 'up'
        }
      },
      {
        id: '4',
        name: 'Date Consistency Check',
        description: 'Validates date formats across all temporal columns',
        category: 'consistency',
        type: 'custom',
        status: 'paused',
        severity: 'medium',
        lastRun: '2 days ago',
        successRate: 87.3,
        affectedAssets: 19,
        createdBy: 'DataOps Team',
        createdAt: '2024-01-05',
        tags: ['dates', 'format', 'consistency'],
        actions: ['log', 'transform'],
        performance: {
          avgExecutionTime: 450,
          issuesFound: 120,
          issuesResolved: 95,
          trend: 'down'
        }
      }
    ];
    setRules(mockRules);
  }, []);

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
    const avgSuccess = rules.reduce((acc, r) => acc + r.successRate, 0) / (rules.length || 1);
    const totalIssues = rules.reduce((acc, r) => acc + r.performance.issuesFound, 0);

    return { active, critical, avgSuccess, totalIssues };
  }, [rules]);

  // AI Assistant Component
  const AIAssistant = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={() => setShowAIAssistant(false)}
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.9 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">AI Rule Assistant</h3>
              <p className="text-sm text-gray-500">Describe what you want to validate in plain English</p>
            </div>
          </div>
          <button
            onClick={() => setShowAIAssistant(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <XCircle className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-200">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-violet-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-violet-900 mb-2">Try these examples:</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    "Check if customer emails are valid",
                    "Find duplicate records in orders table",
                    "Ensure no future dates in birth_date column",
                    "Detect credit card numbers in any field"
                  ].map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setAiPrompt(example)}
                      className="text-xs bg-white px-3 py-1.5 rounded-lg border border-violet-200
                               hover:bg-violet-50 hover:border-violet-300 transition-all"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Example: Make sure all phone numbers have 10 digits and start with a valid area code..."
              className="w-full h-32 px-4 py-3 border border-gray-200 rounded-xl resize-none
                       focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
                       placeholder:text-gray-400"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className="text-xs text-gray-400">{aiPrompt.length}/500</span>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                Advanced Options
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAIAssistant(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                className="px-6 py-2 bg-gradient-to-r from-violet-500 to-purple-600 text-white
                         rounded-lg hover:shadow-lg transform hover:scale-105 transition-all
                         flex items-center gap-2 text-sm font-medium"
              >
                <Sparkles className="w-4 h-4" />
                Generate Rule
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

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
        onClick={() => setSelectedRule(rule)}
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
          <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-gray-100 rounded-lg">
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
          <span className="text-xs text-gray-500">{rule.lastRun}</span>
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
            <Tooltip content="Run Now">
              <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <Play className="w-4 h-4 text-gray-600" />
              </button>
            </Tooltip>
            <Tooltip content="Edit">
              <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <Edit3 className="w-4 h-4 text-gray-600" />
              </button>
            </Tooltip>
            <Tooltip content="Duplicate">
              <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <Copy className="w-4 h-4 text-gray-600" />
              </button>
            </Tooltip>
          </div>
          <button className="text-xs text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
            View Details
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </motion.div>
    );
  };

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
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
                }`}
              >
                <Grid3x3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={`p-2 rounded-md transition-all ${
                  viewMode === 'kanban' ? 'bg-white shadow-sm' : 'hover:bg-gray-50'
                }`}
              >
                <SplitSquareVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
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
                  <XCircle className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none
                       focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="failed">Failed</option>
            </select>

            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <Filter className="w-5 h-5 text-gray-600" />
            </button>

            <button className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50">
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Active Rules</span>
              <Activity className="w-4 h-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
            <div className="text-xs text-gray-500 mt-1">Running continuously</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Critical Issues</span>
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.critical}</div>
            <div className="text-xs text-gray-500 mt-1">Require attention</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Success Rate</span>
              <Gauge className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.avgSuccess.toFixed(1)}%</div>
            <div className="text-xs text-gray-500 mt-1">Average performance</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">Issues Found</span>
              <Target className="w-4 h-4 text-orange-500" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalIssues}</div>
            <div className="text-xs text-gray-500 mt-1">Last 24 hours</div>
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
                         hover:shadow-lg transition-all group relative overflow-hidden`}
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <action.icon className="w-6 h-6" />
                    {action.badge && (
                      <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-medium">
                        {action.badge}
                      </span>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="font-semibold mb-1">{action.label}</div>
                    <div className="text-xs opacity-90">{action.description}</div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
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
            {showInsights && (
              <button
                onClick={() => setShowInsights(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Hide Insights
              </button>
            )}
          </div>

          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence>
                {filteredRules.map(rule => (
                  <RuleCard key={rule.id} rule={rule} />
                ))}
              </AnimatePresence>
            </div>
          )}

          {viewMode === 'list' && (
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
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                              <Play className="w-4 h-4 text-gray-600" />
                            </button>
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                              <Edit3 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                              <MoreHorizontal className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === 'kanban' && (
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
                            <span className="text-xs text-gray-400">{rule.lastRun}</span>
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

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {showAIAssistant && <AIAssistant />}
      </AnimatePresence>
    </div>
  );
};

export default ModernRulesHub;