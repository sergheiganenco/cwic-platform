export type LineageScope = 'system' | 'database' | 'schema' | 'object' | 'column' | 'process' | 'semantic';

export interface LineageSummaryNode {
  urn: string;
  label: string;
  type: string;
  layer: number;
  aliases: string[];
  description?: string;
  confidence?: number | null;
  freshnessHours?: number | null;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

export interface LineageSummaryMetrics {
  totalNodes: number;
  totalEdges: number;
  orphanedNodes: number;
  completeness: number;
  averageConfidence: number;
  freshnessHoursP90: number | null;
}

export interface LineageSummary {
  scope: LineageScope;
  layer: number;
  nodes: LineageSummaryNode[];
  metrics: LineageSummaryMetrics;
}

export interface LineageEdge {
  edgeId: string;
  from: string;
  to: string;
  relationshipType: string;
  operationKind?: string | null;
  confidence?: number | null;
  metadata: Record<string, unknown>;
}

export interface LineageRingResult {
  focus: LineageSummaryNode;
  nodes: LineageSummaryNode[];
  edges: LineageEdge[];
}

export interface LineageImpactNode {
  urn: string;
  label: string;
  depth: number;
  type: string;
  confidence?: number | null;
  metadata: Record<string, unknown>;
}

export interface LineageImpactResult {
  origin: LineageSummaryNode;
  impacted: LineageImpactNode[];
  criticalityScore: number;
}

export interface LineageProvenanceItem {
  runId: string;
  connector?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  status?: string | null;
  metadata?: Record<string, unknown>;
}

export interface LineageProvenanceResult {
  urn: string;
  versionSignature?: string | null;
  provenance: LineageProvenanceItem[];
}
