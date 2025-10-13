// src/hooks/useQualityIssues.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface QualityIssue {
  id: string;
  assetId: string;
  assetName: string;
  rule: string;
  dimension: 'accuracy'|'completeness'|'consistency'|'timeliness'|'uniqueness'|'validity'|'freshness';
  severity: 'low'|'medium'|'high'|'critical';
  status: 'open'|'acknowledged'|'in_progress'|'resolved'|'false_positive'|'wont_fix';
  owner?: string;
  createdAt: string;
  updatedAt?: string;
  details?: string;
  title?: string;
  description?: string;
  affected_rows?: number;
  table_name?: string;
  schema_name?: string;
  data_source_name?: string;
  first_seen_at?: string;
  last_seen_at?: string;
  occurrence_count?: number;
  root_cause?: string;
  remediation_plan?: string;
}

export interface QualityIssuesFilters {
  q?: string;
  status?: QualityIssue['status'];
  severity?: QualityIssue['severity'];
  dimension?: QualityIssue['dimension'];
  owner?: string;
  assetId?: string;
  page?: number;
  limit?: number;
}

interface ApiResponse {
  items: QualityIssue[];
  total: number;
  page: number;
  limit: number;
}

const mockIssues: QualityIssue[] = Array.from({ length: 28 }).map((_, i) => ({
  id: `qi-${i + 1}`,
  assetId: `asset-${(i % 7) + 1}`,
  assetName: ['users','orders','transactions','products','events','invoices','sessions'][i % 7],
  rule: ['not_null','foreign_key_valid','no_future_dates','unique_key','positive_amount'][i % 5],
  dimension: ['accuracy','completeness','consistency','timeliness','uniqueness','validity'][i % 6] as any,
  severity: ['low','medium','high','critical'][i % 4] as any,
  status: ['open','acknowledged','in_progress','resolved'][i % 4] as any,
  owner: ['alice@acme.com','bob@acme.com','carol@acme.com'][i % 3],
  createdAt: new Date(Date.now() - i * 3600_000).toISOString(),
  updatedAt: new Date(Date.now() - i * 1800_000).toISOString(),
  details: 'Sample issue for development'
}));

export function useQualityIssues(initial: QualityIssuesFilters = { page: 1, limit: 20 }) {
  const [filters, setFilters] = useState<QualityIssuesFilters>(initial);
  const [items, setItems] = useState<QualityIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const queryString = useMemo(() => {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    return qs.toString();
  }, [filters]);

  const fetcher = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setIsLoading(true);
    setError(null);
    try {
      if (import.meta.env.MODE === 'development') {
        await new Promise(r => setTimeout(r, 400));
        const start = ((filters.page ?? 1) - 1) * (filters.limit ?? 20);
        const end = start + (filters.limit ?? 20);
        let data = mockIssues.slice();

        if (filters.q) {
          const s = filters.q.toLowerCase();
          data = data.filter(d => d.assetName.toLowerCase().includes(s) || d.rule.includes(s));
        }
        (['status','severity','dimension','owner','assetId'] as const).forEach((k) => {
          const v = filters[k];
          if (v) data = data.filter(d => (d as any)[k] === v);
        });

        setItems(data.slice(start, end));
        setTotal(data.length);
        return;
      }

      const res = await fetch(`/api/quality/issues?${queryString}`, {
        headers: { accept: 'application/json' },
        signal: abortRef.current.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setItems(json.items ?? []);
      setTotal(json.total ?? 0);
    } catch (e: any) {
      const useMocks = import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_MOCKS !== '0';
     if (useMocks) {
        console.warn('quality/issues not available, using mock list');
        setItems(mockIssues.slice(0, filters.limit ?? 20));
        setTotal(mockIssues.length);
      } else {
        setError(e?.message || 'Failed to load issues');
      }
    } finally {
      setIsLoading(false);
    }
  }, [queryString, filters]);

  useEffect(() => { fetcher(); }, [fetcher]);

  const updateFilters = useCallback((patch: Partial<QualityIssuesFilters>) => {
    setFilters(prev => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  }, []);

  return { items, total, filters, updateFilters, isLoading, error, refresh: fetcher };
}
