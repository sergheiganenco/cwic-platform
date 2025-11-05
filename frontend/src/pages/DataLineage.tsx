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
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle,
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
  Settings,
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
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { lineageApi } from '@/services/api/lineage';
import { StatCard } from '@/components/lineage/StatCard'

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

interface ColumnInfo {
  name: string;
  type: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
}

interface TableInfo {
  id: string;
  name: string;
  type: 'source' | 'transform' | 'target';
  columns: ColumnInfo[];
  records?: string;
  color: 'blue' | 'green' | 'purple' | 'indigo' | 'pink';
}

interface RelationshipInfo {
  id: string;
  source: string;
  target: string;
  sourceColumn: string;
  targetColumn: string;
  type: 'one-to-many' | 'many-to-one' | 'one-to-one';
}

// ==================== SAMPLE DATA FOR ENHANCED VIEW ====================
const sampleTables: TableInfo[] = [
  {
    id: 'customers',
    name: 'customers',
    type: 'source',
    columns: [
      { name: 'customer_id', type: 'INT', isPrimaryKey: true },
      { name: 'email', type: 'VARCHAR' },
      { name: 'name', type: 'VARCHAR' },
      { name: 'created_at', type: 'TIMESTAMP' },
      { name: 'country', type: 'VARCHAR' },
    ],
    records: '2.1M',
    color: 'blue',
  },
  {
    id: 'products',
    name: 'products',
    type: 'source',
    columns: [
      { name: 'product_id', type: 'INT', isPrimaryKey: true },
      { name: 'name', type: 'VARCHAR' },
      { name: 'category', type: 'VARCHAR' },
      { name: 'price', type: 'DECIMAL' },
      { name: 'stock', type: 'INT' },
    ],
    records: '50K',
    color: 'green',
  },
  {
    id: 'orders',
    name: 'orders',
    type: 'source',
    columns: [
      { name: 'order_id', type: 'INT', isPrimaryKey: true },
      { name: 'customer_id', type: 'INT', isForeignKey: true },
      { name: 'product_id', type: 'INT', isForeignKey: true },
      { name: 'quantity', type: 'INT' },
      { name: 'order_date', type: 'TIMESTAMP' },
      { name: 'total_amount', type: 'DECIMAL' },
    ],
    records: '5.3M',
    color: 'purple',
  },
  {
    id: 'customer_analytics',
    name: 'customer_analytics',
    type: 'target',
    columns: [
      { name: 'customer_id', type: 'INT', isPrimaryKey: true },
      { name: 'total_orders', type: 'INT' },
      { name: 'total_spent', type: 'DECIMAL' },
      { name: 'avg_order_value', type: 'DECIMAL' },
      { name: 'last_order_date', type: 'TIMESTAMP' },
    ],
    records: '2.1M',
    color: 'indigo',
  },
  {
    id: 'sales_summary',
    name: 'sales_summary',
    type: 'target',
    columns: [
      { name: 'product_id', type: 'INT', isPrimaryKey: true },
      { name: 'total_quantity', type: 'INT' },
      { name: 'total_revenue', type: 'DECIMAL' },
      { name: 'unique_customers', type: 'INT' },
      { name: 'avg_price', type: 'DECIMAL' },
    ],
    records: '50K',
    color: 'pink',
  },
];

