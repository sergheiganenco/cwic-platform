// Interactive Lineage Graph with React Flow
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
} from 'reactflow';
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
  Filter,
  Eye,
  EyeOff,
  LayoutGrid,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { LineageSummaryNode, LineageEdge as LineageEdgeType } from '@/types/lineage';

// Custom node types with icons and styling
const nodeIcons = {
  source: Database,
  database: Database,
  schema: Box,
  object: Table,
  table: Table,
  view: Eye,
  column: Columns,
  process: GitBranch,
  transformation: Zap,
  bronze: Database,
  silver: Database,
  gold: Database,
  sink: Database,
};

const nodeColors = {
  source: 'bg-blue-100 border-blue-500',
  database: 'bg-indigo-100 border-indigo-500',
  schema: 'bg-purple-100 border-purple-500',
  object: 'bg-green-100 border-green-500',
  table: 'bg-green-100 border-green-500',
  view: 'bg-teal-100 border-teal-500',
  column: 'bg-cyan-100 border-cyan-500',
  process: 'bg-orange-100 border-orange-500',
  transformation: 'bg-yellow-100 border-yellow-500',
  bronze: 'bg-amber-100 border-amber-600',
  silver: 'bg-gray-100 border-gray-500',
  gold: 'bg-yellow-100 border-yellow-600',
  sink: 'bg-red-100 border-red-500',
};

interface CustomNodeData {
  label: string;
  type: string;
  description?: string;
  confidence?: number;
  rowCount?: number;
  lastUpdated?: string;
  tags?: string[];
  layer?: number;
  onNodeClick?: (node: any) => void;
}

