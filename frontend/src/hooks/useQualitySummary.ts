// src/hooks/useQualitySummary.ts
import { useCallback, useEffect, useState } from 'react';

export interface QualitySummary {
  assetsScored: number;
  overallScore: number; // 0–100
  passedChecks: number;
  failedChecks: number;
  warnings: number;
  byDimension: Record<'accuracy'|'completeness'|'consistency'|'timeliness'|'uniqueness'|'validity', number>;
}

interface UseQualitySummaryOptions {
  filters?: { dataSourceId?: string; owner?: string; classification?: string };
  enabled?: boolean;
  refreshInterval?: number; // ms; disabled in dev
}

const mock: QualitySummary = {
  assetsScored: 412,
  overallScore: 82,
  passedChecks: 1245,
  failedChecks: 97,
  warnings: 186,
  byDimension: {
    accuracy: 79,
    completeness: 85,
    consistency: 81,
    timeliness: 76,
    uniqueness: 88,
    validity: 84
  }
};

export function useQualitySummary(opts: UseQualitySummaryOptions = {}) {
  const { filters = {}, enabled = true, refreshInterval = 0 } = opts;
  const [data, setData] = useState<QualitySummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) qs.set(k, String(v));
      });

      if (import.meta.env.MODE === 'development') {
        await new Promise(r => setTimeout(r, 500));
        setData(mock);
        return;
      }

      const res = await fetch(`/api/quality/summary?${qs.toString()}`, { headers: { accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as QualitySummary;
      setData(json);
    } catch (e: any) {
      const useMocks = import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_MOCKS !== '0';
     if (useMocks) {
        console.warn('quality/summary not available, using mock');
        setData(mock);
      } else {
        setError(e?.message || 'Failed to load quality summary');
      }
    } finally {
      setIsLoading(false);
    }
  }, [filters, enabled]);

  useEffect(() => { fetcher(); }, [fetcher]);

  useEffect(() => {
    if (refreshInterval > 0 && import.meta.env.MODE !== 'development') {
      const id = setInterval(fetcher, refreshInterval);
      return () => clearInterval(id);
    }
  }, [refreshInterval, fetcher]);

  return { data, isLoading, error, refresh: fetcher };
}
