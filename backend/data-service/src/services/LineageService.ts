// src/services/LineageService.ts
import { withTransaction } from '@/config/database';
import { logger } from '@/utils/logger';
import { createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { z } from 'zod';
import { DatabaseService } from './DatabaseService';

/* ──────────────────────────────────────────────────────────────────────────
 * Schemas & Types
 * ────────────────────────────────────────────────────────────────────────── */

const LineageNodeSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(255),
  type: z.enum(['source', 'bronze', 'silver', 'gold', 'transformation', 'sink', 'database', 'schema', 'table', 'column', 'view', 'procedure', 'function']),
  data_source_id: z.string().uuid().optional(),
  schema_name: z.string().max(100).optional(),
  table_name: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().uuid().optional(),
});

const LineageEdgeSchema = z.object({
  id: z.string().uuid(),
  from_id: z.string().uuid(),
  to_id: z.string().uuid(),
  relationship_type: z.enum(['derives_from', 'transforms_to', 'copies_from', 'aggregates_from']),
  transformation_logic: z.string().max(2000).optional(),
  confidence_score: z.number().min(0).max(1).optional(),
  metadata: z.record(z.any()).optional(),
  created_at: z.date().optional(),
  updated_at: z.date().optional(),
  created_by: z.string().uuid().optional(),
});

const GraphFiltersSchema = z.object({
  dataSourceId: z.string().uuid().optional(),
  nodeTypes: z.array(z.enum(['source', 'bronze', 'silver', 'gold', 'transformation', 'sink', 'database', 'schema', 'table', 'column', 'view', 'procedure', 'function'])).optional(),
  maxDepth: z.number().min(1).max(10).default(5),
  includeMetadata: z.boolean().default(false),
  relationshipTypes: z.array(z.enum(['derives_from', 'transforms_to', 'copies_from', 'aggregates_from'])).optional(),
  fromNodeId: z.string().uuid().optional(),
  toNodeId: z.string().uuid().optional(),
  limit: z.number().min(1).max(10000).default(1000),
});

const LineagePathSchema = z.object({
  startNodeId: z.string().uuid(),
  endNodeId: z.string().uuid(),
  maxDepth: z.number().min(1).max(20).default(10),
  direction: z.enum(['upstream', 'downstream', 'both']).default('both'),
});

export type LineageNode = z.infer<typeof LineageNodeSchema>;
export type LineageEdge = z.infer<typeof LineageEdgeSchema>;
export type GraphFilters = z.infer<typeof GraphFiltersSchema>;
export type LineagePath = z.infer<typeof LineagePathSchema>;

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  metadata: {
    totalNodes: number;
    totalEdges: number;
    nodeTypeDistribution: Record<string, number>;
    maxDepthReached: number;
    queryDuration: number;
    cacheHit: boolean;
  };
}

export interface LineagePathResult {
  paths: Array<{
    nodes: LineageNode[];
    edges: LineageEdge[];
    pathLength: number;
    confidence: number;
  }>;
  shortestPath?: {
    nodes: LineageNode[];
    edges: LineageEdge[];
    pathLength: number;
  };
  metadata: {
    totalPaths: number;
    maxDepthSearched: number;
    queryDuration: number;
  };
}

export interface LineageImpactAnalysis {
  affectedNodes: LineageNode[];
  impactRadius: number;
  criticalPaths: Array<{
    path: LineageNode[];
    criticality: 'high' | 'medium' | 'low';
    reason: string;
  }>;
  recommendations: string[];
}

/* ──────────────────────────────────────────────────────────────────────────
 * Errors & Helpers
 * ────────────────────────────────────────────────────────────────────────── */

