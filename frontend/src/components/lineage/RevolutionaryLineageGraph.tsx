// RevolutionaryLineageGraph.tsx - Best-in-Market Data Lineage Visualization
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  MiniMap,
  Node,
  NodeTypes,
  Panel,
  ReactFlowInstance,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import {
  AlertCircle,
  Bot,
  ChevronDown,
  ChevronRight,
  Database,
  Filter,
  GitBranch,
  Link2,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCw,
  Search,
  Server,
  Sparkles,
  Table,
  Zap,
} from 'lucide-react';
import { Button } from '@components/ui/Button';
import { Badge } from '@components/ui/Badge';
import { Card, CardContent } from '@components/ui/Card';

// ============================================================================
// TYPES
// ============================================================================

interface LineageNode {
  id: string;
  type: 'database' | 'schema' | 'table' | 'column';
  name: string;
  server?: string;
  database?: string;
  schema?: string;
  table?: string;
  metadata?: Record<string, any>;
  columns?: ColumnInfo[];
}

interface ColumnInfo {
  id: string;
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  nullable?: boolean;
  description?: string;
}

interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type?: 'direct' | 'transformation' | 'suggested' | 'manual';
  confidence?: number;
  transformationLogic?: string;
  metadata?: Record<string, any>;
}

interface AIConnectionSuggestion {
  id: string;
  sourceTable: string;
  targetTable: string;
  confidence: number;
  reason: string;
  matchingColumns: Array<{ source: string; target: string; similarity: number }>;
  suggestedJoinType: 'inner' | 'left' | 'right' | 'outer';
}

interface GraphFilters {
  servers: string[];
  databases: string[];
  selectedServer: string | null;
  selectedDatabase: string | null;
  searchQuery: string;
  showColumnLevel: boolean;
  highlightIssues: boolean;
}

// ============================================================================
// CUSTOM NODES
// ============================================================================

