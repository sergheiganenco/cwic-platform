// Visual Rule Builder - Drag & Drop No-Code Rule Creation
import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Wand2,
  Play,
  Eye,
  ChevronRight,
  Plus,
  Trash2,
  Copy,
  AlertCircle,
  CheckCircle,
  Database,
  Table,
  Columns,
  Filter,
  Code,
  Zap
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Input } from '@components/ui/Input';
import { Label } from '@components/ui/Label';
import { Select } from '@components/ui/Select';
import { Textarea } from '@components/ui/Textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card';
import { Badge } from '@components/ui/Badge';
import { Alert, AlertDescription } from '@components/ui/Alert';
import type { QualityRule } from '@services/api/quality';

interface VisualRuleBuilderProps {
  rule?: QualityRule | null;
  dataSourceId?: string;
  selectedDatabase?: string;
  onSave: (rule: Partial<QualityRule>) => Promise<void>;
  onCancel: () => void;
}

type RuleBlock = {
  id: string;
  type: 'condition' | 'action' | 'filter';
  config: Record<string, any>;
};

const RULE_PATTERNS = [
  {
    id: 'null_check',
    name: 'Null Value Check',
    description: 'Detect missing or null values',
    icon: AlertCircle,
    category: 'completeness',
    template: {
      condition: 'IS NULL',
      severity: 'high',
      autoFix: true
    }
  },
  {
    id: 'duplicate_check',
    name: 'Duplicate Detection',
    description: 'Find duplicate records',
    icon: Copy,
    category: 'uniqueness',
    template: {
      condition: 'COUNT > 1',
      severity: 'critical',
      autoFix: false
    }
  },
  {
    id: 'format_validation',
    name: 'Format Validation',
    description: 'Validate email, phone, etc.',
    icon: CheckCircle,
    category: 'validity',
    template: {
      condition: 'REGEX MATCH',
      severity: 'medium',
      autoFix: true
    }
  },
  {
    id: 'range_check',
    name: 'Range Validation',
    description: 'Check if values are in range',
    icon: Filter,
    category: 'validity',
    template: {
      condition: 'BETWEEN',
      severity: 'medium',
      autoFix: false
    }
  },
  {
    id: 'freshness_check',
    name: 'Data Freshness',
    description: 'Check if data is recent',
    icon: Zap,
    category: 'freshness',
    template: {
      condition: 'DATE DIFF',
      severity: 'high',
      autoFix: false
    }
  }
];

