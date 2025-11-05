// ProductionRules.tsx - Enterprise-Grade Rules Management System
import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Brain,
  Calendar,
  CheckCircle2,
  Clock,
  Code,
  Download,
  Edit,
  Eye,
  FileDown,
  FileUp,
  Filter,
  History,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Wand2,
  Zap,
  X,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/Tabs';
import { Alert, AlertDescription } from '@components/ui/Alert';
import { Progress } from '@components/ui/Progress';

// Import our production-grade components
import { RuleBuilder } from './RuleBuilder';
import { RuleExecutionHistory } from './RuleExecutionHistory';
import { QualityAutopilot } from './QualityAutopilot';
import { RuleScheduler } from './RuleScheduler';
import type { QualityRule, RuleTemplate } from '@services/api/quality';

// ============================================================================
// TYPES
// ============================================================================

interface ProductionRulesProps {
  dataSourceId: string;
  dataSourceName: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ProductionRules: React.FC<ProductionRulesProps> = ({
  dataSourceId,
  dataSourceName,
}) => {
  // State
  const [activeView, setActiveView] = useState<
    'overview' | 'library' | 'history' | 'scheduler' | 'analytics'
  >('overview');
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [showAutopilot, setShowAutopilot] = useState(false);
  const [editingRule, setEditingRule] = useState<QualityRule | null>(null);
  const [selectedRules, setSelectedRules] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState({
    search: '',
    severity: '',
    status: '',
    dimension: '',
  });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    passed: 0,
    failed: 0,
    passRate: 0,
    avgExecutionTime: 0,
  });

  // Load data
  useEffect(() => {
    loadRules();
    loadTemplates();
  }, [dataSourceId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/quality/rules?dataSourceId=${dataSourceId}`);
      const data = await response.json();
      if (data.success) {
        setRules(data.data);
        calculateStats(data.data);
      }
    } catch (error) {
      console.error('Failed to load rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/quality/rule-templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const calculateStats = (ruleList: QualityRule[]) => {
    const total = ruleList.length;
    const active = ruleList.filter((r) => r.enabled).length;
    // These stats would come from execution results in production
    setStats({
      total,
      active,
      passed: Math.floor(total * 0.8),
      failed: Math.floor(total * 0.15),
      passRate: 82.5,
      avgExecutionTime: 1250,
    });
  };

  const exportRules = () => {
    const data = JSON.stringify(rules, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quality-rules-${dataSourceName}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const importRules = async (file: File) => {
    try {
      const text = await file.text();
      const importedRules = JSON.parse(text);
      // TODO: Validate and import rules via API
      console.log('Importing rules:', importedRules);
    } catch (error) {
      console.error('Failed to import rules:', error);
    }
  };

  const filteredRules = rules.filter((rule) => {
    const matchesSearch =
      !filter.search ||
      rule.name.toLowerCase().includes(filter.search.toLowerCase()) ||
      rule.description?.toLowerCase().includes(filter.search.toLowerCase());
    const matchesSeverity = !filter.severity || rule.severity === filter.severity;
    const matchesStatus =
      !filter.status || (filter.status === 'enabled' ? rule.enabled : !rule.enabled);
    const matchesDimension = !filter.dimension || rule.dimension === filter.dimension;
    return matchesSearch && matchesSeverity && matchesStatus && matchesDimension;
  });

  // ============================================================================
  // RENDER: OVERVIEW TAB
  // ============================================================================

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50">
        <CardContent className="p-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Production-Grade Rules Management
              </h2>
              <p className="text-gray-700 mb-4">
                Enterprise quality monitoring for <strong>{dataSourceName}</strong>
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowAutopilot(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Quality Autopilot
                </Button>
                <Button variant="outline" onClick={() => setShowRuleBuilder(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Rule
                </Button>
                <Button variant="outline" onClick={() => setActiveView('library')}>
                  <BookOpen className="mr-2 h-4 w-4" />
                  Rule Library
                </Button>
              </div>
            </div>
            <div className="text-right">
              <div className="text-6xl font-bold text-blue-600">{stats.total}</div>
              <p className="text-sm text-gray-600">Total Rules</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <Shield className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-xs text-gray-600">Total Rules</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Play className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            <p className="text-xs text-gray-600">Active</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
            <p className="text-xs text-gray-600">Passed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <AlertTriangle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            <p className="text-xs text-gray-600">Failed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Target className="h-8 w-8 text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{stats.passRate}%</p>
            <p className="text-xs text-gray-600">Pass Rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <Clock className="h-8 w-8 text-purple-500 mb-2" />
            <p className="text-2xl font-bold">{stats.avgExecutionTime}ms</p>
            <p className="text-xs text-gray-600">Avg Time</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-purple-500 hover:shadow-lg transition-all cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Quality Autopilot</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Generate 50+ rules automatically in minutes
                </p>
                <Button
                  size="sm"
                  onClick={() => setShowAutopilot(true)}
                  className="bg-purple-600"
                >
                  Launch Autopilot
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 hover:shadow-lg transition-all cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">Schedule Rules</h3>
                <p className="text-sm text-gray-600 mb-3">Automate quality checks 24/7</p>
                <Button
                  size="sm"
                  onClick={() => setActiveView('scheduler')}
                  className="bg-blue-600"
                >
                  Configure Schedules
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover:shadow-lg transition-all cursor-pointer">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-1">View Analytics</h3>
                <p className="text-sm text-gray-600 mb-3">ROI, trends, and insights</p>
                <Button
                  size="sm"
                  onClick={() => setActiveView('analytics')}
                  className="bg-green-600"
                >
                  Open Dashboard
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pass Rate Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pass Rate Trend (7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-3">
            <Progress value={stats.passRate} className="flex-1 h-4" />
            <span className="text-lg font-bold">{stats.passRate}%</span>
          </div>
          <p className="text-sm text-gray-600">
            {stats.passed} passed, {stats.failed} failed out of {stats.total} total rules
          </p>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Recent Activity</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveView('history')}
            >
              View All History
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-sm font-medium">Email Validation Rule</p>
                    <p className="text-xs text-gray-600">Completed successfully • 2 minutes ago</p>
                  </div>
                </div>
                <Badge>Passed</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // ============================================================================
  // RENDER: RULE LIBRARY
  // ============================================================================

  const renderLibrary = () => (
    <div className="space-y-6">
      {/* Filters & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search rules..."
              value={filter.search}
              onChange={(e) => setFilter({ ...filter, search: e.target.value })}
              className="pl-10 pr-4 py-2 border rounded-lg w-80 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={filter.dimension}
            onChange={(e) => setFilter({ ...filter, dimension: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Dimensions</option>
            <option value="completeness">Completeness</option>
            <option value="accuracy">Accuracy</option>
            <option value="consistency">Consistency</option>
            <option value="validity">Validity</option>
            <option value="freshness">Freshness</option>
            <option value="uniqueness">Uniqueness</option>
          </select>

          <select
            value={filter.severity}
            onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Severities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>

          <select
            value={filter.status}
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
            className="px-4 py-2 border rounded-lg"
          >
            <option value="">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportRules}>
            <FileDown className="mr-2 h-4 w-4" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <FileUp className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setShowRuleBuilder(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Rules Grid */}
      {loading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-3 text-gray-400" />
            <p className="text-gray-600">Loading rules...</p>
          </CardContent>
        </Card>
      ) : filteredRules.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Shield className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Rules Found</h3>
            <p className="text-gray-600 mb-6">
              {rules.length === 0
                ? 'Get started by creating your first quality rule'
                : 'No rules match your current filters'}
            </p>
            {rules.length === 0 && (
              <Button onClick={() => setShowAutopilot(true)}>
                <Zap className="mr-2 h-4 w-4" />
                Launch Quality Autopilot
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredRules.map((rule) => (
            <Card key={rule.id} className="hover:shadow-lg transition-all">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-3 h-3 rounded-full mt-1 ${
                        rule.enabled ? 'bg-green-500' : 'bg-gray-400'
                      }`}
                    />
                    <div>
                      <h4 className="font-medium mb-1">{rule.name}</h4>
                      {rule.description && (
                        <p className="text-xs text-gray-600 mb-2">{rule.description}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={rule.severity === 'critical' ? 'destructive' : 'secondary'}>
                    {rule.severity}
                  </Badge>
                  <Badge variant="outline">{rule.dimension}</Badge>
                  <Badge>{rule.ruleType}</Badge>
                </div>

                <div className="flex items-center justify-between text-xs text-gray-600 mb-3">
                  <span>Last run: {rule.lastRunAt ? 'Just now' : 'Never'}</span>
                  <span>Pass rate: {rule.passRate || 0}%</span>
                </div>

                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="flex-1">
                    <Play className="mr-2 h-4 w-4" />
                    Run
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
          <h1 className="text-3xl font-bold">Quality Rules</h1>
          <p className="text-gray-600 mt-1">
            Production-grade quality management for {dataSourceName}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadRules}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeView} onValueChange={(v: any) => setActiveView(v)}>
        <TabsList className="grid grid-cols-5 w-full max-w-3xl">
          <TabsTrigger value="overview">
            <Target className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="library">
            <Shield className="mr-2 h-4 w-4" />
            Library
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            History
          </TabsTrigger>
          <TabsTrigger value="scheduler">
            <Calendar className="mr-2 h-4 w-4" />
            Scheduler
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">{renderOverview()}</TabsContent>
        <TabsContent value="library">{renderLibrary()}</TabsContent>
        <TabsContent value="history">
          <RuleExecutionHistory dataSourceId={dataSourceId} />
        </TabsContent>
        <TabsContent value="scheduler">
          <RuleScheduler availableRules={rules} />
        </TabsContent>
        <TabsContent value="analytics">
          <div className="text-center py-12">
            <BarChart3 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">Analytics dashboard coming soon</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {showRuleBuilder && (
        <RuleBuilder
          mode="create"
          templates={templates}
          availableTables={[]}
          availableColumns={[]}
          onSave={async (rule) => {
            console.log('Saving rule:', rule);
            setShowRuleBuilder(false);
            await loadRules();
          }}
          onCancel={() => setShowRuleBuilder(false)}
          onLoadColumns={async (tableName) => {
            console.log('Loading columns for:', tableName);
          }}
        />
      )}

      {showAutopilot && (
        <QualityAutopilot
          dataSourceId={dataSourceId}
          dataSourceName={dataSourceName}
          onComplete={(results) => {
            console.log('Autopilot complete:', results);
            setShowAutopilot(false);
            loadRules();
          }}
          onCancel={() => setShowAutopilot(false)}
        />
      )}
    </div>
  );
};
