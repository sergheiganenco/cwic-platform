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
  type: z.enum(['source', 'bronze', 'silver', 'gold', 'transformation', 'sink']),
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
  nodeTypes: z.array(z.enum(['source', 'bronze', 'silver', 'gold', 'transformation', 'sink'])).optional(),
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
}

/** Optional singleton export if you prefer DI */
export const lineageService = new LineageService();
