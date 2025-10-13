import { useQuery } from '@tanstack/react-query';
import { lineageApi } from '@/services/api/lineage';
import type { LineageProvenanceResult } from '@/types/lineage';

export const lineageProvenanceKey = (urn: string | null) => ['lineage', 'provenance', urn ?? 'none'];

export function useLineageProvenance(urn: string | null, enabled = true) {
  return useQuery<LineageProvenanceResult>({
    queryKey: lineageProvenanceKey(urn),
    queryFn: () => lineageApi.provenance({ urn: urn as string }),
    enabled: Boolean(urn) && enabled,
  });
}
