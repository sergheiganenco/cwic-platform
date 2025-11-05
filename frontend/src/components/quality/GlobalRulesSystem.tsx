// Global Rules System - Enterprise-grade quality rules that apply across all data
import React, { useState, useEffect } from 'react';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Database,
  Table,
  Columns,
  Eye,
  ChevronRight,
  Zap,
  Target,
  Brain,
  Sparkles,
  BarChart3,
  Info,
  Settings,
  Play,
  Pause,
  RefreshCw,
  GitBranch,
  Layers,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Progress } from '@components/ui/Progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@components/ui/Tabs';
import { Alert, AlertDescription } from '@components/ui/Alert';

// Global rule categories that apply to ALL tables
const GLOBAL_RULE_CATEGORIES = [
  {
    id: 'data_integrity',
    name: 'Data Integrity',
    icon: Shield,
    color: 'blue',
    description: 'Core data quality checks that ensure data reliability',
    rules: [
      {
        id: 'null_detection',
        name: 'Null Value Detection',
        description: 'Identifies missing values in critical fields across all tables',
        severity: 'high',
        autoFix: true,
        applies: 'All non-nullable columns'
      },
      {
        id: 'duplicate_detection',
        name: 'Duplicate Record Detection',
        description: 'Finds duplicate entries based on key fields',
        severity: 'critical',
        autoFix: false,
        applies: 'Primary keys, unique constraints'
      },
      {
        id: 'referential_integrity',
        name: 'Referential Integrity',
        description: 'Validates foreign key relationships',
        severity: 'critical',
        autoFix: false,
        applies: 'All foreign key relationships'
      },
      {
        id: 'orphan_records',
        name: 'Orphan Record Detection',
        description: 'Identifies records without valid parent references',
        severity: 'high',
        autoFix: true,
        applies: 'Child tables with foreign keys'
      }
    ]
  },
  {
    id: 'data_consistency',
    name: 'Data Consistency',
    icon: GitBranch,
    color: 'purple',
    description: 'Ensures data follows consistent patterns and formats',
    rules: [
      {
        id: 'format_validation',
        name: 'Format Validation',
        description: 'Validates emails, phones, postal codes, etc.',
        severity: 'medium',
        autoFix: true,
        applies: 'Email, phone, postal code columns'
      },
      {
        id: 'data_type_mismatch',
        name: 'Data Type Validation',
        description: 'Detects values that don\'t match expected data types',
        severity: 'high',
        autoFix: false,
        applies: 'All columns with defined types'
      },
      {
        id: 'range_validation',
        name: 'Range & Boundary Checks',
        description: 'Ensures values are within acceptable ranges',
        severity: 'medium',
        autoFix: false,
        applies: 'Numeric, date columns'
      },
      {
        id: 'enum_validation',
        name: 'Enumeration Validation',
        description: 'Validates against allowed value lists',
        severity: 'medium',
        autoFix: true,
        applies: 'Status, type, category columns'
      }
    ]
  },
  {
    id: 'data_freshness',
    name: 'Data Freshness',
    icon: Activity,
    color: 'green',
    description: 'Monitors data recency and update patterns',
    rules: [
      {
        id: 'stale_data',
        name: 'Stale Data Detection',
        description: 'Identifies data that hasn\'t been updated recently',
        severity: 'medium',
        autoFix: false,
        applies: 'Tables with timestamp columns'
      },
      {
        id: 'future_dates',
        name: 'Future Date Detection',
        description: 'Finds dates that are incorrectly in the future',
        severity: 'high',
        autoFix: true,
        applies: 'Date/timestamp columns'
      },
      {
        id: 'update_frequency',
        name: 'Update Frequency Monitoring',
        description: 'Tracks if data is updating at expected intervals',
        severity: 'low',
        autoFix: false,
        applies: 'Time-series data'
      }
    ]
  },
  {
    id: 'data_completeness',
    name: 'Data Completeness',
    icon: Layers,
    color: 'orange',
    description: 'Ensures all required data is present',
    rules: [
      {
        id: 'required_fields',
        name: 'Required Field Validation',
        description: 'Checks all mandatory fields are populated',
        severity: 'critical',
        autoFix: false,
        applies: 'Required/NOT NULL columns'
      },
      {
        id: 'sparse_data',
        name: 'Sparse Data Detection',
        description: 'Identifies columns with too many nulls',
        severity: 'medium',
        autoFix: false,
        applies: 'All nullable columns'
      },
      {
        id: 'incomplete_records',
        name: 'Incomplete Record Detection',
        description: 'Finds records missing critical information',
        severity: 'high',
        autoFix: false,
        applies: 'Records with multiple fields'
      }
    ]
  },
  {
    id: 'data_anomalies',
    name: 'Anomaly Detection',
    icon: Brain,
    color: 'red',
    description: 'AI-powered detection of unusual patterns',
    rules: [
      {
        id: 'outlier_detection',
        name: 'Statistical Outlier Detection',
        description: 'Finds values that deviate significantly from normal',
        severity: 'medium',
        autoFix: false,
        applies: 'Numeric columns',
        aiPowered: true
      },
      {
        id: 'pattern_anomalies',
        name: 'Pattern Anomaly Detection',
        description: 'Detects unusual patterns in data sequences',
        severity: 'medium',
        autoFix: false,
        applies: 'Time-series, transactional data',
        aiPowered: true
      },
      {
        id: 'volume_anomalies',
        name: 'Volume Anomaly Detection',
        description: 'Identifies unusual spikes or drops in data volume',
        severity: 'high',
        autoFix: false,
        applies: 'All tables',
        aiPowered: true
      }
    ]
  }
];