const sampleRelationships: RelationshipInfo[] = [
  {
    id: 'rel1',
    source: 'customers',
    target: 'orders',
    sourceColumn: 'customer_id',
    targetColumn: 'customer_id',
    type: 'one-to-many',
  },
  {
    id: 'rel2',
    source: 'products',
    target: 'orders',
    sourceColumn: 'product_id',
    targetColumn: 'product_id',
    type: 'one-to-many',
  },
  {
    id: 'rel3',
    source: 'customers',
    target: 'customer_analytics',
    sourceColumn: 'customer_id',
    targetColumn: 'customer_id',
    type: 'one-to-one',
  },
  {
    id: 'rel4',
    source: 'orders',
    target: 'customer_analytics',
    sourceColumn: 'customer_id',
    targetColumn: 'customer_id',
    type: 'many-to-one',
  },
  {
    id: 'rel5',
    source: 'orders',
    target: 'sales_summary',
    sourceColumn: 'product_id',
    targetColumn: 'product_id',
    type: 'many-to-one',
  },
];

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

      {/* Optional node-level handles for manual linking */}
      {data.showHandles && (
        <>
          <Handle id="t" type="target" position={Position.Left} className="!w-2 !h-2 !bg-indigo-500" />
          <Handle id="s" type="source" position={Position.Right} className="!w-2 !h-2 !bg-indigo-500" />
        </>
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

// ==================== ENHANCED TABLE NODE (for key-based view) ====================
const EnhancedTableNode = ({ data }: { data: { table: TableInfo; isHighlighted?: boolean } }) => {
  const t = data.table;
  return (
    <div
      className={`min-w-[260px] max-w-[320px] rounded-lg border-2 shadow-md bg-white ${
        data.isHighlighted ? 'ring-4 ring-yellow-400 ring-opacity-60' : ''
      }`}
      style={{ borderColor: '#2563eb' }}
    >
      <div className="px-3 py-2 rounded-t-md text-white flex items-center justify-between"
           style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}>
        <div className="font-bold text-sm truncate flex items-center gap-2">
          <Table2 className="h-4 w-4 text-white/90" />
          {t.name}
        </div>
        {t.records && (
          <span className="text-[10px] bg-white/20 rounded px-2 py-0.5">{t.records}</span>
        )}
      </div>
      <div className="px-3 py-2 bg-white">
        <div className="text-[11px] text-gray-500 mb-1">Columns</div>
        <div className="max-h-[160px] overflow-auto pr-1">
          {t.columns.slice(0, 12).map((c) => (
            <div key={c.name} className="relative text-[12px] flex items-center gap-2 py-0.5">
              {/* target handle (incoming) */}
              <Handle
                id={`t:${c.name}`}
                type="target"
                position={Position.Left}
                className="!w-2 !h-2 !bg-indigo-500"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
              {c.isPrimaryKey ? (
                <span title="Primary Key" className="inline-flex items-center text-emerald-700 font-semibold">PK</span>
              ) : c.isForeignKey ? (
                <span title="Foreign Key" className="inline-flex items-center text-indigo-700 font-semibold">FK</span>
              ) : (
                <span className="w-5" />
              )}
              <span className="font-mono text-gray-800 truncate">{c.name}</span>
              {c.type && <span className="text-[11px] text-gray-500 ml-auto">{c.type}</span>}

              {/* source handle (outgoing) */}
              <Handle
                id={`s:${c.name}`}
                type="source"
                position={Position.Right}
                className="!w-2 !h-2 !bg-indigo-500"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
          {t.columns.length > 12 && (
            <div className="text-[11px] text-gray-500">+{t.columns.length - 12} moreÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</div>
          )}
        </div>
      </div>
    </div>
  );
};

const enhancedNodeTypes = {
  tableNode: EnhancedTableNode,
};

// ==================== RELATIONSHIP INFERENCE (from keys) ====================
function deriveRelationshipsFromKeys(tables: TableInfo[], seed?: RelationshipInfo[]): RelationshipInfo[] {
  const rels: RelationshipInfo[] = Array.isArray(seed) ? [...seed] : [];
  const byId = new Map<string, TableInfo>(tables.map((t) => [t.id, t]));

  // Build PK lookup by column name (lowercased)
  const pkByCol = new Map<string, TableInfo[]>();
  for (const t of tables) {
    for (const c of t.columns) {
      if (c.isPrimaryKey) {
        const key = c.name.toLowerCase();
        const arr = pkByCol.get(key) ?? [];
        arr.push(t);
        pkByCol.set(key, arr);
      }
    }
  }

  const makeId = (s: string, sc: string, t: string, tc: string) => `fk:${s}.${sc}->${t}.${tc}`;
  const seen = new Set(rels.map((r) => makeId(r.source, r.sourceColumn, r.target, r.targetColumn)));

  // For each FK-like column, try to connect to a PK with the same name
  for (const src of tables) {
    for (const col of src.columns) {
      const isFkFlag = Boolean(col.isForeignKey);
      const looksLikeFk = /_id$/i.test(col.name) && !col.isPrimaryKey;
      if (!isFkFlag && !looksLikeFk) continue;

      const targetCandidates = pkByCol.get(col.name.toLowerCase()) ?? [];

      // Heuristic match by base name (e.g., customer_id -> customers)
      const base = col.name.replace(/_id$/i, '').toLowerCase();
      const moreCandidates = tables.filter((t) => t.columns.some((c) => c.isPrimaryKey && c.name.toLowerCase() === `${base}_id`));
      const candidates = [...new Set([...targetCandidates, ...moreCandidates])];

      for (const tgt of candidates) {
        if (tgt.id === src.id) continue;
        const targetPk = tgt.columns.find((c) => c.isPrimaryKey && c.name.toLowerCase() === col.name.toLowerCase())
          || tgt.columns.find((c) => c.isPrimaryKey && c.name.toLowerCase() === `${base}_id`);
        const targetCol = targetPk?.name ?? col.name;
        const id = makeId(src.id, col.name, tgt.id, targetCol);
        if (seen.has(id)) continue;
        rels.push({ id, source: src.id, target: tgt.id, sourceColumn: col.name, targetColumn: targetCol, type: 'many-to-one' });
        seen.add(id);
      }
    }
  }

  // Only keep relationships where both nodes exist
  return rels.filter((r) => byId.has(r.source) && byId.has(r.target));
}

// ==================== BUILD ENHANCED FLOW (tables + key-based edges) ====================
function buildEnhancedFlow(tables: TableInfo[], relationships?: RelationshipInfo[], direction: 'TB' | 'LR' = 'TB', spacing = 150) {
  const inferred = deriveRelationshipsFromKeys(tables, relationships);

  const nodes: Node[] = tables.map((t) => ({
    id: t.id,
    type: 'tableNode',
    data: { table: t },
    position: { x: 0, y: 0 },
    sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
    targetPosition: direction === 'TB' ? Position.Top : Position.Left,
  }));

  const edges: Edge[] = inferred.map((r) => ({
    id: r.id,
    source: r.source,
    target: r.target,
    type: 'smoothstep',
    label: `${r.sourceColumn} -> ${r.targetColumn}`,
    sourceHandle: `s:${r.sourceColumn}`,
    targetHandle: `t:${r.targetColumn}`,
    animated: true,
    style: { stroke: '#6366f1', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 20, height: 20 },
    labelStyle: { fill: '#374151', fontWeight: 600, fontSize: 11 },
    labelBgStyle: { fill: 'white', fillOpacity: 0.95, rx: 6, ry: 6 },
    labelBgPadding: [8, 6],
  }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(nodes, edges, direction, spacing);
  return { nodes: layoutedNodes, edges: layoutedEdges };
}

// ==================== MAIN COMPONENT ====================
function DataLineage(): JSX.Element {
  const reactFlowInstance = useReactFlow();
  const { items: dataSources, loading: dataSourcesLoading, refresh: refreshDataSources, listDatabases, getDataSourceById } = useDataSources();

  // State Management
  const [lineageView, setLineageView] = useState<'classic' | 'enhanced'>('classic'); // Unified: default classic
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [databases, setDatabases] = useState<string[]>([]);
  const [selectedDatabase, setSelectedDatabase] = useState<string>('');
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
  const [manualMode, setManualMode] = useState(false);
  const [manualEdges, setManualEdges] = useState<Edge[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<Edge[]>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const currentSource = React.useMemo(() => getDataSourceById(String(selectedDataSource)), [getDataSourceById, selectedDataSource]);

  // ==================== API CALLS ====================
  
  // Fetch table-level lineage
  const fetchLineageData = useCallback(async () => {
    if (!selectedDataSource) return;

    setLoading(true);
    try {
      const response = await axios.get('/api/data/lineage/graph', {
        params: { dataSourceId: selectedDataSource, database: selectedDatabase || undefined },
      });

      if (response.data.success) {
        setLineageData(response.data.data);
      }
    } catch (error) {
      console.error('Failed to fetch lineage data:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedDataSource, selectedDatabase]);

  // Load databases when data source changes (for DB-level selection)
  useEffect(() => {
    let cancelled = false;
    async function loadDbs() {
      if (!selectedDataSource) { setDatabases([]); setSelectedDatabase(''); return; }
      try {
        const list = await listDatabases(selectedDataSource);
        const names: string[] = Array.isArray(list)
          ? list.map((x: any) => (typeof x === 'string' ? x : x?.name)).filter(Boolean)
          : [];
        if (!cancelled) {
          setDatabases(names);
          // compute a sensible default: prefer existing selection -> connection default -> 'feya' -> first
          const cfg: any = (currentSource as any)?.connectionConfig || {};
          const defaults = [
            selectedDatabase,
            cfg.database, cfg.db, cfg.initialCatalog, cfg.catalog, cfg.defaultDatabase,
            'feya'
          ].filter(Boolean);
          let next = '';
          for (const cand of defaults) {
            if (typeof cand === 'string' && names.includes(cand)) { next = cand; break; }
          }
          if (!next && names.length > 0) next = names[0];
          setSelectedDatabase(next);
        }
      } catch (e) {
        if (!cancelled) {
          setDatabases([]);
          setSelectedDatabase('');
        }
      }
    }
    void loadDbs();
    return () => { cancelled = true };
  }, [selectedDataSource, currentSource]);

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

    // Prefer server-provided edges; if none, attempt to derive from node keys
    let flowEdges: Edge[] = [];
    if ((lineageData.edges?.length ?? 0) > 0) {
      flowEdges = lineageData.edges
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
    } else {
      // Attempt key-based inference from node metadata (if available)
      const tableNodes = lineageData.nodes
        .filter((n) => (filterNodeType === 'all' || n.type === filterNodeType) && (n.type === 'table' || n.type === 'view'))
        .map((n) => {
          const cols: any[] = Array.isArray((n as any).metadata?.columns) ? (n as any).metadata.columns : [];
          const normCols: ColumnInfo[] = cols.map((c: any) => ({
            name: c.name ?? c.column_name ?? String(c) ?? '',
            type: c.type ?? c.dataType ?? c.data_type ?? '',
            isPrimaryKey: Boolean(c.isPrimaryKey ?? c.primaryKey ?? c.is_primary_key),
            isForeignKey: Boolean(c.isForeignKey ?? c.foreignKey ?? c.is_foreign_key),
          }));
          const t: TableInfo = {
            id: n.id,
            name: n.label,
            type: 'source',
            columns: normCols,
            color: 'green',
          };
          return t;
        });

      const inferred = deriveRelationshipsFromKeys(tableNodes);
      flowEdges = inferred
        .filter((r) => flowNodes.some((n) => n.id === r.source) && flowNodes.some((n) => n.id === r.target))
        .map((r) => ({
          id: r.id,
          source: r.source,
          target: r.target,
          type: 'smoothstep',
          label: `${r.sourceColumn} -> ${r.targetColumn}`,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 20, height: 20 },
          labelStyle: { fill: '#374151', fontWeight: 600, fontSize: 11 },
          labelBgStyle: { fill: 'white', fillOpacity: 0.95, rx: 6, ry: 6 },
          labelBgPadding: [8, 6],
        }));
    }

    // Merge manual + AI suggestion edges (dedup by id)
    const existingIds = new Set(flowEdges.map((e) => e.id));
    const extras = [...aiSuggestions, ...manualEdges].filter(
      (e) => flowNodes.some((n) => n.id === e.source) && flowNodes.some((n) => n.id === e.target)
    );
    const allEdges = [...flowEdges, ...extras.filter((e) => !existingIds.has(e.id))];

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      allEdges,
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
    manualMode,
    manualEdges,
    aiSuggestions,
    setNodes,
    setEdges,
  ]);

  // Manual connect handler
  const onConnect = useCallback((params: any) => {
    const id = `manual:${params.source}-${params.sourceHandle || 's'}>${params.target}-${params.targetHandle || 't'}:${Date.now()}`;
    const e: Edge = {
      id,
      source: params.source!,
      target: params.target!,
      sourceHandle: params.sourceHandle,
      targetHandle: params.targetHandle,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#7c3aed', strokeWidth: 2 },
      label: 'manual',
      labelStyle: { fill: '#4b5563', fontWeight: 600, fontSize: 10 },
      labelBgStyle: { fill: 'white', fillOpacity: 0.95, rx: 6, ry: 6 },
      labelBgPadding: [6, 4],
      data: { manual: true },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed', width: 20, height: 20 },
    };
    setManualEdges((prev) => [...prev, e]);
  }, []);

  // AI suggestion (client-side heuristic)
  const suggestEdges = useCallback(() => {
    if (!lineageData) return;
    const tableNodes = lineageData.nodes
      .filter((n) => n.type === 'table' || n.type === 'view')
      .map((n) => {
        const cols: any[] = Array.isArray((n as any).metadata?.columns) ? (n as any).metadata.columns : [];
        const normCols: ColumnInfo[] = cols.map((c: any) => ({
          name: c.name ?? c.column_name ?? String(c) ?? '',
          type: c.type ?? c.dataType ?? c.data_type ?? '',
          isPrimaryKey: Boolean(c.isPrimaryKey ?? c.primaryKey ?? c.is_primary_key),
          isForeignKey: Boolean(c.isForeignKey ?? c.foreignKey ?? c.is_foreign_key),
        }));
        const t: TableInfo = { id: n.id, name: n.label, type: 'source', columns: normCols, color: 'green' };
        return t;
      });
    const inferred = deriveRelationshipsFromKeys(tableNodes);
    const currentKey = (e: Edge) => `${e.source}->${e.target}:${e.sourceHandle || ''}/${e.targetHandle || ''}`;
    const existing = new Set([
      ...(lineageData.edges || []).map((e: any) => `${e.source}->${e.target}:${e.label || ''}`),
      ...manualEdges.map(currentKey),
    ]);
    const suggestions: Edge[] = inferred
      .filter((r) => !existing.has(`${r.source}->${r.target}:${r.sourceColumn} ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾Ãƒâ€šÃ‚Â¢ ${r.targetColumn}`))
      .map((r) => ({
        id: `ai:${r.id}`,
        source: r.source,
        target: r.target,
        sourceHandle: `s:${r.sourceColumn}`,
        targetHandle: `t:${r.targetColumn}`,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#0ea5e9', strokeWidth: 2, strokeDasharray: '6 3' },
        label: 'AI suggested',
        labelStyle: { fill: '#0369a1', fontWeight: 600, fontSize: 10 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.95, rx: 6, ry: 6 },
        labelBgPadding: [6, 4],
        data: { suggested: true },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#0ea5e9', width: 20, height: 20 },
      }));
    setAiSuggestions(suggestions);
    setManualMode(true);
  }, [lineageData, manualEdges]);

  const acceptAISuggestions = useCallback(() => {
    setManualEdges((prev) => [...prev, ...aiSuggestions.map((e) => ({ ...e, id: e.id.replace(/^ai:/, 'manual:ai:') }))]);
    setAiSuggestions([]);
  }, [aiSuggestions]);

  const clearManualEdges = useCallback(() => {
    setManualEdges([]);
    setAiSuggestions([]);
  }, []);

  const saveManualEdges = useCallback(async () => {
    try {
      const payload = manualEdges.map((e) => ({
        from: e.source,
        to: e.target,
        relationshipType: 'references',
        confidence: 0.6,
        metadata: { sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, createdBy: 'ui' },
      }));
      if (payload.length === 0) return;
      await lineageApi.upsertEdges(payload);
      void fetchLineageData();
    } catch (err) {
      console.error('Failed to save edges', err);
      alert('Failed to save edges');
    }
  }, [manualEdges, fetchLineageData]);

  // ==================== LIFECYCLE EFFECTS ====================
  
  useEffect(() => {
    void refreshDataSources();
  }, [refreshDataSources]);

  useEffect(() => {
    if (selectedDataSource && viewMode === 'table') {
      void fetchLineageData();
    }
  }, [selectedDataSource, selectedDatabase, viewMode, fetchLineageData]);

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

  const databaseOptions = useMemo(
    () => [
      {
        value: '',
        label: databases.length === 0 ? 'No databases' : 'Select a database',
        disabled: true,
      },
      ...databases.map((db) => ({ value: db, label: db })),
    ],
    [databases]
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
              Interactive data flow visualization ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ Path tracking ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ Impact analysis
            </p>
          </div>

          <div className="flex gap-2">
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

      {/* Global source/database selectors */}
      <Card className="border-0 shadow-md bg-white/90 backdrop-blur-xl mb-4">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {databases.length > 0 && (
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block uppercase tracking-wide">
                  Database
                </label>
                <Select
                  value={selectedDatabase}
                  onChange={(e) => setSelectedDatabase(e.target.value)}
                  options={databaseOptions}
                  disabled={!selectedDataSource || databases.length === 0}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ==================== STATS ==================== */}
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

      {/* ==================== GRAPH VISUALIZATION ==================== */}
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
              onConnect={onConnect}
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

              {/* Manual linking and AI assist controls */}
              <Panel position="top-left" className="bg-white/90 rounded-md shadow border p-2">
                <div className="flex items-center gap-2">
                  <Button variant={manualMode ? 'default' : 'outline'} size="sm" onClick={() => setManualMode((v) => !v)}>
                    {manualMode ? 'Manual: On' : 'Manual: Off'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={suggestEdges}>AI Assist</Button>
                  {aiSuggestions.length > 0 && (
                    <Button variant="default" size="sm" onClick={acceptAISuggestions}>Apply {aiSuggestions.length}</Button>
                  )}
                  <Button variant="outline" size="sm" onClick={saveManualEdges} disabled={manualEdges.length === 0}>Save</Button>
                  {manualEdges.length > 0 && (
                    <Button variant="outline" size="sm" onClick={clearManualEdges}>Clear</Button>
                  )}
                </div>
              </Panel>
              
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
    </div>
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
