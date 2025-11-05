// ColumnLineagePanel.tsx - Detailed Column-Level Lineage Visualization
import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Code,
  Database,
  Filter,
  GitBranch,
  Key,
  Layers,
  Link2,
  Search,
  Table,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Card, CardContent } from '@components/ui/Card';

// ============================================================================
// TYPES
// ============================================================================

interface Column {
  id: string;
  name: string;
  type: string;
  table: string;
  database: string;
  schema: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  nullable?: boolean;
  description?: string;
}

interface ColumnLineage {
  sourceColumn: Column;
  targetColumn: Column;
  transformationType:
    | 'direct'
    | 'calculated'
    | 'aggregated'
    | 'filtered'
    | 'joined'
    | 'derived'
    | 'cast';
  transformationLogic?: string;
  confidence: number;
  path: Column[];
}

interface ColumnLineagePanelProps {
  selectedTable?: {
    id: string;
    name: string;
    database: string;
    schema: string;
    columns: Column[];
  };
  onClose?: () => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const TransformationBadge: React.FC<{ type: string }> = ({ type }) => {
  const config: Record<string, { color: string; label: string }> = {
    direct: { color: 'bg-blue-100 text-blue-800', label: 'Direct Copy' },
    calculated: { color: 'bg-purple-100 text-purple-800', label: 'Calculated' },
    aggregated: { color: 'bg-green-100 text-green-800', label: 'Aggregated' },
    filtered: { color: 'bg-yellow-100 text-yellow-800', label: 'Filtered' },
    joined: { color: 'bg-orange-100 text-orange-800', label: 'Joined' },
    derived: { color: 'bg-pink-100 text-pink-800', label: 'Derived' },
    cast: { color: 'bg-gray-100 text-gray-800', label: 'Cast' },
  };

  const { color, label } = config[type] || config.direct;

  return (
    <Badge className={`text-xs ${color}`}>
      {label}
    </Badge>
  );
};

const ColumnCard: React.FC<{ column: Column; showTable?: boolean }> = ({
  column,
  showTable = false,
}) => (
  <div className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded-lg">
    <div
      className={`w-2 h-2 rounded-full flex-shrink-0 ${
        column.isPrimaryKey
          ? 'bg-yellow-400'
          : column.isForeignKey
          ? 'bg-blue-400'
          : 'bg-gray-300'
      }`}
    />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm text-gray-900 truncate">{column.name}</span>
        <span className="text-xs text-gray-500">{column.type}</span>
      </div>
      {showTable && (
        <div className="text-xs text-gray-600 truncate">
          {column.database}.{column.schema}.{column.table}
        </div>
      )}
    </div>
    {column.isPrimaryKey && (
      <Key className="h-3 w-3 text-yellow-600 flex-shrink-0" />
    )}
    {column.isForeignKey && (
      <Link2 className="h-3 w-3 text-blue-600 flex-shrink-0" />
    )}
  </div>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ColumnLineagePanel: React.FC<ColumnLineagePanelProps> = ({
  selectedTable,
  onClose,
}) => {
  const [selectedColumn, setSelectedColumn] = useState<Column | null>(null);
  const [upstreamLineage, setUpstreamLineage] = useState<ColumnLineage[]>([]);
  const [downstreamLineage, setDownstreamLineage] = useState<ColumnLineage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLineage, setExpandedLineage] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'upstream' | 'downstream' | 'both'>('both');

  useEffect(() => {
    if (selectedColumn) {
      loadColumnLineage(selectedColumn);
    }
  }, [selectedColumn]);

  const loadColumnLineage = async (column: Column) => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/lineage/column/${column.id}`, {
      //   method: 'GET',
      // });
      // const data = await response.json();

      // Mock data for demonstration
      const mockUpstream: ColumnLineage[] = [
        {
          sourceColumn: {
            id: 'col-src-1',
            name: 'user_id',
            type: 'INTEGER',
            table: 'users',
            database: 'prod_db',
            schema: 'public',
            isPrimaryKey: true,
          },
          targetColumn: column,
          transformationType: 'direct',
          transformationLogic: 'SELECT user_id FROM users',
          confidence: 1.0,
          path: [],
        },
        {
          sourceColumn: {
            id: 'col-src-2',
            name: 'first_name',
            type: 'VARCHAR',
            table: 'users',
            database: 'prod_db',
            schema: 'public',
          },
          targetColumn: column,
          transformationType: 'calculated',
          transformationLogic: "CONCAT(first_name, ' ', last_name) AS full_name",
          confidence: 0.95,
          path: [],
        },
      ];

      const mockDownstream: ColumnLineage[] = [
        {
          sourceColumn: column,
          targetColumn: {
            id: 'col-tgt-1',
            name: 'customer_id',
            type: 'INTEGER',
            table: 'orders',
            database: 'sales_db',
            schema: 'public',
            isForeignKey: true,
          },
          transformationType: 'direct',
          transformationLogic: 'INSERT INTO orders (customer_id) SELECT id FROM customers',
          confidence: 1.0,
          path: [],
        },
        {
          sourceColumn: column,
          targetColumn: {
            id: 'col-tgt-2',
            name: 'total_customers',
            type: 'INTEGER',
            table: 'analytics_summary',
            database: 'analytics_db',
            schema: 'public',
          },
          transformationType: 'aggregated',
          transformationLogic: 'COUNT(DISTINCT customer_id) AS total_customers',
          confidence: 0.92,
          path: [],
        },
      ];

      setUpstreamLineage(mockUpstream);
      setDownstreamLineage(mockDownstream);
    } catch (error) {
      console.error('Failed to load column lineage:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLineageExpansion = (lineageId: string) => {
    setExpandedLineage((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lineageId)) {
        newSet.delete(lineageId);
      } else {
        newSet.add(lineageId);
      }
      return newSet;
    });
  };

  const filteredColumns = selectedTable?.columns.filter((col) =>
    col.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderLineageItem = (lineage: ColumnLineage, isUpstream: boolean) => {
    const lineageId = `${lineage.sourceColumn.id}-${lineage.targetColumn.id}`;
    const isExpanded = expandedLineage.has(lineageId);
    const displayColumn = isUpstream ? lineage.sourceColumn : lineage.targetColumn;

    return (
      <div key={lineageId} className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-3 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={() => toggleLineageExpansion(lineageId)}
              className="text-gray-500 hover:text-gray-700"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <div className="flex-1">
              <ColumnCard column={displayColumn} showTable />
            </div>
            <div className="flex items-center gap-2">
              <TransformationBadge type={lineage.transformationType} />
              <Badge
                className={`text-xs ${
                  lineage.confidence >= 0.9
                    ? 'bg-green-100 text-green-800'
                    : lineage.confidence >= 0.7
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-orange-100 text-orange-800'
                }`}
              >
                {(lineage.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        </div>

        {isExpanded && lineage.transformationLogic && (
          <div className="p-3 bg-white border-t">
            <div className="flex items-center gap-2 mb-2">
              <Code className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-medium text-gray-700">
                Transformation Logic:
              </span>
            </div>
            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto font-mono">
              {lineage.transformationLogic}
            </pre>
          </div>
        )}
      </div>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (!selectedTable) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Layers className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Select a table to view column-level lineage</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Layers className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Column-Level Lineage</h3>
            </div>
            <p className="text-xs text-gray-600">
              {selectedTable.database}.{selectedTable.schema}.{selectedTable.name}
            </p>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* View Mode Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('upstream')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'upstream'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <TrendingUp className="h-3 w-3 inline mr-1" />
            Upstream
          </button>
          <button
            onClick={() => setViewMode('both')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'both'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <GitBranch className="h-3 w-3 inline mr-1" />
            Both
          </button>
          <button
            onClick={() => setViewMode('downstream')}
            className={`flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
              viewMode === 'downstream'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ArrowRight className="h-3 w-3 inline mr-1" />
            Downstream
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 h-full">
          {/* Columns List */}
          <div className="border-r">
            <div className="p-3 border-b bg-gray-50">
              <div className="relative">
                <Search className="absolute left-3 top-2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                <span>{filteredColumns?.length || 0} columns</span>
                {selectedColumn && (
                  <button
                    onClick={() => setSelectedColumn(null)}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    Clear selection
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 space-y-2">
              {filteredColumns?.map((column) => (
                <button
                  key={column.id}
                  onClick={() => setSelectedColumn(column)}
                  className={`w-full text-left transition-all ${
                    selectedColumn?.id === column.id
                      ? 'ring-2 ring-blue-500'
                      : 'hover:ring-2 hover:ring-gray-300'
                  }`}
                >
                  <ColumnCard column={column} />
                </button>
              ))}

              {filteredColumns?.length === 0 && (
                <div className="text-center py-8">
                  <Filter className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No columns found</p>
                </div>
              )}
            </div>
          </div>

          {/* Lineage Details */}
          <div className="bg-gray-50">
            {!selectedColumn ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <ArrowRight className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Select a column to view its lineage</p>
                </div>
              </div>
            ) : loading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Zap className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
                  <p className="text-sm text-gray-600">Loading lineage...</p>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto p-3 space-y-4">
                {/* Selected Column */}
                <Card>
                  <CardContent className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="text-xs font-medium text-gray-700 mb-2">
                      Selected Column:
                    </div>
                    <ColumnCard column={selectedColumn} />
                    {selectedColumn.description && (
                      <p className="text-xs text-gray-600 mt-2">
                        {selectedColumn.description}
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Upstream Lineage */}
                {(viewMode === 'upstream' || viewMode === 'both') && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <h4 className="text-sm font-semibold text-gray-900">
                        Upstream Sources
                      </h4>
                      <Badge className="bg-blue-100 text-blue-800 text-xs">
                        {upstreamLineage.length}
                      </Badge>
                    </div>
                    {upstreamLineage.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-xs text-gray-600">
                            No upstream sources found
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {upstreamLineage.map((lineage) =>
                          renderLineageItem(lineage, true)
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Downstream Lineage */}
                {(viewMode === 'downstream' || viewMode === 'both') && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowRight className="h-4 w-4 text-green-600" />
                      <h4 className="text-sm font-semibold text-gray-900">
                        Downstream Dependencies
                      </h4>
                      <Badge className="bg-green-100 text-green-800 text-xs">
                        {downstreamLineage.length}
                      </Badge>
                    </div>
                    {downstreamLineage.length === 0 ? (
                      <Card>
                        <CardContent className="p-4 text-center">
                          <p className="text-xs text-gray-600">
                            No downstream dependencies found
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-2">
                        {downstreamLineage.map((lineage) =>
                          renderLineageItem(lineage, false)
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Stats */}
      {selectedColumn && !loading && (
        <div className="p-3 border-t bg-gray-50">
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-lg font-bold text-blue-600">
                {upstreamLineage.length}
              </div>
              <div className="text-xs text-gray-600">Upstream</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {upstreamLineage.length + downstreamLineage.length}
              </div>
              <div className="text-xs text-gray-600">Total Links</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-green-600">
                {downstreamLineage.length}
              </div>
              <div className="text-xs text-gray-600">Downstream</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ColumnLineagePanel;
