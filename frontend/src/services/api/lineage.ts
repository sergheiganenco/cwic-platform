import http from '@/services/http';
import type {
  LineageImpactResult,
  LineageProvenanceResult,
  LineageRingResult,
  LineageScope,
  LineageSummary,
} from '@/types/lineage';

export const lineageApi = {
  async summary(params: { scope?: LineageScope; limit?: number; dataSourceId?: string }) {
    const { data } = await http.get<{ success: boolean; data: LineageSummary }>('/lineage/summary', {
      params,
    });
    return data.data;
  },
  async drill(params: { urn: string; depth?: number; direction?: 'upstream' | 'downstream' | 'both'; limit?: number }) {
    const { data } = await http.get<{ success: boolean; data: LineageRingResult }>('/lineage/drill', {
      params,
    });
    return data.data;
  },
  async impacts(params: { urn: string; radius?: number; limit?: number }) {
    const { data } = await http.get<{ success: boolean; data: LineageImpactResult }>('/lineage/impacts', {
      params,
    });
    return data.data;
  },
  async provenance(params: { urn: string }) {
    const { data } = await http.get<{ success: boolean; data: LineageProvenanceResult }>('/lineage/provenance', {
      params,
    });
    return data.data;
  },
  async upsertNodes(payload: any[]) {
    const { data } = await http.post<{ success: boolean; data: { count: number } }>('/lineage/nodes', payload);
    return data.data;
  },
  async upsertEdges(payload: any[]) {
    const { data } = await http.post<{ success: boolean; data: { count: number } }>('/lineage/edges', payload);
    return data.data;
  },
  async ingest(payload: { nodes?: any[]; edges?: any[] }) {
    const { data } = await http.post<{ success: boolean; data: { nodes: number; edges: number } }>('/lineage/ingest', payload);
    return data.data;
  },
};