const TableNode: React.FC<{ data: any }> = ({ data }) => {
  const [expanded, setExpanded] = useState(false);
  const hasIssues = data.issues && data.issues.length > 0;
  const isSuggested = data.isSuggested;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-lg min-w-[200px] transition-all ${
        isSuggested
          ? 'border-purple-400 bg-purple-50'
          : hasIssues
          ? 'border-orange-400 bg-orange-50'
          : 'border-blue-400 bg-white'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Table className={`h-4 w-4 ${isSuggested ? 'text-purple-600' : 'text-blue-600'}`} />
          <span className="font-semibold text-gray-900 text-sm">{data.label}</span>
        </div>
        {data.columns && data.columns.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {/* Database/Schema Info */}
      <div className="text-xs text-gray-600 mb-2">
        {data.database && <div>DB: {data.database}</div>}
        {data.schema && <div>Schema: {data.schema}</div>}
      </div>

      {/* Issues Badge */}
      {hasIssues && (
        <div className="mb-2">
          <Badge className="bg-orange-100 text-orange-800 text-xs">
            <AlertCircle className="h-3 w-3 mr-1" />
            {data.issues.length} issue{data.issues.length > 1 ? 's' : ''}
          </Badge>
        </div>
      )}

      {/* Suggested Badge */}
      {isSuggested && (
        <div className="mb-2">
          <Badge className="bg-purple-100 text-purple-800 text-xs">
            <Sparkles className="h-3 w-3 mr-1" />
            AI Suggested
          </Badge>
        </div>
      )}

      {/* Columns */}
      {expanded && data.columns && (
        <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
          {data.columns.slice(0, 10).map((col: ColumnInfo) => (
            <div
              key={col.id}
              className="flex items-center justify-between text-xs p-1 rounded hover:bg-gray-50"
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    col.isPrimaryKey
                      ? 'bg-yellow-400'
                      : col.isForeignKey
                      ? 'bg-blue-400'
                      : 'bg-gray-300'
                  }`}
                />
                <span className="font-medium text-gray-700">{col.name}</span>
              </div>
              <span className="text-gray-500">{col.type}</span>
            </div>
          ))}
          {data.columns.length > 10 && (
            <div className="text-xs text-gray-500 text-center pt-1">
              +{data.columns.length - 10} more columns
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      {data.rowCount && (
        <div className="mt-2 text-xs text-gray-600">
          {data.rowCount.toLocaleString()} rows
        </div>
      )}
    </div>
  );
};

const nodeTypes: NodeTypes = {
  tableNode: TableNode,
};

// ============================================================================
// CUSTOM EDGE
// ============================================================================

const CustomEdge: React.FC<any> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}) => {
  const edgePath = `M ${sourceX} ${sourceY} C ${sourceX + 50} ${sourceY}, ${
    targetX - 50
  } ${targetY}, ${targetX} ${targetY}`;

  const isManual = data?.type === 'manual';
  const isSuggested = data?.type === 'suggested';
  const confidence = data?.confidence || 1;

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: isSuggested
            ? '#a855f7'
            : isManual
            ? '#10b981'
            : confidence < 0.5
            ? '#f59e0b'
            : '#3b82f6',
          strokeWidth: 2,
          strokeDasharray: isSuggested ? '5,5' : isManual ? '3,3' : 'none',
          opacity: confidence,
        }}
      />
      {data?.label && (
        <text>
          <textPath
            href={`#${id}`}
            style={{ fontSize: '10px', fill: '#6b7280' }}
            startOffset="50%"
            textAnchor="middle"
          >
            {data.label}
          </textPath>
        </text>
      )}
    </>
  );
};

const edgeTypes = {
  custom: CustomEdge,
};

// ============================================================================
// LAYOUT HELPER
// ============================================================================

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 80 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 250, height: 150 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - 125,
        y: nodeWithPosition.y - 75,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const RevolutionaryLineageGraph: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // State
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [filters, setFilters] = useState<GraphFilters>({
    servers: [],
    databases: [],
    selectedServer: null,
    selectedDatabase: null,
    searchQuery: '',
    showColumnLevel: false,
    highlightIssues: true,
  });
  const [manualConnectMode, setManualConnectMode] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AIConnectionSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  // Load initial data
  useEffect(() => {
    loadLineageData();
  }, [filters.selectedServer, filters.selectedDatabase]);

  const loadLineageData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/lineage/graph', {
      //   method: 'POST',
      //   body: JSON.stringify({
      //     server: filters.selectedServer,
      //     database: filters.selectedDatabase,
      //   }),
      // });
      // const data = await response.json();

      // Mock data for demonstration
      const mockNodes: Node[] = [
        {
          id: 'table-1',
          type: 'tableNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'customers',
            database: 'sales_db',
            schema: 'public',
            columns: [
              { id: 'col-1', name: 'customer_id', type: 'INTEGER', isPrimaryKey: true },
              { id: 'col-2', name: 'email', type: 'VARCHAR', nullable: false },
              { id: 'col-3', name: 'name', type: 'VARCHAR', nullable: false },
              { id: 'col-4', name: 'created_at', type: 'TIMESTAMP', nullable: false },
            ],
            rowCount: 15243,
          },
        },
        {
          id: 'table-2',
          type: 'tableNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'orders',
            database: 'sales_db',
            schema: 'public',
            columns: [
              { id: 'col-5', name: 'order_id', type: 'INTEGER', isPrimaryKey: true },
              { id: 'col-6', name: 'customer_id', type: 'INTEGER', isForeignKey: true },
              { id: 'col-7', name: 'total_amount', type: 'DECIMAL', nullable: false },
              { id: 'col-8', name: 'order_date', type: 'TIMESTAMP', nullable: false },
            ],
            rowCount: 45678,
          },
        },
        {
          id: 'table-3',
          type: 'tableNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'order_items',
            database: 'sales_db',
            schema: 'public',
            columns: [
              { id: 'col-9', name: 'item_id', type: 'INTEGER', isPrimaryKey: true },
              { id: 'col-10', name: 'order_id', type: 'INTEGER', isForeignKey: true },
              { id: 'col-11', name: 'product_id', type: 'INTEGER', isForeignKey: true },
              { id: 'col-12', name: 'quantity', type: 'INTEGER', nullable: false },
            ],
            rowCount: 123456,
          },
        },
        {
          id: 'table-4',
          type: 'tableNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'products',
            database: 'sales_db',
            schema: 'public',
            columns: [
              { id: 'col-13', name: 'product_id', type: 'INTEGER', isPrimaryKey: true },
              { id: 'col-14', name: 'name', type: 'VARCHAR', nullable: false },
              { id: 'col-15', name: 'price', type: 'DECIMAL', nullable: false },
            ],
            rowCount: 8765,
          },
        },
        {
          id: 'table-5',
          type: 'tableNode',
          position: { x: 0, y: 0 },
          data: {
            label: 'customer_analytics',
            database: 'analytics_db',
            schema: 'public',
            columns: [
              { id: 'col-16', name: 'customer_id', type: 'INTEGER', isForeignKey: true },
              { id: 'col-17', name: 'lifetime_value', type: 'DECIMAL', nullable: false },
              { id: 'col-18', name: 'segment', type: 'VARCHAR', nullable: false },
            ],
            rowCount: 15243,
            issues: ['No direct FK - pattern matched'],
          },
        },
      ];

      const mockEdges: Edge[] = [
        {
          id: 'edge-1',
          source: 'table-1',
          target: 'table-2',
          type: 'custom',
          data: { label: 'customer_id', type: 'direct', confidence: 1.0 },
        },
        {
          id: 'edge-2',
          source: 'table-2',
          target: 'table-3',
          type: 'custom',
          data: { label: 'order_id', type: 'direct', confidence: 1.0 },
        },
        {
          id: 'edge-3',
          source: 'table-4',
          target: 'table-3',
          type: 'custom',
          data: { label: 'product_id', type: 'direct', confidence: 1.0 },
        },
        {
          id: 'edge-4',
          source: 'table-1',
          target: 'table-5',
          type: 'custom',
          data: {
            label: 'customer_id (pattern match)',
            type: 'suggested',
            confidence: 0.85,
          },
        },
      ];

      const layouted = getLayoutedElements(mockNodes, mockEdges);
      setNodes(layouted.nodes);
      setEdges(layouted.edges);

      // Load available filters
      setFilters((prev) => ({
        ...prev,
        servers: ['prod-server-1', 'prod-server-2', 'analytics-server'],
        databases: ['sales_db', 'analytics_db', 'warehouse_db'],
      }));

      // Load AI suggestions
      loadAISuggestions();
    } catch (error) {
      console.error('Failed to load lineage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAISuggestions = async () => {
    // TODO: Replace with actual API call
    const mockSuggestions: AIConnectionSuggestion[] = [
      {
        id: 'sugg-1',
        sourceTable: 'customer_analytics',
        targetTable: 'customer_segments',
        confidence: 0.92,
        reason: 'Both tables have customer_id column with matching data types and similar cardinality',
        matchingColumns: [
          { source: 'customer_id', target: 'customer_id', similarity: 1.0 },
          { source: 'segment', target: 'segment_name', similarity: 0.78 },
        ],
        suggestedJoinType: 'left',
      },
      {
        id: 'sugg-2',
        sourceTable: 'orders',
        targetTable: 'shipping_info',
        confidence: 0.87,
        reason: 'Pattern matching found order_id in both tables with 98% join success rate in sample data',
        matchingColumns: [{ source: 'order_id', target: 'order_id', similarity: 1.0 }],
        suggestedJoinType: 'inner',
      },
    ];

    setAiSuggestions(mockSuggestions);
  };

  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        ...params,
        id: `edge-manual-${Date.now()}`,
        type: 'custom',
        data: { type: 'manual', confidence: 1.0, label: 'Manual connection' },
      };
      setEdges((eds) => addEdge(newEdge, eds));

      // TODO: Save to backend
      console.log('Manual connection created:', newEdge);
    },
    [setEdges]
  );

  const handleApplySuggestion = (suggestion: AIConnectionSuggestion) => {
    const sourceNode = nodes.find((n) => n.data.label === suggestion.sourceTable);
    const targetNode = nodes.find((n) => n.data.label === suggestion.targetTable);

    if (sourceNode && targetNode) {
      const newEdge: Edge = {
        id: `edge-suggested-${Date.now()}`,
        source: sourceNode.id,
        target: targetNode.id,
        type: 'custom',
        data: {
          type: 'suggested',
          confidence: suggestion.confidence,
          label: suggestion.matchingColumns.map((c) => c.source).join(', '),
        },
      };
      setEdges((eds) => [...eds, newEdge]);

      // Remove applied suggestion
      setAiSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
    }
  };

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleRefresh = () => {
    loadLineageData();
  };

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const matchesSearch =
        !filters.searchQuery ||
        node.data.label.toLowerCase().includes(filters.searchQuery.toLowerCase());
      const matchesDatabase =
        !filters.selectedDatabase || node.data.database === filters.selectedDatabase;
      return matchesSearch && matchesDatabase;
    });
  }, [nodes, filters.searchQuery, filters.selectedDatabase]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      className={`${
        isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'relative'
      } h-full flex flex-col`}
    >
      {/* Top Toolbar */}
      <div className="border-b bg-white px-4 py-3 flex items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Revolutionary Lineage</h2>
          </div>
          <Badge className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-800 border-purple-200">
            <Sparkles className="h-3 w-3 mr-1" />
            AI-Powered
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* Server Filter */}
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-gray-500" />
            <select
              value={filters.selectedServer || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  selectedServer: e.target.value || null,
                }))
              }
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Servers</option>
              {filters.servers.map((server) => (
                <option key={server} value={server}>
                  {server}
                </option>
              ))}
            </select>
          </div>

          {/* Database Filter */}
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-gray-500" />
            <select
              value={filters.selectedDatabase || ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  selectedDatabase: e.target.value || null,
                }))
              }
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Databases</option>
              {filters.databases.map((db) => (
                <option key={db} value={db}>
                  {db}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tables..."
              value={filters.searchQuery}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
              }
              className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 w-48"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 border-l pl-3 ml-2">
            <Button
              variant={manualConnectMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => setManualConnectMode(!manualConnectMode)}
            >
              <Link2 className="h-4 w-4 mr-2" />
              Manual Connect
            </Button>
            <Button
              variant={showAIAssistant ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowAIAssistant(!showAIAssistant)}
            >
              <Bot className="h-4 w-4 mr-2" />
              AI Assist ({aiSuggestions.length})
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleToggleFullscreen}>
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph */}
        <div ref={reactFlowWrapper} className="flex-1 bg-gray-50">
          <ReactFlow
            nodes={filteredNodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={manualConnectMode ? onConnect : undefined}
            onNodeClick={handleNodeClick}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            minZoom={0.1}
            maxZoom={4}
            defaultEdgeOptions={{
              type: 'custom',
              animated: true,
            }}
          >
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.data.isSuggested) return '#a855f7';
                if (node.data.issues?.length > 0) return '#f97316';
                return '#3b82f6';
              }}
              className="bg-white border-2 border-gray-200 rounded-lg"
            />

            {/* Mode Indicator */}
            {manualConnectMode && (
              <Panel position="top-center">
                <div className="bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  <span className="font-medium">Manual Connect Mode Active</span>
                  <span className="text-xs opacity-90">
                    Click and drag from a table to create connections
                  </span>
                </div>
              </Panel>
            )}

            {/* Legend */}
            <Panel position="bottom-left">
              <Card className="bg-white/90 backdrop-blur-sm">
                <CardContent className="p-3 space-y-2">
                  <div className="text-xs font-semibold text-gray-700 mb-2">Legend</div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-yellow-400" />
                    <span>Primary Key</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span>Foreign Key</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div className="w-8 h-0.5 bg-blue-500" />
                    <span>Direct Link</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className="w-8 h-0.5 bg-purple-500"
                      style={{ backgroundImage: 'repeating-linear-gradient(to right, #a855f7 0, #a855f7 5px, transparent 5px, transparent 10px)' }}
                    />
                    <span>AI Suggested</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <div
                      className="w-8 h-0.5 bg-green-500"
                      style={{ backgroundImage: 'repeating-linear-gradient(to right, #10b981 0, #10b981 3px, transparent 3px, transparent 6px)' }}
                    />
                    <span>Manual</span>
                  </div>
                </CardContent>
              </Card>
            </Panel>
          </ReactFlow>
        </div>

        {/* AI Assistant Sidebar */}
        {showAIAssistant && (
          <div className="w-96 border-l bg-white overflow-y-auto">
            <div className="p-4 border-b bg-gradient-to-r from-purple-50 to-blue-50">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-purple-600" />
                  <h3 className="font-semibold text-gray-900">AI Connection Suggestions</h3>
                </div>
                <Badge className="bg-purple-100 text-purple-800">
                  {aiSuggestions.length} suggestions
                </Badge>
              </div>
              <p className="text-xs text-gray-600">
                AI-discovered relationships for tables without explicit foreign keys
              </p>
            </div>

            <div className="p-4 space-y-4">
              {aiSuggestions.length === 0 ? (
                <div className="text-center py-8">
                  <Sparkles className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">No suggestions available</p>
                  <p className="text-xs text-gray-500 mt-1">
                    All relationships are already mapped
                  </p>
                </div>
              ) : (
                aiSuggestions.map((suggestion) => (
                  <Card key={suggestion.id} className="border-2 border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">
                              {suggestion.sourceTable}
                            </span>
                            <ChevronRight className="h-3 w-3 text-gray-400" />
                            <span className="font-medium text-sm text-gray-900">
                              {suggestion.targetTable}
                            </span>
                          </div>
                          <Badge
                            className={`text-xs ${
                              suggestion.confidence >= 0.9
                                ? 'bg-green-100 text-green-800'
                                : suggestion.confidence >= 0.7
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {(suggestion.confidence * 100).toFixed(0)}% confidence
                          </Badge>
                        </div>
                      </div>

                      <p className="text-xs text-gray-600 mb-3">{suggestion.reason}</p>

                      <div className="mb-3 space-y-1">
                        <div className="text-xs font-medium text-gray-700">
                          Matching Columns:
                        </div>
                        {suggestion.matchingColumns.map((col, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded"
                          >
                            <span className="text-gray-700">
                              {col.source} → {col.target}
                            </span>
                            <span className="text-gray-500">
                              {(col.similarity * 100).toFixed(0)}%
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApplySuggestion(suggestion)}
                          className="flex-1"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Apply
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setAiSuggestions((prev) =>
                              prev.filter((s) => s.id !== suggestion.id)
                            )
                          }
                          className="flex-1"
                        >
                          Dismiss
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}

              {/* AI Chat Interface */}
              <Card className="border-2 border-blue-200 mt-6">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <h4 className="font-medium text-sm text-gray-900">Ask AI</h4>
                  </div>
                  <textarea
                    placeholder="Ask about lineage, relationships, or data flow..."
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                  <Button size="sm" className="w-full mt-2">
                    <Bot className="h-3 w-3 mr-2" />
                    Ask AI Assistant
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Selected Node Details */}
        {selectedNode && !showAIAssistant && (
          <div className="w-80 border-l bg-white overflow-y-auto">
            <div className="p-4 border-b bg-blue-50">
              <h3 className="font-semibold text-gray-900 mb-1">
                {selectedNode.data.label}
              </h3>
              <p className="text-xs text-gray-600">
                {selectedNode.data.database}.{selectedNode.data.schema}
              </p>
            </div>

            <div className="p-4 space-y-4">
              {/* Stats */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-700">Statistics</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-600">Rows</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedNode.data.rowCount?.toLocaleString() || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <div className="text-xs text-gray-600">Columns</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {selectedNode.data.columns?.length || 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Columns */}
              {selectedNode.data.columns && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700">Columns</div>
                  <div className="space-y-1 max-h-96 overflow-y-auto">
                    {selectedNode.data.columns.map((col: ColumnInfo) => (
                      <div
                        key={col.id}
                        className="p-2 bg-gray-50 rounded text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">{col.name}</span>
                          <span className="text-gray-500">{col.type}</span>
                        </div>
                        {(col.isPrimaryKey || col.isForeignKey) && (
                          <div className="flex gap-1">
                            {col.isPrimaryKey && (
                              <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                PK
                              </Badge>
                            )}
                            {col.isForeignKey && (
                              <Badge className="bg-blue-100 text-blue-800 text-xs">FK</Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Issues */}
              {selectedNode.data.issues && selectedNode.data.issues.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700">Issues</div>
                  {selectedNode.data.issues.map((issue: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-2 bg-orange-50 border border-orange-200 rounded text-xs flex items-start gap-2"
                    >
                      <AlertCircle className="h-3 w-3 text-orange-600 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700">{issue}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-900">Loading lineage data...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevolutionaryLineageGraph;
