// Advanced Asset Profiler - Comprehensive Data Quality & Profiling Tool
import React, { useState, useEffect } from 'react';
import {
  Table as TableIcon,
  AlertTriangle,
  CheckCircle2,
  Shield,
  Key,
  Link2,
  Eye,
  Code,
  Database,
  Info,
  Zap,
  Copy,
  Terminal,
  FileCode,
  Loader2,
  Download,
  Search,
  Filter,
  Play,
  GitBranch,
  TrendingUp,
  BarChart3,
  PieChart,
  Activity,
  Brain,
  Target,
  CheckSquare,
  Settings,
  Lightbulb,
  Sparkles,
  Hash,
  Calendar,
} from 'lucide-react';
import { Badge } from '@components/ui/Badge';
import { Button } from '@components/ui/Button';

// ============================================================================
// TYPES
// ============================================================================

interface Column {
  id: number;
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
  is_foreign_key: boolean;
  foreign_key_table?: string;
  foreign_key_column?: string;
  pii_type?: string | null;
  is_sensitive: boolean;
  encryption_status: string;
  null_percentage?: number | null;
  unique_percentage?: number | null;
  sample_values?: string[] | null;
  quality_issues: QualityIssue[];
  description?: string | null;
  data_classification?: string | null;
  avg_value?: number | null;
  min_value?: number | null;
  max_value?: number | null;
  ordinal: number;
}

interface QualityIssue {
  id?: number;
  issue_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affected_rows?: number;
  fix_script?: string;
}

interface AIInsight {
  type: 'recommendation' | 'warning' | 'info' | 'opportunity';
  title: string;
  description: string;
  action?: string;
  priority: 'high' | 'medium' | 'low';
}

