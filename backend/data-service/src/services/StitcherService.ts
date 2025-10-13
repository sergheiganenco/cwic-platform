import { lineageService } from './LineageService';

export interface StitcherPayload {
  nodes?: Array<Record<string, any>>;
  edges?: Array<Record<string, any>>;
}

export class LineageStitcherService {
  async ingest(payload: StitcherPayload, context: { userId?: string; requestId?: string } = {}) {
    const results = { nodes: 0, edges: 0 };
    if (payload.nodes?.length) {
      results.nodes = await lineageService.upsertNodes(payload.nodes, context);
    }
    if (payload.edges?.length) {
      results.edges = await lineageService.upsertEdges(payload.edges, context);
    }
    return results;
  }
}

export const lineageStitcherService = new LineageStitcherService();
