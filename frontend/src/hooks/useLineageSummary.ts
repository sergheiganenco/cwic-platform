import { useQuery } from '@tanstack/react-query';
import { lineageApi } from '@/services/api/lineage';
import type { LineageScope, LineageSummary } from '@/types/lineage';

export const lineageSummaryKey = (scope: LineageScope, dataSourceId?: string) => [
  'lineage',
  'summary',
  scope,
  dataSourceId ?? 'all',
];

export function useLineageSummary(scope: LineageScope, dataSourceId?: string, limit = 50) {
  return useQuery<LineageSummary>({
    queryKey: lineageSummaryKey(scope, dataSourceId),
    queryFn: () => lineageApi.summary({ scope, dataSourceId, limit }),
    keepPreviousData: true,
  });
}
