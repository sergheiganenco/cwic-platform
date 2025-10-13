import { useQuery } from '@tanstack/react-query';
import { lineageApi } from '@/services/api/lineage';
import type { LineageRingResult } from '@/types/lineage';

export const lineageDrillKey = (params: {
  urn: string | null;
  depth: number;
  direction: 'upstream' | 'downstream' | 'both';
  limit: number;
}) => ['lineage', 'drill', params.urn ?? 'none', params.depth, params.direction, params.limit];

export function useLineageDrill(
  params: { urn: string | null; depth?: number; direction?: 'upstream' | 'downstream' | 'both'; limit?: number },
  enabled = true,
) {
  const { urn, depth = 1, direction = 'both', limit = 200 } = params;
  return useQuery<LineageRingResult>({
    queryKey: lineageDrillKey({ urn, depth, direction, limit }),
    queryFn: () => lineageApi.drill({ urn: urn as string, depth, direction, limit }),
    enabled: Boolean(urn) && enabled,
  });
}