interface GlobalRulesSystemProps {
  dataSourceId?: string;
  onDrillDown?: (ruleId: string, table?: string) => void;
  onConfigureRule?: (ruleId: string) => void;
}

export const GlobalRulesSystem: React.FC<GlobalRulesSystemProps> = ({
  dataSourceId,
  onDrillDown,
  onConfigureRule
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('data_integrity');
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [ruleStatus, setRuleStatus] = useState<Record<string, any>>({});
  const [executionMode, setExecutionMode] = useState<'manual' | 'scheduled' | 'realtime'>('scheduled');

  // Simulate rule execution status
  useEffect(() => {
    const mockStatus: Record<string, any> = {};
    GLOBAL_RULE_CATEGORIES.forEach(category => {
      category.rules.forEach(rule => {
        mockStatus[rule.id] = {
          enabled: Math.random() > 0.2,
          lastRun: new Date(Date.now() - Math.random() * 86400000).toISOString(),
          issuesFound: Math.floor(Math.random() * 1000),
          tablesAffected: Math.floor(Math.random() * 50),
          passRate: 70 + Math.random() * 30,
          trend: Math.random() > 0.5 ? 'improving' : 'degrading',
          coverage: {
            tables: Math.floor(Math.random() * 100),
            columns: Math.floor(Math.random() * 1000),
            rows: Math.floor(Math.random() * 1000000)
          }
        };
      });
    });
    setRuleStatus(mockStatus);
  }, []);

  const selectedCategoryData = GLOBAL_RULE_CATEGORIES.find(c => c.id === selectedCategory);

  const toggleRuleExpansion = (ruleId: string) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  const getStatusColor = (passRate: number) => {
    if (passRate >= 95) return 'text-green-600';
    if (passRate >= 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: string) => {
    return trend === 'improving' ?
      <TrendingUp className="h-4 w-4 text-green-600" /> :
      <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Header with Global Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold">Global Quality Rules</CardTitle>
              <p className="text-sm text-gray-600 mt-1">
                Enterprise-wide rules that automatically apply to all your data
              </p>
            </div>
            <div className="flex items-center gap-4">
              {/* Execution Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={executionMode === 'manual' ? 'default' : 'ghost'}
                  onClick={() => setExecutionMode('manual')}
                  className="text-xs"
                >
                  Manual
                </Button>
                <Button
                  size="sm"
                  variant={executionMode === 'scheduled' ? 'default' : 'ghost'}
                  onClick={() => setExecutionMode('scheduled')}
                  className="text-xs"
                >
                  Scheduled
                </Button>
                <Button
                  size="sm"
                  variant={executionMode === 'realtime' ? 'default' : 'ghost'}
                  onClick={() => setExecutionMode('realtime')}
                  className="text-xs"
                >
                  Real-time
                </Button>
              </div>

              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </Button>

              <Button variant="default" size="sm">
                <Play className="h-4 w-4 mr-2" />
                Run All Rules
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Global Overview Stats */}
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {Object.values(ruleStatus).filter(s => s.enabled).length}
              </div>
              <div className="text-xs text-gray-600">Active Rules</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {Object.values(ruleStatus).reduce((sum, s) => sum + (s.issuesFound || 0), 0).toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Total Issues</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {Object.values(ruleStatus).reduce((sum, s) => sum + (s.tablesAffected || 0), 0)}
              </div>
              <div className="text-xs text-gray-600">Tables Monitored</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">
                {(Object.values(ruleStatus).reduce((sum, s) => sum + (s.passRate || 0), 0) / Object.keys(ruleStatus).length).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-600">Avg Pass Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                24/7
              </div>
              <div className="text-xs text-gray-600">Monitoring</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs and Rule Details */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Categories */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rule Categories</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {GLOBAL_RULE_CATEGORIES.map((category) => {
                  const Icon = category.icon;
                  const categoryRules = category.rules;
                  const categoryIssues = categoryRules.reduce(
                    (sum, rule) => sum + (ruleStatus[rule.id]?.issuesFound || 0),
                    0
                  );

                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full text-left p-3 rounded-lg transition-all ${
                        selectedCategory === category.id
                          ? 'bg-blue-50 border-2 border-blue-500'
                          : 'hover:bg-gray-50 border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <Icon className={`h-5 w-5 mt-0.5 text-${category.color}-600`} />
                          <div>
                            <div className="font-medium text-sm">{category.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {categoryRules.length} rules
                            </div>
                          </div>
                        </div>
                        {categoryIssues > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {categoryIssues}
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI Insights */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Alert>
                <Sparkles className="h-4 w-4 text-yellow-600" />
                <AlertDescription>
                  <div className="text-xs">
                    <strong>Pattern Detected:</strong> Email validation failures increased 23% after recent data import
                  </div>
                </AlertDescription>
              </Alert>
              <Alert>
                <Target className="h-4 w-4 text-blue-600" />
                <AlertDescription>
                  <div className="text-xs">
                    <strong>Recommendation:</strong> Enable auto-fix for format validation rules to improve pass rate by ~15%
                  </div>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>

        {/* Right: Rule Details */}
        <div className="col-span-9">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedCategoryData?.name}</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {selectedCategoryData?.description}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {selectedCategoryData?.rules.length} Rules
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selectedCategoryData?.rules.map((rule) => {
                  const status = ruleStatus[rule.id] || {};
                  const isExpanded = expandedRules.has(rule.id);

                  return (
                    <Card key={rule.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        {/* Rule Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              {/* Status Indicator */}
                              <div className="mt-1">
                                {status.enabled ? (
                                  <CheckCircle className="h-5 w-5 text-green-600" />
                                ) : (
                                  <XCircle className="h-5 w-5 text-gray-400" />
                                )}
                              </div>

                              {/* Rule Info */}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{rule.name}</h4>
                                  {rule.aiPowered && (
                                    <Badge variant="outline" className="text-xs">
                                      <Brain className="h-3 w-3 mr-1" />
                                      AI-Powered
                                    </Badge>
                                  )}
                                  {rule.autoFix && (
                                    <Badge variant="outline" className="text-xs bg-green-50">
                                      <Zap className="h-3 w-3 mr-1" />
                                      Auto-Fix
                                    </Badge>
                                  )}
                                  <Badge
                                    variant={
                                      rule.severity === 'critical' ? 'destructive' :
                                      rule.severity === 'high' ? 'default' :
                                      'secondary'
                                    }
                                    className="text-xs"
                                  >
                                    {rule.severity}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  Applies to: <span className="font-medium">{rule.applies}</span>
                                </p>

                                {/* Stats Bar */}
                                {status.enabled && (
                                  <div className="flex items-center gap-6 mt-3 text-xs">
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500">Pass Rate:</span>
                                      <span className={`font-bold ${getStatusColor(status.passRate)}`}>
                                        {status.passRate?.toFixed(1)}%
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500">Issues:</span>
                                      <span className="font-bold text-red-600">
                                        {status.issuesFound?.toLocaleString()}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500">Tables:</span>
                                      <span className="font-bold">
                                        {status.tablesAffected}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-gray-500">Trend:</span>
                                      {getTrendIcon(status.trend)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleRuleExpansion(rule.id)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                {isExpanded ? 'Hide' : 'View'} Details
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onDrillDown?.(rule.id)}
                              >
                                <Table className="h-3 w-3 mr-1" />
                                View Issues
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onConfigureRule?.(rule.id)}
                              >
                                <Settings className="h-3 w-3 mr-1" />
                                Configure
                              </Button>
                              {status.enabled ? (
                                <Button size="sm" variant="ghost">
                                  <Pause className="h-3 w-3 mr-1" />
                                  Disable
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost">
                                  <Play className="h-3 w-3 mr-1" />
                                  Enable
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && status.enabled && (
                          <div className="mt-4 pt-4 border-t">
                            <div className="grid grid-cols-2 gap-4">
                              {/* Coverage Info */}
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-gray-700">Coverage</h5>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Tables Scanned:</span>
                                    <span className="font-medium">{status.coverage?.tables}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Columns Checked:</span>
                                    <span className="font-medium">{status.coverage?.columns}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-gray-500">Rows Analyzed:</span>
                                    <span className="font-medium">{status.coverage?.rows?.toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Top Issues */}
                              <div className="space-y-2">
                                <h5 className="text-sm font-medium text-gray-700">Top Affected Tables</h5>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">customers</span>
                                    <Badge variant="destructive" className="text-xs">234</Badge>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">orders</span>
                                    <Badge variant="destructive" className="text-xs">156</Badge>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-gray-600">products</span>
                                    <Badge variant="destructive" className="text-xs">89</Badge>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span>Quality Score</span>
                                <span className="font-medium">{status.passRate?.toFixed(1)}%</span>
                              </div>
                              <Progress value={status.passRate} className="h-2" />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};