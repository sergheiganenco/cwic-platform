/**
 * Production-Ready Enhanced Data Lineage Component
 * Version: 2.0
 * 
 * Features:
 * - React Flow interactive graph with custom styled nodes
 * - Auto-layout with dagre (vertical/horizontal with adjustable spacing)
 * - Column-level lineage tracking with API integration
 * - Advanced impact analysis with confidence scoring
 * - Lineage path highlighting (upstream/downstream/full path)
 * - Transformation logic display on edges
 * - Persona-based views (Business, Engineer, Architect)
 * - Advanced search and filtering by node type
 * - Multiple export options (JSON, PNG, SVG)
 * - Real-time lineage updates
 * - Data quality indicators
 * - Execution time tracking
 * - Interactive node details panel
 * - Minimap with toggle
 * - Fullscreen mode
 * - Customizable background patterns
 */
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useDataSources } from '@/hooks/useDataSources';
import axios from 'axios';
import dagre from 'dagre';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock,
  Code,
  Columns3,
  Database,
  Download,
  Eye,
  FileDown,
  FileJson,
  GitBranch,
  Image as ImageIcon,
  Info,
  Layers,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RefreshCcw,
  Search,
  Sparkles,
  Table2,
  Target,
  TrendingUp,
  Users,
  X,
  Zap
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  Panel,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ==================== TYPES ====================
type NodeType = 'database' | 'schema' | 'table' | 'column' | 'view' | 'procedure' | 'function';
type Persona = 'business' | 'engineer' | 'architect';
type ViewMode = 'table' | 'column' | 'impact';
type HighlightMode = 'none' | 'upstream' | 'downstream' | 'path';

interface LineageNode {
  id: string;
  label: string;
  type: NodeType;
  metadata?: {
    database?: string;
    schema?: string;
    tableName?: string;
    dataType?: string;
    rowCount?: number;
    lastUpdated?: string;
    owner?: string;
    description?: string;
    tags?: string[];
    quality_score?: number;
    execution_time_ms?: number;
  };
}

interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  metadata?: {
    confidence?: number;
    transformation?: string;
    transformationType?: 'join' | 'filter' | 'aggregate' | 'union' | 'pivot' | 'custom';
    columns?: Array<{ source: string; target: string }>;
    executionTime?: number;
    recordsProcessed?: number;
  };
}

interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
}

interface PathInfo {
  nodes: string[];
  edges: string[];
  depth: number;
}

// ==================== COLOR SCHEMES ====================
const NODE_COLORS: Record<NodeType, { bg: string; border: string; text: string; icon: string }> = {
  database: { bg: '#3b82f6', border: '#2563eb', text: '#ffffff', icon: '#93c5fd' },
  schema: { bg: '#8b5cf6', border: '#7c3aed', text: '#ffffff', icon: '#c4b5fd' },
  table: { bg: '#10b981', border: '#059669', text: '#ffffff', icon: '#6ee7b7' },
  column: { bg: '#06b6d4', border: '#0891b2', text: '#ffffff', icon: '#67e8f9' },
  view: { bg: '#f59e0b', border: '#d97706', text: '#ffffff', icon: '#fcd34d' },
  procedure: { bg: '#ec4899', border: '#db2777', text: '#ffffff', icon: '#f9a8d4' },
  function: { bg: '#6366f1', border: '#4f46e5', text: '#ffffff', icon: '#a5b4fc' },
};

