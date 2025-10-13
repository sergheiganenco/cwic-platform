import { Badge } from '@components/ui/Badge';
import type { LineageEdge, LineageSummaryNode } from '@/types/lineage';

export const lineageConfidenceTone = (confidence?: number | null) => {
  if (confidence == null) return 'bg-gray-100 text-gray-700';
  if (confidence >= 0.85) return 'bg-green-100 text-green-700';
  if (confidence >= 0.65) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
};

interface LineagePreviewListProps {
  title: string;
  edges: LineageEdge[];
  nodes: LineageSummaryNode[];
  neighbour: 'from' | 'to';
  emptyLabel: string;
}

export function LineagePreviewList({
  title,
  edges,
  nodes,
  neighbour,
  emptyLabel,
}: LineagePreviewListProps): JSX.Element {
  const items = edges
    .map((edge) => {
      const urn = neighbour === 'from' ? edge.from : edge.to;
      const node = nodes.find((n) => n.urn === urn);
      return node ? { edge, node } : null;
    })
    .filter((entry): entry is { edge: LineageEdge; node: LineageSummaryNode } => Boolean(entry));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      <div className="mt-3 flex max-h-52 flex-col gap-3 overflow-auto pr-1">
        {items.map(({ edge, node }) => (
          <div key={edge.edgeId} className="rounded border border-gray-200 bg-gray-50/70 p-3">
            <div className="flex items-center justify-between text-sm font-medium text-gray-900">
              <span className="truncate">{node.label}</span>
              <Badge tone="neutral">{edge.relationshipType.replace(/_/g, ' ')}</Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-gray-600">{node.urn}</p>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
              <span className={`rounded px-2 py-0.5 ${lineageConfidenceTone(edge.confidence ?? node.confidence)}`}>
                {(edge.confidence ?? node.confidence ?? 0).toFixed(2)}
              </span>
              {edge.operationKind && <span>{edge.operationKind}</span>}
            </div>
          </div>
        ))}
        {!items.length && (
          <div className="rounded border border-dashed border-gray-200 p-6 text-center text-xs text-gray-500">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
