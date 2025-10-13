// Modern Lineage Graph with Animated Flowing Lines and Transformation Nodes
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionLineType,
  MarkerType,
  Panel,
  ReactFlowProvider,
  useReactFlow,
  BackgroundVariant,
  getBezierPath,
  EdgeProps,
} from 'reactflow';
// @ts-ignore - dagre types are not available
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import {
  Database,
  Table,
  Columns,
  GitBranch,
  Zap,
  Box,
  Search,
  Download,
  Maximize2,
  Eye,
  EyeOff,
  LayoutGrid,
  Settings,
  ArrowRight,
  RefreshCw,
  Workflow,
  Filter,
  Activity,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { LineageSummaryNode, LineageEdge as LineageEdgeType } from '@/types/lineage';

// Modern node icons with better visuals
const nodeIcons = {
  source: Database,
  database: Database,
  schema: Box,
  object: Table,
  table: Table,
  view: Eye,
  column: Columns,
  process: GitBranch,
  transformation: Workflow,
  bronze: Database,
  silver: Database,
  gold: Database,
  sink: Database,
};

// Custom Edge with Animated Flow and Transformation Icon
const AnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isTransform = data?.relationshipType === 'transforms_to' || data?.relationshipType === 'references';
  const isHighlighted = data?.isHighlighted;

  return (
    <g>
      {/* Background gradient path */}
      <defs>
        <linearGradient id={`gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isHighlighted ? '#3b82f6' : '#6366f1'} stopOpacity="0.6" />
          <stop offset="50%" stopColor={isHighlighted ? '#3b82f6' : '#6366f1'} stopOpacity="0.9" />
          <stop offset="100%" stopColor={isHighlighted ? '#3b82f6' : '#6366f1'} stopOpacity="0.6" />
        </linearGradient>

        {/* Animated dash pattern for flowing effect */}
        <linearGradient id={`flow-gradient-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={isHighlighted ? '#60a5fa' : '#818cf8'} stopOpacity="0">
            <animate attributeName="stop-opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="50%" stopColor={isHighlighted ? '#60a5fa' : '#818cf8'} stopOpacity="1">
            <animate attributeName="stop-opacity" values="1;0;1" dur="2s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor={isHighlighted ? '#60a5fa' : '#818cf8'} stopOpacity="0">
            <animate attributeName="stop-opacity" values="0;1;0" dur="2s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>

      {/* Main edge path */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        strokeWidth={isHighlighted ? 5 : 3.5}
        stroke={`url(#gradient-${id})`}
      />

      {/* Animated flowing overlay */}
      <path
        d={edgePath}
        stroke={`url(#flow-gradient-${id})`}
        strokeWidth={isHighlighted ? 3 : 2}
        fill="none"
        strokeDasharray="10 5"
        opacity="0.8"
      >
        <animate attributeName="stroke-dashoffset" values="20;0" dur="1.5s" repeatCount="indefinite" />
      </path>

      {/* Transformation gear icon in the middle */}
      {isTransform && (
        <g transform={`translate(${labelX - 14}, ${labelY - 14})`}>
          {/* Background circle */}
          <circle
            cx="14"
            cy="14"
            r="14"
            fill={isHighlighted ? '#3b82f6' : '#6366f1'}
            className="drop-shadow-lg"
          />
          <circle
            cx="14"
            cy="14"
            r="12"
            fill="white"
          />
          {/* Gear icon (simplified) */}
          <g transform="translate(14, 14)">
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from="0 14 14"
              to="360 14 14"
              dur="4s"
              repeatCount="indefinite"
            />
            <Settings
              size={18}
              style={{
                transform: 'translate(-9px, -9px)',
                color: isHighlighted ? '#3b82f6' : '#6366f1',
              }}
            />
          </g>
        </g>
      )}

      {/* Relationship label */}
      {data?.label && (
        <g transform={`translate(${labelX}, ${labelY + (isTransform ? 30 : 0)})`}>
          <rect
            x="-30"
            y="-10"
            width="60"
            height="20"
            fill="white"
            stroke="#e2e8f0"
            strokeWidth="1"
            rx="4"
            opacity="0.95"
          />
          <text
            x="0"
            y="5"
            textAnchor="middle"
            fontSize="10"
            fill="#64748b"
            fontWeight="500"
          >
            {data.label}
          </text>
        </g>
      )}
    </g>
  );
};

// Modern node component with gradient and glow effects
const ModernNode = ({ data }: { data: any }) => {
  const Icon = nodeIcons[data.type as keyof typeof nodeIcons] || Box;

  const gradients = {
    source: { from: '#3b82f6', to: '#1d4ed8', shadow: 'rgba(59, 130, 246, 0.5)' },
    database: { from: '#6366f1', to: '#4f46e5', shadow: 'rgba(99, 102, 241, 0.5)' },
    schema: { from: '#8b5cf6', to: '#7c3aed', shadow: 'rgba(139, 92, 246, 0.5)' },
    object: { from: '#10b981', to: '#059669', shadow: 'rgba(16, 185, 129, 0.5)' },
    table: { from: '#10b981', to: '#047857', shadow: 'rgba(16, 185, 129, 0.5)' },
    view: { from: '#14b8a6', to: '#0d9488', shadow: 'rgba(20, 184, 166, 0.5)' },
    column: { from: '#06b6d4', to: '#0891b2', shadow: 'rgba(6, 182, 212, 0.5)' },
    process: { from: '#f59e0b', to: '#d97706', shadow: 'rgba(245, 158, 11, 0.5)' },
    transformation: { from: '#f97316', to: '#ea580c', shadow: 'rgba(249, 115, 22, 0.5)' },
    bronze: { from: '#f59e0b', to: '#d97706', shadow: 'rgba(245, 158, 11, 0.5)' },
    silver: { from: '#64748b', to: '#475569', shadow: 'rgba(100, 116, 139, 0.5)' },
    gold: { from: '#eab308', to: '#ca8a04', shadow: 'rgba(234, 179, 8, 0.5)' },
    sink: { from: '#ef4444', to: '#dc2626', shadow: 'rgba(239, 68, 68, 0.5)' },
  };

  const colors = gradients[data.type as keyof typeof gradients] || gradients.object;

  // Impact mode styling
  const isImpactSelected = data.isImpactSelected;
  const isDownstream = data.isDownstream;
  const isDimmed = data.isDimmed;

  const opacity = isDimmed ? 0.3 : 1;
  const scale = isImpactSelected ? 'scale-110' : isDownstream ? 'scale-105' : '';
  const ringClass = isImpactSelected
    ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-white'
    : isDownstream
    ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-white'
    : '';

  return (
    <div
      className={`px-4 py-3 rounded-2xl shadow-2xl min-w-[180px] max-w-[240px] cursor-pointer transition-all duration-500 hover:scale-110 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] relative overflow-hidden backdrop-blur-sm group animate-in fade-in zoom-in duration-700 ${scale} ${ringClass}`}
      style={{
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
        boxShadow: `0 10px 30px -10px ${colors.shadow}, 0 0 0 1px rgba(255,255,255,0.1) inset`,
        opacity,
      }}
      onClick={() => data.onNodeClick?.()}
    >
      {/* Animated background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Shimmer effect on hover */}
      <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      {/* Pulse animation for active nodes */}
      <div className="absolute inset-0 rounded-2xl animate-pulse opacity-30" style={{
        background: `radial-gradient(circle at top right, ${colors.from}80, transparent)`,
      }} />

      <div className="relative z-10">
        {/* Header with icon and title */}
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-white/90 shadow-lg backdrop-blur group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
            <Icon className="h-5 w-5 transition-transform duration-300" style={{ color: colors.from }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-white truncate drop-shadow-md group-hover:scale-105 transition-transform duration-300">
              {data.label}
            </h3>
            {data.description && (
              <p className="text-xs text-white/80 truncate">{data.description}</p>
            )}
          </div>
        </div>

        {/* Metadata badges */}
        <div className="flex items-center gap-2 flex-wrap mt-3">
          {data.rowCount !== undefined && data.rowCount !== null && (
            <div className="px-2 py-1 rounded-lg bg-white/20 backdrop-blur-sm text-white text-xs font-medium flex items-center gap-1 animate-in fade-in slide-in-from-bottom duration-500 hover:bg-white/30 transition-colors">
              <Activity className="h-3 w-3" />
              {data.rowCount.toLocaleString()}
            </div>
          )}

          {data.tags && data.tags.slice(0, 2).map((tag: string, idx: number) => (
            <div key={tag} className="px-2 py-1 rounded-lg bg-white/20 backdrop-blur-sm text-white text-xs animate-in fade-in slide-in-from-bottom duration-500 hover:bg-white/30 transition-colors" style={{ animationDelay: `${(idx + 1) * 100}ms` }}>
              {tag}
            </div>
          ))}

          {data.confidence !== undefined && data.confidence < 0.9 && (
            <div className="px-2 py-1 rounded-lg bg-yellow-400/30 backdrop-blur-sm text-white text-xs font-medium animate-in fade-in slide-in-from-bottom duration-500 hover:bg-yellow-400/40 transition-colors">
              {Math.round(data.confidence * 100)}%
            </div>
          )}
        </div>

        {/* Corner badge for type */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-white/30 backdrop-blur-sm text-white text-[10px] font-semibold uppercase group-hover:bg-white/40 transition-colors animate-in fade-in duration-300">
          {data.type}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  modern: ModernNode,
};

const edgeTypes = {
  animated: AnimatedEdge,
};

// Improved layout with better spacing
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: 150,
    nodesep: 100,
    edgesep: 80,
  });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 120 });
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
        x: nodeWithPosition.x - 110,
        y: nodeWithPosition.y - 60,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface ModernLineageGraphProps {
  nodes: LineageSummaryNode[];
  edges: LineageEdgeType[];
  onNodeSelect?: (node: LineageSummaryNode) => void;
}

const ModernLineageGraphContent: React.FC<ModernLineageGraphProps> = ({
  nodes: rawNodes,
  edges: rawEdges,
  onNodeSelect,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('LR');
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
  const { fitView } = useReactFlow();

  // Convert API data to React Flow format
  const convertToFlowNodes = useCallback((apiNodes: LineageSummaryNode[]): Node[] => {
    return apiNodes.map((node) => ({
      id: node.urn,
      type: 'modern',
      position: { x: 0, y: 0 },
      data: {
        label: node.label,
        type: node.type || 'object',
        description: node.metadata?.description as string | undefined,
        confidence: node.confidence,
        rowCount: node.metadata?.rowCount as number | undefined,
        lastUpdated: node.updatedAt,
        tags: node.aliases || [],
        layer: node.layer,
        onNodeClick: () => onNodeSelect?.(node),
        // Impact mode metadata
        isImpactSelected: node.metadata?.isImpactSelected,
        isDownstream: node.metadata?.isDownstream,
        isDimmed: node.metadata?.isDimmed,
      },
    }));
  }, [onNodeSelect]);

  const convertToFlowEdges = useCallback((apiEdges: LineageEdgeType[]): Edge[] => {
    return apiEdges.map((edge, idx) => {
      const isHighlighted = edge.metadata?.isHighlighted || (highlightedPath.has(edge.from) && highlightedPath.has(edge.to));
      const isDimmed = edge.metadata?.isDimmed;
      const isTransform = edge.relationshipType === 'transforms_to' || edge.relationshipType === 'references';

      return {
        id: edge.edgeId || `edge-${idx}`,
        source: edge.from,
        target: edge.to,
        type: 'animated',
        animated: true,
        style: {
          opacity: isDimmed ? 0.2 : 1,
        },
        data: {
          label: edge.relationshipType?.replace(/_/g, ' '),
          relationshipType: edge.relationshipType,
          isHighlighted,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 24,
          height: 24,
          color: isHighlighted ? '#3b82f6' : '#6366f1',
        },
      };
    });
  }, [highlightedPath]);

  const handleNodeClick = useCallback((node: LineageSummaryNode) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }

    // Highlight connected nodes
    const connectedEdges = rawEdges.filter(
      e => e.from === node.urn || e.to === node.urn
    );
    const connectedNodes = new Set<string>();
    connectedEdges.forEach(e => {
      connectedNodes.add(e.from);
      connectedNodes.add(e.to);
    });
    setHighlightedPath(connectedNodes);
  }, [rawEdges, onNodeSelect]);

  // Initialize and layout graph
  useEffect(() => {
    if (rawNodes.length > 0) {
      const flowNodes = convertToFlowNodes(rawNodes);
      const flowEdges = convertToFlowEdges(rawEdges);

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges,
        layoutDirection
      );

      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

      setTimeout(() => fitView({ padding: 0.15, duration: 800 }), 100);
    }
  }, [rawNodes, rawEdges, layoutDirection, convertToFlowNodes, convertToFlowEdges, setNodes, setEdges, fitView]);

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);

    if (!term) {
      setHighlightedPath(new Set());
      return;
    }

    const matchingNodes = rawNodes.filter(node =>
      node.label.toLowerCase().includes(term.toLowerCase())
    );

    if (matchingNodes.length > 0) {
      const urns = new Set(matchingNodes.map(n => n.urn));
      setHighlightedPath(urns);

      const firstMatch = nodes.find(n => n.data.label.toLowerCase().includes(term.toLowerCase()));
      if (firstMatch) {
        fitView({
          nodes: [firstMatch],
          duration: 800,
          padding: 0.5,
        });
      }
    }
  }, [rawNodes, nodes, fitView]);

  return (
    <div className="h-full w-full relative bg-gradient-to-br from-slate-50 to-blue-50">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.1}
        maxZoom={1.5}
        defaultEdgeOptions={{
          animated: true,
        }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          color="#cbd5e1"
          gap={20}
          size={1}
          variant={BackgroundVariant.Dots}
        />
        <Controls
          showInteractive={false}
          className="bg-white shadow-xl rounded-lg border border-gray-200"
        />
        {showMiniMap && (
          <MiniMap
            nodeColor={() => '#6366f1'}
            nodeBorderRadius={12}
            maskColor="rgba(0, 0, 0, 0.15)"
            className="bg-white shadow-xl rounded-lg border border-gray-200"
          />
        )}

        {/* Modern Control Panel */}
        <Panel position="top-left" className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-4 space-y-3 border border-gray-200 animate-in slide-in-from-left duration-500">
          <div className="flex items-center gap-2 mb-2">
            <Workflow className="h-5 w-5 text-indigo-600 animate-pulse" />
            <h3 className="font-bold text-gray-900">Lineage Controls</h3>
          </div>

          <div className="relative animate-in fade-in duration-500 delay-100">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 pr-3 py-2 border border-gray-300 rounded-xl text-sm w-full focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white transition-all duration-300 hover:border-indigo-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-500 delay-200">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setLayoutDirection(prev => prev === 'TB' ? 'LR' : 'TB')}
              className="gap-2 hover:scale-105 transition-transform duration-200"
            >
              <LayoutGrid className="h-4 w-4" />
              {layoutDirection === 'TB' ? 'Vertical' : 'Horizontal'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMiniMap(!showMiniMap)}
              className="gap-2 hover:scale-105 transition-transform duration-200"
            >
              {showMiniMap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => fitView({ padding: 0.2, duration: 800 })}
              className="gap-2 col-span-2 hover:scale-105 transition-transform duration-200"
            >
              <Maximize2 className="h-4 w-4" />
              Fit View
            </Button>
          </div>

          <div className="text-xs text-gray-600 pt-2 border-t border-gray-200 animate-in fade-in duration-500 delay-300">
            <div className="flex justify-between hover:text-gray-900 transition-colors">
              <span>Nodes:</span>
              <span className="font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{rawNodes.length}</span>
            </div>
            <div className="flex justify-between hover:text-gray-900 transition-colors">
              <span>Relationships:</span>
              <span className="font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">{rawEdges.length}</span>
            </div>
          </div>
        </Panel>

        {/* Stats Panel */}
        <Panel position="top-right" className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-4 border border-gray-200 animate-in slide-in-from-right duration-500 delay-200">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-5 w-5 text-indigo-600 animate-pulse" />
            <h3 className="font-bold text-gray-900">Graph Stats</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-right duration-500 delay-300">
              <span className="text-gray-600">Sources</span>
              <Badge variant="secondary">{rawNodes.filter(n => n.layer === 0).length}</Badge>
            </div>
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-right duration-500 delay-[400ms]">
              <span className="text-gray-600">Tables</span>
              <Badge variant="secondary">{rawNodes.filter(n => n.type === 'table').length}</Badge>
            </div>
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-right duration-500 delay-500">
              <span className="text-gray-600">Schemas</span>
              <Badge variant="secondary">{rawNodes.filter(n => n.type === 'schema').length}</Badge>
            </div>
            <div className="flex justify-between items-center animate-in fade-in slide-in-from-right duration-500 delay-[600ms]">
              <span className="text-gray-600">Columns</span>
              <Badge variant="secondary">{rawNodes.filter(n => n.type === 'column').length}</Badge>
            </div>
            {highlightedPath.size > 0 && (
              <div className="pt-2 border-t border-gray-200 animate-in fade-in zoom-in duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-indigo-600 font-semibold">Selected</span>
                  <Badge className="bg-indigo-600 animate-pulse">{highlightedPath.size}</Badge>
                </div>
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// Wrapper with provider
export const ModernLineageGraph: React.FC<ModernLineageGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ModernLineageGraphContent {...props} />
    </ReactFlowProvider>
  );
};

export default ModernLineageGraph;
