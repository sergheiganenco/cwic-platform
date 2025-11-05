// RuleBuilder.tsx - Production-Grade Visual Rule Builder
import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  Code,
  Copy,
  Database,
  Eye,
  FileCode,
  Lightbulb,
  Play,
  Plus,
  Save,
  Settings,
  Shield,
  Sparkles,
  Target,
  TestTube,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Alert, AlertDescription } from '@components/ui/Alert';
import type { QualityRule, RuleTemplate } from '@services/api/quality';

// ============================================================================
// TYPES
// ============================================================================

interface RuleBuilderProps {
  initialRule?: Partial<QualityRule>;
  templates: RuleTemplate[];
  availableTables: Array<{ schema: string; table: string; fullName: string }>;
  availableColumns: Array<{ name: string; type: string }>;
  onSave: (rule: Partial<QualityRule>) => Promise<void>;
  onCancel: () => void;
  onTestRule?: (rule: Partial<QualityRule>) => Promise<any>;
  onLoadColumns: (tableName: string) => Promise<void>;
  mode: 'create' | 'edit';
}

type BuilderMode = 'visual' | 'sql' | 'ai' | 'template';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  initialRule,
  templates,
  availableTables,
  availableColumns,
  onSave,
  onCancel,
  onTestRule,
  onLoadColumns,
  mode,
}) => {
  // State
  const [builderMode, setBuilderMode] = useState<BuilderMode>('visual');
  const [rule, setRule] = useState<Partial<QualityRule>>(
    initialRule || {
      name: '',
      description: '',
      severity: 'medium',
      dimension: 'completeness',
      ruleType: 'threshold',
      enabled: true,
    }
  );
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<Record<string, any>>({});
  const [aiPrompt, setAiPrompt] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState(false);

  // Validation
  const validateRule = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!rule.name?.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (!rule.ruleType) {
      newErrors.ruleType = 'Rule type is required';
    }

    if (rule.ruleType === 'sql' && !rule.ruleConfig?.sql) {
      newErrors.sql = 'SQL expression is required';
    }

    if (rule.ruleType === 'threshold') {
      if (!rule.ruleConfig?.metric) {
        newErrors.metric = 'Metric is required';
      }
      if (!rule.thresholdConfig?.value) {
        newErrors.threshold = 'Threshold value is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handlers
  const handleSave = async () => {
    if (!validateRule()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(rule);
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    if (!onTestRule) return;

    setIsTesting(true);
    try {
      const result = await onTestRule(rule);
      setTestResult(result);
    } catch (error) {
      console.error('Test failed:', error);
      setTestResult({ error: 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const updateRule = (updates: Partial<QualityRule>) => {
    setRule((prev) => ({ ...prev, ...updates }));
  };

  const updateRuleConfig = (updates: any) => {
    setRule((prev) => ({
      ...prev,
      ruleConfig: { ...prev.ruleConfig, ...updates },
    }));
  };

  const updateThresholdConfig = (updates: any) => {
    setRule((prev) => ({
      ...prev,
      thresholdConfig: { ...prev.thresholdConfig, ...updates },
    }));
  };

  // ============================================================================
  // RENDER: MODE SELECTOR
  // ============================================================================

  const renderModeSelector = () => (
    <div className="grid grid-cols-4 gap-3">
      <button
        onClick={() => setBuilderMode('visual')}
        className={`p-4 rounded-lg border-2 transition-all ${
          builderMode === 'visual'
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-200 hover:border-blue-300'
        }`}
      >
        <Target className="h-6 w-6 mx-auto mb-2 text-blue-600" />
        <p className="text-sm font-medium">Visual Builder</p>
        <p className="text-xs text-gray-600 mt-1">Point & click interface</p>
      </button>

      <button
        onClick={() => setBuilderMode('template')}
        className={`p-4 rounded-lg border-2 transition-all ${
          builderMode === 'template'
            ? 'border-green-500 bg-green-50'
            : 'border-gray-200 hover:border-green-300'
        }`}
      >
        <Lightbulb className="h-6 w-6 mx-auto mb-2 text-green-600" />
        <p className="text-sm font-medium">Templates</p>
        <p className="text-xs text-gray-600 mt-1">Pre-built patterns</p>
      </button>

      <button
        onClick={() => setBuilderMode('ai')}
        className={`p-4 rounded-lg border-2 transition-all ${
          builderMode === 'ai'
            ? 'border-purple-500 bg-purple-50'
            : 'border-gray-200 hover:border-purple-300'
        }`}
      >
        <Brain className="h-6 w-6 mx-auto mb-2 text-purple-600" />
        <p className="text-sm font-medium">AI Assistant</p>
        <p className="text-xs text-gray-600 mt-1">Natural language</p>
      </button>

      <button
        onClick={() => setBuilderMode('sql')}
        className={`p-4 rounded-lg border-2 transition-all ${
          builderMode === 'sql'
            ? 'border-amber-500 bg-amber-50'
            : 'border-gray-200 hover:border-amber-300'
        }`}
      >
        <Code className="h-6 w-6 mx-auto mb-2 text-amber-600" />
        <p className="text-sm font-medium">SQL Editor</p>
        <p className="text-xs text-gray-600 mt-1">Advanced queries</p>
      </button>
    </div>
  );

  // ============================================================================
  // RENDER: VISUAL BUILDER
  // ============================================================================

  const renderVisualBuilder = () => (
    <div className="space-y-6">
      {/* Basic Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Rule Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={rule.name || ''}
            onChange={(e) => updateRule({ name: e.target.value })}
            placeholder="e.g., Check email completeness"
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
              errors.name ? 'border-red-500' : ''
            }`}
          />
          {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Severity</label>
          <select
            value={rule.severity || 'medium'}
            onChange={(e) => updateRule({ severity: e.target.value as any })}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <textarea
          value={rule.description || ''}
          onChange={(e) => updateRule({ description: e.target.value })}
          placeholder="Describe what this rule checks..."
          rows={3}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Rule Type Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">
          Rule Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {['threshold', 'sql', 'pattern', 'freshness_check', 'comparison', 'ai_anomaly'].map(
            (type) => (
              <button
                key={type}
                onClick={() => updateRule({ ruleType: type as any })}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  rule.ruleType === type
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <p className="text-sm font-medium capitalize">
                  {type.replace('_', ' ')}
                </p>
              </button>
            )
          )}
        </div>
      </div>

      {/* Dimension Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Quality Dimension</label>
        <div className="grid grid-cols-6 gap-2">
          {['completeness', 'accuracy', 'consistency', 'validity', 'freshness', 'uniqueness'].map(
            (dim) => (
              <button
                key={dim}
                onClick={() => updateRule({ dimension: dim as any })}
                className={`p-2 rounded-lg border text-xs transition-all ${
                  rule.dimension === dim
                    ? 'border-blue-500 bg-blue-50 font-medium'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                {dim}
              </button>
            )
          )}
        </div>
      </div>

      {/* Table Selection */}
      <div>
        <label className="block text-sm font-medium mb-2">Target Table</label>
        <select
          value={rule.ruleConfig?.tableName || ''}
          onChange={(e) => {
            updateRuleConfig({ tableName: e.target.value });
            onLoadColumns(e.target.value);
          }}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a table...</option>
          {availableTables.map((table) => (
            <option key={table.fullName} value={table.fullName}>
              {table.fullName}
            </option>
          ))}
        </select>
      </div>

      {/* Type-specific Configuration */}
      {rule.ruleType === 'threshold' && (
        <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-medium">Threshold Configuration</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Metric</label>
              <select
                value={rule.ruleConfig?.metric || ''}
                onChange={(e) => updateRuleConfig({ metric: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select metric...</option>
                <option value="null_rate">Null Rate</option>
                <option value="unique_rate">Unique Rate</option>
                <option value="duplicate_rate">Duplicate Rate</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Column</label>
              <select
                value={rule.ruleConfig?.columnName || ''}
                onChange={(e) => updateRuleConfig({ columnName: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
                disabled={!rule.ruleConfig?.tableName}
              >
                <option value="">Select column...</option>
                {availableColumns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Operator</label>
              <select
                value={rule.thresholdConfig?.operator || 'less_than'}
                onChange={(e) => updateThresholdConfig({ operator: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="less_than">Less Than (&lt;)</option>
                <option value="less_than_or_equal">Less Than or Equal (&lt;=)</option>
                <option value="greater_than">Greater Than (&gt;)</option>
                <option value="greater_than_or_equal">Greater Than or Equal (&gt;=)</option>
                <option value="equal">Equal (=)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Threshold Value</label>
              <input
                type="number"
                value={rule.thresholdConfig?.value || ''}
                onChange={(e) => updateThresholdConfig({ value: parseFloat(e.target.value) })}
                placeholder="e.g., 5 for 5%"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {rule.ruleType === 'pattern' && (
        <div className="space-y-4 p-4 bg-green-50 rounded-lg">
          <h4 className="font-medium">Pattern Configuration</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Column</label>
              <select
                value={rule.ruleConfig?.columnName || ''}
                onChange={(e) => updateRuleConfig({ columnName: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select column...</option>
                {availableColumns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Pattern Type</label>
              <select
                value={rule.ruleConfig?.patternType || ''}
                onChange={(e) => {
                  const patterns: Record<string, string> = {
                    email: '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$',
                    phone: '^\\+?1?[2-9]\\d{2}[2-9]\\d{6}$',
                    url: '^https?://[^\\s/$.?#].[^\\s]*$',
                    custom: '',
                  };
                  updateRuleConfig({
                    patternType: e.target.value,
                    pattern: patterns[e.target.value] || '',
                  });
                }}
                className="w-full px-4 py-2 border rounded-lg"
              >
                <option value="">Select pattern...</option>
                <option value="email">Email</option>
                <option value="phone">Phone Number</option>
                <option value="url">URL</option>
                <option value="custom">Custom Regex</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-sm font-medium mb-2">Regex Pattern</label>
              <input
                type="text"
                value={rule.ruleConfig?.pattern || ''}
                onChange={(e) => updateRuleConfig({ pattern: e.target.value })}
                placeholder="Enter regex pattern..."
                className="w-full px-4 py-2 border rounded-lg font-mono text-sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // RENDER: SQL BUILDER
  // ============================================================================

  const renderSqlBuilder = () => (
    <div className="space-y-4">
      <Alert className="bg-amber-50 border-amber-200">
        <Code className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-sm text-amber-800">
          Write a SQL query that returns a boolean <strong>passed</strong> column.
          Additional columns will be captured as metadata.
        </AlertDescription>
      </Alert>

      <div>
        <label className="block text-sm font-medium mb-2">SQL Query</label>
        <textarea
          value={rule.ruleConfig?.sql || ''}
          onChange={(e) => updateRuleConfig({ sql: e.target.value })}
          placeholder={`SELECT
  COUNT(*) FILTER (WHERE email IS NULL) < 10 as passed,
  COUNT(*) FILTER (WHERE email IS NULL) as null_count,
  COUNT(*) as total_rows
FROM users`}
          rows={12}
          className="w-full px-4 py-2 border rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
        />
        {errors.sql && <p className="text-xs text-red-500 mt-1">{errors.sql}</p>}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
          <Eye className="mr-2 h-4 w-4" />
          {showPreview ? 'Hide' : 'Show'} Preview
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={isTesting}>
          {isTesting ? (
            <>
              <TestTube className="mr-2 h-4 w-4 animate-pulse" />
              Testing...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Test Query
            </>
          )}
        </Button>
      </div>

      {showPreview && rule.ruleConfig?.sql && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Query Preview:</h4>
          <pre className="text-xs font-mono bg-white p-3 rounded border overflow-x-auto">
            {rule.ruleConfig.sql}
          </pre>
        </div>
      )}

      {testResult && (
        <Alert
          className={
            testResult.error
              ? 'bg-red-50 border-red-200'
              : testResult.passed
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }
        >
          {testResult.error ? (
            <>
              <X className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-sm text-red-800">
                <strong>Test Failed:</strong> {testResult.error}
              </AlertDescription>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-sm">
                <strong>Test Result:</strong> {testResult.passed ? 'Passed' : 'Failed'}
                <br />
                {JSON.stringify(testResult, null, 2)}
              </AlertDescription>
            </>
          )}
        </Alert>
      )}
    </div>
  );

  // ============================================================================
  // RENDER: AI BUILDER
  // ============================================================================

  const renderAiBuilder = () => (
    <div className="space-y-6">
      <Alert className="bg-purple-50 border-purple-200">
        <Brain className="h-4 w-4 text-purple-600" />
        <AlertDescription className="text-sm text-purple-800">
          Describe your quality check in plain English. Our AI will generate the SQL for you.
        </AlertDescription>
      </Alert>

      <div>
        <label className="block text-sm font-medium mb-2">
          What do you want to check?
        </label>
        <textarea
          value={aiPrompt}
          onChange={(e) => setAiPrompt(e.target.value)}
          placeholder="e.g., 'Check that all customer emails are valid and not null'"
          rows={4}
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
        />
      </div>

      <Button className="w-full bg-purple-600 hover:bg-purple-700">
        <Wand2 className="mr-2 h-4 w-4" />
        Generate Rule with AI
      </Button>

      <div className="grid grid-cols-3 gap-3">
        <button className="p-3 border rounded-lg text-left hover:border-purple-300 transition-all">
          <p className="text-xs font-medium">Check for nulls</p>
        </button>
        <button className="p-3 border rounded-lg text-left hover:border-purple-300 transition-all">
          <p className="text-xs font-medium">Validate format</p>
        </button>
        <button className="p-3 border rounded-lg text-left hover:border-purple-300 transition-all">
          <p className="text-xs font-medium">Find duplicates</p>
        </button>
      </div>
    </div>
  );

  // ============================================================================
  // RENDER: TEMPLATE BUILDER
  // ============================================================================

  const renderTemplateBuilder = () => (
    <div className="space-y-4">
      {!selectedTemplate ? (
        <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
          {templates.map((template) => (
            <button
              key={template.id}
              onClick={() => setSelectedTemplate(template)}
              className="p-4 border-2 rounded-lg text-left hover:border-green-500 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-sm">{template.name}</h4>
                <Badge
                  variant={template.severity === 'critical' ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {template.severity}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mb-2">{template.description}</p>
              <div className="flex items-center justify-between">
                <Badge className="text-xs">{template.dimension}</Badge>
                <span className="text-xs text-gray-500">{template.category}</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedTemplate(null)}
          >
            ← Back to templates
          </Button>
          <div className="border-l-4 border-green-500 bg-green-50 p-4 rounded">
            <h3 className="font-semibold text-lg mb-1">{selectedTemplate.name}</h3>
            <p className="text-sm text-gray-700 mb-2">{selectedTemplate.description}</p>
          </div>
        </div>
      )}
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="border-b sticky top-0 bg-white z-10">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-600" />
              {mode === 'create' ? 'Create Quality Rule' : 'Edit Quality Rule'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Mode Selector */}
          {renderModeSelector()}

          {/* Builder Content */}
          <div className="min-h-[400px]">
            {builderMode === 'visual' && renderVisualBuilder()}
            {builderMode === 'sql' && renderSqlBuilder()}
            {builderMode === 'ai' && renderAiBuilder()}
            {builderMode === 'template' && renderTemplateBuilder()}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rule.enabled ?? true}
                  onChange={(e) => updateRule({ enabled: e.target.checked })}
                  className="rounded"
                />
                Enable rule immediately
              </label>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              {onTestRule && (
                <Button variant="outline" onClick={handleTest} disabled={isTesting}>
                  {isTesting ? (
                    <>
                      <TestTube className="mr-2 h-4 w-4 animate-pulse" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" />
                      Test Rule
                    </>
                  )}
                </Button>
              )}
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Save className="mr-2 h-4 w-4 animate-pulse" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {mode === 'create' ? 'Create Rule' : 'Save Changes'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
