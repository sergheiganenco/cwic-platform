// Rule Builder Component - Create and Edit Quality Rules
import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  AlertTriangle,
  Info,
  Database,
  Table,
  Columns,
  FileCode,
  Wand2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Input } from '@components/ui/Input';
import { Label } from '@components/ui/Label';
import { Textarea } from '@components/ui/Textarea';
import { Select } from '@components/ui/Select';
import { Alert, AlertDescription } from '@components/ui/Alert';
import { Badge } from '@components/ui/Badge';
import { generateSampleQuery } from '@utils/mockDataGenerators';
import type { QualityRule } from '@services/api/quality';
import type { DataSourceType } from '@/types/dataSources';

interface RuleBuilderProps {
  rule?: QualityRule | null;
  dataSourceId?: string;
  dataSourceType?: DataSourceType;
  onSave: (rule: Partial<QualityRule>) => Promise<void>;
  onCancel: () => void;
  availableTables?: Array<{ name: string; schema?: string }>;
  availableColumns?: Array<{ name: string; type: string }>;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  rule,
  dataSourceId,
  dataSourceType = 'postgresql',
  onSave,
  onCancel,
  availableTables = [],
  availableColumns = []
}) => {
  const isEditing = !!rule;

  // Form state
  const [formData, setFormData] = useState<Partial<QualityRule>>({
    name: '',
    description: '',
    rule_type: 'nullCheck',
    dimension: 'completeness',
    severity: 'medium',
    table_name: '',
    column_name: '',
    expression: '',
    threshold: 95,
    enabled: true,
    data_source_id: dataSourceId,
    ...rule
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showQueryHelper, setShowQueryHelper] = useState(false);
  const [generatedQuery, setGeneratedQuery] = useState('');

  // Rule type options
  const ruleTypes = [
    { value: 'nullCheck', label: 'Null Check', description: 'Check for NULL values' },
    { value: 'duplicateCheck', label: 'Duplicate Check', description: 'Find duplicate values' },
    { value: 'rangeCheck', label: 'Range Check', description: 'Validate values are within range' },
    { value: 'patternCheck', label: 'Pattern Check', description: 'Match against a pattern' },
    { value: 'freshnessCheck', label: 'Freshness Check', description: 'Check data recency' },
    { value: 'uniqueness', label: 'Uniqueness', description: 'Ensure values are unique' },
    { value: 'completeness', label: 'Completeness', description: 'Check for missing data' },
    { value: 'consistency', label: 'Consistency', description: 'Validate data consistency' },
    { value: 'custom', label: 'Custom SQL', description: 'Write custom validation query' }
  ];

  // Dimension options
  const dimensions = [
    { value: 'completeness', label: 'Completeness', icon: '📊' },
    { value: 'uniqueness', label: 'Uniqueness', icon: '🔑' },
    { value: 'validity', label: 'Validity', icon: '✓' },
    { value: 'consistency', label: 'Consistency', icon: '🔄' },
    { value: 'freshness', label: 'Freshness', icon: '⏰' },
    { value: 'accuracy', label: 'Accuracy', icon: '🎯' }
  ];

  // Generate sample query when rule type or table/column changes
  useEffect(() => {
    if (formData.rule_type && formData.table_name && formData.column_name) {
      const query = generateSampleQuery(
        dataSourceType,
        formData.rule_type,
        formData.table_name,
        formData.column_name
      );
      setGeneratedQuery(query);
      if (!formData.expression || formData.expression === '') {
        setFormData(prev => ({ ...prev, expression: query }));
      }
    }
  }, [formData.rule_type, formData.table_name, formData.column_name, dataSourceType]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (!formData.table_name?.trim()) {
      newErrors.table_name = 'Table name is required';
    }

    if (!formData.column_name?.trim() && formData.rule_type !== 'custom') {
      newErrors.column_name = 'Column name is required';
    }

    if (!formData.expression?.trim()) {
      newErrors.expression = 'Query expression is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save rule:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Get friendly database name
  const getDatabaseTypeName = (type: DataSourceType): string => {
    const names: Record<string, string> = {
      'postgresql': 'PostgreSQL',
      'mysql': 'MySQL',
      'mssql': 'SQL Server',
      'oracle': 'Oracle',
      'mongodb': 'MongoDB',
      'snowflake': 'Snowflake',
      'bigquery': 'BigQuery',
      'redshift': 'Redshift'
    };
    return names[type] || type.toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between sticky top-0 bg-white z-10 border-b">
          <CardTitle className="flex items-center gap-2">
            {isEditing ? (
              <>
                <FileCode className="h-5 w-5" />
                Edit Quality Rule
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" />
                Create New Quality Rule
              </>
            )}
            <Badge variant="outline" className="ml-2">
              {getDatabaseTypeName(dataSourceType)}
            </Badge>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="hover:bg-gray-100"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Basic Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Rule Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Customer Email Validation"
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <Select
                  label="Severity"
                  id="severity"
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                  options={[
                    { value: 'low', label: '● Low' },
                    { value: 'medium', label: '● Medium' },
                    { value: 'high', label: '● High' },
                    { value: 'critical', label: '● Critical' }
                  ]}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe what this rule validates..."
                rows={2}
              />
            </div>
          </div>

          {/* Rule Configuration */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
              Rule Configuration
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Select
                  label="Rule Type"
                  id="rule_type"
                  value={formData.rule_type}
                  onChange={(e) => setFormData({ ...formData, rule_type: e.target.value })}
                  options={ruleTypes.map(type => ({
                    value: type.value,
                    label: type.label
                  }))}
                />
              </div>

              <div>
                <Select
                  label="Quality Dimension"
                  id="dimension"
                  value={formData.dimension}
                  onChange={(e) => setFormData({ ...formData, dimension: e.target.value })}
                  options={dimensions.map(dim => ({
                    value: dim.value,
                    label: dim.label
                  }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="table_name">Table Name *</Label>
                <div className="flex gap-2">
                  <Input
                    id="table_name"
                    value={formData.table_name}
                    onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                    placeholder="e.g., customers"
                    className={`flex-1 ${errors.table_name ? 'border-red-500' : ''}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={availableTables.length === 0}
                    title="Select from available tables"
                  >
                    <Table className="h-4 w-4" />
                  </Button>
                </div>
                {errors.table_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.table_name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="column_name">Column Name *</Label>
                <div className="flex gap-2">
                  <Input
                    id="column_name"
                    value={formData.column_name}
                    onChange={(e) => setFormData({ ...formData, column_name: e.target.value })}
                    placeholder="e.g., email"
                    className={`flex-1 ${errors.column_name ? 'border-red-500' : ''}`}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={availableColumns.length === 0}
                    title="Select from available columns"
                  >
                    <Columns className="h-4 w-4" />
                  </Button>
                </div>
                {errors.column_name && (
                  <p className="text-xs text-red-500 mt-1">{errors.column_name}</p>
                )}
              </div>
            </div>

            {/* Threshold for certain rule types */}
            {['rangeCheck', 'freshnessCheck', 'completeness'].includes(formData.rule_type || '') && (
              <div>
                <Label htmlFor="threshold">
                  Pass Threshold (%)
                  <span className="text-xs text-gray-500 ml-2">
                    Minimum percentage to pass validation
                  </span>
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseInt(e.target.value) })}
                  placeholder="95"
                />
              </div>
            )}
          </div>

          {/* Query Expression */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
                Query Expression
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowQueryHelper(!showQueryHelper)}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Query Helper
              </Button>
            </div>

            {showQueryHelper && generatedQuery && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium">Generated {getDatabaseTypeName(dataSourceType)} Query:</p>
                    <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto">
                      {generatedQuery}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFormData({ ...formData, expression: generatedQuery })}
                    >
                      Use This Query
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="expression">SQL Expression *</Label>
              <Textarea
                id="expression"
                value={formData.expression}
                onChange={(e) => setFormData({ ...formData, expression: e.target.value })}
                placeholder={`Enter ${getDatabaseTypeName(dataSourceType)} query expression...`}
                rows={6}
                className={`font-mono text-sm ${errors.expression ? 'border-red-500' : ''}`}
              />
              {errors.expression && (
                <p className="text-xs text-red-500 mt-1">{errors.expression}</p>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Write a query that returns validation results for {getDatabaseTypeName(dataSourceType)}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium">
                  {formData.enabled ? 'Rule Enabled' : 'Rule Disabled'}
                </span>
              </label>
              {formData.enabled ? (
                <Badge variant="default" className="bg-green-100 text-green-800">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              )}
            </div>

            <div className="text-xs text-gray-500">
              {isEditing ? `Editing rule: ${rule.id}` : 'Creating new rule'}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[100px]"
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEditing ? 'Update Rule' : 'Create Rule'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};