interface AdvancedAssetProfilerProps {
  assetId: string;
  assetName: string;
  assetType: string;
  schema: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

const AdvancedAssetProfiler: React.FC<AdvancedAssetProfilerProps> = ({
  assetId,
  assetName,
  assetType,
  schema,
}) => {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'issues' | 'pii' | 'keys'>('all');
  const [showInsights, setShowInsights] = useState(true);
  const [selectedColumns, setSelectedColumns] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchAssetDetails();
  }, [assetId]);

  const fetchAssetDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/assets/${assetId}`);
      const result = await response.json();

      if (result.success && result.data && result.data.columns) {
        setColumns(result.data.columns);
      } else {
        throw new Error('Failed to fetch asset details');
      }
    } catch (err) {
      console.error('Error fetching asset details:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // AI INSIGHTS GENERATION
  // ============================================================================

  const generateAIInsights = (): AIInsight[] => {
    const insights: AIInsight[] = [];

    // Analyze columns for insights
    columns.forEach((col) => {
      // High null percentage
      if (col.null_percentage && col.null_percentage > 30) {
        insights.push({
          type: 'warning',
          title: `High Null Rate in ${col.column_name}`,
          description: `${col.null_percentage.toFixed(1)}% of values are NULL. Consider adding default values or making it nullable.`,
          action: 'Add Default Value',
          priority: 'medium',
        });
      }

      // High uniqueness - good for indexing
      if (col.unique_percentage && col.unique_percentage > 90 && !col.is_primary_key) {
        insights.push({
          type: 'opportunity',
          title: `Index Candidate: ${col.column_name}`,
          description: `${col.unique_percentage.toFixed(1)}% unique values. Creating an index could improve query performance.`,
          action: 'Create Index',
          priority: 'low',
        });
      }

      // PII not encrypted
      if (col.pii_type && col.encryption_status === 'plain_text') {
        insights.push({
          type: 'warning',
          title: `Unencrypted PII: ${col.column_name}`,
          description: `Contains ${col.pii_type} but is not encrypted. This poses a security risk.`,
          action: 'Encrypt Column',
          priority: 'high',
        });
      }

      // Quality issues
      if (col.quality_issues.length > 0) {
        const criticalIssues = col.quality_issues.filter(i => i.severity === 'critical');
        if (criticalIssues.length > 0) {
          insights.push({
            type: 'warning',
            title: `Critical Issues in ${col.column_name}`,
            description: `${criticalIssues.length} critical data quality issues detected. Immediate action required.`,
            action: 'View Issues',
            priority: 'high',
          });
        }
      }
    });

    // Table-level insights
    const piiCount = columns.filter(c => c.pii_type).length;
    if (piiCount > 0) {
      insights.push({
        type: 'info',
        title: 'Sensitive Data Detected',
        description: `${piiCount} columns contain PII. Ensure proper access controls and audit logging are in place.`,
        action: 'Review Permissions',
        priority: 'medium',
      });
    }

    // No primary key
    const hasPrimaryKey = columns.some(c => c.is_primary_key);
    if (!hasPrimaryKey && assetType === 'table') {
      insights.push({
        type: 'recommendation',
        title: 'No Primary Key Defined',
        description: 'Adding a primary key can improve data integrity and query performance.',
        action: 'Add Primary Key',
        priority: 'medium',
      });
    }

    // Foreign keys without index
    const fkWithoutIndex = columns.filter(c => c.is_foreign_key);
    if (fkWithoutIndex.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Foreign Key Performance',
        description: `${fkWithoutIndex.length} foreign keys detected. Ensure they are indexed for optimal join performance.`,
        action: 'Review Indexes',
        priority: 'low',
      });
    }

    return insights.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  const aiInsights = generateAIInsights();

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(id);
    setTimeout(() => setCopiedScript(null), 2000);
  };

  const toggleColumnSelection = (columnId: number) => {
    const newSelection = new Set(selectedColumns);
    if (newSelection.has(columnId)) {
      newSelection.delete(columnId);
    } else {
      newSelection.add(columnId);
    }
    setSelectedColumns(newSelection);
  };

  const exportData = (format: 'csv' | 'json' | 'sql') => {
    let content = '';
    const filename = `${assetName}_profile.${format}`;

    if (format === 'csv') {
      const headers = ['Column Name', 'Data Type', 'Nullable', 'PII', 'Null %', 'Issues'];
      content = headers.join(',') + '\n';
      columns.forEach(col => {
        content += [
          col.column_name,
          col.data_type,
          col.is_nullable ? 'Yes' : 'No',
          col.pii_type || 'None',
          col.null_percentage?.toFixed(1) || '0',
          col.quality_issues.length,
        ].join(',') + '\n';
      });
    } else if (format === 'json') {
      content = JSON.stringify({ table: assetName, columns }, null, 2);
    } else if (format === 'sql') {
      content = `-- Table: ${schema}.${assetName}\n\n`;
      content += `CREATE TABLE ${schema}.${assetName} (\n`;
      content += columns.map((col, idx) => {
        let line = `  ${col.column_name} ${col.data_type}`;
        if (!col.is_nullable) line += ' NOT NULL';
        if (col.is_primary_key) line += ' PRIMARY KEY';
        return line + (idx < columns.length - 1 ? ',' : '');
      }).join('\n');
      content += '\n);\n';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateFixScript = (column: Column, issue: QualityIssue): string => {
    const tableName = `${schema}.${assetName}`;
    const columnName = column.column_name;

    switch (issue.issue_type) {
      case 'null_values':
        return `-- Fix NULL values in ${columnName}
UPDATE ${tableName}
SET ${columnName} = '<default_value>'
WHERE ${columnName} IS NULL;

-- Add NOT NULL constraint
ALTER TABLE ${tableName}
ALTER COLUMN ${columnName} SET NOT NULL;`;

      case 'duplicate_values':
        return `-- Find duplicates
SELECT ${columnName}, COUNT(*) as count
FROM ${tableName}
GROUP BY ${columnName}
HAVING COUNT(*) > 1;

-- Remove duplicates (keep first)
DELETE FROM ${tableName} a
USING (
  SELECT MIN(ctid) as ctid, ${columnName}
  FROM ${tableName}
  GROUP BY ${columnName}
  HAVING COUNT(*) > 1
) b
WHERE a.${columnName} = b.${columnName}
AND a.ctid <> b.ctid;`;

      case 'invalid_format':
        return `-- Find invalid values
SELECT ${columnName}, COUNT(*) as count
FROM ${tableName}
WHERE ${columnName} !~ '^[valid_pattern]$'
GROUP BY ${columnName};

-- Fix format
UPDATE ${tableName}
SET ${columnName} = REGEXP_REPLACE(${columnName}, '[^a-zA-Z0-9]', '', 'g')
WHERE ${columnName} !~ '^[valid_pattern]$';`;

      case 'pii_unencrypted':
        return `-- Encrypt PII (${column.pii_type})
-- Backup first!
CREATE TABLE ${assetName}_backup AS SELECT * FROM ${tableName};

-- Option 1: Use pgcrypto
UPDATE ${tableName}
SET ${columnName} = pgp_sym_encrypt(${columnName}::text, 'your_key');

-- Option 2: Mask data
UPDATE ${tableName}
SET ${columnName} = CONCAT(
  LEFT(${columnName}, 3),
  REPEAT('*', GREATEST(LENGTH(${columnName}) - 6, 0)),
  RIGHT(${columnName}, 3)
);`;

      case 'outlier_values':
        return `-- Analyze outliers
WITH stats AS (
  SELECT
    AVG(${columnName}) as mean,
    STDDEV(${columnName}) as stddev
  FROM ${tableName}
)
SELECT ${columnName},
  (${columnName} - stats.mean) / stats.stddev as z_score
FROM ${tableName}, stats
WHERE ABS((${columnName} - stats.mean) / stats.stddev) > 3;

-- Cap outliers
UPDATE ${tableName}
SET ${columnName} = CASE
  WHEN ${columnName} > (SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${columnName}) FROM ${tableName})
    THEN (SELECT PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${columnName}) FROM ${tableName})
  WHEN ${columnName} < (SELECT PERCENTILE_CONT(0.01) WITHIN GROUP (ORDER BY ${columnName}) FROM ${tableName})
    THEN (SELECT PERCENTILE_CONT(0.01) WITHIN GROUP (ORDER BY ${columnName}) FROM ${tableName})
  ELSE ${columnName}
