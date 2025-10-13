import { useQuery } from '@tanstack/react-query';
import { lineageApi } from '@/services/api/lineage';
import type { LineageImpactResult } from '@/types/lineage';

export const lineageImpactsKey = (urn: string | null, radius: number, limit: number) => [
  'lineage',
  'impacts',
  urn ?? 'none',
  radius,
  limit,
];

export function useLineageImpacts(params: { urn: string | null; radius?: number; limit?: number }, enabled = true) {
  const { urn, radius = 3, limit = 500 } = params;
  return useQuery<LineageImpactResult>({
    queryKey: lineageImpactsKey(urn, radius, limit),
    queryFn: () => lineageApi.impacts({ urn: urn as string, radius, limit }),
    enabled: Boolean(urn) && enabled,
  });
}
