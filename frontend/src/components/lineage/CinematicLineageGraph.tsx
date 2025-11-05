/**
 * Cinematic Data Lineage with Pan/Zoom, Minimap & Animated Flow
 * Flexible architecture that adapts to any lineage data structure
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database,
  Server,
  Table2,
  Columns3,
  GitBranch,
  Shield,
  Clock,
  Zap,
  BarChart2,
  Layers,
  Box,
  Play,
  Pause,
  Search,
  Maximize2,
  Focus,
  Info,
  Activity,
  Eye,
  X,
} from "lucide-react";
import type { LineageSummaryNode, LineageEdge as LineageEdgeType } from '@/types/lineage';

// ---------- Utils ----------
function layerColor(layer?: string) {
  switch (layer) {
    case "database":
      return { from: "from-blue-500/60", to: "to-blue-900/80", ring: "ring-blue-400", glow: "shadow-[0_0_40px_rgba(96,165,250,0.7)]", dot: "bg-blue-400" };
    case "schema":
      return { from: "from-purple-500/60", to: "to-purple-900/80", ring: "ring-purple-400", glow: "shadow-[0_0_40px_rgba(192,132,252,0.7)]", dot: "bg-purple-400" };
    case "table":
      return { from: "from-green-500/60", to: "to-green-900/80", ring: "ring-green-400", glow: "shadow-[0_0_40px_rgba(74,222,128,0.7)]", dot: "bg-green-400" };
    case "column":
      return { from: "from-cyan-500/60", to: "to-cyan-900/80", ring: "ring-cyan-400", glow: "shadow-[0_0_40px_rgba(34,211,238,0.7)]", dot: "bg-cyan-400" };
    default:
      return { from: "from-slate-500/60", to: "to-slate-900/80", ring: "ring-slate-400", glow: "shadow-[0_0_35px_rgba(148,163,184,0.7)]", dot: "bg-slate-400" };
  }
}

const nodeIcons: Record<string, React.ElementType> = {
  database: Database,
  schema: Box,
  table: Table2,
  column: Columns3,
  source: Server,
  view: Eye,
  process: GitBranch,
};

// ---------- Micro components ----------
const Chip: React.FC<{
  icon?: React.ReactNode;
  children: React.ReactNode;
  tone?: "blue" | "pink" | "amber" | "green" | "gray"
}> = ({ icon, children, tone = "blue" }) => {
  const tones: Record<string, string> = {
    blue: "bg-sky-500/20 text-sky-200 border-sky-400/40",
    pink: "bg-pink-500/20 text-pink-200 border-pink-400/40",
    amber: "bg-amber-500/20 text-amber-200 border-amber-400/40",
    green: "bg-green-500/20 text-green-200 border-green-400/40",
    gray: "bg-slate-500/20 text-slate-200 border-slate-400/40"
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  );
};

// ---------- Node Component ----------
const NodeCard: React.FC<{
  id: string;
  name: string;
  type?: string;
  metadata?: any;
  onSelect?: (id: string) => void;
  onHover?: (id: string | null) => void;
  pulse?: boolean;
  x: number;
  y: number;
}> = ({ id, name, type, metadata, onSelect, onHover, pulse, x, y }) => {
  const c = layerColor(type);
  const IconComponent = nodeIcons[type || 'table'] || Database;

  // Impact mode styling
  const isImpactSelected = metadata?.isImpactSelected;
  const isDownstream = metadata?.isDownstream;
  const isDimmed = metadata?.isDimmed;

  const opacity = isDimmed ? 0.3 : 1;
  const ringClass = isImpactSelected
    ? 'ring-4 ring-yellow-400'
    : isDownstream
    ? 'ring-2 ring-blue-400'
    : `ring-1 ${c.ring}`;

  return (
    <motion.div
      layout
      role="button"
      aria-label={`Node ${name}`}
      whileHover={{ y: -4, scale: 1.05 }}
      whileTap={{ scale: 0.96 }}
      onClick={() => onSelect?.(id)}
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      className={`group absolute w-[220px] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white/20 bg-gradient-to-br ${c.from} ${c.to} p-3 ${ringClass} ${c.glow} cursor-pointer transition-all duration-300 backdrop-blur-sm`}
      style={{ left: x, top: y, opacity }}
    >
      {pulse && (
        <span className="pointer-events-none absolute inset-0 -z-10 animate-ping rounded-xl bg-gradient-to-br from-cyan-400/30 to-violet-400/30" />
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-slate-800/90 ring-2 ring-white/20 text-white flex-shrink-0 shadow-lg">
            <IconComponent className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-bold text-white drop-shadow-lg">{name}</div>
            <div className="mt-0.5 text-[10px] text-slate-200 uppercase font-medium tracking-wide">{type ?? "node"}</div>
          </div>
        </div>
        {metadata?.confidence !== undefined && metadata.confidence < 0.9 && (
          <Chip tone="amber">{Math.round(metadata.confidence * 100)}%</Chip>
        )}
      </div>

      {/* Metadata badges */}
      {metadata && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {metadata.rowCount !== undefined && (
            <Chip tone="blue">
              <Activity className="h-3.5 w-3.5" />
              {metadata.rowCount.toLocaleString()} rows
            </Chip>
          )}
          {metadata.columnCount !== undefined && (
            <Chip tone="green">
              <Columns3 className="h-3.5 w-3.5" />
              {metadata.columnCount} cols
            </Chip>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ---------- Edge (animated) ----------
const Edge: React.FC<{
  from: { x: number; y: number };
  to: { x: number; y: number };
  hot?: boolean;
  relationshipType?: string;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onHover?: (hover: boolean) => void;
}> = ({ from, to, hot, relationshipType, isHighlighted, isDimmed, onHover }) => {
  const midX = (from.x + to.x) / 2;
  const d = `M ${from.x},${from.y} C ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;

  const isReference = relationshipType === 'references';
  const strokeColor = isReference ? 'stroke-cyan-400/70' : 'stroke-slate-400/60';
  const hotColor = isReference ? 'stroke-cyan-300' : 'stroke-violet-300';

  const opacity = isDimmed ? 0.15 : 1;
  const shouldGlow = hot || isHighlighted;

  return (
    <g style={{ opacity }}>
      {/* Base path */}
      <path
        d={d}
        className={`${strokeColor} transition-all duration-300`}
        strokeWidth={shouldGlow ? 4 : 3}
        fill="none"
        style={{ filter: shouldGlow ? 'drop-shadow(0 0 12px rgba(34,211,238,0.8))' : 'drop-shadow(0 0 6px rgba(148,163,184,0.4))' }}
      />
      {/* Animated flow */}
      <path
        d={d}
        className={hot ? hotColor : 'stroke-transparent'}
        strokeWidth={2}
        fill="none"
        strokeDasharray="6 12"
        style={{
          animation: hot ? 'dash 2s linear infinite' : 'none',
          opacity: 0.8
        }}
      />
      {/* Invisible hit area for hover interactivity */}
      <path
        d={d}
        strokeWidth={12}
        stroke="transparent"
        fill="none"
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => onHover?.(true)}
        onMouseLeave={() => onHover?.(false)}
      />
      {/* Arrowhead */}
      <defs>
        <marker
          id={`arrow-${hot ? 'hot' : 'normal'}`}
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path
            d="M0,0 L0,6 L9,3 z"
            fill={hot ? '#22d3ee' : '#94a3b8'}
            opacity={hot ? 1 : 0.5}
          />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        strokeWidth={0}
        markerEnd={`url(#arrow-${hot ? 'hot' : 'normal'})`}
      />
    </g>
  );
};

// ---------- Main Component ----------
interface CinematicLineageGraphProps {
  nodes: LineageSummaryNode[];
  edges: LineageEdgeType[];
  onNodeSelect?: (node: LineageSummaryNode) => void;
}

export const CinematicLineageGraph: React.FC<CinematicLineageGraphProps> = ({
  nodes: rawNodes,
  edges: rawEdges,
  onNodeSelect,
}) => {
  const [playing, setPlaying] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [t, setT] = useState(0); // timeline 0..100
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdgeIdx, setHoveredEdgeIdx] = useState<number | null>(null);

  // pan/zoom state
  const [view, setView] = useState({ x: 400, y: 200, k: 1 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);

  // Auto-layout nodes in layers
  const layout = useMemo(() => {
    const byId: Record<string, { x: number; y: number; node: LineageSummaryNode }> = {};

    // Group by layer
    const layers = new Map<number, LineageSummaryNode[]>();
    rawNodes.forEach(node => {
      const layer = node.layer ?? 0;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer)!.push(node);
    });

    // Sort layers
    const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);
    const laneWidth = 340;
    const nodeSpacing = 120;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    sortedLayers.forEach((layerIdx, laneIndex) => {
      const nodesInLayer = layers.get(layerIdx)!;
      const x = 200 + laneIndex * laneWidth;

      nodesInLayer.forEach((node, idx) => {
        const y = 150 + idx * nodeSpacing;
        byId[node.urn] = { x, y, node };

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      });
    });

    const bounds = {
      minX: minX - 300,
      minY: minY - 200,
      maxX: maxX + 400,
      maxY: maxY + 200
    };

    return { byId, bounds };
  }, [rawNodes]);

  // Search filter
  const visible = useMemo(() => {
    if (!search) return new Set(Object.keys(layout.byId));
    const s = search.toLowerCase();
    return new Set(
      Object.keys(layout.byId).filter((id) =>
        layout.byId[id].node.label.toLowerCase().includes(s)
      )
    );
  }, [layout.byId, search]);

  // Autoplay timeline
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setT((v) => (v + 2) % 101), 90);
    return () => clearInterval(id);
  }, [playing]);

  // Pan/zoom handlers
  const onWheel: React.WheelEventHandler<HTMLDivElement> = useCallback((e) => {
    e.preventDefault();
    const { x, y, k } = view;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const scaleBy = 1.08;
    const nextK = e.deltaY < 0 ? Math.min(2.5, k * scaleBy) : Math.max(0.5, k / scaleBy);
    const dx = mx - x;
    const dy = my - y;
    const nx = mx - (dx * nextK) / k;
    const ny = my - (dy * nextK) / k;
    setView({ x: nx, y: ny, k: nextK });
  }, [view]);

  const onMouseDown: React.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
    if ((e.target as HTMLElement).closest("[data-ui]") ||
        (e.target as HTMLElement).closest("button") ||
        (e.target as HTMLElement).closest("input")) return;
    dragging.current = {
      x: e.clientX - view.x,
      y: e.clientY - view.y,
      vx: view.x,
      vy: view.y
    };
    (e.currentTarget as HTMLDivElement).style.cursor = "grabbing";
  }, [view]);

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
    const drag = dragging.current;
    if (!drag) return;
    setView((v) => ({
      ...v,
      x: e.clientX - drag.x,
      y: e.clientY - drag.y
    }));
  }, []);

  const onMouseUp: React.MouseEventHandler<HTMLDivElement> = useCallback((e) => {
    dragging.current = null;
    (e.currentTarget as HTMLDivElement).style.cursor = "grab";
  }, []);

  const resetView = useCallback(() => {
    setView({ x: 400, y: 200, k: 1 });
  }, []);

  // Autofit to bounds on data change for compact view
  useEffect(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { minX, minY, maxX, maxY } = layout.bounds;
    const bw = Math.max(1, maxX - minX + 240);
    const bh = Math.max(1, maxY - minY + 240);
    const sx = rect.width / bw;
    const sy = rect.height / bh;
    const k = Math.min(1.8, Math.max(0.5, Math.min(sx, sy)));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const x = rect.width / 2 - cx * k;
    const y = rect.height / 2 - cy * k;
    setView({ x, y, k });
  }, [rawNodes, rawEdges, layout.bounds]);

  // Viewport size for minimap
  const [vp, setVp] = useState({ w: 1200, h: 800 });
  useEffect(() => {
    const f = () => {
      if (stageRef.current) {
        const rect = stageRef.current.getBoundingClientRect();
        setVp({ w: rect.width, h: rect.height });
      }
    };
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);

  // Minimap calculations
  const mini = useMemo(() => {
    const W = 200, H = 140;
    const { minX, minY, maxX, maxY } = layout.bounds;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const sx = W / bw;
    const sy = H / bh;
    const s = Math.min(sx, sy) * 0.9;
    const ox = -minX * s + (W - bw * s) / 2;
    const oy = -minY * s + (H - bh * s) / 2;
    const vbox = {
      x: (-view.x) * s / view.k + ox,
      y: (-view.y) * s / view.k + oy,
      w: (vp.w * s) / view.k,
      h: (vp.h * s) / view.k
    };
    return { W, H, s, ox, oy, vbox };
  }, [layout.bounds, view, vp]);

  const jumpMinimap = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const { minX, minY } = layout.bounds;
    const gx = (px - mini.ox) / mini.s + minX;
    const gy = (py - mini.oy) / mini.s + minY;
    setView((v) => ({
      ...v,
      x: vp.w / 2 - gx * v.k,
      y: vp.h / 2 - gy * v.k
    }));
  }, [layout.bounds, mini, vp]);

  // Hot edges based on timeline
  const hotEdge = useCallback((idx: number) => {
    return ((idx * 7 + Math.round(t)) % 100) < 20;
  }, [t]);

  const handleNodeSelect = useCallback((id: string) => {
    setSelected(id);
    const node = layout.byId[id]?.node;
    if (node && onNodeSelect) {
      onNodeSelect(node);
    }
  }, [layout.byId, onNodeSelect]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      {/* Global CSS */}
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: -100; }
        }
        .starfield {
          background-image:
            radial-gradient(2px 2px at 20% 30%, rgba(148,163,184,.12) 50%, transparent 51%),
            radial-gradient(1px 1px at 70% 60%, rgba(148,163,184,.12) 50%, transparent 51%),
            radial-gradient(1.5px 1.5px at 40% 80%, rgba(148,163,184,.1) 50%, transparent 51%);
          background-size: 1600px 900px;
          animation: twinkle 18s linear infinite;
        }
        @keyframes twinkle {
          0%{ background-position:0 0,0 0,0 0;}
          50%{ background-position:10px 8px,-6px 10px,8px -6px;}
          100%{ background-position:0 0,0 0,0 0;}
        }
      `}</style>

      {/* Backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="starfield absolute inset-0 opacity-30" />
      </div>

      {/* Controls Overlay */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-3" data-ui>
        {/* Search */}
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 backdrop-blur">
          <Search className="h-4 w-4 text-slate-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search nodes..."
            className="w-48 bg-transparent text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none"
          />
        </div>

        {/* Play/Pause */}
        <button
          onClick={() => setPlaying((p) => !p)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 backdrop-blur transition-colors"
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {playing ? "Pause Flow" : "Play Flow"}
        </button>

        {/* Reset View */}
        <button
          onClick={resetView}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 backdrop-blur transition-colors"
        >
          <Maximize2 className="h-4 w-4" />
          Reset View
        </button>
      </div>

      {/* Minimap */}
      <div className="absolute right-4 top-4 z-20" data-ui>
        <div className="rounded-xl border border-white/10 bg-slate-900/80 p-2 backdrop-blur">
          <div className="text-[10px] mb-1 flex items-center gap-1 text-slate-300">
            <Focus className="h-3 w-3" /> Minimap
          </div>
          <div
            className="relative overflow-hidden rounded-lg bg-slate-950/70 ring-1 ring-white/10 cursor-crosshair"
            style={{ width: mini.W, height: mini.H }}
            onClick={jumpMinimap}
          >
            <svg width={mini.W} height={mini.H} className="absolute inset-0">
              {/* Edges */}
              {rawEdges.map((edge, i) => {
                const A = layout.byId[edge.from];
                const B = layout.byId[edge.to];
                if (!A || !B) return null;
                const mx = (A.x + B.x) / 2;
                const d = `M ${A.x * mini.s + mini.ox},${A.y * mini.s + mini.oy} C ${mx * mini.s + mini.ox},${A.y * mini.s + mini.oy} ${mx * mini.s + mini.ox},${B.y * mini.s + mini.oy} ${B.x * mini.s + mini.ox},${B.y * mini.s + mini.oy}`;
                return <path key={i} d={d} stroke="rgba(148,163,184,.3)" strokeWidth={1} fill="none" />;
              })}
              {/* Nodes */}
              {Object.keys(layout.byId).map((id) => {
                const n = layout.byId[id];
                return (
                  <rect
                    key={id}
                    x={n.x * mini.s + mini.ox - 4}
                    y={n.y * mini.s + mini.oy - 3}
                    width={8}
                    height={6}
                    rx={1}
                    fill="rgba(203,213,225,.9)"
                  />
                );
              })}
              {/* Viewport box */}
              <rect
                x={mini.vbox.x}
                y={mini.vbox.y}
                width={mini.vbox.w}
                height={mini.vbox.h}
                fill="transparent"
                stroke="#22d3ee"
                strokeWidth={1.5}
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="absolute inset-x-4 bottom-4 z-10" data-ui>
        <div className="mx-auto max-w-2xl flex items-center gap-3 rounded-xl border border-white/10 bg-slate-900/80 px-4 py-2 text-[12px] text-slate-300 backdrop-blur">
          <Info className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="hidden sm:inline">Timeline</span>
          <input
            type="range"
            min={0}
            max={100}
            value={t}
            onChange={(e) => setT(parseInt(e.target.value))}
            className="accent-cyan-400 flex-1"
          />
          <span className="w-10 text-right tabular-nums">{t}</span>
        </div>
      </div>

      {/* Main Stage */}
      <div
        ref={stageRef}
        className="relative h-full w-full cursor-grab active:cursor-grabbing"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ userSelect: dragging.current ? "none" : "auto" }}
      >
        {/* Transformed content */}
        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
            transformOrigin: "0 0",
          }}
        >
          {/* SVG edges */}
          <svg className="absolute inset-0" style={{ width: Math.max(layout.bounds.maxX, 1000), height: Math.max(layout.bounds.maxY, 800) }}>
            {rawEdges.map((edge, idx) => {
              const A = layout.byId[edge.from];
              const B = layout.byId[edge.to];
              if (!A || !B || !A.x || !B.x || !A.y || !B.y) {
                console.warn('Missing node data for edge:', edge, 'A:', A, 'B:', B);
                return null;
              }
              if (search && !(visible.has(edge.from) || visible.has(edge.to))) return null;
              return (
                <Edge
                  key={idx}
                  from={{ x: A.x, y: A.y }}
                  to={{ x: B.x, y: B.y }}
                  hot={hotEdge(idx)}
                  relationshipType={edge.relationshipType}
                  isHighlighted={(edge.metadata?.isHighlighted as boolean | undefined) || hoveredNode === edge.from || hoveredNode === edge.to || hoveredEdgeIdx === idx}
                  isDimmed={edge.metadata?.isDimmed as boolean | undefined}
                  onHover={(hover) => setHoveredEdgeIdx(hover ? idx : null)}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {Object.keys(layout.byId).map((id) => {
            const { x, y, node } = layout.byId[id];
            if (search && !visible.has(id)) return null;
            return (
              <NodeCard
                key={id}
                id={id}
                name={node.label}
                type={node.type}
                metadata={node.metadata}
                pulse={selected === id}
                onSelect={handleNodeSelect}
                onHover={setHoveredNode}
                x={x}
                y={y}
              />
            );
          })}
        </div>
      </div>

      {/* Details Drawer */}
      <AnimatePresence>
        {selected && layout.byId[selected] && (
          <motion.aside
            key="drawer"
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 120, damping: 16 }}
            className="fixed right-0 top-0 z-40 h-full w-[380px] overflow-y-auto border-l border-white/10 bg-slate-950/95 backdrop-blur"
          >
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-cyan-400 tracking-wider">Selected Node</div>
                  <div className="text-lg font-bold text-white mt-1">
                    {layout.byId[selected].node.label}
                  </div>
                  <div className="text-sm text-slate-300 mt-1">
                    {layout.byId[selected].node.type}
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="rounded-lg border border-white/10 bg-slate-900/60 p-2 text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 space-y-3">
                <div className="text-xs uppercase text-slate-400 tracking-wider">Metadata</div>
                {layout.byId[selected].node.metadata && (
                  <div className="grid gap-2">
                    {Object.entries(layout.byId[selected].node.metadata).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <span className="text-slate-400">{key}:</span>
                        <span className="text-slate-200 font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4">
                <div className="text-xs uppercase text-slate-400 tracking-wider mb-2">Connections</div>
                <div className="space-y-2">
                  {rawEdges.filter(e => e.from === selected || e.to === selected).map((edge, i) => (
                    <div key={i} className="text-sm text-slate-300 flex items-center gap-2">
                      <GitBranch className="h-3 w-3" />
                      <span className="text-cyan-400">{edge.relationshipType}</span>
                      <span>→</span>
                      <span>{layout.byId[edge.to]?.node.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CinematicLineageGraph;