export const VisualRuleBuilder: React.FC<VisualRuleBuilderProps> = ({
  rule,
  dataSourceId,
  selectedDatabase,
  onSave,
  onCancel
}) => {
  const [mode, setMode] = useState<'visual' | 'code'>('visual');
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<RuleBlock[]>([]);
  const [previewResults, setPreviewResults] = useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Table and column dropdowns
  const [tables, setTables] = useState<any[]>([]);
  const [columns, setColumns] = useState<any[]>([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);

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

  // Update formData when rule prop changes (for editing)
  useEffect(() => {
    if (rule) {
      setFormData(prev => ({
        ...prev,
        ...rule
      }));
      // If rule has a pattern, select it
      if (rule.rule_type) {
        const pattern = RULE_PATTERNS.find(p =>
          p.id === rule.rule_type ||
          (rule.expression && rule.expression.includes(p.id))
        );
        if (pattern) {
          setSelectedPattern(pattern.id);
        }
      }
    }
  }, [rule]);

  // Fetch tables when dataSourceId or selectedDatabase changes
  useEffect(() => {
    if (dataSourceId) {
      fetchTables();
    }
  }, [dataSourceId, selectedDatabase]);

  // Fetch columns when table_name changes
  useEffect(() => {
    if (formData.table_name && dataSourceId) {
      fetchColumns(formData.table_name);
    } else {
      setColumns([]);
    }
  }, [formData.table_name, dataSourceId]);

  const fetchTables = async () => {
    console.log('[VisualRuleBuilder] fetchTables called with dataSourceId:', dataSourceId, 'database:', selectedDatabase);
    if (!dataSourceId) {
      console.warn('[VisualRuleBuilder] No dataSourceId provided to fetchTables');
      return;
    }

    setLoadingTables(true);
    try {
      // Build URL with optional database filter
      let url = `http://localhost:3002/catalog/assets?dataSourceId=${dataSourceId}&limit=100`;
      if (selectedDatabase && selectedDatabase !== 'all') {
        url += `&database=${encodeURIComponent(selectedDatabase)}`;
      }
      console.log('[VisualRuleBuilder] Fetching tables from:', url);
      const response = await fetch(url);
      const data = await response.json();
      console.log('[VisualRuleBuilder] API response:', {
        success: data.success,
        hasData: !!data.data,
        hasAssets: !!data.data?.assets,
        assetCount: data.data?.assets?.length || data.data?.length || 0,
        total: data.data?.pagination?.total || data.pagination?.total || 0
      });

      // Handle both API response formats: { data: { assets: [...] } } and { data: [...] }
      const assets = data.data?.assets || data.data || [];

      if (data.success && assets.length > 0) {
        // Filter only tables (not views or functions), handle both naming conventions
        let tableAssets = assets.filter((asset: any) =>
          asset.type === 'table' &&
          (asset.table || asset.tableName) &&
          (asset.schema || asset.schemaName)
        );

        // Apply database filtering on frontend if needed
        if (selectedDatabase && selectedDatabase !== 'all') {
          const originalCount = tableAssets.length;
          tableAssets = tableAssets.filter((asset: any) =>
            asset.databaseName === selectedDatabase
          );
          console.log(`[VisualRuleBuilder] Database filter applied: ${selectedDatabase}, reduced from ${originalCount} to ${tableAssets.length} tables`);
        }

        console.log(`[VisualRuleBuilder] Filtered ${tableAssets.length} tables from ${assets.length} total assets`);

        // Get unique table names (handle both naming conventions)
        // Include database name if multiple databases are present
        const databases = new Set(tableAssets.map((a: any) => a.databaseName));
        const showDatabase = databases.size > 1;

        const uniqueTables = Array.from(
          new Map(
            tableAssets.map((asset: any) => {
              const schema = asset.schema || asset.schemaName;
              const table = asset.table || asset.tableName;
              const database = asset.databaseName;
              const fullName = showDatabase && database
                ? `${database}.${schema}.${table}`
                : `${schema}.${table}`;
              return [
                fullName,
                {
                  name: fullName,
                  tableName: table,
                  schemaName: schema,
                  databaseName: database,
                  id: asset.id
                }
              ];
            })
          ).values()
        );
        console.log('[VisualRuleBuilder] Unique tables found:', uniqueTables.length);
        if (uniqueTables.length > 0) {
          console.log('[VisualRuleBuilder] Sample tables:', uniqueTables.slice(0, 3).map(t => t.name));
        } else {
          console.warn('[VisualRuleBuilder] ⚠️ NO TABLES FOUND - Data source may not be scanned yet');
        }
        setTables(uniqueTables);
      } else {
        console.warn('[VisualRuleBuilder] No tables found or unsuccessful response');
        setTables([]);
      }
    } catch (error) {
      console.error('[VisualRuleBuilder] Failed to fetch tables:', error);
      setTables([]);
    } finally {
      setLoadingTables(false);
    }
  };

  const fetchColumns = async (tableName: string) => {
    setLoadingColumns(true);
    console.log('[VisualRuleBuilder] fetchColumns called for table:', tableName);
    try {
      // Parse database.schema.table or schema.table format
      const parts = tableName.split('.');
      let database, schema, table;

      if (parts.length === 3) {
        // database.schema.table
        database = parts[0];
        schema = parts[1];
        table = parts[2];
      } else if (parts.length === 2) {
        // schema.table
        schema = parts[0];
        table = parts[1];
      } else {
        // just table (assume public schema)
        schema = 'public';
        table = parts[0];
      }

      // Find the asset by table name (exact match on the full name)
      const asset = tables.find(t => t.name === tableName);

      if (!asset) {
        console.warn('[VisualRuleBuilder] Asset not found for table:', tableName);
        setColumns([]);
        return;
      }

      console.log('[VisualRuleBuilder] Using asset:', {
        id: asset.id,
        table: tableName,
        database: asset.databaseName || database,
        originalDataSource: dataSourceId
      });

      // Query database for columns using asset ID directly
      // Note: asset_id in database is bigint, so we don't need quotes
      const columnQuery = `SELECT column_name, data_type FROM catalog_columns WHERE asset_id = ${asset.id} ORDER BY ordinal`;
      console.log('[VisualRuleBuilder] Column query:', columnQuery);
      console.log('[VisualRuleBuilder] Using Postgres to query catalog_columns for all data sources');

      // Always use Postgres to query catalog_columns table
      // This works for both Postgres and Azure tables without needing Azure credentials
      const POSTGRES_DATASOURCE_ID = '793e4fe5-db62-4aa4-8b48-c220960d85ba';

      const response = await fetch(
        `http://localhost:3002/data/execute-query`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            dataSourceId: POSTGRES_DATASOURCE_ID,  // Always use Postgres to query catalog
            database: 'cwic_platform',              // Catalog is in cwic_platform database
            query: columnQuery
          })
        }
      );

      const data = await response.json();
      console.log('[VisualRuleBuilder] Column query response:', {
        success: data.success,
        hasRows: !!data.rows,
        rowCount: data.rows?.length || data.rowCount || 0,
        error: data.error
      });

      if (data.success && data.rows && data.rows.length > 0) {
        const columnList = data.rows.map((row: any) => ({
          name: row.column_name,
          type: row.data_type
        }));
        console.log('[VisualRuleBuilder] Found columns:', columnList.length, 'columns');
        console.log('[VisualRuleBuilder] Sample columns:', columnList.slice(0, 3));
        setColumns(columnList);
      } else {
        console.warn('[VisualRuleBuilder] No columns found for table:', tableName);
        console.warn('[VisualRuleBuilder] Response data:', data);
        setColumns([]);
      }
    } catch (error) {
      console.error('[VisualRuleBuilder] Failed to fetch columns:', error);
      setColumns([]);
    } finally {
      setLoadingColumns(false);
    }
  };

  const handlePatternSelect = (patternId: string) => {
    const pattern = RULE_PATTERNS.find(p => p.id === patternId);
    if (!pattern) return;

    setSelectedPattern(patternId);
    setFormData(prev => ({
      ...prev,
      rule_type: patternId,
      dimension: pattern.category,
      severity: pattern.template.severity as any
    }));

    // Add initial block
    addBlock('condition', pattern.template);
  };

  const addBlock = (type: RuleBlock['type'], config: Record<string, any> = {}) => {
    const newBlock: RuleBlock = {
      id: `block_${Date.now()}`,
      type,
      config
    };
    setBlocks(prev => [...prev, newBlock]);
  };

  const removeBlock = (blockId: string) => {
    setBlocks(prev => prev.filter(b => b.id !== blockId));
  };

  const updateBlock = (blockId: string, config: Record<string, any>) => {
    setBlocks(prev =>
      prev.map(b => (b.id === blockId ? { ...b, config: { ...b.config, ...config } } : b))
    );
  };

  const generateExpression = () => {
    // Generate SQL expression from blocks
    if (selectedPattern === 'null_check') {
      return `${formData.column_name} IS NULL`;
    } else if (selectedPattern === 'duplicate_check') {
      return `SELECT ${formData.column_name}, COUNT(*) FROM ${formData.table_name} GROUP BY ${formData.column_name} HAVING COUNT(*) > 1`;
    } else if (selectedPattern === 'format_validation') {
      return `${formData.column_name} REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z]{2,}$'`;
    }
    return formData.expression || '';
  };

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    setPreviewResults(null);

    try {
      // Build the preview query based on rule type
      let previewQuery = '';
      const tableName = formData.table_name;
      const columnName = formData.column_name;

      if (selectedPattern === 'null_check') {
        previewQuery = `
          SELECT COUNT(*) as total_rows,
                 COUNT(CASE WHEN ${columnName} IS NULL THEN 1 END) as null_rows
          FROM ${tableName}
        `;
      } else if (selectedPattern === 'duplicate_check') {
        previewQuery = `
          SELECT COUNT(*) as total_rows,
                 COUNT(*) - COUNT(DISTINCT ${columnName || '*'}) as duplicate_rows
          FROM ${tableName}
        `;
      } else if (selectedPattern === 'range_check') {
        const min = formData.parameters?.min_value || 0;
        const max = formData.parameters?.max_value || 100;
        previewQuery = `
          SELECT COUNT(*) as total_rows,
                 COUNT(CASE WHEN ${columnName} NOT BETWEEN ${min} AND ${max} THEN 1 END) as out_of_range_rows
          FROM ${tableName}
        `;
      } else {
        // Default completeness check
        previewQuery = `
          SELECT COUNT(*) as total_rows,
                 COUNT(${columnName}) as non_null_rows
          FROM ${tableName}
        `;
      }

      console.log('[VisualRuleBuilder] Preview query:', previewQuery);

      // Execute the preview query
      const response = await fetch('http://localhost:3002/data/execute-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataSourceId: dataSourceId,
          database: selectedDatabase || 'cwic_platform',
          query: previewQuery
        })
      });

      const data = await response.json();
      console.log('[VisualRuleBuilder] Preview response:', data);

      if (data.success && data.rows && data.rows.length > 0) {
        const result = data.rows[0];
        const totalRows = parseInt(result.total_rows) || 0;
        const issueRows = parseInt(result.null_rows || result.duplicate_rows || result.out_of_range_rows || 0);
        const passRate = totalRows > 0 ? ((totalRows - issueRows) / totalRows * 100).toFixed(2) : 100;

        // Get sample of actual issues
        let sampleQuery = '';
        if (selectedPattern === 'null_check') {
          sampleQuery = `SELECT * FROM ${tableName} WHERE ${columnName} IS NULL LIMIT 5`;
        } else if (selectedPattern === 'duplicate_check') {
          sampleQuery = `SELECT ${columnName}, COUNT(*) as count FROM ${tableName} GROUP BY ${columnName} HAVING COUNT(*) > 1 LIMIT 5`;
        }

        let sampleIssues = [];
        if (sampleQuery) {
          const sampleResponse = await fetch('http://localhost:3002/data/execute-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              dataSourceId: dataSourceId,
              database: selectedDatabase || 'cwic_platform',
              query: sampleQuery
            })
          });

          const sampleData = await sampleResponse.json();
          if (sampleData.success && sampleData.rows) {
            sampleIssues = sampleData.rows.slice(0, 3).map((row: any, idx: number) => ({
              row: idx + 1,
              value: row[columnName] || 'NULL',
              table: tableName,
              column: columnName
            }));
          }
        }

        setPreviewResults({
          rowsScanned: totalRows,
          issuesFound: issueRows,
          sampleIssues: sampleIssues,
          passRate: parseFloat(passRate),
          estimatedExecutionTime: `${(totalRows / 10000).toFixed(1)}s`,
          autoFixable: selectedPattern === 'null_check' ? 0 : 50
        });
      } else {
        // If query fails, show a message
        setPreviewResults({
          rowsScanned: 0,
          issuesFound: 0,
          sampleIssues: [],
          passRate: 100,
          estimatedExecutionTime: '0s',
          autoFixable: 0,
          error: data.error || 'Failed to preview rule'
        });
      }
    } catch (error) {
      console.error('[VisualRuleBuilder] Preview error:', error);
      setPreviewResults({
        rowsScanned: 0,
        issuesFound: 0,
        sampleIssues: [],
        passRate: 100,
        estimatedExecutionTime: '0s',
        autoFixable: 0,
        error: 'Failed to connect to database'
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Rule name is required';
    }

    if (!formData.table_name?.trim()) {
      newErrors.table_name = 'Table name is required';
    }

    if (!formData.column_name?.trim() && selectedPattern !== 'duplicate_check') {
      newErrors.column_name = 'Column name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const expression = generateExpression();

    // Include id if editing existing rule
    const saveData: Partial<QualityRule> = {
      ...formData,
      expression
    };

    // Ensure id is included when editing
    if (rule?.id) {
      saveData.id = rule.id;
    }

    await onSave(saveData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Wand2 className="w-6 h-6 text-purple-600" />
              Visual Rule Builder
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Create quality rules without writing code
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-100 rounded-lg p-1 flex items-center gap-1">
              <button
                onClick={() => setMode('visual')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  mode === 'visual'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Eye className="w-4 h-4 inline mr-1" />
                Visual
              </button>
              <button
                onClick={() => setMode('code')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  mode === 'code'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Code className="w-4 h-4 inline mr-1" />
                Code
              </button>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Left: Pattern Selection */}
            <div className="col-span-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Select Pattern
                </h3>
                <div className="space-y-2">
                  {RULE_PATTERNS.map(pattern => {
                    const Icon = pattern.icon;
                    const isSelected = selectedPattern === pattern.id;

                    return (
                      <button
                        key={pattern.id}
                        onClick={() => handlePatternSelect(pattern.id)}
                        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-blue-500' : 'bg-gray-100'
                          }`}>
                            <Icon className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-gray-600'}`} />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 mb-1">{pattern.name}</h4>
                            <p className="text-xs text-gray-600">{pattern.description}</p>
                            <Badge className="mt-2" variant="secondary">
                              {pattern.category}
                            </Badge>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Middle: Configuration */}
            <div className="col-span-8 space-y-6">
              {mode === 'visual' ? (
                <>
                  {/* Basic Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Rule Configuration</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                          placeholder="Describe what this rule checks..."
                          rows={2}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Select
                            label="Severity"
                            value={formData.severity}
                            onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                            options={[
                              { value: 'low', label: 'Low' },
                              { value: 'medium', label: 'Medium' },
                              { value: 'high', label: 'High' },
                              { value: 'critical', label: 'Critical' }
                            ]}
                          />
                        </div>

                        <div>
                          <Label htmlFor="threshold">Pass Threshold (%)</Label>
                          <Input
                            id="threshold"
                            type="number"
                            value={formData.threshold}
                            onChange={(e) => setFormData({ ...formData, threshold: Number(e.target.value) })}
                            min={0}
                            max={100}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Target Selection */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Target Data</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="table_name">
                            <Table className="w-4 h-4 inline mr-1" />
                            Table Name *
                          </Label>
                          {loadingTables ? (
                            <div className="text-sm text-gray-500 py-2">Loading tables...</div>
                          ) : (
                            <select
                              id="table_name"
                              value={formData.table_name}
                              onChange={(e) => {
                                setFormData({ ...formData, table_name: e.target.value, column_name: '' });
                              }}
                              className={`w-full px-3 py-2 border rounded-md ${errors.table_name ? 'border-red-500' : 'border-gray-300'}`}
                            >
                              <option value="">Select a table...</option>
                              {tables.map((table) => (
                                <option key={table.name} value={table.name}>
                                  {table.name}
                                </option>
                              ))}
                            </select>
                          )}
                          {errors.table_name && (
                            <p className="text-xs text-red-500 mt-1">{errors.table_name}</p>
                          )}
                          {!loadingTables && tables.length === 0 && dataSourceId && (
                            <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                              <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-sm text-yellow-800 font-medium">No tables found</p>
                                  <p className="text-xs text-yellow-700 mt-1">
                                    This data source hasn't been scanned yet. Go to{' '}
                                    <a href="/data-catalog" className="underline font-medium hover:text-yellow-900">
                                      Data Catalog
                                    </a>
                                    {' '}and run a catalog scan for this data source first, or select a different data source that has already been scanned.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div>
                          <Label htmlFor="column_name">
                            <Columns className="w-4 h-4 inline mr-1" />
                            Column Name *
                          </Label>
                          {loadingColumns ? (
                            <div className="text-sm text-gray-500 py-2">Loading columns...</div>
                          ) : (
                            <select
                              id="column_name"
                              value={formData.column_name}
                              onChange={(e) => setFormData({ ...formData, column_name: e.target.value })}
                              className={`w-full px-3 py-2 border rounded-md ${errors.column_name ? 'border-red-500' : 'border-gray-300'}`}
                              disabled={!formData.table_name || columns.length === 0}
                            >
                              <option value="">Select a column...</option>
                              {columns.map((column) => (
                                <option key={column.name} value={column.name}>
                                  {column.name} ({column.type})
                                </option>
                              ))}
                            </select>
                          )}
                          {errors.column_name && (
                            <p className="text-xs text-red-500 mt-1">{errors.column_name}</p>
                          )}
                          {formData.table_name && columns.length === 0 && !loadingColumns && (
                            <p className="text-xs text-yellow-600 mt-1">No columns found for this table</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Preview Results */}
                  {previewResults && (
                    <Card className={previewResults.error ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <CheckCircle className={`w-5 h-5 ${previewResults.error ? 'text-red-600' : 'text-green-600'}`} />
                          Preview Results
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {previewResults.error ? (
                          <div className="text-red-600 text-sm">
                            <p className="font-medium">Preview failed:</p>
                            <p className="mt-1">{previewResults.error}</p>
                          </div>
                        ) : (
                          <>
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <div className="text-2xl font-bold text-gray-900">
                              {previewResults.rowsScanned.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-600">Rows Scanned</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-red-600">
                              {previewResults.issuesFound.toLocaleString()}
                            </div>
                            <div className="text-xs text-gray-600">Issues Found</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">
                              {previewResults.passRate}%
                            </div>
                            <div className="text-xs text-gray-600">Pass Rate</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-blue-600">
                              {previewResults.estimatedExecutionTime}
                            </div>
                            <div className="text-xs text-gray-600">Est. Time</div>
                          </div>
                        </div>

                        <Alert>
                          <Zap className="w-4 h-4" />
                          <AlertDescription>
                            {previewResults.autoFixable}% of issues can be fixed automatically
                          </AlertDescription>
                        </Alert>

                        <div>
                          <h4 className="text-sm font-semibold text-gray-700 mb-2">Sample Issues:</h4>
                          <div className="space-y-1">
                            {previewResults.sampleIssues.map((issue: any, idx: number) => (
                              <div key={idx} className="text-xs bg-white p-2 rounded border border-gray-200">
                                Row {issue.row}: {issue.table}.{issue.column} = {String(issue.value)}
                              </div>
                            ))}
                          </div>
                        </div>
                        </>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">SQL Expression</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={formData.expression}
                      onChange={(e) => setFormData({ ...formData, expression: e.target.value })}
                      placeholder="Enter your custom SQL expression..."
                      rows={10}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Advanced users can write custom SQL expressions for complex validation logic.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isPreviewLoading}
          >
            {isPreviewLoading ? (
              <>Loading...</>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Preview Results
              </>
            )}
          </Button>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
              <Save className="w-4 h-4 mr-2" />
              Save Rule
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