END;`;

      default:
        return `-- Manual review for ${issue.issue_type}
SELECT ${columnName}, COUNT(*) as count
FROM ${tableName}
GROUP BY ${columnName}
ORDER BY count DESC
LIMIT 100;`;
    }
  };

  // ============================================================================
  // FILTERING
  // ============================================================================

  const filteredColumns = columns.filter(col => {
    // Search filter
    if (searchTerm && !col.column_name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Type filter
    if (filterType === 'issues' && col.quality_issues.length === 0) return false;
    if (filterType === 'pii' && !col.pii_type) return false;
    if (filterType === 'keys' && !col.is_primary_key && !col.is_foreign_key) return false;

    return true;
  });

  // ============================================================================
  // STYLE HELPERS
  // ============================================================================

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getDataTypeColor = (dataType: string) => {
    const dt = dataType.toLowerCase();
    if (dt.includes('int') || dt.includes('numeric') || dt.includes('decimal') || dt.includes('float')) {
      return 'bg-purple-100 text-purple-700 border-purple-200';
    }
    if (dt.includes('char') || dt.includes('text') || dt.includes('varchar')) {
      return 'bg-green-100 text-green-700 border-green-200';
    }
    if (dt.includes('date') || dt.includes('time') || dt.includes('timestamp')) {
      return 'bg-blue-100 text-blue-700 border-blue-200';
    }
    if (dt.includes('bool')) {
      return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
    if (dt.includes('json') || dt.includes('xml')) {
      return 'bg-orange-100 text-orange-700 border-orange-200';
    }
    return 'bg-gray-100 text-gray-700 border-gray-200';
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recommendation': return <Lightbulb className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'opportunity': return <Target className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'recommendation': return 'border-blue-200 bg-blue-50';
      case 'warning': return 'border-amber-200 bg-amber-50';
      case 'opportunity': return 'border-green-200 bg-green-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  // ============================================================================
  // RENDER STATES
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3 text-gray-600">Loading comprehensive asset profile...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <p className="text-red-600 font-medium">{error}</p>
        <Button onClick={fetchAssetDetails} className="mt-4" size="sm">
          <Loader2 className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const totalIssues = columns.reduce((sum, col) => sum + col.quality_issues.length, 0);
  const piiColumns = columns.filter(col => col.pii_type);
  const keyColumns = columns.filter(col => col.is_primary_key || col.is_foreign_key);

  // ============================================================================
  // RENDER MAIN UI
  // ============================================================================

  return (
    <div className="space-y-4">
      {/* AI Insights Section */}
      {showInsights && aiInsights.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-600" />
              <h4 className="font-bold text-gray-900">AI-Powered Insights</h4>
              <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                {aiInsights.length} insights
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInsights(false)}
              className="text-xs"
            >
              Hide
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {aiInsights.slice(0, 4).map((insight, idx) => (
              <div
                key={idx}
                className={`rounded-lg border-2 p-3 ${getInsightColor(insight.type)}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`p-1.5 rounded ${
                    insight.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                    insight.type === 'opportunity' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {getInsightIcon(insight.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900">{insight.title}</span>
                      <Badge className={`text-xs ${
                        insight.priority === 'high' ? 'bg-red-100 text-red-700 border-red-200' :
                        insight.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                        'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {insight.priority}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{insight.description}</p>
                    {insight.action && (
                      <Button size="sm" variant="outline" className="text-xs h-6">
                        {insight.action}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {aiInsights.length > 4 && (
            <Button size="sm" variant="ghost" className="w-full mt-3 text-xs">
              View all {aiInsights.length} insights
            </Button>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border-2 border-blue-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Database className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-900">Columns</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{columns.length}</div>
          <div className="text-xs text-blue-700 mt-1">
            {filteredColumns.length !== columns.length && `${filteredColumns.length} filtered`}
          </div>
        </div>

        <div className={`rounded-lg border-2 p-3 ${
          totalIssues > 0
            ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
            : 'bg-gradient-to-br from-green-50 to-green-100 border-green-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            {totalIssues > 0 ? (
              <AlertTriangle className="w-4 h-4 text-red-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            )}
            <span className={`text-xs font-medium ${totalIssues > 0 ? 'text-red-900' : 'text-green-900'}`}>
              Quality Issues
            </span>
          </div>
          <div className={`text-2xl font-bold ${totalIssues > 0 ? 'text-red-900' : 'text-green-900'}`}>
            {totalIssues}
          </div>
          {totalIssues > 0 && (
            <div className="text-xs text-red-700 mt-1">
              {columns.filter(c => c.quality_issues.length > 0).length} columns affected
            </div>
          )}
        </div>

        <div className={`rounded-lg border-2 p-3 ${
          piiColumns.length > 0
            ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200'
            : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-amber-600" />
            <span className="text-xs font-medium text-amber-900">PII Columns</span>
          </div>
          <div className="text-2xl font-bold text-amber-900">{piiColumns.length}</div>
          {piiColumns.length > 0 && (
            <div className="text-xs text-amber-700 mt-1">
              {piiColumns.filter(c => c.encryption_status === 'plain_text').length} unencrypted
            </div>
          )}
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg border-2 border-purple-200 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-medium text-purple-900">Keys</span>
          </div>
          <div className="text-2xl font-bold text-purple-900">{keyColumns.length}</div>
          <div className="text-xs text-purple-700 mt-1">
            {columns.filter(c => c.is_primary_key).length} PK, {columns.filter(c => c.is_foreign_key).length} FK
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search columns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            {(['all', 'issues', 'pii', 'keys'] as const).map((filter) => (
              <Button
                key={filter}
                size="sm"
                variant={filterType === filter ? 'default' : 'outline'}
                onClick={() => setFilterType(filter)}
                className="text-xs h-8"
              >
                {filter === 'all' && 'All'}
                {filter === 'issues' && `Issues (${columns.filter(c => c.quality_issues.length > 0).length})`}
                {filter === 'pii' && `PII (${piiColumns.length})`}
                {filter === 'keys' && `Keys (${keyColumns.length})`}
              </Button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={fetchAssetDetails}>
              <Activity className="w-3 h-3 mr-1" />
              Profile Now
            </Button>

            <div className="relative group">
              <Button size="sm" variant="outline" className="text-xs h-8">
                <Download className="w-3 h-3 mr-1" />
                Export
              </Button>
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-10 min-w-[120px]">
                <button
                  onClick={() => exportData('csv')}
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                >
                  Export as CSV
                </button>
                <button
                  onClick={() => exportData('json')}
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                >
                  Export as JSON
                </button>
                <button
                  onClick={() => exportData('sql')}
                  className="w-full px-3 py-1.5 text-xs text-left hover:bg-gray-50"
                >
                  Export as SQL
                </button>
              </div>
            </div>

            <Button size="sm" className="text-xs h-8 bg-blue-600 hover:bg-blue-700">
              <GitBranch className="w-3 h-3 mr-1" />
              View Lineage
            </Button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedColumns.size > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">
                {selectedColumns.size} column{selectedColumns.size > 1 ? 's' : ''} selected
              </span>
              <Button size="sm" variant="outline" className="text-xs h-7">
                <Settings className="w-3 h-3 mr-1" />
                Bulk Actions
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7">
                Add Quality Rules
              </Button>
              <Button size="sm" variant="outline" className="text-xs h-7">
                Compare
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs h-7"
                onClick={() => setSelectedColumns(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Columns Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-gray-900 flex items-center gap-2">
              <TableIcon className="w-5 h-5 text-blue-600" />
              Column Details & Quality Analysis
            </h4>
            <span className="text-sm text-gray-600">
              Showing {filteredColumns.length} of {columns.length} columns
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b-2 border-gray-200 sticky top-0">
              <tr>
                <th className="w-8 py-3 px-3">
                  <input
                    type="checkbox"
                    checked={selectedColumns.size === filteredColumns.length && filteredColumns.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedColumns(new Set(filteredColumns.map(c => c.id)));
                      } else {
                        setSelectedColumns(new Set());
                      }
                    }}
                    className="rounded"
                  />
                </th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">#</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Column Name</th>
                <th className="text-left py-3 px-3 font-semibold text-gray-700">Data Type</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Nullable</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Keys</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">PII</th>
                <th className="text-right py-3 px-3 font-semibold text-gray-700">Null %</th>
                <th className="text-right py-3 px-3 font-semibold text-gray-700">Unique %</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Issues</th>
                <th className="text-center py-3 px-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredColumns.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-gray-500">
                    <FileCode className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p>No columns match your search criteria</p>
                  </td>
                </tr>
              ) : (
                filteredColumns.map((column) => (
                  <React.Fragment key={column.id}>
                    <tr
                      className={`hover:bg-gray-50 transition-colors ${
                        selectedColumn?.id === column.id ? 'bg-blue-50' : ''
                      } ${column.quality_issues.length > 0 ? 'bg-red-50/20' : ''} ${
                        selectedColumns.has(column.id) ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <td className="py-2 px-3">
                        <input
                          type="checkbox"
                          checked={selectedColumns.has(column.id)}
                          onChange={() => toggleColumnSelection(column.id)}
                          className="rounded"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="py-2 px-3 text-gray-500 font-mono">{column.ordinal}</td>
                      <td className="py-2 px-3">
                        <div className="font-medium text-gray-900">{column.column_name}</div>
                        {column.description && (
                          <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{column.description}</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <Badge className={`text-xs ${getDataTypeColor(column.data_type)}`}>
                          {column.data_type}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {column.is_nullable ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center justify-center gap-1">
                          {column.is_primary_key && (
                            <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs px-1.5">
                              <Key className="w-3 h-3" />
                            </Badge>
                          )}
                          {column.is_foreign_key && (
                            <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs px-1.5">
                              <Link2 className="w-3 h-3" />
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 text-center">
                        {column.pii_type ? (
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
                            <Shield className="w-3 h-3 mr-0.5" />
                            {column.pii_type}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {column.null_percentage !== null && column.null_percentage !== undefined ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${
                                  column.null_percentage > 50 ? 'bg-red-500' :
                                  column.null_percentage > 20 ? 'bg-yellow-500' :
                                  'bg-green-500'
                                }`}
                                style={{ width: `${column.null_percentage}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs w-10 text-right">
                              {column.null_percentage.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right">
                        {column.unique_percentage !== null && column.unique_percentage !== undefined ? (
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div
                                className="bg-purple-500 h-1.5 rounded-full"
                                style={{ width: `${column.unique_percentage}%` }}
                              />
                            </div>
                            <span className="font-mono text-xs w-10 text-right">
                              {column.unique_percentage.toFixed(1)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {column.quality_issues.length > 0 ? (
                          <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">
                            <AlertTriangle className="w-3 h-3 mr-0.5" />
                            {column.quality_issues.length}
                          </Badge>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto" />
                        )}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-6 px-2"
                            onClick={() => setSelectedColumn(
                              selectedColumn?.id === column.id ? null : column
                            )}
                            title="View sample data and statistics"
                          >
                            <Eye className="w-3 h-3 mr-0.5" />
                            {selectedColumn?.id === column.id ? 'Hide Data' : 'View Data'}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs h-6 px-2"
                            title="View column lineage"
                          >
                            <GitBranch className="w-3 h-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Data Row */}
                    {selectedColumn?.id === column.id && (
                      <tr>
                        <td colSpan={11} className={`p-4 ${column.quality_issues.length > 0 ? 'bg-gradient-to-r from-red-50 via-orange-50 to-amber-50' : 'bg-blue-50'}`}>
                          <div className="space-y-3">
                            {/* Header */}
                            {column.quality_issues.length > 0 ? (
                              <div className="flex items-center justify-between">
                                <h5 className="font-bold text-gray-900 flex items-center gap-2">
                                  <AlertTriangle className="w-5 h-5 text-red-600" />
                                  Quality Issues for {column.column_name}
                                  <Badge className="bg-red-100 text-red-700 border-red-200">
                                    {column.quality_issues.length} issue{column.quality_issues.length > 1 ? 's' : ''}
                                  </Badge>
                                </h5>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <h5 className="font-bold text-gray-900 flex items-center gap-2">
                                  <Eye className="w-5 h-5 text-blue-600" />
                                  Column Details: {column.column_name}
                                  <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                                    {column.data_type}
                                  </Badge>
                                  {column.data_classification && (
                                    <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                                      <Shield className="w-3 h-3 mr-1" />
                                      {column.data_classification}
                                    </Badge>
                                  )}
                                </h5>
                              </div>
                            )}

                            {/* Quality Issues */}
                            {column.quality_issues.length > 0 && column.quality_issues.map((issue, idx) => {
                              const fixScript = generateFixScript(column, issue);
                              const scriptId = `${column.id}-${idx}`;

                              return (
                                <div key={idx} className="bg-white rounded-lg border-2 border-red-200 p-4 shadow-sm">
                                  <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Badge className={`text-xs ${getSeverityColor(issue.severity)}`}>
                                          {issue.severity.toUpperCase()}
                                        </Badge>
                                        <span className="font-bold text-gray-900 text-sm">
                                          {issue.issue_type.replace(/_/g, ' ').toUpperCase()}
                                        </span>
                                      </div>
                                      <p className="text-sm text-gray-700 mb-2">{issue.description}</p>
                                      {issue.affected_rows && (
                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                          <Activity className="w-3 h-3" />
                                          <span>
                                            Affected rows: <strong className="text-red-600">{issue.affected_rows.toLocaleString()}</strong>
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Fix Script */}
                                  <div className="bg-gray-900 rounded-lg p-4 relative">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <Terminal className="w-4 h-4 text-green-400" />
                                        <span className="text-xs font-bold text-green-400 uppercase tracking-wide">
                                          Auto-Generated Fix Script
                                        </span>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-6 bg-gray-800 text-white border-gray-700 hover:bg-gray-700"
                                        onClick={() => copyToClipboard(fixScript, scriptId)}
                                      >
                                        {copiedScript === scriptId ? (
                                          <>
                                            <CheckCircle2 className="w-3 h-3 mr-1 text-green-400" />
                                            <span className="text-green-400">Copied!</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3 mr-1" />
                                            Copy SQL
                                          </>
                                        )}
                                      </Button>
                                    </div>
                                    <pre className="text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                                      {fixScript}
                                    </pre>
                                  </div>
                                </div>
                              );
                            })}

                            {/* Sample Values */}
                            {column.sample_values && column.sample_values.length > 0 && (
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileCode className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-semibold text-gray-700">Sample Values</span>
                                  <Badge className="bg-gray-100 text-gray-600 border-gray-200 text-xs">
                                    {column.sample_values.length} samples
                                  </Badge>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {column.sample_values.map((val, idx) => (
                                    <code
                                      key={idx}
                                      className="text-xs bg-gray-100 px-2 py-1 rounded border border-gray-300 font-mono"
                                    >
                                      {val || '<null>'}
                                    </code>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Statistics */}
                            {(column.min_value !== null || column.max_value !== null || column.avg_value !== null) && (
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center gap-2 mb-2">
                                  <BarChart3 className="w-4 h-4 text-gray-600" />
                                  <span className="text-sm font-semibold text-gray-700">Statistics</span>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                  {column.min_value !== null && (
                                    <div>
                                      <div className="text-xs text-gray-500">Min</div>
                                      <div className="text-sm font-mono font-semibold text-gray-900">
                                        {column.min_value}
                                      </div>
                                    </div>
                                  )}
                                  {column.avg_value !== null && (
                                    <div>
                                      <div className="text-xs text-gray-500">Avg</div>
                                      <div className="text-sm font-mono font-semibold text-gray-900">
                                        {column.avg_value.toFixed(2)}
                                      </div>
                                    </div>
                                  )}
                                  {column.max_value !== null && (
                                    <div>
                                      <div className="text-xs text-gray-500">Max</div>
                                      <div className="text-sm font-mono font-semibold text-gray-900">
                                        {column.max_value}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Summary */}
      {totalIssues > 0 && (
        <div className="bg-gradient-to-r from-red-50 via-orange-50 to-amber-50 rounded-xl border-2 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Zap className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h5 className="font-bold text-gray-900 mb-1">Action Required</h5>
              <p className="text-sm text-gray-700 mb-3">
                Detected <strong className="text-red-600">{totalIssues} quality issues</strong> across{' '}
                <strong>{columns.filter(c => c.quality_issues.length > 0).length} columns</strong>.
                Review and apply fix scripts carefully in a test environment first.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">
                  <Terminal className="w-4 h-4 mr-2" />
                  Generate Master Fix Script
                </Button>
                <Button size="sm" variant="outline">
                  <Play className="w-4 h-4 mr-2" />
                  Run Quality Tests
                </Button>
                <Button size="sm" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Fixes
                </Button>
                <Button size="sm" variant="outline">
                  <Info className="w-4 h-4 mr-2" />
                  View Documentation
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedAssetProfiler;
