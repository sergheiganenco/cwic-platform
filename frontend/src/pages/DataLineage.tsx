/**
 * Enhanced Data Lineage with Animated Connections
 */
import { ModernLineageGraph } from '@/components/lineage/ModernLineageGraph';
import { CinematicLineageGraph } from '@/components/lineage/CinematicLineageGraph';
import { RevolutionaryLineageGraph } from '@/components/lineage/RevolutionaryLineageGraph';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { useDataSources } from '@/hooks/useDataSources';
import type { DataSource } from '@/types/dataSources';
import type {
  LineageEdge,
  LineageSummaryNode,
} from '@/types/lineage';
import { buildDataUrn } from '@/utils/lineageUrn';
import {
  ArrowRight,
  Box,
  ChevronRight,
  Columns3,
  Database,
  FolderTree,
  GitBranch,
  Layers,
  Link2,
  Maximize2,
  Minimize2,
  Network,
  RefreshCcw,
  Search,
  Sparkles,
  Table2,
  TrendingUp,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

// Modern color schemes for different node types
const nodeThemes = {
  database: {
    bg: 'from-blue-500 to-indigo-600',
    border: 'border-blue-400',
    icon: Database,
    glow: 'shadow-blue-500/50',
    color: '#3b82f6',
  },
  schema: {
    bg: 'from-purple-500 to-pink-600',
    border: 'border-purple-400',
    icon: Layers,
    glow: 'shadow-purple-500/50',
    color: '#a855f7',
  },
  table: {
    bg: 'from-green-500 to-emerald-600',
    border: 'border-green-400',
    icon: Table2,
    glow: 'shadow-green-500/50',
    color: '#10b981',
  },
  column: {
    bg: 'from-cyan-500 to-teal-600',
    border: 'border-cyan-400',
    icon: Columns3,
    glow: 'shadow-cyan-500/50',
    color: '#06b6d4',
  },
  process: {
    bg: 'from-orange-500 to-red-600',
    border: 'border-orange-400',
    icon: GitBranch,
    glow: 'shadow-orange-500/50',
    color: '#f97316',
  },
};

interface HierarchyNode {
  id: string;
  name: string;
  type: 'database' | 'schema' | 'table' | 'column';
  children?: HierarchyNode[];
  metadata?: Record<string, any>;
  expanded?: boolean;
  selected?: boolean;
}

export default function DataLineage(): JSX.Element {
  const { items: dataSources, loading: dataSourcesLoading, refresh: refreshDataSources } = useDataSources();

  // State management
  const [selectedDataSource, setSelectedDataSource] = useState<string>('');
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'hierarchy' | 'graph'>('hierarchy');
  const [graphDepth, setGraphDepth] = useState(3);
  const [direction, setDirection] = useState<'both' | 'upstream' | 'downstream'>('both');
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<HierarchyNode | null>(null);
  const [graphStyle, setGraphStyle] = useState<'modern' | 'cinematic' | 'revolutionary'>('revolutionary');
  const [lineageMode, setLineageMode] = useState<'explore' | 'impact' | 'timetravel'>('explore');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [impactSelectedUrn, setImpactSelectedUrn] = useState<string | null>(null);
  const [downstreamUrns, setDownstreamUrns] = useState<Set<string>>(new Set());

  // Command palette hotkey (Ctrl/Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load data sources on mount
  useEffect(() => {
    void refreshDataSources();
  }, [refreshDataSources]);

  // Auto-select first data source
  useEffect(() => {
    if (dataSources.length > 0 && !selectedDataSource) {
      setSelectedDataSource(dataSources[0].id || '');
    }
  }, [dataSources, selectedDataSource]);

  // Build hierarchy from data source using real catalog API
  const buildHierarchy = useCallback(async (dataSourceId: string) => {
    if (!dataSourceId) return;

    setLoading(true);
    try {
      const dataSource = dataSources.find((ds: DataSource) => ds.id === dataSourceId);
      if (!dataSource) return;

      const response = await fetch(`http://localhost:3000/api/catalog/assets?dataSourceId=${dataSourceId}`);
      const data = await response.json();

      if (!data.success) {
        console.error('Failed to fetch catalog assets:', data);
        setHierarchy([]);
        return;
      }

      let assets = data.data;
      if (assets && typeof assets === 'object' && !Array.isArray(assets)) {
        if (assets.assets && Array.isArray(assets.assets)) {
          assets = assets.assets;
        } else if (assets.items && Array.isArray(assets.items)) {
          assets = assets.items;
        }
      }

      if (!Array.isArray(assets)) {
        console.error('Assets is not an array:', assets);
        setHierarchy([]);
        return;
      }

      if (assets.length === 0) {
        console.warn('No assets found for this data source');
        setHierarchy([]);
        return;
      }

      const schemaMap = new Map<string, any[]>();
      assets.forEach((asset: any) => {
        const schemaName = asset.schema || 'dbo';
        if (!schemaMap.has(schemaName)) {
          schemaMap.set(schemaName, []);
        }
        schemaMap.get(schemaName)!.push(asset);
      });

      const schemas: HierarchyNode[] = Array.from(schemaMap.entries()).map(([schemaName, schemaAssets]) => {
        const tables = schemaAssets.filter(a => a.type === 'table');
        const views = schemaAssets.filter(a => a.type === 'view');

        const children: HierarchyNode[] = [];

        if (tables.length > 0) {
          children.push({
            id: `tables-folder-${dataSourceId}-${schemaName}`,
            name: `📊 Tables (${tables.length})`,
            type: 'schema' as const,
            expanded: schemaName === 'dbo',
            metadata: { folder: true },
            children: tables.map((asset: any) => ({
              id: `table-${asset.id}`,
              name: asset.table || asset.name,
              type: 'table' as const,
              expanded: false,
              metadata: {
                assetId: asset.id,
                dataSourceId: asset.dataSourceId,
                assetType: asset.type,
                rowCount: asset.rowCount,
                columnCount: asset.columnCount,
                description: asset.description,
              },
              children: [],
            })),
          });
        }

        if (views.length > 0) {
          children.push({
            id: `views-folder-${dataSourceId}-${schemaName}`,
            name: `👁️ Views (${views.length})`,
            type: 'schema' as const,
            expanded: false,
            metadata: { folder: true },
            children: views.map((asset: any) => ({
              id: `view-${asset.id}`,
              name: asset.table || asset.name,
              type: 'table' as const,
              expanded: false,
              metadata: {
                assetId: asset.id,
                dataSourceId: asset.dataSourceId,
                assetType: asset.type,
                rowCount: asset.rowCount,
                columnCount: asset.columnCount,
                description: asset.description,
                isView: true,
              },
              children: [],
            })),
          });
        }

        return {
          id: `schema-${dataSourceId}-${schemaName}`,
          name: schemaName,
          type: 'schema' as const,
          expanded: schemaName === 'dbo',
          children,
        };
      });

      const rootNode: HierarchyNode = {
        id: `db-${dataSourceId}`,
        name: dataSource.connectionConfig?.database || dataSource.name || 'Database',
        type: 'database',
        metadata: { dataSourceId, type: dataSource.type },
        expanded: true,
        children: schemas,
      };

      setHierarchy([rootNode]);
    } catch (error) {
      console.error('Error building hierarchy:', error);
      setHierarchy([]);
    } finally {
      setLoading(false);
    }
  }, [dataSources]);

  useEffect(() => {
    if (selectedDataSource) {
      void buildHierarchy(selectedDataSource);
    }
  }, [selectedDataSource, buildHierarchy]);

  const toggleNode = useCallback(async (nodeId: string) => {
    const toggleRecursive = async (nodes: HierarchyNode[]): Promise<HierarchyNode[]> => {
      const result: HierarchyNode[] = [];

      for (const node of nodes) {
        if (node.id === nodeId) {
          const willExpand = !node.expanded;

          if (willExpand && node.type === 'table' && node.children?.length === 0 && node.metadata?.assetId) {
            try {
              const response = await fetch(`http://localhost:3000/api/catalog/assets/${node.metadata.assetId}`);
              const data = await response.json();

              if (data.success && data.data?.columns) {
                const columns: HierarchyNode[] = data.data.columns.map((col: any) => {
                  let displayName = col.column_name || col.name;
                  let prefix = '';
                  if (col.is_primary_key || col.isPrimaryKey) prefix = '🔑 ';
                  else if (col.is_foreign_key || col.isForeignKey) prefix = '🔗 ';
                  else if (col.is_computed || col.isComputed) prefix = '⚡ ';

                  return {
                    id: `col-${node.metadata?.assetId}-${col.column_name || col.name}`,
                    name: `${prefix}${displayName}`,
                    type: 'column' as const,
                    metadata: {
                      dataType: col.data_type || col.dataType,
                      isNullable: col.is_nullable || col.isNullable,
                      isPrimaryKey: col.is_primary_key || col.isPrimaryKey,
                      isForeignKey: col.is_foreign_key || col.isForeignKey,
                      isComputed: col.is_computed || col.isComputed,
                      computedExpression: col.computed_expression || col.computedExpression,
                      defaultValue: col.default_value || col.defaultValue,
                      ordinalPosition: col.ordinal_position || col.ordinalPosition,
                    },
                  };
                });

                result.push({ ...node, expanded: true, children: columns });
                continue;
              }
            } catch (error) {
              console.error('Error fetching columns:', error);
            }
          }

          result.push({ ...node, expanded: willExpand });
        } else if (node.children) {
          const updatedChildren = await toggleRecursive(node.children);
          result.push({ ...node, children: updatedChildren });
        } else {
          result.push(node);
        }
      }

      return result;
    };

    const updated = await toggleRecursive(hierarchy);
    setHierarchy(updated);
  }, [hierarchy]);

  const selectNode = useCallback((node: HierarchyNode) => {
    setSelectedNode(node);
    setViewMode('graph');
  }, []);

  // Function to auto-expand all tables to load columns for FK detection
  const expandAllTables = useCallback(async () => {
    setLoading(true);
    try {
      const expandRecursive = async (nodes: HierarchyNode[]): Promise<HierarchyNode[]> => {
        const result: HierarchyNode[] = [];

        for (const node of nodes) {
          if (node.type === 'table' && !node.metadata?.folder && node.children?.length === 0 && node.metadata?.assetId) {
            // Load columns for this table
            try {
              const response = await fetch(`http://localhost:3000/api/catalog/assets/${node.metadata.assetId}`);
              const data = await response.json();

              if (data.success && data.data?.columns) {
                const columns: HierarchyNode[] = data.data.columns.map((col: any) => {
                  let displayName = col.column_name || col.name;
                  let prefix = '';
                  if (col.is_primary_key || col.isPrimaryKey) prefix = '🔑 ';
                  else if (col.is_foreign_key || col.isForeignKey) prefix = '🔗 ';
                  else if (col.is_computed || col.isComputed) prefix = '⚡ ';

                  return {
                    id: `col-${node.metadata?.assetId}-${col.column_name || col.name}`,
                    name: `${prefix}${displayName}`,
                    type: 'column' as const,
                    metadata: {
                      dataType: col.data_type || col.dataType,
                      isNullable: col.is_nullable || col.isNullable,
                      isPrimaryKey: col.is_primary_key || col.isPrimaryKey,
                      isForeignKey: col.is_foreign_key || col.isForeignKey,
                      isComputed: col.is_computed || col.isComputed,
                      computedExpression: col.computed_expression || col.computedExpression,
                      defaultValue: col.default_value || col.defaultValue,
                      ordinalPosition: col.ordinal_position || col.ordinalPosition,
                    },
                  };
                });

                result.push({ ...node, expanded: false, children: columns });
                continue;
              }
            } catch (error) {
              console.error('Error fetching columns for', node.name, error);
            }
          }

          if (node.children) {
            const updatedChildren = await expandRecursive(node.children);
            result.push({ ...node, children: updatedChildren });
          } else {
            result.push(node);
          }
        }

        return result;
      };

      const updated = await expandRecursive(hierarchy);
      setHierarchy(updated);
    } catch (error) {
      console.error('Error expanding tables:', error);
    } finally {
      setLoading(false);
    }
  }, [hierarchy]);

  // Calculate downstream nodes for Impact mode
  const getDownstreamNodes = useCallback((startUrn: string, edges: LineageEdge[]): Set<string> => {
    const downstream = new Set<string>();
    const visited = new Set<string>();

    const traverse = (urn: string) => {
      if (visited.has(urn)) return;
      visited.add(urn);

      // Find all edges where this node is the source
      edges.forEach(edge => {
        if (edge.from === urn) {
          downstream.add(edge.to);
          traverse(edge.to);
        }
      });
    };

    traverse(startUrn);
    return downstream;
  }, []);

  // Reset impact selection when mode changes
  useEffect(() => {
    if (lineageMode !== 'impact') {
      setImpactSelectedUrn(null);
      setDownstreamUrns(new Set());
    }
  }, [lineageMode]);

  // Enhanced graph data with better relationship detection
  const graphData = useMemo(() => {
    if (!selectedNode) return { nodes: [], edges: [] };

    const nodes: LineageSummaryNode[] = [];
    const edges: LineageEdge[] = [];
    const tableNodeMap = new Map<string, { urn: string; node: HierarchyNode }>();

    const buildGraphRecursive = (node: HierarchyNode, parentUrn?: string, depth = 0) => {
      if (depth > graphDepth) return;

      const urn = buildDataUrn({
        platform: node.metadata?.type || 'custom',
        systemId: node.id,
      });

      nodes.push({
        urn,
        label: node.name,
        type: node.type,
        layer: depth,
        aliases: [],
        confidence: 0.95,
        metadata: {
          ...node.metadata,
          theme: nodeThemes[node.type],
        },
        updatedAt: new Date().toISOString(),
      });

      // Track table nodes for FK detection
      if (node.type === 'table' && !node.metadata?.folder) {
        tableNodeMap.set(node.name.toLowerCase(), { urn, node });
      }

      if (parentUrn) {
        edges.push({
          edgeId: `${parentUrn}-${urn}`,
          from: parentUrn,
          to: urn,
          relationshipType: 'contains',
          confidence: 0.95,
          metadata: { animated: true },
        });
      }

      if (node.children && depth < graphDepth) {
        node.children.forEach(child => buildGraphRecursive(child, urn, depth + 1));
      }
    };

    // Helper function to find all tables in hierarchy
    const findAllTables = (nodes: HierarchyNode[]): HierarchyNode[] => {
      const tables: HierarchyNode[] = [];
      const traverse = (node: HierarchyNode) => {
        if (node.type === 'table' && !node.metadata?.folder) {
          tables.push(node);
        }
        if (node.children) {
          node.children.forEach(traverse);
        }
      };
      nodes.forEach(traverse);
      return tables;
    };

    // Build the graph based on selected node type
    if (selectedNode.type === 'schema' || selectedNode.type === 'database' || selectedNode.metadata?.folder) {
      // For schema/database/folder nodes, show all tables and their relationships
      buildGraphRecursive(selectedNode);

      // Now detect FK relationships between tables
      const allTables = findAllTables([selectedNode]);

      // Fetch columns for each table and detect relationships
      allTables.forEach(async table => {
        if (!table.children || table.children.length === 0) {
          // If columns not loaded yet, skip FK detection for this table
          return;
        }

        const sourceUrn = buildDataUrn({
          platform: table.metadata?.type || 'custom',
          systemId: table.id,
        });

        table.children.forEach(col => {
          const columnName = col.name.toLowerCase().replace(/[🔑🔗⚡]/g, '').trim();

          // Detect potential FK by column naming convention
          if (columnName.includes('_id') || (columnName.endsWith('id') && columnName !== 'id')) {
            // Extract potential table name (e.g., user_id -> user, roleid -> role)
            let potentialTableName = columnName.replace(/_id$|id$/i, '');

            // Try to find matching table
            const matchingTable = allTables.find(t => {
              const tableName = t.name.toLowerCase();
              return tableName === potentialTableName ||
                     tableName === potentialTableName + 's' || // plural
                     tableName + 's' === potentialTableName || // singular
                     tableName.includes(potentialTableName) ||
                     potentialTableName.includes(tableName);
            });

            if (matchingTable && matchingTable.id !== table.id) {
              const targetUrn = buildDataUrn({
                platform: matchingTable.metadata?.type || 'custom',
                systemId: matchingTable.id,
              });

              // Check if edge doesn't already exist
              const edgeId = `fk-${sourceUrn}-${targetUrn}-${col.name}`;
              if (!edges.find(e => e.edgeId === edgeId)) {
                edges.push({
                  edgeId,
                  from: sourceUrn,
                  to: targetUrn,
                  relationshipType: 'references',
                  confidence: 0.80,
                  metadata: {
                    inferredFrom: col.name,
                    animated: true,
                    flowColor: nodeThemes.column.color,
                    label: col.name,
                  },
                });
              }
            }
          }
        });
      });
    } else if (selectedNode.type === 'table') {
      // For individual table nodes, show table with its columns and related tables
      buildGraphRecursive(selectedNode);

      // Enhanced FK detection for the selected table
      if (selectedNode.children) {
        selectedNode.children.forEach(col => {
          const columnName = col.name.toLowerCase().replace(/[🔑🔗⚡]/g, '').trim();

          if (columnName.includes('_id') || (columnName.endsWith('id') && columnName !== 'id')) {
            const potentialTableName = columnName.replace(/_id$|id$/i, '');

            const findTable = (nodes: HierarchyNode[]): HierarchyNode | null => {
              for (const node of nodes) {
                if (node.type === 'table' && !node.metadata?.folder) {
                  const tableName = node.name.toLowerCase();
                  if (tableName === potentialTableName ||
                      tableName === potentialTableName + 's' ||
                      tableName + 's' === potentialTableName ||
                      tableName.includes(potentialTableName) ||
                      potentialTableName.includes(tableName)) {
                    return node;
                  }
                }
                if (node.children) {
                  const found = findTable(node.children);
                  if (found) return found;
                }
              }
              return null;
            };

            const relatedTable = findTable(hierarchy);
            if (relatedTable && relatedTable.id !== selectedNode.id) {
              const relatedUrn = buildDataUrn({
                platform: relatedTable.metadata?.type || 'custom',
                systemId: relatedTable.id,
              });

              if (!nodes.find(n => n.urn === relatedUrn)) {
                nodes.push({
                  urn: relatedUrn,
                  label: relatedTable.name,
                  type: relatedTable.type,
                  layer: 1,
                  aliases: [],
                  confidence: 0.85,
                  metadata: {
                    ...relatedTable.metadata,
                    theme: nodeThemes[relatedTable.type],
                  },
                  updatedAt: new Date().toISOString(),
                });
              }

              const selectedUrn = buildDataUrn({
                platform: selectedNode.metadata?.type || 'custom',
                systemId: selectedNode.id,
              });

              const edgeId = `fk-${selectedUrn}-${relatedUrn}-${col.name}`;
              if (!edges.find(e => e.edgeId === edgeId)) {
                edges.push({
                  edgeId,
                  from: selectedUrn,
                  to: relatedUrn,
                  relationshipType: 'references',
                  confidence: 0.75,
                  metadata: {
                    inferredFrom: col.name,
                    animated: true,
                    flowColor: nodeThemes.column.color,
                    label: col.name,
                  },
                });
              }
            }
          }
        });
      }
    } else {
      buildGraphRecursive(selectedNode);
    }

    return { nodes, edges };
  }, [selectedNode, graphDepth, hierarchy]);

  // Handle node selection in Impact mode
  const handleNodeClick = useCallback((urn: string) => {
    if (lineageMode === 'impact') {
      setImpactSelectedUrn(urn);
      const downstream = getDownstreamNodes(urn, graphData.edges);
      setDownstreamUrns(downstream);
    }
  }, [lineageMode, graphData.edges, getDownstreamNodes]);

  // Enhanced graph data with Impact mode highlighting
  const enhancedGraphData = useMemo(() => {
    if (lineageMode !== 'impact' || !impactSelectedUrn) {
      return graphData;
    }

    // Apply highlighting/dimming based on impact analysis
    const enhancedNodes = graphData.nodes.map(node => ({
      ...node,
      metadata: {
        ...node.metadata,
        isImpactSelected: node.urn === impactSelectedUrn,
        isDownstream: downstreamUrns.has(node.urn),
        isDimmed: node.urn !== impactSelectedUrn && !downstreamUrns.has(node.urn),
      },
    }));

    const enhancedEdges = graphData.edges.map(edge => ({
      ...edge,
      metadata: {
        ...edge.metadata,
        isHighlighted: impactSelectedUrn === edge.from || downstreamUrns.has(edge.from),
        isDimmed: impactSelectedUrn !== edge.from && !downstreamUrns.has(edge.from),
      },
    }));

    return { nodes: enhancedNodes, edges: enhancedEdges };
  }, [graphData, lineageMode, impactSelectedUrn, downstreamUrns]);

  const filteredHierarchy = useMemo(() => {
    if (!searchTerm) return hierarchy;

    const filterRecursive = (nodes: HierarchyNode[]): HierarchyNode[] => {
      return nodes.reduce<HierarchyNode[]>((acc, node) => {
        const matches = node.name.toLowerCase().includes(searchTerm.toLowerCase());
        const filteredChildren = node.children ? filterRecursive(node.children) : [];

        if (matches || filteredChildren.length > 0) {
          acc.push({
            ...node,
            expanded: true,
            children: filteredChildren,
          });
        }
        return acc;
      }, []);
    };

    return filterRecursive(hierarchy);
  }, [hierarchy, searchTerm]);

  const dataSourceOptions = useMemo(
    () => [
      {
        value: '',
        label: dataSourcesLoading ? 'Loading...' : 'Select a data source',
        disabled: true,
      },
      ...dataSources.map((ds: DataSource) => ({
        value: String(ds.id ?? ''),
        label: ds.name ?? ds.id ?? 'Unnamed source',
      })),
    ],
    [dataSources, dataSourcesLoading],
  );

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 transition-all duration-500 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Animated Background Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(99,102,241,0.1),transparent_50%)] animate-pulse" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:4rem_4rem]" />
      </div>

      {/* Header */}
      <div className="mb-6 relative z-10 animate-in fade-in duration-700">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent animate-in slide-in-from-left duration-700">
              Data Lineage Explorer
            </h1>
            <p className="text-gray-600 flex items-center gap-2 animate-in slide-in-from-left duration-700 delay-100">
              <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
              Visualize data relationships with animated connections and interactive exploration
            </p>
          </div>

          <div className="flex gap-2 animate-in slide-in-from-right duration-500">
            {/* Mode Selector */}
            <div className="flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg border border-gray-200 p-1">
              <Button
                variant={lineageMode === 'explore' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLineageMode('explore')}
                className="gap-1.5 text-xs"
              >
                <Search className="h-3.5 w-3.5" />
                Explore
              </Button>
              <Button
                variant={lineageMode === 'impact' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLineageMode('impact')}
                className="gap-1.5 text-xs"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Impact
              </Button>
              <Button
                variant={lineageMode === 'timetravel' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setLineageMode('timetravel')}
                className="gap-1.5 text-xs"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Time Travel
              </Button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowCommandPalette(true)}
              className="gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg text-xs"
              title="Open command palette (Ctrl/Cmd+K)"
            >
              <Search className="h-4 w-4" />
              ⌘K
            </Button>
            <Button
              variant="outline"
              onClick={() => void expandAllTables()}
              disabled={loading || hierarchy.length === 0}
              className="gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg"
              title="Load all table columns to detect FK relationships"
            >
              <Network className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Detect FKs
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              {isFullscreen ? 'Exit' : 'Fullscreen'}
            </Button>
            <Button
              variant="outline"
              onClick={() => void refreshDataSources()}
              disabled={dataSourcesLoading}
              className="gap-2 hover:scale-105 transition-all duration-200 hover:shadow-lg"
            >
              <RefreshCcw className={`h-4 w-4 ${dataSourcesLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Mode Indicator */}
        {lineageMode !== 'explore' && (
          <div className="mb-4 animate-in slide-in-from-top duration-500">
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200 rounded-lg px-4 py-3 flex items-center gap-3">
              {lineageMode === 'impact' && (
                <>
                  <TrendingUp className="h-5 w-5 text-indigo-600 animate-pulse" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-indigo-900">Impact Analysis Mode</div>
                    <div className="text-xs text-indigo-700">Click on a node to highlight downstream dependencies</div>
                  </div>
                </>
              )}
              {lineageMode === 'timetravel' && (
                <>
                  <RefreshCcw className="h-5 w-5 text-indigo-600 animate-pulse" />
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-indigo-900">Time Travel Mode</div>
                    <div className="text-xs text-indigo-700">View how your data lineage evolved over time</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards with Pulse Animation */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="animate-in slide-in-from-bottom duration-500 delay-150">
            <StatCard
              icon={Database}
              label="Data Sources"
              value={dataSources.length}
              gradient="from-blue-500 to-indigo-600"
            />
          </div>
          <div className="animate-in slide-in-from-bottom duration-500 delay-200">
            <StatCard
              icon={Network}
              label="Total Nodes"
              value={graphData.nodes.length}
              gradient="from-purple-500 to-pink-600"
              pulse={graphData.nodes.length > 0}
            />
          </div>
          <div className="animate-in slide-in-from-bottom duration-500 delay-300">
            <StatCard
              icon={GitBranch}
              label="Relationships"
              value={graphData.edges.length}
              gradient="from-green-500 to-emerald-600"
              pulse={graphData.edges.length > 0}
            />
          </div>
          <div className="animate-in slide-in-from-bottom duration-500 delay-[400ms]">
            <StatCard
              icon={TrendingUp}
              label="Depth Levels"
              value={graphDepth}
              gradient="from-orange-500 to-red-600"
            />
          </div>
        </div>

        {/* Controls */}
        <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-xl animate-in zoom-in duration-500 delay-500 hover:shadow-2xl transition-all">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[250px]">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Data Source</label>
                <Select
                  value={selectedDataSource}
                  onChange={(e) => setSelectedDataSource(e.target.value)}
                  options={dataSourceOptions}
                  disabled={dataSourcesLoading}
                  className="w-full"
                />
              </div>

              <div className="flex-1 min-w-[250px]">
                <label className="text-sm font-medium text-gray-700 mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search tables, columns..."
                    className="pl-10 transition-all focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">View Mode</label>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'hierarchy' | 'graph')}>
                  <TabsList className="grid grid-cols-2 w-[200px]">
                    <TabsTrigger value="hierarchy" className="gap-2">
                      <FolderTree className="h-4 w-4" />
                      Hierarchy
                    </TabsTrigger>
                    <TabsTrigger value="graph" className="gap-2">
                      <Network className="h-4 w-4" />
                      Graph
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {viewMode === 'graph' && (
                <>
                  <div className="animate-in fade-in duration-300">
                    <label className="text-sm font-medium text-gray-700 mb-2 block">Style</label>
                    <div className="flex gap-2">
                      <Button
                        variant={graphStyle === 'modern' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGraphStyle('modern')}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        Modern
                      </Button>
                      <Button
                        variant={graphStyle === 'cinematic' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGraphStyle('cinematic')}
                        className="hover:scale-105 transition-transform duration-200"
                      >
                        Cinematic
                      </Button>
                      <Button
                        variant={graphStyle === 'revolutionary' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setGraphStyle('revolutionary')}
                        className="hover:scale-105 transition-transform duration-200 bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                      >
                        <GitBranch className="mr-2 h-4 w-4" />
                        Revolutionary
                      </Button>
                    </div>
                  </div>
                  {graphStyle === 'modern' && (
                    <div className="animate-in fade-in duration-300">
                      <label className="text-sm font-medium text-gray-700 mb-2 block">Depth</label>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGraphDepth(d => Math.max(1, d - 1))}
                          disabled={graphDepth <= 1}
                          className="hover:scale-110 transition-transform duration-200"
                        >
                          <ZoomOut className="h-4 w-4" />
                        </Button>
                        <span className="flex items-center px-3 font-semibold bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                          {graphDepth}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setGraphDepth(d => Math.min(10, d + 1))}
                          disabled={graphDepth >= 10}
                          className="hover:scale-110 transition-transform duration-200"
                        >
                          <ZoomIn className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 animate-in fade-in duration-700 delay-200">
        {/* Sidebar - Hierarchy Tree with Animated Connections */}
        <div className="lg:col-span-3 animate-in slide-in-from-left duration-700 delay-300">
          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-xl h-[calc(100vh-400px)] overflow-hidden flex flex-col hover:shadow-2xl transition-shadow duration-300">
            <CardHeader className="pb-3 border-b border-gradient-to-r from-indigo-100 to-purple-100">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                  <FolderTree className="h-5 w-5 text-white" />
                </div>
                Data Hierarchy
                {hoveredNode && (
                  <Badge className="ml-auto animate-in fade-in duration-200 bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg">
                    {hoveredNode.type}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-indigo-300 scrollbar-track-transparent">
              {loading ? (
                <div className="flex items-center justify-center h-full animate-in fade-in duration-300">
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <RefreshCcw className="h-8 w-8 animate-spin text-indigo-500" />
                      <div className="absolute inset-0 blur-xl bg-indigo-500/20 animate-pulse" />
                    </div>
                    <p className="text-sm text-gray-500 animate-pulse">Loading hierarchy...</p>
                  </div>
                </div>
              ) : filteredHierarchy.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 animate-in fade-in duration-500">
                  <Database className="h-12 w-12 mb-2 animate-pulse" />
                  <p className="text-sm">Select a data source to explore</p>
                </div>
              ) : (
                <HierarchyTree
                  nodes={filteredHierarchy}
                  onToggle={toggleNode}
                  onSelect={selectNode}
                  selectedNode={selectedNode}
                  onHover={setHoveredNode}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main View Area with Enhanced Visualizations */}
        <div className="lg:col-span-9 space-y-4 animate-in slide-in-from-right duration-700 delay-400">
          {/* Enhanced Selected Node Details with Animated Badge */}
          {selectedNode && selectedNode.type === 'column' && selectedNode.metadata && (
            <Card className="border-0 shadow-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white animate-in slide-in-from-top duration-500 hover:shadow-2xl transition-all overflow-hidden relative">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,white_1px,transparent_1px)] bg-[size:1rem_1rem] animate-pulse" />
              </div>
              
              <CardContent className="p-4 relative z-10">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                      <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                        <Columns3 className="h-5 w-5" />
                      </div>
                      {selectedNode.name}
                      <ArrowRight className="h-4 w-4 animate-pulse" />
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {selectedNode.metadata.dataType && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition-all">
                          <span className="opacity-80 block mb-1">Data Type:</span>
                          <div className="font-semibold font-mono">{selectedNode.metadata.dataType}</div>
                        </div>
                      )}
                      {selectedNode.metadata.isNullable !== undefined && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition-all">
                          <span className="opacity-80 block mb-1">Nullable:</span>
                          <div className="font-semibold">{selectedNode.metadata.isNullable ? 'Yes' : 'No'}</div>
                        </div>
                      )}
                      {selectedNode.metadata.isPrimaryKey && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition-all hover:scale-105">
                          <span className="opacity-80 block mb-1">🔑 Primary Key</span>
                          <div className="h-1 bg-yellow-400 rounded-full mt-2 animate-pulse" />
                        </div>
                      )}
                      {selectedNode.metadata.isForeignKey && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/20 transition-all hover:scale-105">
                          <span className="opacity-80 block mb-1">🔗 Foreign Key</span>
                          <div className="h-1 bg-blue-400 rounded-full mt-2 animate-pulse" />
                        </div>
                      )}
                    </div>
                    {selectedNode.metadata.computedExpression && (
                      <div className="mt-4 p-3 bg-white/20 backdrop-blur-sm rounded-lg animate-in fade-in duration-300 delay-200">
                        <div className="text-xs opacity-80 mb-1 flex items-center gap-2">
                          ⚡ Computed Expression:
                          <div className="h-px flex-1 bg-white/30" />
                        </div>
                        <code className="text-sm font-mono block mt-2">{selectedNode.metadata.computedExpression}</code>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-xl bg-white/90 backdrop-blur-xl h-[calc(100vh-400px)] overflow-hidden hover:shadow-2xl transition-shadow duration-300 relative">
            {/* Animated border gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 hover:opacity-10 transition-opacity duration-500 pointer-events-none" />
            
            <CardHeader className="pb-3 border-b border-gradient-to-r from-indigo-100 to-purple-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg animate-pulse">
                    <Network className="h-5 w-5 text-white" />
                  </div>
                  {viewMode === 'hierarchy' ? 'Hierarchy View' : 'Lineage Graph'}
                  {graphData.edges.length > 0 && (
                    <Badge className="ml-2 animate-in fade-in duration-300 bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg">
                      {graphData.edges.length} connection{graphData.edges.length !== 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardTitle>
                {selectedNode && (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right duration-300">
                    <Link2 className="h-4 w-4 text-indigo-500 animate-pulse" />
                    <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow">
                      {selectedNode.name}
                    </Badge>
                    {selectedNode.metadata?.isView && (
                      <Badge variant="secondary" className="animate-in fade-in duration-300 delay-100 bg-purple-100 text-purple-700">VIEW</Badge>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="h-full pb-6">
              {viewMode === 'hierarchy' ? (
                <div className="flex items-center justify-center h-full text-gray-400 animate-in fade-in duration-500">
                  <div className="text-center">
                    <div className="relative inline-block mb-4">
                      <Box className="h-16 w-16 opacity-50 animate-pulse" />
                      <div className="absolute inset-0 blur-2xl bg-indigo-500/20 animate-pulse" />
                    </div>
                    <p className="text-lg font-medium mb-2 animate-in slide-in-from-bottom duration-500 delay-100">Select a node to view lineage</p>
                    <p className="text-sm animate-in slide-in-from-bottom duration-500 delay-200">Click on any table or column in the hierarchy to visualize its relationships</p>
                    <div className="mt-6 flex items-center justify-center gap-2 animate-in fade-in duration-500 delay-300">
                      <div className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                      <div className="h-2 w-2 rounded-full bg-purple-500 animate-ping delay-100" />
                      <div className="h-2 w-2 rounded-full bg-pink-500 animate-ping delay-200" />
                    </div>
                  </div>
                </div>
              ) : graphData.nodes.length > 0 ? (
                <div className="h-full rounded-lg overflow-hidden animate-in zoom-in duration-700 relative">
                  {graphStyle === 'revolutionary' ? (
                    <RevolutionaryLineageGraph />
                  ) : graphStyle === 'modern' ? (
                    <>
                      {/* Connection counter overlay */}
                      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 animate-in slide-in-from-top duration-500">
                        <div className="flex items-center gap-2 text-sm">
                          <GitBranch className="h-4 w-4 text-indigo-600" />
                          <span className="font-semibold text-gray-900">{graphData.edges.length}</span>
                          <span className="text-gray-600">active connection{graphData.edges.length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>

                      {/* Info message for FK relationships */}
                      {graphData.edges.filter(e => e.relationshipType === 'references').length === 0 && (selectedNode?.type === 'schema' || selectedNode?.type === 'database' || selectedNode?.metadata?.folder) && (
                        <div className="absolute top-16 right-4 z-10 bg-blue-50 backdrop-blur-sm rounded-lg shadow-lg px-4 py-2 animate-in slide-in-from-top duration-500 delay-200 max-w-xs">
                          <div className="flex items-start gap-2 text-xs text-blue-900">
                            <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5 animate-pulse" />
                            <div>
                              <div className="font-semibold mb-1">No FK relationships detected</div>
                              <div className="text-blue-700">Click <strong>"Detect FKs"</strong> button above to load table columns and auto-detect foreign key relationships!</div>
                            </div>
                          </div>
                        </div>
                      )}

                      <ModernLineageGraph
                        nodes={enhancedGraphData.nodes}
                        edges={enhancedGraphData.edges}
                        onNodeSelect={(node) => handleNodeClick(node.urn)}
                      />
                    </>
                  ) : (
                    <CinematicLineageGraph
                      nodes={enhancedGraphData.nodes}
                      edges={enhancedGraphData.edges}
                      onNodeSelect={(node) => handleNodeClick(node.urn)}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 animate-in fade-in duration-500">
                  <div className="text-center">
                    <div className="relative inline-block mb-4">
                      <Network className="h-16 w-16 opacity-50 animate-pulse" />
                      <div className="absolute inset-0 blur-2xl bg-purple-500/20 animate-pulse" />
                    </div>
                    <p className="text-lg font-medium mb-2 animate-in slide-in-from-bottom duration-500 delay-100">No lineage data</p>
                    <p className="text-sm animate-in slide-in-from-bottom duration-500 delay-200">Select a node from the hierarchy to view its lineage graph</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Command Palette */}
      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          onSelectMode={setLineageMode}
          onSelectGraphStyle={setGraphStyle}
          onSelectViewMode={setViewMode}
          onRefresh={() => void refreshDataSources()}
          onDetectFKs={() => void expandAllTables()}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />
      )}
    </div>
  );
}

// Command Palette Component
function CommandPalette({
  onClose,
  onSelectMode,
  onSelectGraphStyle,
  onSelectViewMode,
  onRefresh,
  onDetectFKs,
  onToggleFullscreen,
}: {
  onClose: () => void;
  onSelectMode: (mode: 'explore' | 'impact' | 'timetravel') => void;
  onSelectGraphStyle: (style: 'modern' | 'cinematic') => void;
  onSelectViewMode: (mode: 'hierarchy' | 'graph') => void;
  onRefresh: () => void;
  onDetectFKs: () => void;
  onToggleFullscreen: () => void;
}) {
  const [query, setQuery] = useState('');

  const commands = [
    { id: 'explore', label: 'Switch to Explore Mode', icon: <Search className="h-4 w-4" />, action: () => { onSelectMode('explore'); onClose(); } },
    { id: 'impact', label: 'Switch to Impact Analysis', icon: <TrendingUp className="h-4 w-4" />, action: () => { onSelectMode('impact'); onClose(); } },
    { id: 'timetravel', label: 'Switch to Time Travel', icon: <RefreshCcw className="h-4 w-4" />, action: () => { onSelectMode('timetravel'); onClose(); } },
    { id: 'modern', label: 'Use Modern Graph Style', icon: <Network className="h-4 w-4" />, action: () => { onSelectGraphStyle('modern'); onClose(); } },
    { id: 'cinematic', label: 'Use Cinematic Graph Style', icon: <Sparkles className="h-4 w-4" />, action: () => { onSelectGraphStyle('cinematic'); onClose(); } },
    { id: 'hierarchy', label: 'Show Hierarchy View', icon: <FolderTree className="h-4 w-4" />, action: () => { onSelectViewMode('hierarchy'); onClose(); } },
    { id: 'graph', label: 'Show Graph View', icon: <GitBranch className="h-4 w-4" />, action: () => { onSelectViewMode('graph'); onClose(); } },
    { id: 'refresh', label: 'Refresh Data Sources', icon: <RefreshCcw className="h-4 w-4" />, action: () => { onRefresh(); onClose(); } },
    { id: 'detect', label: 'Detect Foreign Keys', icon: <Network className="h-4 w-4" />, action: () => { onDetectFKs(); onClose(); } },
    { id: 'fullscreen', label: 'Toggle Fullscreen', icon: <Maximize2 className="h-4 w-4" />, action: () => { onToggleFullscreen(); onClose(); } },
  ];

  const filteredCommands = commands.filter(cmd =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-32 z-50 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in slide-in-from-top duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200/50 flex items-center gap-3">
          <Search className="h-5 w-5 text-indigo-500" />
          <input
            autoFocus
            placeholder="Type a command or search..."
            className="w-full outline-none bg-transparent text-gray-900 placeholder:text-gray-400"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && filteredCommands[0]) {
                filteredCommands[0].action();
              }
              if (e.key === 'Escape') {
                onClose();
              }
            }}
          />
          <kbd className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-300 text-gray-600">ESC</kbd>
        </div>
        <div className="p-2 max-h-96 overflow-auto">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-indigo-50 flex items-center gap-3 transition-all duration-200 group"
              >
                <div className="text-indigo-600 group-hover:scale-110 transition-transform">
                  {cmd.icon}
                </div>
                <span className="text-sm font-medium text-gray-800 group-hover:text-indigo-700">
                  {cmd.label}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400 ml-auto group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </button>
            ))
          ) : (
            <div className="px-4 py-12 text-center text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No commands found</p>
              <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Stat Card with Pulse
function StatCard({ icon: Icon, label, value, gradient, pulse = false }: {
  icon: React.ElementType;
  label: string;
  value: number;
  gradient: string;
  pulse?: boolean;
}) {
  return (
    <Card className="border-0 shadow-lg hover:shadow-2xl transition-all duration-300 bg-white/90 backdrop-blur-xl hover:scale-105 hover:-translate-y-1 group relative overflow-hidden">
      {/* Animated background */}
      {pulse && (
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-purple-500/5 animate-pulse" />
      )}
      
      <CardContent className="p-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:rotate-6 relative`}>
            <Icon className="h-6 w-6 text-white" />
            {pulse && (
              <div className="absolute inset-0 rounded-xl bg-white/20 animate-ping" />
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600 font-medium transition-colors group-hover:text-gray-900">{label}</p>
            <p className="text-2xl font-bold text-gray-900 transition-transform group-hover:scale-110 tabular-nums">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Enhanced Hierarchy Tree with Animated Connection Lines
function HierarchyTree({
  nodes,
  onToggle,
  onSelect,
  selectedNode,
  onHover,
  level = 0,
}: {
  nodes: HierarchyNode[];
  onToggle: (id: string) => void;
  onSelect: (node: HierarchyNode) => void;
  selectedNode: HierarchyNode | null;
  onHover?: (node: HierarchyNode | null) => void;
  level?: number;
}) {
  return (
    <div className={level > 0 ? 'ml-3 relative' : ''}>
      {/* Animated vertical connection line */}
      {level > 0 && (
        <div className="absolute left-0 top-0 bottom-0 w-px overflow-hidden">
          <div className="h-full w-full bg-gradient-to-b from-indigo-300 via-blue-300 to-transparent relative">
            {/* Animated flow effect */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-500 to-transparent opacity-50 animate-flow" />
          </div>
        </div>
      )}

      {nodes.map((node, index) => {
        const theme = nodeThemes[node.type];
        const Icon = theme.icon;
        const isSelected = selectedNode?.id === node.id;
        const hasChildren = node.children && node.children.length > 0;

        return (
          <div key={node.id} className="relative group/item">
            {/* Animated horizontal connection line */}
            {level > 0 && (
              <div className="absolute left-0 top-[18px] w-3 h-px overflow-hidden">
                <div className="h-full w-full bg-gradient-to-r from-indigo-300 to-blue-200 relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50 animate-flow-horizontal" />
                </div>
              </div>
            )}

            <button
              onClick={() => {
                if (hasChildren) {
                  onToggle(node.id);
                }
                onSelect(node);
              }}
              onMouseEnter={() => onHover?.(node)}
              onMouseLeave={() => onHover?.(null)}
              className={`w-full flex items-center gap-1.5 py-1.5 px-2 rounded-md text-left transition-all duration-300 mb-0.5 relative
                ${level > 0 ? 'pl-4' : ''}
                ${isSelected
                  ? `bg-gradient-to-r ${theme.bg} text-white shadow-lg ${theme.glow} scale-[1.02] animate-in fade-in duration-300 before:absolute before:inset-0 before:bg-white/10 before:rounded-md before:animate-pulse`
                  : 'hover:bg-indigo-50/50 hover:shadow-md hover:scale-[1.01] hover:translate-x-0.5'
                }`}
            >
              {hasChildren && (
                <ChevronRight
                  className={`h-3.5 w-3.5 transition-all duration-300 flex-shrink-0 ${node.expanded ? 'rotate-90' : ''} ${isSelected ? 'text-white' : 'text-indigo-500'}`}
                />
              )}
              {!hasChildren && level > 0 && <div className="w-3.5" />}

              <div className={`p-1 rounded transition-all duration-300 ${isSelected ? 'bg-white/20 shadow-inner' : 'bg-indigo-100 group-hover/item:bg-indigo-200'} flex-shrink-0 relative overflow-hidden`}>
                <Icon className={`h-3.5 w-3.5 transition-all duration-300 relative z-10 ${isSelected ? 'text-white' : 'text-indigo-600'}`} />
                {isSelected && (
                  <div className="absolute inset-0 bg-white/20 animate-ping" />
                )}
              </div>

              <span className={`text-xs font-medium truncate flex-1 transition-all duration-300 ${isSelected ? 'text-white font-semibold' : 'text-gray-800'}`}>
                {node.name}
              </span>

              {/* Animated badges */}
              <div className="ml-auto flex items-center gap-1 flex-shrink-0">
                {node.type === 'column' && node.metadata?.dataType && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono transition-all duration-300 ${isSelected ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-700 group-hover/item:bg-blue-200'}`}>
                    {node.metadata.dataType}
                  </span>
                )}

                {node.type === 'table' && node.metadata?.rowCount !== undefined && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded transition-all duration-300 ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600 group-hover/item:bg-gray-200'}`}>
                    {node.metadata.rowCount.toLocaleString()}
                  </span>
                )}

                {node.type === 'table' && node.metadata?.columnCount && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded transition-all duration-300 ${isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600 group-hover/item:bg-gray-200'}`}>
                    {node.metadata.columnCount} cols
                  </span>
                )}

                {/* Connection indicator for selected/hovered nodes */}
                {(isSelected || false) && (
                  <div className="flex items-center gap-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse delay-100" />
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse delay-200" />
                  </div>
                )}
              </div>
            </button>

            {hasChildren && node.expanded && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <HierarchyTree
                  nodes={node.children!}
                  onToggle={onToggle}
                  onSelect={onSelect}
                  selectedNode={selectedNode}
                  onHover={onHover}
                  level={level + 1}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Add custom animations to your global CSS or Tailwind config
const styles = `
@keyframes flow {
  0%, 100% { transform: translateY(-100%); }
  50% { transform: translateY(100%); }
}

@keyframes flow-horizontal {
  0%, 100% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
}

.animate-flow {
  animation: flow 2s ease-in-out infinite;
}

.animate-flow-horizontal {
  animation: flow-horizontal 2s ease-in-out infinite;
}

.scrollbar-thin::-webkit-scrollbar {
  width: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: #c7d2fe;
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: #a5b4fc;
}
`;