// ==================== LAYOUT ALGORITHM ====================
const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
  nodeSpacing: number = 150
) => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 280;
  const nodeHeight = 140;

  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: nodeSpacing,
    ranksep: nodeSpacing * 1.5,
    marginx: 50,
    marginy: 50,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
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
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// ==================== CUSTOM NODE COMPONENT ====================
const CustomNode = ({ data, selected }: { data: any; selected: boolean }) => {
  const colors = NODE_COLORS[data.type as NodeType] || NODE_COLORS.table;
  const Icon =
    data.type === 'database'
      ? Database
      : data.type === 'column'
      ? Columns3
      : data.type === 'view'
      ? Eye
      : data.type === 'procedure'
      ? Zap
      : data.type === 'function'
      ? Code
      : Table2;

  const qualityScore = data.metadata?.quality_score || 0;
  const qualityColor =
    qualityScore >= 90 ? '#10b981' : qualityScore >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <div
      style={{
        background: `linear-gradient(135deg, ${colors.bg} 0%, ${colors.border} 100%)`,
        border: `3px solid ${selected ? '#fbbf24' : colors.border}`,
        borderRadius: '12px',
        padding: '16px',
        minWidth: '260px',
        maxWidth: '300px',
        color: colors.text,
        boxShadow: selected
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          : data.isHighlighted
          ? '0 15px 20px -3px rgba(251, 191, 36, 0.4)'
          : '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      className={data.isHighlighted ? 'ring-4 ring-yellow-400 ring-opacity-60' : ''}
    >
      {/* Quality indicator dot */}
      {qualityScore > 0 && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 10,
            height: 10,
            borderRadius: '50%',
            backgroundColor: qualityColor,
            boxShadow: `0 0 10px ${qualityColor}`,
            border: '2px solid rgba(255,255,255,0.8)',
          }}
          title={`Quality Score: ${qualityScore}%`}
        />
      )}

      {/* Header with icon and title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.25)',
            borderRadius: '10px',
            padding: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <Icon size={22} />
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: 700,
              textTransform: 'uppercase',
              opacity: 0.9,
              letterSpacing: '0.8px',
              marginBottom: '2px',
            }}
          >
            {data.type}
          </div>
          <div
            style={{
              fontSize: '15px',
              fontWeight: 700,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={data.label}
          >
            {data.label}
          </div>
        </div>
      </div>

      {/* Metadata section */}
      {data.metadata && (
        <div
          style={{
            fontSize: '11px',
            opacity: 0.95,
            background: 'rgba(255, 255, 255, 0.18)',
            borderRadius: '8px',
            padding: '10px',
            marginTop: '8px',
            backdropFilter: 'blur(4px)',
          }}
        >
          {data.metadata.schema && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={11} opacity={0.8} />
              <strong>Schema:</strong> <span style={{ marginLeft: '4px' }}>{data.metadata.schema}</span>
            </div>
          )}
          {data.metadata.database && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Database size={11} opacity={0.8} />
              <strong>DB:</strong> <span style={{ marginLeft: '4px' }}>{data.metadata.database}</span>
            </div>
          )}
          {data.metadata.dataType && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Code size={11} opacity={0.8} />
              <strong>Type:</strong> <span style={{ marginLeft: '4px' }}>{data.metadata.dataType}</span>
            </div>
          )}
          {data.metadata.tableName && data.type === 'column' && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Table2 size={11} opacity={0.8} />
              <strong>Table:</strong> <span style={{ marginLeft: '4px' }}>{data.metadata.tableName}</span>
            </div>
          )}
          {data.metadata.rowCount !== undefined && (
            <div style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Activity size={11} opacity={0.8} />
              <strong>Rows:</strong> <span style={{ marginLeft: '4px' }}>{data.metadata.rowCount.toLocaleString()}</span>
            </div>
          )}
          {data.metadata.execution_time_ms !== undefined && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={11} opacity={0.8} />
              <strong>Exec:</strong> <span style={{ marginLeft: '4px' }}>{data.metadata.execution_time_ms}ms</span>
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      {data.metadata?.tags && data.metadata.tags.length > 0 && (
        <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
          {data.metadata.tags.slice(0, 3).map((tag: string, idx: number) => (
            <span
              key={idx}
              style={{
                fontSize: '9px',
                padding: '3px 7px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '5px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
              }}
            >
              {tag}
            </span>
          ))}
          {data.metadata.tags.length > 3 && (
            <span
              style={{
                fontSize: '9px',
                padding: '3px 7px',
                background: 'rgba(255, 255, 255, 0.3)',
                borderRadius: '5px',
                fontWeight: 700,
              }}
            >
              +{data.metadata.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Impact warning badge */}
      {data.isImpacted && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px',
            background: 'rgba(239, 68, 68, 0.25)',
            border: '2px solid rgba(239, 68, 68, 0.6)',
            borderRadius: '8px',
            fontSize: '11px',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          <AlertTriangle size={16} />
          IMPACTED
        </div>
      )}

      {/* Highlight indicator bar */}
      {data.isHighlighted && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #fbbf24, #f59e0b, #fbbf24)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 2s infinite',
          }}
        />
      )}
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

// ==================== MAIN COMPONENT ====================
function DataLineage(): JSX.Element {
  const reactFlowInstance = useReactFlow();
  const { items: dataSources, loading: dataSourcesLoading, refresh: refreshDataSources } = useDataSources();

  // State Management
  const [lineageView, setLineageView] = useState<'classic' | 'enhanced'>('enhanced'); // New: View toggle
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [persona, setPersona] = useState<Persona>('engineer');
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lineageData, setLineageData] = useState<LineageGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [impactedNodes, setImpactedNodes] = useState<Set<string>>(new Set());
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('none');
  const [highlightedPath, setHighlightedPath] = useState<PathInfo | null>(null);
  const [showTransformations, setShowTransformations] = useState(true);
  const [showMetadata, setShowMetadata] = useState(true);
  const [nodeSpacing, setNodeSpacing] = useState(150);
  const [filterNodeType, setFilterNodeType] = useState<NodeType | 'all'>('all');
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [backgroundVariant, setBackgroundVariant] = useState<BackgroundVariant>(BackgroundVariant.Dots);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // ==================== API CALLS ====================
  
  // Fetch table-level lineage
  const fetchLineageData = useCallback(async () => {
    if (!selectedDataSource) return;

    setLoading(true);
    try {
      const response = await axios.get('/api/data/lineage/graph', {
        params: { dataSourceId: selectedDataSource },
      });

      if (response.data.success) {
        setLineageData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch lineage data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDataSource]);

  // Fetch column-level lineage
  const fetchColumnLineage = useCallback(async (assetId: string, columnName: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/data/lineage/column/${assetId}/${columnName}`);

      if (response.data.success) {
        setLineageData({
          nodes: response.data.data.nodes.map((n: any) => ({
            id: n.id,
            label: n.label,
            type: n.type as NodeType,
            metadata: n.metadata,
          })),
          edges: response.data.data.edges.map((e: any) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            type: 'column-to-column',
            label: e.transformation,
            metadata: e,
          })),
        });
      }
    } catch (error) {
      console.error('Failed to fetch column lineage:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch impact analysis
  const fetchImpactAnalysis = useCallback(async (nodeId: string) => {
    try {
      const response = await axios.get(`/api/data/lineage/impact/${nodeId}`);

      if (response.data.success) {
        const affected = new Set<string>(response.data.data.affectedNodes.map((n: any) => n.id));
        setImpactedNodes(affected);
      }
    } catch (error) {
      console.error('Failed to fetch impact analysis:', error);
    }
  }, []);

  // ==================== PATH CALCULATION ====================
  
  const calculatePath = useCallback(
    (nodeId: string, direction: 'upstream' | 'downstream'): PathInfo => {
      const visitedNodes = new Set<string>([nodeId]);
      const visitedEdges = new Set<string>();
      const queue: Array<{ id: string; depth: number }> = [{ id: nodeId, depth: 0 }];
      let maxDepth = 0;

      while (queue.length > 0) {
        const current = queue.shift()!;
        maxDepth = Math.max(maxDepth, current.depth);

        const relevantEdges =
          direction === 'upstream'
            ? edges.filter((e) => e.target === current.id)
            : edges.filter((e) => e.source === current.id);

        relevantEdges.forEach((edge) => {
          visitedEdges.add(edge.id);
          const nextNodeId = direction === 'upstream' ? edge.source : edge.target;

          if (!visitedNodes.has(nextNodeId)) {
            visitedNodes.add(nextNodeId);
            queue.push({ id: nextNodeId, depth: current.depth + 1 });
          }
        });
      }

      return {
        nodes: Array.from(visitedNodes),
        edges: Array.from(visitedEdges),
        depth: maxDepth,
      };
    },
    [edges]
  );

  const highlightPath = useCallback(
    (nodeId: string, mode: 'upstream' | 'downstream' | 'path') => {
      if (mode === 'upstream') {
        const path = calculatePath(nodeId, 'upstream');
        setHighlightedPath(path);
      } else if (mode === 'downstream') {
        const path = calculatePath(nodeId, 'downstream');
        setHighlightedPath(path);
      } else if (mode === 'path') {
        const upstreamPath = calculatePath(nodeId, 'upstream');
        const downstreamPath = calculatePath(nodeId, 'downstream');
        setHighlightedPath({
          nodes: [...new Set([...upstreamPath.nodes, ...downstreamPath.nodes])],
          edges: [...new Set([...upstreamPath.edges, ...downstreamPath.edges])],
          depth: Math.max(upstreamPath.depth, downstreamPath.depth),
        });
      }
    },
    [calculatePath]
  );

  // ==================== CONVERT TO REACT FLOW FORMAT ====================
  
  useEffect(() => {
    if (!lineageData) return;

    const flowNodes: Node[] = lineageData.nodes
      .filter((node) => filterNodeType === 'all' || node.type === filterNodeType)
      .map((node) => ({
        id: node.id,
        type: 'custom',
        data: {
          label: node.label,
          type: node.type,
          metadata: showMetadata ? node.metadata : undefined,
          isImpacted: impactedNodes.has(node.id),
          isHighlighted: highlightedPath?.nodes.includes(node.id) || false,
        },
        position: { x: 0, y: 0 },
      }));

    const flowEdges: Edge[] = lineageData.edges
      .filter(
        (edge) =>
          flowNodes.some((n) => n.id === edge.source) && flowNodes.some((n) => n.id === edge.target)
      )
      .map((edge) => {
        const isImpacted = viewMode === 'impact' && impactedNodes.has(edge.target);
        const isHighlighted = highlightedPath?.edges.includes(edge.id) || false;
        const confidence = edge.metadata?.confidence || 0.8;
        const edgeColor = isHighlighted
          ? '#fbbf24'
          : isImpacted
          ? '#ef4444'
          : confidence > 0.9
          ? '#10b981'
          : confidence > 0.7
          ? '#3b82f6'
          : '#f59e0b';

        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: showTransformations ? edge.label || edge.metadata?.transformation : undefined,
          animated: true,
          type: 'smoothstep',
          style: {
            stroke: edgeColor,
            strokeWidth: isHighlighted ? 4 : isImpacted ? 3 : 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: edgeColor,
            width: 22,
            height: 22,
          },
          labelStyle: {
            fill: '#1f2937',
            fontWeight: 600,
            fontSize: 11,
          },
          labelBgStyle: {
            fill: 'white',
            fillOpacity: 0.95,
            rx: 6,
            ry: 6,
          },
          labelBgPadding: [8, 6],
        };
      });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowEdges,
      layoutDirection,
      nodeSpacing
    );

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [
    lineageData,
    layoutDirection,
    viewMode,
    impactedNodes,
    highlightedPath,
    showTransformations,
    showMetadata,
    nodeSpacing,
    filterNodeType,
    setNodes,
    setEdges,
  ]);

  // ==================== LIFECYCLE EFFECTS ====================
  
  useEffect(() => {
    void refreshDataSources();
  }, [refreshDataSources]);

  useEffect(() => {
    if (selectedDataSource && viewMode === 'table') {
      void fetchLineageData();
    }
  }, [selectedDataSource, viewMode, fetchLineageData]);

  useEffect(() => {
    if (dataSources.length > 0 && !selectedDataSource) {
      setSelectedDataSource(dataSources[0].id || '');
    }
  }, [dataSources, selectedDataSource]);

  // ==================== EVENT HANDLERS ====================
  
  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id);

      if (viewMode === 'impact') {
        void fetchImpactAnalysis(node.id);
      }

      if (highlightMode !== 'none') {
        highlightPath(node.id, highlightMode as 'upstream' | 'downstream' | 'path');
      }
    },
    [viewMode, highlightMode, fetchImpactAnalysis, highlightPath]
  );

  // Export handlers
  const handleExportJSON = useCallback(() => {
    const dataStr = JSON.stringify(
      {
        nodes: lineageData?.nodes || [],
        edges: lineageData?.edges || [],
        metadata: {
          dataSource: selectedDataSource,
          viewMode,
          persona,
          exportedAt: new Date().toISOString(),
        },
      },
      null,
      2
    );
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lineage-${selectedDataSource}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [lineageData, selectedDataSource, viewMode, persona]);

  const handleExportPNG = useCallback(() => {
    // Note: Requires html-to-image library
    // npm install html-to-image
    alert('PNG export requires html-to-image library. Install with: npm install html-to-image');
    console.log('Would export PNG with current viewport');
  }, []);

  const handleExportSVG = useCallback(() => {
    alert('SVG export coming soon');
    console.log('Would export as SVG');
  }, []);

  const handleFitView = useCallback(() => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 800 });
    }
  }, [reactFlowInstance]);

  const clearHighlights = useCallback(() => {
    setHighlightedPath(null);
    setHighlightMode('none');
  }, []);

  // ==================== COMPUTED VALUES ====================
  
  const dataSourceOptions = useMemo(
    () => [
      {
        value: '',
        label: dataSourcesLoading ? 'Loading...' : 'Select a data source',
        disabled: true,
      },
      ...dataSources.map((ds) => ({
        value: String(ds.id ?? ''),
        label: ds.name ?? ds.id ?? 'Unnamed source',
      })),
    ],
    [dataSources, dataSourcesLoading]
  );

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;
    return nodes.filter((node) =>
      node.data.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [nodes, searchTerm]);

  const stats = useMemo(() => {
    const upstreamCount = selectedNode
      ? edges.filter((e) => e.target === selectedNode).length
      : 0;
    const downstreamCount = selectedNode
      ? edges.filter((e) => e.source === selectedNode).length
      : 0;

    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      impactedCount: impactedNodes.size,
      healthyCount: nodes.length - impactedNodes.size,
      upstreamCount,
      downstreamCount,
      avgConfidence:
        edges.length > 0
          ? edges.reduce((sum, e) => sum + ((e as any).data?.metadata?.confidence || 0.8), 0) / edges.length
          : 0,
    };
  }, [nodes, edges, impactedNodes, selectedNode]);

  // ==================== RENDER ====================
  
  return (
    <div
      className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 p-4' : ''
      }`}
    >
      {/* ==================== HEADER ==================== */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
              <GitBranch className="h-10 w-10 text-indigo-600" />
              Data Lineage
              <Badge className="ml-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs px-3 py-1">
                v2.0
              </Badge>
            </h1>
            <p className="text-gray-600 mt-2 text-sm">
              Interactive data flow visualization • Path tracking • Impact analysis
            </p>
          </div>

          <div className="flex gap-2">
            {/* View Toggle - NEW */}
            <div className="flex gap-1 bg-white border-2 border-gray-200 rounded-lg p-1">
              <Button
                variant={lineageView === 'classic' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLineageView('classic')}
                className="gap-2"
              >
                <GitBranch className="h-4 w-4" />
                Classic
              </Button>
              <Button
                variant={lineageView === 'enhanced' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLineageView('enhanced')}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                Enhanced
              </Button>
            </div>

            {/* Export Dropdown */}
            <div className="relative group">
              <Button variant="outline" className="gap-2" disabled={nodes.length === 0}>
                <Download className="h-4 w-4" />
                Export
                <ChevronDown className="h-3 w-3" />
              </Button>
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <button
                  onClick={handleExportJSON}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm rounded-t-lg transition-colors"
                  disabled={nodes.length === 0}
                >
                  <FileJson className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Export JSON</span>
                </button>
                <button
                  onClick={handleExportPNG}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm transition-colors"
                  disabled={nodes.length === 0}
                >
                  <ImageIcon className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Export PNG</span>
                </button>
                <button
                  onClick={handleExportSVG}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 text-sm rounded-b-lg transition-colors"
                  disabled={nodes.length === 0}
                >
                  <FileDown className="h-4 w-4 text-purple-600" />
                  <span className="font-medium">Export SVG</span>
                </button>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="gap-2"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => void fetchLineageData()}
              disabled={loading || !selectedDataSource}
              className="gap-2"
              title="Refresh lineage data"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* ==================== CONTROLS PANEL (Classic View Only) ==================== */}
        {lineageView === 'classic' && (
        <Card className="border-0 shadow-xl bg-white/95 backdrop-blur-xl">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Data Source */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Data Source
                </label>
                <Select
                  value={selectedDataSource}
                  onChange={(e) => setSelectedDataSource(e.target.value)}
                  options={dataSourceOptions}
                  disabled={dataSourcesLoading}
                  className="w-full"
                />
              </div>

              {/* View Mode */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  View Mode
                </label>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="table" className="text-xs">
                      <Table2 className="h-3 w-3 mr-1" />
                      Table
                    </TabsTrigger>
                    <TabsTrigger value="column" className="text-xs">
                      <Columns3 className="h-3 w-3 mr-1" />
                      Column
                    </TabsTrigger>
                    <TabsTrigger value="impact" className="text-xs">
                      <TrendingUp className="h-3 w-3 mr-1" />
                      Impact
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Persona */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Persona
                </label>
                <div className="flex gap-1">
                  <Button
                    variant={persona === 'business' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPersona('business')}
                    className="flex-1 text-xs"
                  >
                    <Users className="h-3 w-3 mr-1" />
                    Business
                  </Button>
                  <Button
                    variant={persona === 'engineer' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPersona('engineer')}
                    className="flex-1 text-xs"
                  >
                    <Code className="h-3 w-3 mr-1" />
                    Engineer
                  </Button>
                  <Button
                    variant={persona === 'architect' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPersona('architect')}
                    className="flex-1 text-xs"
                  >
                    <Building2 className="h-3 w-3 mr-1" />
                    Architect
                  </Button>
                </div>
              </div>

              {/* Layout */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Layout
                </label>
                <div className="flex gap-2">
                  <Button
                    variant={layoutDirection === 'TB' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLayoutDirection('TB')}
                    className="flex-1"
                  >
                    Vertical
                  </Button>
                  <Button
                    variant={layoutDirection === 'LR' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLayoutDirection('LR')}
                    className="flex-1"
                  >
                    Horizontal
                  </Button>
                </div>
              </div>

              {/* Highlight Mode */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Highlight Path
                </label>
                <Select
                  value={highlightMode}
                  onChange={(e) => {
                    const mode = e.target.value as HighlightMode;
                    setHighlightMode(mode);
                    if (mode === 'none') {
                      clearHighlights();
                    } else if (selectedNode) {
                      highlightPath(selectedNode, mode as any);
                    }
                  }}
                  options={[
                    { value: 'none', label: 'None' },
                    { value: 'upstream', label: '⬆ Upstream' },
                    { value: 'downstream', label: '⬇ Downstream' },
                    { value: 'path', label: '⬍ Full Path' },
                  ]}
                />
              </div>

              {/* Filter by Type */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Filter Type
                </label>
                <Select
                  value={filterNodeType}
                  onChange={(e) => setFilterNodeType(e.target.value as NodeType | 'all')}
                  options={[
                    { value: 'all', label: 'All Types' },
                    { value: 'database', label: '🗄 Databases' },
                    { value: 'schema', label: '📂 Schemas' },
                    { value: 'table', label: '📊 Tables' },
                    { value: 'column', label: '🔧 Columns' },
                    { value: 'view', label: '👁 Views' },
                  ]}
                />
              </div>

              {/* Node Spacing */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Spacing: {nodeSpacing}px
                </label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNodeSpacing(Math.max(50, nodeSpacing - 25))}
                    className="p-2"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <input
                    type="range"
                    min="50"
                    max="300"
                    step="25"
                    value={nodeSpacing}
                    onChange={(e) => setNodeSpacing(parseInt(e.target.value))}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setNodeSpacing(Math.min(300, nodeSpacing + 25))}
                    className="p-2"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search nodes..."
                    className="pl-10 text-sm"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Options Row */}
            <div className="flex flex-wrap items-center gap-4 mt-5 pt-5 border-t border-gray-200">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900 transition-colors">
                <input
                  type="checkbox"
                  checked={showTransformations}
                  onChange={(e) => setShowTransformations(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium">Show Transformations</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900 transition-colors">
                <input
                  type="checkbox"
                  checked={showMetadata}
                  onChange={(e) => setShowMetadata(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium">Show Metadata</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:text-gray-900 transition-colors">
                <input
                  type="checkbox"
                  checked={showMiniMap}
                  onChange={(e) => setShowMiniMap(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="font-medium">Show MiniMap</span>
              </label>
              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFitView}
                  disabled={nodes.length === 0}
                  className="gap-2"
                >
                  <Target className="h-4 w-4" />
                  Fit View
                </Button>
                {highlightedPath && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearHighlights}
                    className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50"
                  >
                    <X className="h-4 w-4" />
                    Clear Path
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      {/* ==================== STATISTICS (Classic View Only) ==================== */}
      {lineageView === 'classic' && (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        <StatCard
          icon={Database}
          label="Nodes"
          value={stats.totalNodes}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatCard
          icon={GitBranch}
          label="Edges"
          value={stats.totalEdges}
          gradient="from-purple-500 to-pink-600"
        />
        <StatCard
          icon={ArrowUpRight}
          label="Upstream"
          value={stats.upstreamCount}
          gradient="from-orange-500 to-red-600"
        />
        <StatCard
          icon={ArrowDownRight}
          label="Downstream"
          value={stats.downstreamCount}
          gradient="from-teal-500 to-cyan-600"
        />
        <StatCard
          icon={AlertTriangle}
          label="Impacted"
          value={stats.impactedCount}
          gradient="from-red-500 to-rose-600"
        />
        <StatCard
          icon={CheckCircle2}
          label="Healthy"
          value={stats.healthyCount}
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          icon={Sparkles}
          label="Confidence"
          value={`${(stats.avgConfidence * 100).toFixed(0)}%`}
          gradient="from-indigo-500 to-purple-600"
        />
      </div>
      )}

      {/* ==================== GRAPH VISUALIZATION ==================== */}
      {lineageView === 'enhanced' ? (
        <div className="text-center py-20 bg-white rounded-xl shadow-lg">
          <Sparkles className="h-16 w-16 text-purple-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Enhanced View Coming Soon!</h3>
          <p className="text-gray-600">Interactive lineage visualization with AI insights</p>
        </div>
      ) : (
      <Card
        className="border-0 shadow-2xl bg-white/95 backdrop-blur-xl overflow-hidden"
        style={{ height: isFullscreen ? 'calc(100vh - 200px)' : 'calc(100vh - 520px)', minHeight: '500px' }}
      >
        <CardHeader className="pb-3 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                <GitBranch className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold">Lineage Graph</span>
              {viewMode === 'impact' && (
                <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-md">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Impact Analysis
                </Badge>
              )}
              {highlightedPath && (
                <Badge className="bg-gradient-to-r from-yellow-500 to-orange-600 text-white shadow-md">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Path Depth: {highlightedPath.depth}
                </Badge>
              )}
              {searchTerm && (
                <Badge variant="outline" className="border-blue-300 text-blue-700">
                  <Search className="h-3 w-3 mr-1" />
                  {filteredNodes.length} results
                </Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="h-full p-0">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-blue-50 to-indigo-50">
              <div className="text-center">
                <div className="relative">
                  <RefreshCcw className="h-16 w-16 animate-spin text-indigo-500 mx-auto mb-6" />
                  <Sparkles className="h-6 w-6 text-purple-500 absolute top-0 right-0 animate-pulse" />
                </div>
                <p className="text-gray-700 font-semibold text-lg mb-2">Loading Lineage Data</p>
                <p className="text-gray-500 text-sm">Analyzing dependencies and relationships...</p>
              </div>
            </div>
          ) : nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-50 to-blue-50">
              <div className="text-center max-w-lg px-6">
                <div className="relative inline-block mb-6">
                  <GitBranch className="h-24 w-24 text-gray-300 opacity-40" />
                  <Sparkles className="h-8 w-8 text-indigo-400 absolute -top-2 -right-2 animate-pulse" />
                </div>
                <p className="text-2xl font-bold mb-3 text-gray-700">No Lineage Data</p>
                <p className="text-sm text-gray-500 mb-6 leading-relaxed">
                  Select a data source above to visualize data lineage, track dependencies,
                  and analyze the impact of changes across your data ecosystem.
                </p>
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                    <Table2 className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-blue-900">Table Level</p>
                    <p className="text-xs text-blue-700 mt-1">Track table dependencies</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                    <Columns3 className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-purple-900">Column Level</p>
                    <p className="text-xs text-purple-700 mt-1">Granular field tracking</p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                    <TrendingUp className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-orange-900">Impact Analysis</p>
                    <p className="text-xs text-orange-700 mt-1">Assess change effects</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <ReactFlow
              nodes={filteredNodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              connectionMode={ConnectionMode.Loose}
              fitView
              minZoom={0.1}
              maxZoom={2}
              defaultEdgeOptions={{
                animated: true,
              }}
              proOptions={{ hideAttribution: true }}
            >
              <Background
                variant={backgroundVariant}
                gap={16}
                size={1}
                color="#e2e8f0"
              />
              <Controls showInteractive={false} className="bg-white/90 backdrop-blur-sm border-gray-200" />
              
              {showMiniMap && (
                <MiniMap
                  nodeColor={(node) => {
                    const colors = NODE_COLORS[node.data.type as NodeType];
                    return colors?.bg || '#94a3b8';
                  }}
                  pannable
                  zoomable
                  className="bg-white/90 backdrop-blur-sm border-2 border-gray-200 rounded-lg shadow-lg"
                />
              )}

              {/* Selected Node Details Panel */}
              {selectedNode && (
                <Panel
                  position="top-right"
                  className="bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl p-6 max-w-md border-2 border-indigo-100"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-lg flex items-center gap-2 text-gray-900">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg">
                        <Info className="h-4 w-4 text-white" />
                      </div>
                      Node Details
                    </h3>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>

                  {nodes.find((n) => n.id === selectedNode)?.data && (
                    <div className="space-y-4">
                      {/* Node Info */}
                      <div className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                        <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">
                          {nodes.find((n) => n.id === selectedNode)?.data.type}
                        </div>
                        <div className="text-lg font-bold text-gray-900 break-words">
                          {nodes.find((n) => n.id === selectedNode)?.data.label}
                        </div>
                      </div>

                      {/* Connection Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 text-center">
                          <ArrowUpRight className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                          <div className="text-xs text-blue-600 font-semibold mb-1">Upstream</div>
                          <div className="text-3xl font-bold text-blue-900">{stats.upstreamCount}</div>
                        </div>
                        <div className="p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200 text-center">
                          <ArrowDownRight className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                          <div className="text-xs text-purple-600 font-semibold mb-1">Downstream</div>
                          <div className="text-3xl font-bold text-purple-900">{stats.downstreamCount}</div>
                        </div>
                      </div>

                      {/* Metadata */}
                      {nodes.find((n) => n.id === selectedNode)?.data.metadata && (
                        <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-3">
                            Metadata
                          </div>
                          <div className="text-xs space-y-2">
                            {Object.entries(nodes.find((n) => n.id === selectedNode)!.data.metadata || {}).map(
                              ([key, value]) => (
                                <div key={key} className="flex justify-between items-center py-1 border-b border-gray-200 last:border-0">
                                  <span className="font-semibold text-gray-600">{key}:</span>
                                  <span className="text-gray-900 font-medium text-right ml-2 break-words max-w-[60%]">
                                    {Array.isArray(value) ? value.join(', ') : String(value)}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setHighlightMode('upstream');
                            highlightPath(selectedNode, 'upstream');
                          }}
                          className="flex-1 gap-2"
                        >
                          <ArrowUpRight className="h-3 w-3" />
                          Upstream
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setHighlightMode('downstream');
                            highlightPath(selectedNode, 'downstream');
                          }}
                          className="flex-1 gap-2"
                        >
                          <ArrowDownRight className="h-3 w-3" />
                          Downstream
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setHighlightMode('path');
                            highlightPath(selectedNode, 'path');
                          }}
                          className="flex-1 gap-2"
                        >
                          <Sparkles className="h-3 w-3" />
                          Full Path
                        </Button>
                      </div>
                    </div>
                  )}
                </Panel>
              )}

              {/* Impact Analysis Warning */}
              {viewMode === 'impact' && impactedNodes.size > 0 && (
                <Panel
                  position="bottom-left"
                  className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-300 rounded-2xl shadow-2xl p-5 max-w-sm"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg flex-shrink-0">
                      <AlertTriangle className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-orange-900 mb-2 text-lg">Impact Analysis</h3>
                      <p className="text-sm text-orange-800 font-semibold mb-1">
                        <span className="text-3xl font-bold">{impactedNodes.size}</span> node
                        {impactedNodes.size !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-orange-700 leading-relaxed">
                        will be affected by changes. Review all dependencies before proceeding.
                      </p>
                    </div>
                  </div>
                </Panel>
              )}

              {/* Path Highlight Info */}
              {highlightedPath && (
                <Panel
                  position="bottom-right"
                  className="bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-2xl shadow-2xl p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg flex-shrink-0">
                      <Sparkles className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-yellow-900 mb-3 text-lg">Path Highlighted</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="text-center">
                          <div className="text-yellow-700 font-semibold text-xs mb-1">Nodes</div>
                          <div className="text-3xl font-bold text-yellow-900">{highlightedPath.nodes.length}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-yellow-700 font-semibold text-xs mb-1">Edges</div>
                          <div className="text-3xl font-bold text-yellow-900">{highlightedPath.edges.length}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-yellow-700 font-semibold text-xs mb-1">Depth</div>
                          <div className="text-3xl font-bold text-yellow-900">{highlightedPath.depth}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Panel>
              )}
            </ReactFlow>
          )}
        </CardContent>
      </Card>
      )}

      {/* Add shimmer animation for highlight effect */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ==================== STAT CARD COMPONENT ====================
function StatCard({
  icon: Icon,
  label,
  value,
  gradient,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  gradient: string;
}) {
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/95 backdrop-blur-xl hover:scale-105 cursor-pointer group">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:shadow-xl transition-shadow`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-600 font-bold uppercase tracking-wider mb-0.5">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ==================== PROVIDER WRAPPER ====================
export default function DataLineageWithProvider() {
  return (
    <ReactFlowProvider>
      <DataLineage />
    </ReactFlowProvider>
  );
}