class LineageError extends Error {
  constructor(
    message: string,
    public code: string = 'LINEAGE_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'LineageError';
  }
}
class LineageValidationError extends LineageError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', 400);
    this.name = 'LineageValidationError';
  }
}
class LineageNotFoundError extends LineageError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with ID ${id} not found` : `${resource} not found`, 'NOT_FOUND', 404);
    this.name = 'LineageNotFoundError';
  }
}

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
const toInt = (v: unknown, fallback = 0): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : fallback;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Service
 * ────────────────────────────────────────────────────────────────────────── */

export class LineageService {
  private db = new DatabaseService();

  private queryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly cacheTTL = 300000; // 5 minutes
  private readonly maxCacheSize = 1000;

  constructor() {
    this.setupCacheCleanup();
  }

  /* ── Graph retrieval ──────────────────────────────────────────────────── */

  async getGraph(
    filters: Partial<GraphFilters> = {},
    requestContext: { userId?: string; requestId?: string } = {}
  ): Promise<LineageGraph> {
    const start = performance.now();
    const validated = GraphFiltersSchema.parse(filters);
    const cacheKey = this.generateCacheKey('graph', validated);

    // Cache lookup
    const cached = this.getCachedResult(cacheKey);
    if (cached) {
      const meta = {
        ...cached.metadata,
        cacheHit: true,
        queryDuration: Math.round(performance.now() - start),
      };
      logger.info('Lineage graph cache hit', {
        requestId: requestContext.requestId,
        userId: requestContext.userId,
        cacheKey: cacheKey.slice(0, 16),
      });
      return { ...cached, metadata: meta };
    }

    try {
      // No need for explicit transaction: two read-only queries
      const { nodesQuery, nodesParams } = this.buildNodesQuery(validated);
      const { edgesQuery, edgesParams } = this.buildEdgesQuery(validated);

      const nodesRes = (await this.db.query(nodesQuery, nodesParams)) as any;
      const edgesRes = (await this.db.query(edgesQuery, edgesParams)) as any;

      const nodes = this.processNodes(nodesRes.rows ?? [], validated.includeMetadata);
      const edges = this.processEdges(edgesRes.rows ?? []);

      const baseMeta = this.generateGraphMetadata(nodes, edges, performance.now() - start);
      const result: LineageGraph = { nodes, edges, metadata: { ...baseMeta, cacheHit: false } };

      this.setCachedResult(cacheKey, result, this.cacheTTL);

      logger.info('Lineage graph retrieved', {
        requestId: requestContext.requestId,
        userId: requestContext.userId,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        queryDuration: baseMeta.queryDuration,
      });

      return result;
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('Failed to retrieve lineage graph', {
        error: err.message,
        stack: err.stack,
        filters: validated,
        requestId: requestContext.requestId,
        userId: requestContext.userId,
      });
      throw new LineageError('Failed to retrieve lineage graph', 'GRAPH_RETRIEVAL_FAILED', 500);
    }
  }

  /* ── Path finding ─────────────────────────────────────────────────────── */

  async findLineagePaths(
    pathConfig: LineagePath,
    requestContext: { userId?: string; requestId?: string } = {}
  ): Promise<LineagePathResult> {
    const start = performance.now();
    const cfg = LineagePathSchema.parse(pathConfig);

    try {
      await this.validateNodesExist([cfg.startNodeId, cfg.endNodeId]);

      const { query, params } = this.buildPathQuery(cfg);
      const res = (await this.db.query(query, params)) as any;

      const paths = this.processPaths(res.rows ?? []);
      const shortestPath = this.findShortestPath(paths);

      const meta = {
        totalPaths: paths.length,
        maxDepthSearched: cfg.maxDepth,
        queryDuration: Math.round(performance.now() - start),
      };

      logger.info('Lineage paths found', {
        requestId: requestContext.requestId,
        userId: requestContext.userId,
        startNode: cfg.startNodeId,
        endNode: cfg.endNodeId,
        pathsFound: paths.length,
        queryDuration: meta.queryDuration,
      });

      return { paths, shortestPath, metadata: meta };
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('Failed to find lineage paths', {
        error: err.message,
        pathConfig: cfg,
        requestId: requestContext.requestId,
        userId: requestContext.userId,
      });
      if (err instanceof LineageError) throw err;
      throw new LineageError('Failed to find lineage paths', 'PATH_FINDING_FAILED', 500);
    }
  }

  /* ── Impact analysis ─────────────────────────────────────────────────── */

  async analyzeImpact(
    nodeId: string,
    analysisDepth = 5,
    requestContext: { userId?: string; requestId?: string } = {}
  ): Promise<LineageImpactAnalysis> {
    if (!z.string().uuid().safeParse(nodeId).success) {
      throw new LineageValidationError('Invalid node ID format');
    }

    try {
      await this.validateNodesExist([nodeId]);

      const downstreamQuery = `
        WITH RECURSIVE downstream_impact AS (
          SELECT ln.*, 0 as depth, ARRAY[ln.id] as path
          FROM lineage_nodes ln
          WHERE ln.id = $1 AND ln.deleted_at IS NULL
          UNION ALL
          SELECT ln.*, di.depth + 1, di.path || ln.id
          FROM lineage_nodes ln
          JOIN lineage_edges le ON ln.id = le.to_id
          JOIN downstream_impact di ON le.from_id = di.id
          WHERE di.depth < $2 
            AND ln.deleted_at IS NULL 
            AND le.deleted_at IS NULL
            AND NOT (ln.id = ANY(di.path))
        )
        SELECT DISTINCT id, label, type, schema_name, table_name, depth
        FROM downstream_impact
        WHERE depth > 0
        ORDER BY depth, type, label;
      `;

      const res = (await this.db.query(downstreamQuery, [nodeId, analysisDepth])) as any;

      const affectedNodes: LineageNode[] = (res.rows ?? []).map((row: any) => ({
        id: row.id,
        label: row.label,
        type: row.type,
        schema_name: row.schema_name,
        table_name: row.table_name,
      }));

      const criticalPaths = this.analyzeCriticality(affectedNodes);
      const recommendations = this.generateRecommendations(affectedNodes, criticalPaths);

      const impactRadius = (res.rows ?? []).reduce((m: number, r: any) => Math.max(m, toInt(r.depth, 0)), 0);

      logger.info('Impact analysis completed', {
        requestId: requestContext.requestId,
        userId: requestContext.userId,
        nodeId,
        affectedCount: affectedNodes.length,
        impactRadius,
      });

      return {
        affectedNodes,
        impactRadius,
        criticalPaths,
        recommendations,
      };
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('Failed to analyze impact', {
        error: err.message,
        nodeId,
        requestId: requestContext.requestId,
        userId: requestContext.userId,
      });
      if (err instanceof LineageError) throw err;
      throw new LineageError('Failed to analyze impact', 'IMPACT_ANALYSIS_FAILED', 500);
    }
  }

  /* ── Mutations ───────────────────────────────────────────────────────── */

  async createNode(
    nodeData: Omit<LineageNode, 'id' | 'created_at' | 'updated_at'>,
    userId: string,
    requestContext: { requestId?: string } = {}
  ): Promise<LineageNode> {
    const data = LineageNodeSchema.omit({ id: true, created_at: true, updated_at: true }).parse(nodeData);

    try {
      const inserted = await withTransaction(async (client) => {
        // duplicate check
        if (data.schema_name && data.table_name) {
          const dup = await client.query(
            `SELECT id FROM lineage_nodes 
             WHERE schema_name = $1 AND table_name = $2 AND data_source_id = $3 AND deleted_at IS NULL`,
            [data.schema_name, data.table_name, data.data_source_id]
          );
          if ((dup.rows ?? []).length > 0) {
            throw new LineageValidationError(`Node already exists for ${data.schema_name}.${data.table_name}`);
          }
        }

        const ins = await client.query(
          `
          INSERT INTO lineage_nodes (
            label, type, data_source_id, schema_name, table_name,
            description, metadata, created_by, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
          RETURNING id, label, type, data_source_id, schema_name, table_name,
                    description, metadata, created_at, updated_at, created_by
          `,
          [
            data.label,
            data.type,
            data.data_source_id ?? null,
            data.schema_name ?? null,
            data.table_name ?? null,
            data.description ?? null,
            JSON.stringify(data.metadata ?? {}),
            userId,
          ]
        );
        return ins.rows[0] as LineageNode;
      });

      this.invalidateGraphCache();

      logger.info('Lineage node created', {
        nodeId: inserted.id,
        label: inserted.label,
        type: inserted.type,
        userId,
        requestId: requestContext.requestId,
      });

      return inserted;
    } catch (e: unknown) {
      const err = toError(e);
      if (err instanceof LineageError) throw err;
      logger.error('Failed to create lineage node', {
        error: err.message,
        nodeData: data,
        userId,
        requestId: requestContext.requestId,
      });
      throw new LineageError('Failed to create lineage node', 'NODE_CREATION_FAILED', 500);
    }
  }

  async createEdge(
    edgeData: Omit<LineageEdge, 'id' | 'created_at' | 'updated_at'>,
    userId: string,
    requestContext: { requestId?: string } = {}
  ): Promise<LineageEdge> {
    const data = LineageEdgeSchema.omit({ id: true, created_at: true, updated_at: true }).parse(edgeData);

    if (data.from_id === data.to_id) {
      throw new LineageValidationError('Self-referencing edges are not allowed');
    }
    await this.validateNodesExist([data.from_id, data.to_id]);

    try {
      const inserted = await withTransaction(async (client) => {
        // duplicate edge check
        const dup = await client.query(
          `SELECT id FROM lineage_edges 
           WHERE from_id = $1 AND to_id = $2 AND relationship_type = $3 AND deleted_at IS NULL`,
          [data.from_id, data.to_id, data.relationship_type]
        );
        if ((dup.rows ?? []).length > 0) {
          throw new LineageValidationError('Edge with this relationship already exists between these nodes');
        }

        // cycle check (simple downstream reachability)
        const cycleQ = `
          WITH RECURSIVE path_check AS (
            SELECT id, 0 as depth FROM lineage_nodes WHERE id = $1
            UNION ALL
            SELECT ln.id, pc.depth + 1
            FROM path_check pc
            JOIN lineage_edges le ON pc.id = le.from_id
            JOIN lineage_nodes ln ON le.to_id = ln.id
            WHERE pc.depth < 20 AND ln.deleted_at IS NULL AND le.deleted_at IS NULL
          )
          SELECT EXISTS(SELECT 1 FROM path_check WHERE id = $2 AND depth > 0) as has_cycle;
        `;
        const cyc = await client.query(cycleQ, [data.to_id, data.from_id]);
        if (cyc.rows?.[0]?.has_cycle === true) {
          throw new LineageValidationError('Creating this edge would introduce a cycle in the lineage graph');
        }

        const ins = await client.query(
          `
          INSERT INTO lineage_edges (
            from_id, to_id, relationship_type, transformation_logic,
            confidence_score, metadata, created_by, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
          RETURNING id, from_id, to_id, relationship_type, transformation_logic,
                    confidence_score, metadata, created_at, updated_at, created_by
          `,
          [
            data.from_id,
            data.to_id,
            data.relationship_type,
            data.transformation_logic ?? null,
            data.confidence_score ?? null,
            JSON.stringify(data.metadata ?? {}),
            userId,
          ]
        );
        return ins.rows[0] as LineageEdge;
      });

      this.invalidateGraphCache();

      logger.info('Lineage edge created', {
        edgeId: inserted.id,
        fromId: inserted.from_id,
        toId: inserted.to_id,
        relationshipType: inserted.relationship_type,
        userId,
        requestId: requestContext.requestId,
      });

      return inserted;
    } catch (e: unknown) {
      const err = toError(e);
      if (err instanceof LineageError) throw err;
      logger.error('Failed to create lineage edge', {
        error: err.message,
        edgeData: data,
        userId,
        requestId: requestContext.requestId,
      });
      throw new LineageError('Failed to create lineage edge', 'EDGE_CREATION_FAILED', 500);
    }
  }

  async deleteNode(
    nodeId: string,
    userId: string,
    requestContext: { requestId?: string } = {}
  ): Promise<void> {
    if (!z.string().uuid().safeParse(nodeId).success) throw new LineageValidationError('Invalid node ID format');
    await this.validateNodesExist([nodeId]);

    try {
      await withTransaction(async (client) => {
        await client.query(
          `UPDATE lineage_nodes SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
           WHERE id = $1 AND deleted_at IS NULL`,
          [nodeId, userId]
        );
        await client.query(
          `UPDATE lineage_edges SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
           WHERE (from_id = $1 OR to_id = $1) AND deleted_at IS NULL`,
          [nodeId, userId]
        );
      });

      this.invalidateGraphCache();

      logger.warn('Lineage node deleted', { nodeId, userId, requestId: requestContext.requestId });
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('Failed to delete lineage node', { error: err.message, nodeId, userId, requestId: requestContext.requestId });
      throw new LineageError('Failed to delete lineage node', 'NODE_DELETION_FAILED', 500);
    }
  }

  async deleteEdge(
    edgeId: string,
    userId: string,
    requestContext: { requestId?: string } = {}
  ): Promise<void> {
    if (!z.string().uuid().safeParse(edgeId).success) throw new LineageValidationError('Invalid edge ID format');

    try {
      const res = (await this.db.query(
        `UPDATE lineage_edges 
         SET deleted_at = NOW(), deleted_by = $2, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [edgeId, userId]
      )) as any;

      if ((res.rows ?? []).length === 0) throw new LineageNotFoundError('Lineage edge', edgeId);

      this.invalidateGraphCache();

      logger.warn('Lineage edge deleted', { edgeId, userId, requestId: requestContext.requestId });
    } catch (e: unknown) {
      const err = toError(e);
      if (err instanceof LineageError) throw err;
      logger.error('Failed to delete lineage edge', { error: err.message, edgeId, userId, requestId: requestContext.requestId });
      throw new LineageError('Failed to delete lineage edge', 'EDGE_DELETION_FAILED', 500);
    }
  }

  async bulkCreateNodes(
    nodesData: Array<Omit<LineageNode, 'id' | 'created_at' | 'updated_at'>>,
    userId: string,
    requestContext: { requestId?: string } = {}
  ): Promise<{ created: LineageNode[]; errors: Array<{ index: number; error: string }> }> {
    if (nodesData.length > 1000) throw new LineageValidationError('Maximum 1000 nodes allowed in bulk operation');

    const created: LineageNode[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    try {
      await withTransaction(async (client) => {
        for (let i = 0; i < nodesData.length; i++) {
          try {
            const data = LineageNodeSchema.omit({ id: true, created_at: true, updated_at: true }).parse(nodesData[i]);

            const dup = await client.query(
              `SELECT id FROM lineage_nodes 
               WHERE schema_name = $1 AND table_name = $2 AND data_source_id = $3 AND deleted_at IS NULL`,
              [data.schema_name ?? null, data.table_name ?? null, data.data_source_id ?? null]
            );
            if ((dup.rows ?? []).length > 0) {
              errors.push({ index: i, error: `Duplicate node: ${data.schema_name}.${data.table_name}` });
              continue;
            }

            const ins = await client.query(
              `
              INSERT INTO lineage_nodes (
                label, type, data_source_id, schema_name, table_name,
                description, metadata, created_by, created_at, updated_at
              ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
              RETURNING id, label, type, data_source_id, schema_name, table_name,
                        description, metadata, created_at, updated_at, created_by
              `,
              [
                data.label,
                data.type,
                data.data_source_id ?? null,
                data.schema_name ?? null,
                data.table_name ?? null,
                data.description ?? null,
                JSON.stringify(data.metadata ?? {}),
                userId,
              ]
            );
            created.push(ins.rows[0] as LineageNode);
          } catch (e: unknown) {
            const err = toError(e);
            errors.push({ index: i, error: err.message || 'Unknown validation error' });
          }
        }
      });

      this.invalidateGraphCache();

      logger.info('Bulk node creation completed', {
        totalNodes: nodesData.length,
        created: created.length,
        errors: errors.length,
        userId,
        requestId: requestContext.requestId,
      });

      return { created, errors };
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('Failed to bulk create lineage nodes', {
        error: err.message,
        totalNodes: nodesData.length,
        userId,
        requestId: requestContext.requestId,
      });
      throw new LineageError('Failed to bulk create lineage nodes', 'BULK_NODE_CREATION_FAILED', 500);
    }
  }

  /* ── Stats ───────────────────────────────────────────────────────────── */

  async getLineageStats(
    dataSourceId?: string,
    requestContext: { userId?: string; requestId?: string } = {}
  ): Promise<{
    totalNodes: number;
    totalEdges: number;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
    orphanedNodes: number;
    cyclicalReferences: number;
    dataQualityScore: number;
    lastUpdated: Date;
  }> {
    // Where/params
    const whereClause = dataSourceId ? 'WHERE ln.data_source_id = $1 AND ln.deleted_at IS NULL' : 'WHERE ln.deleted_at IS NULL';
    const params = dataSourceId ? [dataSourceId] : [];

    try {
      const [nodeStats, edgeStats, orphanStats] = (await Promise.all([
        this.db.query(
          `
          SELECT type, COUNT(*)::int as count_by_type
          FROM lineage_nodes ln
          ${whereClause}
          GROUP BY type
          ORDER BY count_by_type DESC
          `,
          params
        ) as any,
        this.db.query(
          `
          SELECT le.relationship_type, COUNT(*)::int as count_by_type, AVG(le.confidence_score)::float as avg_confidence
          FROM lineage_edges le
          JOIN lineage_nodes ln_from ON le.from_id = ln_from.id
          JOIN lineage_nodes ln_to   ON le.to_id   = ln_to.id
          WHERE le.deleted_at IS NULL 
            AND ln_from.deleted_at IS NULL 
            AND ln_to.deleted_at IS NULL
            ${dataSourceId ? 'AND (ln_from.data_source_id = $1 OR ln_to.data_source_id = $1)' : ''}
          GROUP BY le.relationship_type
          `,
          params
        ) as any,
        this.db.query(
          `
          SELECT COUNT(*)::int as orphaned_count
          FROM lineage_nodes ln
          ${whereClause}
            AND NOT EXISTS (
              SELECT 1 FROM lineage_edges le 
              WHERE (le.from_id = ln.id OR le.to_id = ln.id) 
                AND le.deleted_at IS NULL
            )
          `,
          params
        ) as any,
      ])) as [any, any, any];

      const totalNodes = (nodeStats.rows ?? []).reduce((sum: number, row: any) => sum + toInt(row.count_by_type, 0), 0);
      const totalEdges = (edgeStats.rows ?? []).reduce((sum: number, row: any) => sum + toInt(row.count_by_type, 0), 0);

      const nodesByType = (nodeStats.rows ?? []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.type] = toInt(row.count_by_type, 0);
        return acc;
      }, {});

      const edgesByType = (edgeStats.rows ?? []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.relationship_type] = toInt(row.count_by_type, 0);
        return acc;
      }, {});

      const avgConfidence =
        (edgeStats.rows ?? []).reduce((sum: number, row: any) => sum + (Number(row.avg_confidence ?? 0.8) || 0.8), 0) /
        Math.max((edgeStats.rows ?? []).length, 1);

      const orphanedCount = toInt(orphanStats.rows?.[0]?.orphaned_count, 0);
      const orphanedRatio = totalNodes > 0 ? orphanedCount / totalNodes : 0;

      const dataQualityScore = Math.round((avgConfidence * 0.6 + (1 - orphanedRatio) * 0.4) * 100);

      logger.info('Lineage statistics retrieved', {
        totalNodes,
        totalEdges,
        dataQualityScore,
        dataSourceId,
        requestId: requestContext.requestId,
        userId: requestContext.userId,
      });

      return {
        totalNodes,
        totalEdges,
        nodesByType,
        edgesByType,
        orphanedNodes: orphanedCount,
        cyclicalReferences: 0, // detecting cycles requires a dedicated algorithm/query
        dataQualityScore,
        lastUpdated: new Date(),
      };
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('Failed to retrieve lineage statistics', {
        error: err.message,
        dataSourceId,
        requestId: requestContext.requestId,
        userId: requestContext.userId,
      });
      throw new LineageError('Failed to retrieve lineage statistics', 'STATS_RETRIEVAL_FAILED', 500);
    }
  }

  /* ── Manual Connection Creation ──────────────────────────────────────── */

  /**
   * Create a manual lineage connection - PRODUCTION VERSION
   * Persists to lineage_edges table with full validation
   */
  async createManualConnection(params: {
    sourceUrn: string;
    targetUrn: string;
    relationshipType: string;
    metadata?: Record<string, any>;
  }): Promise<LineageEdge> {
    const { sourceUrn, targetUrn, relationshipType, metadata } = params;

    try {
      logger.info('Creating manual lineage connection', {
        sourceUrn,
        targetUrn,
        relationshipType,
      });

      // 1. Validate and find source and target nodes
      const sourceNode = await this.findNodeByUrn(sourceUrn);
      const targetNode = await this.findNodeByUrn(targetUrn);

      if (!sourceNode) {
        throw new LineageError(
          `Source node not found: ${sourceUrn}`,
          'SOURCE_NODE_NOT_FOUND',
          404
        );
      }

      if (!targetNode) {
        throw new LineageError(
          `Target node not found: ${targetUrn}`,
          'TARGET_NODE_NOT_FOUND',
          404
        );
      }

      // 2. Map relationship type to valid enum value
      const validRelationshipType = this.mapToValidRelationshipType(relationshipType);

      // 3. Generate UUID for the edge
      const edgeId = createHash('sha256')
        .update(`${sourceNode.id}-${targetNode.id}-${Date.now()}`)
        .digest('hex')
        .substring(0, 36);

      // 4. Insert edge into database with transaction
      const edge = await withTransaction(this.db, async (client) => {
        const insertQuery = `
          INSERT INTO lineage_edges (
            id,
            from_id,
            to_id,
            relationship_type,
            transformation_logic,
            confidence_score,
            metadata,
            created_at,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
          RETURNING *
        `;

        const values = [
          edgeId,
          sourceNode.id,
          targetNode.id,
          validRelationshipType,
          'Manual connection created by user',
          1.0, // Manual connections have 100% confidence
          JSON.stringify({
            ...metadata,
            manual: true,
            sourceUrn,
            targetUrn,
            originalRelationshipType: relationshipType,
          }),
        ];

        const result = await client.query(insertQuery, values);

        if (!result.rows || result.rows.length === 0) {
          throw new LineageError(
            'Failed to insert manual connection',
            'INSERT_FAILED',
            500
          );
        }

        return result.rows[0];
      });

      // 5. Invalidate lineage cache
      this.invalidateGraphCache();

      logger.info('Manual lineage connection created successfully', {
        edgeId,
        sourceUrn,
        targetUrn,
      });

      // 6. Transform database row to LineageEdge type
      const lineageEdge: LineageEdge = {
        id: edge.id,
        from_id: edge.from_id,
        to_id: edge.to_id,
        relationship_type: edge.relationship_type,
        transformation_logic: edge.transformation_logic,
        confidence_score: edge.confidence_score,
        metadata: edge.metadata,
        created_at: edge.created_at,
        updated_at: edge.updated_at,
        created_by: edge.created_by,
      };

      return lineageEdge;
    } catch (e: unknown) {
      const err = toError(e);
      logger.error('Failed to create manual connection', {
        error: err.message,
        sourceUrn,
        targetUrn,
      });

      if (err instanceof LineageError) {
        throw err;
      }

      throw new LineageError(
        'Failed to create manual connection',
        'MANUAL_CONNECTION_FAILED',
        500
      );
    }
  }

  /**
   * Find a lineage node by URN (universal resource name)
   */
  private async findNodeByUrn(urn: string): Promise<LineageNode | null> {
    try {
      // Try to find by ID first (if URN is a UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      if (uuidRegex.test(urn)) {
        const result = await this.db.query(
          'SELECT * FROM lineage_nodes WHERE id = $1 AND deleted_at IS NULL',
          [urn]
        );

        if (result.rows && result.rows.length > 0) {
          return this.processNodes(result.rows, true)[0] || null;
        }
      }

      // Otherwise, search by label or metadata
      const result = await this.db.query(
        `SELECT * FROM lineage_nodes
         WHERE (label = $1 OR metadata->>'urn' = $1)
         AND deleted_at IS NULL
         LIMIT 1`,
        [urn]
      );

      if (result.rows && result.rows.length > 0) {
        return this.processNodes(result.rows, true)[0] || null;
      }

      return null;
    } catch (error) {
      logger.error('Failed to find node by URN', { urn, error });
      return null;
    }
  }

  /**
   * Map user-provided relationship type to valid enum value
   */
  private mapToValidRelationshipType(
    type: string
  ): 'derives_from' | 'transforms_to' | 'copies_from' | 'aggregates_from' {
    const lowerType = type.toLowerCase();

    const mappings: Record<string, 'derives_from' | 'transforms_to' | 'copies_from' | 'aggregates_from'> = {
      manual_reference: 'derives_from',
      reference: 'derives_from',
      derives: 'derives_from',
      transform: 'transforms_to',
      transformation: 'transforms_to',
      copy: 'copies_from',
      copies: 'copies_from',
      aggregate: 'aggregates_from',
      aggregation: 'aggregates_from',
    };

    return mappings[lowerType] || 'derives_from';
  }

  /* ── Private helpers ─────────────────────────────────────────────────── */

  private buildNodesQuery(filters: GraphFilters): { nodesQuery: string; nodesParams: any[] } {
    const where: string[] = ['ln.deleted_at IS NULL'];
    const params: any[] = [];
    let i = 1;

    if (filters.dataSourceId) {
      where.push(`ln.data_source_id = $${i++}`);
      params.push(filters.dataSourceId);
    }

    if (filters.nodeTypes && filters.nodeTypes.length > 0) {
      where.push(`ln.type = ANY($${i++})`);
      params.push(filters.nodeTypes);
    }

    const selectFields = filters.includeMetadata
      ? 'ln.id, ln.label, ln.type, ln.data_source_id, ln.schema_name, ln.table_name, ln.description, ln.metadata, ln.created_at, ln.updated_at'
      : 'ln.id, ln.label, ln.type, ln.data_source_id, ln.schema_name, ln.table_name';

    const nodesQuery = `
      SELECT ${selectFields}
      FROM lineage_nodes ln
      WHERE ${where.join(' AND ')}
      ORDER BY ln.type, ln.label
      LIMIT $${i++}
    `;
    params.push(filters.limit);

    return { nodesQuery, nodesParams: params };
  }

  private buildEdgesQuery(filters: GraphFilters): { edgesQuery: string; edgesParams: any[] } {
    const where: string[] = ['le.deleted_at IS NULL'];
    const params: any[] = [];
    let i = 1;

    if (filters.relationshipTypes && filters.relationshipTypes.length > 0) {
      where.push(`le.relationship_type = ANY($${i++})`);
      params.push(filters.relationshipTypes);
    }

    if (filters.dataSourceId) {
      where.push(`(
        EXISTS(SELECT 1 FROM lineage_nodes ln WHERE ln.id = le.from_id AND ln.data_source_id = $${i}) OR
        EXISTS(SELECT 1 FROM lineage_nodes ln WHERE ln.id = le.to_id   AND ln.data_source_id = $${i})
      )`);
      params.push(filters.dataSourceId);
      i++;
    }

    const selectFields = filters.includeMetadata
      ? 'le.id, le.from_id, le.to_id, le.relationship_type, le.transformation_logic, le.confidence_score, le.metadata, le.created_at, le.updated_at'
      : 'le.id, le.from_id, le.to_id, le.relationship_type';

    const edgesQuery = `
      SELECT ${selectFields}
      FROM lineage_edges le
      WHERE ${where.join(' AND ')}
      ORDER BY le.from_id, le.to_id
      LIMIT $${i++}
    `;
    params.push(filters.limit);

    return { edgesQuery, edgesParams: params };
  }

  private buildPathQuery(config: LineagePath): { query: string; params: any[] } {
    const join = this.getDirectionClause(config.direction);
    const nodeJoin = this.getNodeJoinCondition(config.direction);

    const query = `
      WITH RECURSIVE lineage_paths AS (
        SELECT 
          ln.id, ln.label, ln.type,
          ARRAY[ln.id] as path_nodes,
          ARRAY[]::uuid[] as path_edges,
          0 as depth,
          1.0 as confidence
        FROM lineage_nodes ln
        WHERE ln.id = $1 AND ln.deleted_at IS NULL
        UNION ALL
        SELECT 
          ln.id, ln.label, ln.type,
          lp.path_nodes || ln.id,
          lp.path_edges || le.id,
          lp.depth + 1,
          lp.confidence * COALESCE(le.confidence_score, 0.8)
        FROM lineage_paths lp
        JOIN lineage_edges le ${join}
        JOIN lineage_nodes ln ON ${nodeJoin}
        WHERE lp.depth < $3
          AND ln.deleted_at IS NULL
          AND le.deleted_at IS NULL
          AND NOT (ln.id = ANY(lp.path_nodes))
      )
      SELECT * FROM lineage_paths 
      WHERE id = $2 AND depth > 0
      ORDER BY depth, confidence DESC;
    `;

    return { query, params: [config.startNodeId, config.endNodeId, config.maxDepth] };
  }

  private getDirectionClause(direction: string): string {
    switch (direction) {
      case 'upstream':
        return 'ON le.to_id = lp.id';
      case 'downstream':
        return 'ON le.from_id = lp.id';
      case 'both':
      default:
        return 'ON (le.from_id = lp.id OR le.to_id = lp.id)';
    }
  }

  private getNodeJoinCondition(direction: string): string {
    switch (direction) {
      case 'upstream':
        return 'ln.id = le.from_id';
      case 'downstream':
        return 'ln.id = le.to_id';
      case 'both':
      default:
        return '(ln.id = le.to_id OR ln.id = le.from_id) AND ln.id != lp.id';
    }
  }

  private async validateNodesExist(nodeIds: string[]): Promise<void> {
    const res = (await this.db.query(
      'SELECT id FROM lineage_nodes WHERE id = ANY($1) AND deleted_at IS NULL',
      [nodeIds]
    )) as any;

    const found = new Set<string>((res.rows ?? []).map((r: any) => r.id as string));
    const missing = nodeIds.filter((id) => !found.has(id));
    if (missing.length > 0) throw new LineageNotFoundError('Lineage nodes', missing.join(', '));
  }

  private processNodes(rows: any[], includeMetadata: boolean): LineageNode[] {
    return rows.map((row: any) => ({
      id: row.id,
      label: row.label,
      type: row.type,
      data_source_id: row.data_source_id ?? undefined,
      schema_name: row.schema_name ?? undefined,
      table_name: row.table_name ?? undefined,
      ...(includeMetadata
        ? {
            description: row.description ?? undefined,
            metadata: row.metadata ?? undefined,
            created_at: row.created_at ?? undefined,
            updated_at: row.updated_at ?? undefined,
          }
        : {}),
    }));
  }

  private processEdges(rows: any[]): LineageEdge[] {
    return rows.map((row: any) => ({
      id: row.id,
      from_id: row.from_id,
      to_id: row.to_id,
      relationship_type: row.relationship_type,
      transformation_logic: row.transformation_logic ?? undefined,
      confidence_score: typeof row.confidence_score === 'number' ? row.confidence_score : undefined,
      metadata: row.metadata ?? undefined,
      created_at: row.created_at ?? undefined,
      updated_at: row.updated_at ?? undefined,
    }));
  }

  private processPaths(rows: any[]): Array<{ nodes: LineageNode[]; edges: LineageEdge[]; pathLength: number; confidence: number }> {
    return rows.map((row: any) => ({
      // If you need full nodes/edges, fetch by ids in row.path_nodes / row.path_edges
      nodes: [],
      edges: [],
      pathLength: toInt(row.depth, 0),
      confidence: Number(row.confidence ?? 0),
    }));
  }

  private findShortestPath<T extends { pathLength: number }>(paths: T[]): T | undefined {
    return paths.reduce<T | undefined>((shortest, current) => {
      if (!shortest) return current;
      return current.pathLength < shortest.pathLength ? current : shortest;
    }, undefined);
  }

  private analyzeCriticality(nodes: LineageNode[]): Array<{ path: LineageNode[]; criticality: 'high' | 'medium' | 'low'; reason: string }> {
    return nodes
      .filter((n) => n.type === 'gold')
      .map((n) => ({ path: [n], criticality: 'high' as const, reason: 'Production gold-tier data asset' }));
  }

  private generateRecommendations(affectedNodes: LineageNode[], criticalPaths: Array<{ path: LineageNode[] }>): string[] {
    const rec: string[] = [];
    if (affectedNodes.length > 50) rec.push('High impact change detected. Consider phased deployment approach.');
    if (criticalPaths.length > 0) rec.push('Critical production assets affected. Coordinate with data consumers before deployment.');
    const goldCount = affectedNodes.filter((n) => n.type === 'gold').length;
    if (goldCount > 0) rec.push(`${goldCount} gold-tier assets affected. Ensure data quality validation.`);
    rec.push('Review and update documentation for affected assets.');
    rec.push('Schedule stakeholder notifications before implementing changes.');
    return rec;
    }

  private generateGraphMetadata(nodes: LineageNode[], edges: LineageEdge[], queryDurationMs: number): Omit<LineageGraph['metadata'], 'cacheHit'> {
    const nodeTypeDistribution = nodes.reduce<Record<string, number>>((acc, n) => {
      acc[n.type] = (acc[n.type] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypeDistribution,
      maxDepthReached: this.calculateMaxDepth(nodes, edges),
      queryDuration: Math.round(queryDurationMs),
    };
  }

  private calculateMaxDepth(nodes: LineageNode[], edges: LineageEdge[]): number {
    if (nodes.length === 0 || edges.length === 0) return 0;

    const incoming = new Set<string>(edges.map((e) => e.to_id));
    const sources = nodes.filter((n) => !incoming.has(n.id));
    if (sources.length === 0) return 0;

    let maxDepth = 0;
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; depth: number }> = sources.map((s) => ({ nodeId: s.id, depth: 0 }));

    while (queue.length) {
      const current = queue.shift()!;
      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);
      maxDepth = Math.max(maxDepth, current.depth);

      const children = edges.filter((e) => e.from_id === current.nodeId).map((e) => e.to_id);
      for (const nextId of children) {
        if (!visited.has(nextId)) queue.push({ nodeId: nextId, depth: current.depth + 1 });
      }
    }
    return maxDepth;
  }

  /* ── Cache ───────────────────────────────────────────────────────────── */

  private generateCacheKey(operation: string, filters: any): string {
    const filterString = JSON.stringify(filters, Object.keys(filters).sort());
    return createHash('md5').update(`${operation}:${filterString}`).digest('hex');
  }

  private getCachedResult(key: string): any | null {
    const cached = this.queryCache.get(key);
    if (!cached) return null;
    const now = Date.now();
    if (now - cached.timestamp > cached.ttl) {
      this.queryCache.delete(key);
      return null;
    }
    return cached.data;
  }

  private setCachedResult(key: string, data: any, ttl: number): void {
    if (this.queryCache.size >= this.maxCacheSize) {
      const oldestKey: string | undefined = this.queryCache.keys().next().value;
      if (typeof oldestKey === 'string') this.queryCache.delete(oldestKey);
    }
    this.queryCache.set(key, { data, timestamp: Date.now(), ttl });
  }

  private invalidateGraphCache(): void {
    for (const k of Array.from(this.queryCache.keys())) {
      if (k.startsWith('graph:')) this.queryCache.delete(k);
    }
  }

  private setupCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.queryCache) {
        if (now - entry.timestamp > entry.ttl) this.queryCache.delete(key);
      }
    }, 300000).unref();
  }

  /* ── Build Demo Graph from Assets ─────────────────────────────────────── */

  async buildDemoGraph(dataSourceId?: string): Promise<LineageGraph> {
    try {
      // Fetch assets from the catalog (using correct column names from catalog_assets table)
      // Filter system tables and optionally by data source
      const params: any[] = [];
      let whereClause = `WHERE asset_type IN ('table', 'view')`;

      // Filter out system/internal tables
      whereClause += ` AND schema_name NOT IN ('information_schema', 'pg_catalog', 'sys')`;
      whereClause += ` AND table_name NOT LIKE 'pg_%'`;
      whereClause += ` AND table_name NOT LIKE 'sql_%'`;

      if (dataSourceId) {
        whereClause += ` AND datasource_id = $1`;
        params.push(dataSourceId);
      }

      const assetsQuery = `
        SELECT
          id::text,
          table_name as name,
          asset_type as type,
          datasource_id::text as data_source_id,
          schema_name,
          table_name,
          description,
          row_count,
          column_count,
          trust_score,
          quality_score,
          updated_at
        FROM catalog_assets
        ${whereClause}
        ORDER BY schema_name, table_name
        LIMIT 100
      `;

      const assetsRes = (await this.db.query(assetsQuery, params)) as any;
      const assets = assetsRes.rows ?? [];

      logger.info('Assets fetched for lineage', { count: assets.length, dataSourceId });

      // Build nodes from assets with enriched metadata
      const nodes: LineageNode[] = assets.map((asset: any) => ({
        id: asset.id,
        label: asset.name || asset.table_name || 'Unknown',
        type: this.mapAssetTypeToLineageType(asset.type),
        data_source_id: asset.data_source_id,
        schema_name: asset.schema_name,
        table_name: asset.table_name || asset.name,
        description: asset.description,
        metadata: {
          rowCount: asset.row_count ? Number(asset.row_count) : undefined,
          columnCount: asset.column_count ? Number(asset.column_count) : undefined,
          trustScore: asset.trust_score ? Number(asset.trust_score) : undefined,
          quality_score: asset.quality_score ? Number(asset.quality_score) : undefined,
          lastUpdated: asset.updated_at,
          schema: asset.schema_name,
          tableName: asset.table_name,
        },
      }));

      // Build edges from Foreign Key relationships in catalog_columns
      const nodeIds = nodes.map(n => n.id);
      const assetIdToTable = new Map(nodes.map(n => [n.id, { schema: n.schema_name, table: n.table_name }]));
      const tableToAssetId = new Map(nodes.map(n => [`${n.schema_name}.${n.table_name}`, n.id]));

      let edges: LineageEdge[] = [];

      if (nodeIds.length > 0 && dataSourceId) {
        // Query foreign key relationships from catalog_columns
        // This will give us real FK-based lineage connections
        const fkQuery = `
          SELECT DISTINCT
            cc.asset_id::text as source_asset_id,
            ca_ref.id::text as target_asset_id,
            cc.column_name as source_column,
            cc.foreign_key_column as target_column,
            cc.foreign_key_table as referenced_table
          FROM catalog_columns cc
          JOIN catalog_assets ca ON ca.id = cc.asset_id
          JOIN catalog_assets ca_ref ON ca_ref.table_name = cc.foreign_key_table
            AND ca_ref.schema_name = ca.schema_name
            AND ca_ref.datasource_id = ca.datasource_id
          WHERE cc.is_foreign_key = true
            AND cc.foreign_key_table IS NOT NULL
            AND cc.asset_id = ANY($1)
            AND ca_ref.id = ANY($1)
          LIMIT 200
        `;

        try {
          const fkRes = (await this.db.query(fkQuery, [nodeIds])) as any;
          const fkRows = fkRes.rows ?? [];

          logger.info('Foreign keys fetched for lineage', { count: fkRows.length, dataSourceId });

          edges = fkRows.map((row: any) => ({
            id: `fk_${row.source_asset_id}_${row.target_asset_id}_${row.source_column}`,
            from_id: row.source_asset_id,
            to_id: row.target_asset_id,
            relationship_type: 'derives_from' as const,
            confidence_score: 1.0, // FK relationships have 100% confidence
            metadata: {
              transformation: `${row.source_column} → ${row.target_column}`,
              relationship: 'foreign_key',
              sourceColumn: row.source_column,
              targetColumn: row.target_column,
            },
          }));
        } catch (error: any) {
          logger.warn('Could not fetch FK relationships', {
            error: error.message,
            code: error.code,
            dataSourceId
          });
        }
      }

      // Fallback: If still no edges, try to query from data_lineage table
      if (edges.length === 0 && nodeIds.length > 0) {
        try {
          const lineageQuery = `
            SELECT
              dl.id::text,
              dl.source_asset_id::text as from_id,
              dl.target_asset_id::text as to_id,
              dl.lineage_type,
              dl.confidence_score,
              dl.transformation_logic
            FROM data_lineage dl
            WHERE dl.source_asset_id = ANY($1)
              AND dl.target_asset_id = ANY($1)
              AND dl.deleted_at IS NULL
            LIMIT 200
          `;

          const edgesRes = (await this.db.query(lineageQuery, [nodeIds])) as any;
          edges = (edgesRes.rows ?? []).map((row: any) => ({
            id: row.id,
            from_id: row.from_id,
            to_id: row.to_id,
            relationship_type: this.mapLineageTypeToRelationship(row.lineage_type),
            confidence_score: row.confidence_score || 0.8,
            metadata: {
              transformation: row.transformation_logic,
              lineageType: row.lineage_type,
            },
          }));

          logger.info('Edges from data_lineage table', { count: edges.length });
        } catch (error: any) {
          logger.warn('Could not fetch data_lineage edges', { error: error.message });
        }
      }

      logger.info('Edges generated for lineage', {
        count: edges.length,
        fkBased: edges.filter(e => e.id.startsWith('fk_')).length,
        dataSourceId
      });

      const metadata = this.generateGraphMetadata(nodes, edges, 0);

      return {
        nodes,
        edges,
        metadata: { ...metadata, cacheHit: false },
      };
    } catch (error: any) {
      logger.error('Failed to build demo graph', {
        error: error.message,
        stack: error.stack,
        code: error.code
      });
      return {
        nodes: [],
        edges: [],
        metadata: {
          totalNodes: 0,
          totalEdges: 0,
          nodeTypeDistribution: {},
          maxDepthReached: 0,
          queryDuration: 0,
          cacheHit: false,
        },
      };
    }
  }

  private mapAssetTypeToLineageType(assetType: string): 'source' | 'bronze' | 'silver' | 'gold' | 'transformation' | 'sink' {
    // Return the original asset type for frontend compatibility
    // The frontend expects: 'database', 'schema', 'table', 'column', 'view', 'procedure', 'function'
    // So we keep table as table, view as view, etc.
    return assetType.toLowerCase() as any;
  }

  private mapLineageTypeToRelationship(lineageType: string): 'derives_from' | 'transforms_to' | 'copies_from' | 'aggregates_from' {
    const typeMap: Record<string, 'derives_from' | 'transforms_to' | 'copies_from' | 'aggregates_from'> = {
      'derived': 'derives_from',
      'transformed': 'transforms_to',
      'copied': 'copies_from',
      'aggregated': 'aggregates_from',
    };
    return typeMap[lineageType?.toLowerCase()] || 'derives_from';
  }

  /* ── Column-Level Lineage ─────────────────────────────────────────────── */

  async getColumnLineage(
    assetId: string,
    columnName: string,
    depth: number = 2,
    requestContext: { userId?: string; requestId?: string } = {}
  ): Promise<{
    nodes: Array<{ id: string; label: string; type: string; columnName: string; tableName: string; metadata?: any }>;
    edges: Array<{
      id: string;
      source: string;
      target: string;
      sourceColumn: string;
      targetColumn: string;
      transformation?: string;
      confidence: number;
    }>;
  }> {
    try {
      // Get the asset details
      const assetQuery = `
        SELECT id, name, table_name, schema_name, data_source_id
        FROM assets
        WHERE id = $1
      `;
      const assetRes = (await this.db.query(assetQuery, [assetId])) as any;
      if (!assetRes.rows || assetRes.rows.length === 0) {
        throw new LineageNotFoundError('Asset', assetId);
      }
      const asset = assetRes.rows[0];

      // Get column details
      const columnQuery = `
        SELECT
          cc.column_name,
          cc.data_type,
          cc.is_primary_key,
          cc.is_foreign_key,
          cc.referenced_table,
          cc.referenced_column
        FROM catalog_columns cc
        WHERE cc.table_name = $1 AND cc.column_name = $2
        LIMIT 1
      `;
      const columnRes = (await this.db.query(columnQuery, [asset.table_name, columnName])) as any;
      if (!columnRes.rows || columnRes.rows.length === 0) {
        throw new LineageNotFoundError('Column', columnName);
      }
      const column = columnRes.rows[0];

      // Build nodes and edges for column lineage
      const nodes: any[] = [
        {
          id: `${assetId}_${columnName}`,
          label: columnName,
          type: 'column',
          columnName: columnName,
          tableName: asset.table_name || asset.name,
          metadata: {
            dataType: column.data_type,
            isPrimaryKey: column.is_primary_key,
            isForeignKey: column.is_foreign_key,
          },
        },
      ];

      const edges: any[] = [];

      // If this is a foreign key, add the referenced column
      if (column.is_foreign_key && column.referenced_table && column.referenced_column) {
        const refAssetQuery = `
          SELECT id, name, table_name
          FROM assets
          WHERE table_name = $1
          LIMIT 1
        `;
        const refAssetRes = (await this.db.query(refAssetQuery, [column.referenced_table])) as any;

        if (refAssetRes.rows && refAssetRes.rows.length > 0) {
          const refAsset = refAssetRes.rows[0];
          const refNodeId = `${refAsset.id}_${column.referenced_column}`;

          nodes.push({
            id: refNodeId,
            label: column.referenced_column,
            type: 'column',
            columnName: column.referenced_column,
            tableName: column.referenced_table,
            metadata: {
              isPrimaryKey: true,
            },
          });

          edges.push({
            id: `${assetId}_${columnName}_to_${refNodeId}`,
            source: `${assetId}_${columnName}`,
            target: refNodeId,
            sourceColumn: columnName,
            targetColumn: column.referenced_column,
            transformation: 'Foreign Key Reference',
            confidence: 1.0,
          });
        }
      }

      // Find columns that reference this column (reverse FK)
      const reverseRefQuery = `
        SELECT DISTINCT
          cc.table_name,
          cc.column_name,
          cc.data_type,
          a.id as asset_id
        FROM catalog_columns cc
        JOIN assets a ON a.table_name = cc.table_name
        WHERE cc.referenced_table = $1 AND cc.referenced_column = $2
        LIMIT 10
      `;
      const reverseRefRes = (await this.db.query(reverseRefQuery, [asset.table_name, columnName])) as any;

      if (reverseRefRes.rows) {
        for (const refRow of reverseRefRes.rows) {
          const refNodeId = `${refRow.asset_id}_${refRow.column_name}`;

          nodes.push({
            id: refNodeId,
            label: refRow.column_name,
            type: 'column',
            columnName: refRow.column_name,
            tableName: refRow.table_name,
            metadata: {
              dataType: refRow.data_type,
              isForeignKey: true,
            },
          });

          edges.push({
            id: `${refNodeId}_to_${assetId}_${columnName}`,
            source: refNodeId,
            target: `${assetId}_${columnName}`,
            sourceColumn: refRow.column_name,
            targetColumn: columnName,
            transformation: 'Foreign Key Reference',
            confidence: 1.0,
          });
        }
      }

      logger.info('Column lineage retrieved', {
        assetId,
        columnName,
        nodesCount: nodes.length,
        edgesCount: edges.length,
        requestId: requestContext.requestId,
      });

      return { nodes, edges };
    } catch (error) {
      const err = toError(error);
      logger.error('Failed to get column lineage', {
        error: err.message,
        assetId,
        columnName,
        requestId: requestContext.requestId,
      });
      if (err instanceof LineageError) throw err;
      throw new LineageError('Failed to get column lineage', 'COLUMN_LINEAGE_FAILED', 500);
    }
  }
}

/** Optional singleton export if you prefer DI */
export const lineageService = new LineageService();
