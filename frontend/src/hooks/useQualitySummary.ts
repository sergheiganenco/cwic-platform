// src/hooks/useQualitySummary.ts
import { useCallback, useEffect, useMemo, useState } from 'react';

type Timeframe = '24h' | '7d' | '30d' | '90d';

export interface QualitySummarySource {
  id: string | null;
  name: string;
  type: string | null;
  typeLabel: string;
  host: string | null;
  status: string | null;
  totalAssets: number;
  monitoredAssets: number;
  totalChecks: number;
  passed: number;
  failed: number;
  error: number;
  skipped: number;
  timeout: number;
  passRate: number;
  lastRunAt: string | null;
  ruleCount: number;
}

export interface QualitySummaryTotals {
  totalChecks: number;
  passed: number;
  failed: number;
  error: number;
  skipped: number;
  timeout: number;
  passRate: number;
  avgExecMs: number;
  overallScore: number;
}

export interface QualitySummary {
  timeframe: Timeframe;
  from: string;
  to: string;
  totals: QualitySummaryTotals;
  statusBreakdown: Array<{ key: string; count: number }>;
  sourceBreakdown: QualitySummarySource[];
  ruleCounts: {
    total: number;
    active: number;
    disabled: number;
  };
  assetCoverage: {
    totalAssets: number;
    monitoredAssets: number;
  };
  unassigned: QualitySummarySource | null;
}

interface UseQualitySummaryOptions {
  timeframe?: Timeframe;
  filters?: Record<string, string | number | undefined>;
  enabled?: boolean;
  refreshInterval?: number; // ms; optional auto-refresh
}

const mockSummary: QualitySummary = {
  timeframe: '7d',
  from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  to: new Date().toISOString(),
  totals: {
    totalChecks: 0,
    passed: 0,
    failed: 0,
    error: 0,
    skipped: 0,
    timeout: 0,
    passRate: 0,
    avgExecMs: 0,
    overallScore: 0,
  },
  statusBreakdown: [],
  sourceBreakdown: [],
  ruleCounts: { total: 0, active: 0, disabled: 0 },
  assetCoverage: { totalAssets: 0, monitoredAssets: 0 },
  unassigned: null,
};

export function useQualitySummary(opts: UseQualitySummaryOptions = {}) {
  const {
    timeframe = '7d',
    filters = {},
    enabled = true,
    refreshInterval = 0,
  } = opts;
  const [data, setData] = useState<QualitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams({ timeframe });
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        qs.set(key, String(value));
      }
    });
    return qs.toString();
  }, [filters, timeframe]);

  const fetcher = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);

    const allowMocks = import.meta.env.VITE_USE_MOCKS === '1';

    try {
      const res = await fetch(`/api/quality/summary?${queryString}`, {
        headers: { accept: 'application/json' },
        credentials: 'include',
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
      const payload = (json?.data ?? json) as QualitySummary;
      setData(payload);
    } catch (e: any) {
      if (allowMocks) {
        console.warn('[useQualitySummary] Falling back to mock data:', e?.message || e);
        setData(mockSummary);
      } else {
        setError(e?.message || 'Failed to load quality summary');
      }
    } finally {
      setIsLoading(false);
    }
  }, [enabled, queryString]);

  useEffect(() => {
    fetcher();
  }, [fetcher]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const id = setInterval(fetcher, refreshInterval);
      return () => clearInterval(id);
    }
    return undefined;
  }, [refreshInterval, fetcher]);

  return { data, isLoading, error, refresh: fetcher };
}