// Custom node component - Modern compact version
const CustomNode = ({ data }: { data: CustomNodeData }) => {
  const Icon = nodeIcons[data.type as keyof typeof nodeIcons] || Box;
  const colorClass = nodeColors[data.type as keyof typeof nodeColors] || 'bg-gray-100 border-gray-500';

  // Get gradient colors based on type
  const gradients = {
    source: 'from-blue-400 to-blue-600',
    database: 'from-indigo-400 to-indigo-600',
    schema: 'from-purple-400 to-purple-600',
    object: 'from-green-400 to-green-600',
    table: 'from-green-400 to-emerald-600',
    view: 'from-teal-400 to-cyan-600',
    column: 'from-cyan-400 to-blue-500',
    process: 'from-orange-400 to-red-500',
    transformation: 'from-yellow-400 to-orange-500',
    bronze: 'from-amber-400 to-amber-600',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    sink: 'from-red-400 to-red-600',
  };

  const gradient = gradients[data.type as keyof typeof gradients] || 'from-gray-400 to-gray-600';

  return (
    <div
      className={`px-3 py-2 rounded-xl border-2 shadow-lg min-w-[160px] max-w-[220px] ${colorClass} cursor-pointer hover:shadow-2xl hover:scale-105 transition-all duration-200 backdrop-blur-sm bg-white/90`}
      onClick={() => data.onNodeClick?.(data)}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${gradient} shadow-md`}>
          <Icon className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="font-semibold text-xs text-gray-900 truncate flex-1">{data.label}</span>
      </div>

      {data.description && (
        <p className="text-[10px] text-gray-600 mb-1.5 line-clamp-1">{data.description}</p>
      )}

      <div className="flex items-center gap-1 flex-wrap">
        {data.rowCount !== undefined && data.rowCount !== null && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">
            {data.rowCount.toLocaleString()}
          </span>
        )}

        {data.tags && data.tags.slice(0, 2).map(tag => (
          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
            {tag}
          </span>
        ))}

        {data.confidence !== undefined && data.confidence < 0.9 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-700">
            {Math.round(data.confidence * 100)}%
          </span>
        )}
      </div>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

// Dagre layout algorithm for hierarchical graphs - Compact spacing
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction, ranksep: 60, nodesep: 50 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 200, height: 100 });
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
        x: nodeWithPosition.x - 100,
        y: nodeWithPosition.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

interface InteractiveLineageGraphProps {
  nodes: LineageSummaryNode[];
  edges: LineageEdgeType[];
  onNodeSelect?: (node: LineageSummaryNode) => void;
  onExport?: (format: 'png' | 'svg' | 'json') => void;
}

const InteractiveLineageGraphContent: React.FC<InteractiveLineageGraphProps> = ({
  nodes: rawNodes,
  edges: rawEdges,
  onNodeSelect,
  onExport,
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');
  const [showMiniMap, setShowMiniMap] = useState(true);
  const [highlightedPath, setHighlightedPath] = useState<Set<string>>(new Set());
  const { fitView } = useReactFlow();

  // Convert API data to React Flow format
  const convertToFlowNodes = useCallback((apiNodes: LineageSummaryNode[]): Node[] => {
    return apiNodes.map((node) => ({
      id: node.urn,
      type: 'custom',
      position: { x: 0, y: 0 }, // Will be set by layout
      data: {
        label: node.label,
        type: node.nodeType || 'object',
        description: node.metadata?.description,
        confidence: node.confidence,
        rowCount: node.metadata?.rowCount,
        lastUpdated: node.lastRefreshed,
        tags: node.tags,
        layer: node.layer,
        onNodeClick: handleNodeClick,
      },
    }));
  }, []);

  const convertToFlowEdges = useCallback((apiEdges: LineageEdgeType[]): Edge[] => {
    return apiEdges.map((edge, idx) => {
      const isHighlighted = highlightedPath.has(edge.fromUrn) && highlightedPath.has(edge.toUrn);
      const isTransform = edge.relationshipType === 'transforms_to' || edge.relationshipType === 'references';

      return {
        id: `edge-${idx}`,
        source: edge.fromUrn,
        target: edge.toUrn,
        type: 'smoothstep',
        animated: isTransform || isHighlighted,
        label: edge.relationshipType?.replace(/_/g, ' '),
        style: {
          stroke: isHighlighted
            ? 'url(#highlight-gradient)'
            : isTransform
            ? '#6366f1'
            : '#cbd5e1',
          strokeWidth: isHighlighted ? 3 : 2,
          strokeDasharray: edge.relationshipType === 'references' ? '5,5' : undefined,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: isHighlighted
            ? '#3b82f6'
            : isTransform
            ? '#6366f1'
            : '#cbd5e1',
        },
        labelStyle: {
          fontSize: 10,
          fill: '#475569',
          fontWeight: 500,
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.9,
        },
      };
    });
  }, [highlightedPath]);

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

      // Fit view after layout
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    }
  }, [rawNodes, rawEdges, layoutDirection, convertToFlowNodes, convertToFlowEdges, setNodes, setEdges, fitView]);

  const handleNodeClick = useCallback((nodeData: any) => {
    const node = rawNodes.find(n => n.label === nodeData.label);
    if (node && onNodeSelect) {
      onNodeSelect(node);
    }

    // Highlight path from this node
    const connectedEdges = rawEdges.filter(
      e => e.fromUrn === node?.urn || e.toUrn === node?.urn
    );
    const connectedNodes = new Set<string>();
    connectedEdges.forEach(e => {
      connectedNodes.add(e.fromUrn);
      connectedNodes.add(e.toUrn);
    });
    setHighlightedPath(connectedNodes);
  }, [rawNodes, rawEdges, onNodeSelect]);

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

      // Zoom to first match
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

  const handleExport = (format: 'png' | 'svg' | 'json') => {
    if (onExport) {
      onExport(format);
    }
  };

  const toggleLayout = () => {
    setLayoutDirection(prev => prev === 'TB' ? 'LR' : 'TB');
  };

  const filteredNodes = useMemo(() => {
    if (!searchTerm) return nodes;
    return nodes.filter(node =>
      node.data.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [nodes, searchTerm]);

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={filteredNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
          animated: false,
        }}
      >
        <Background color="#e2e8f0" gap={16} />
        <Controls />
        {showMiniMap && (
          <MiniMap
            nodeColor={(node) => {
              const type = node.data.type || 'object';
              return nodeColors[type as keyof typeof nodeColors]?.replace('bg-', '#').split(' ')[0] || '#94a3b8';
            }}
            nodeBorderRadius={8}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
        )}

        {/* Control Panel */}
        <Panel position="top-left" className="bg-white rounded-lg shadow-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search nodes..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-8 pr-3 py-2 border rounded-lg text-sm w-full focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={toggleLayout}
              title="Toggle layout direction"
            >
              <LayoutGrid className="h-4 w-4 mr-1" />
              {layoutDirection === 'TB' ? 'Vertical' : 'Horizontal'}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowMiniMap(!showMiniMap)}
              title="Toggle minimap"
            >
              {showMiniMap ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => fitView({ padding: 0.2, duration: 800 })}
              title="Fit to view"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => handleExport('png')}
              title="Export graph"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-xs text-gray-600 pt-2 border-t">
            {rawNodes.length} nodes • {rawEdges.length} edges
          </div>
        </Panel>

        {/* Stats Panel */}
        <Panel position="top-right" className="bg-white rounded-lg shadow-lg p-3">
          <div className="text-xs font-semibold mb-2">Graph Stats</div>
          <div className="space-y-1 text-xs text-gray-600">
            <div>Sources: {rawNodes.filter(n => n.layer === 0).length}</div>
            <div>Tables: {rawNodes.filter(n => n.layer === 3).length}</div>
            <div>Processes: {rawNodes.filter(n => n.layer === 5).length}</div>
            {highlightedPath.size > 0 && (
              <div className="pt-2 border-t text-blue-600 font-medium">
                {highlightedPath.size} nodes selected
              </div>
            )}
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
};

// Wrapper with provider
export const InteractiveLineageGraph: React.FC<InteractiveLineageGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <InteractiveLineageGraphContent {...props} />
    </ReactFlowProvider>
  );
};

export default InteractiveLineageGraph;
