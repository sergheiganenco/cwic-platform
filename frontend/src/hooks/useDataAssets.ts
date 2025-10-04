// src/hooks/useDataAssets.ts
import { useApi } from '@/hooks/useApi';
import type {
  AccessRequestResponse,
  Asset,
  AssetFilters,
  AssetSummary,
  PaginationInfo
} from '@/types/dataAssets';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { debounce } from '@/utils/performanceUtils';

// ---------- API response types ----------
interface AssetsApiResponse {
  assets: Asset[];
  pagination: PaginationInfo;
  summary?: AssetSummary;
  total?: number;
}
interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: unknown;
}

interface UseDataAssetsOptions {
  autoFetch?: boolean;
  defaultFilters?: AssetFilters;
  refreshInterval?: number;        // ms; disabled in dev
  revalidateOnFocus?: boolean;     // disabled in dev
  errorRetryCount?: number;        // exponential backoff
}

interface UseDataAssetsReturn {
  assets: Asset[];
  pagination: PaginationInfo;
  summary: AssetSummary | null;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  isEmpty: boolean;
  hasFilters: boolean;
  isValidating: boolean;
  filters: AssetFilters;
  updateFilters: (newFilters: Partial<AssetFilters>) => void;
  clearFilters: () => void;
  refresh: () => Promise<void>;
  requestAccess: (
    assetId: string,
    reason?: string,
    options?: { urgency?: 'low' | 'medium' | 'high' }
  ) => Promise<AccessRequestResponse>;
  mutate: () => void;
}

// ---------- Mock data (dev only) ----------
const mockAssets: Asset[] = [
  {
    id: '1',
    name: 'user_profiles',
    type: 'table',
    description: 'User profile information',
    dataSourceId: 'ds-1',
    schema: 'public',
    table: 'user_profiles',
    owner: 'john.doe@company.com',
    quality: 'high',
    classification: 'internal',
    tags: ['users', 'profiles', 'pii'],
    metadata: { rows: 150000, columns: 12 },
    lastUpdated: new Date().toISOString(),
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
    updatedAt: new Date().toISOString(),
    createdBy: 'system',
    updatedBy: 'john.doe@company.com',
    viewCount: 245,
    isBookmarked: true
  },
  {
    id: '2',
    name: 'sales_transactions',
    type: 'table',
    description: 'Daily sales transaction records',
    dataSourceId: 'ds-2',
    schema: 'sales',
    table: 'transactions',
    owner: 'jane.smith@company.com',
    quality: 'medium',
    classification: 'confidential',
    tags: ['sales', 'revenue', 'financial'],
    metadata: { rows: 2_500_000, columns: 18 },
    lastUpdated: new Date(Date.now() - 3_600_000).toISOString(),
    createdAt: new Date(Date.now() - 2_592_000_000).toISOString(),
    updatedAt: new Date(Date.now() - 3_600_000).toISOString(),
    createdBy: 'jane.smith@company.com',
    viewCount: 89,
    isBookmarked: false
  }
];

const mockPagination: PaginationInfo = {
  page: 1,
  limit: 20,
  total: 1247,
  totalPages: 63,
  hasNext: true,
  hasPrev: false
};

const mockSummary: AssetSummary = {
  total: 1247,
  byType: { table: 892, view: 245, file: 78, api: 32, dashboard: 15, report: 7 },
  byQuality: { high: 934, medium: 245, low: 68 },
  byClassification: { public: 156, internal: 789, confidential: 234, restricted: 68 },
  byOwner: { 'john.doe@company.com': 234, 'jane.smith@company.com': 189 },
  recentlyUpdated: 89
};

// ---------- Helpers ----------
function normalizeAccessResponse(raw: any): AccessRequestResponse {
  const status: AccessRequestResponse['status'] =
    raw?.status === 'auto_approved' ? 'auto_approved' : 'submitted';

  return {
    requestId: String(raw?.requestId ?? raw?.id ?? raw?.request_id ?? ''),
    status,
    // ensure required field exists even if backend doesn't send one
    message:
      typeof raw?.message === 'string' && raw.message.trim()
        ? raw.message
        : status === 'auto_approved'
          ? 'Access auto-approved'
          : 'Access request submitted',
    ...(raw?.createdAt || raw?.created_at ? { createdAt: String(raw.createdAt ?? raw.created_at) } : {}),
    ...(raw?.approver ? { approver: String(raw.approver) } : {}),
  };
}

export const useDataAssets = (options: UseDataAssetsOptions = {}): UseDataAssetsReturn => {
  const api = useApi();
  const {
    autoFetch = true,
    defaultFilters = { page: 1, limit: 20, sortBy: 'updatedAt', sortOrder: 'desc' },
    refreshInterval = 0,
    revalidateOnFocus = false,
    errorRetryCount = 3
  } = options;

  // ---------- State ----------
  const [assets, setAssets] = useState<Asset[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const [summary, setSummary] = useState<AssetSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [filters, setFilters] = useState<AssetFilters>(defaultFilters);
  const [retryCount, setRetryCount] = useState(0);

  // ---------- Refs ----------
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastRequestRef = useRef<string>('');
  const offlineTimerRef = useRef<number | null>(null); // debounce noisy offline flips
  const lastFetchTime = useRef<number>(0);
  const MIN_FETCH_INTERVAL = 5000; // Minimum 5 seconds between fetches

  // ---------- QS builder ----------
  const createQueryString = useCallback((current: AssetFilters): string => {
    const qs = new URLSearchParams();
    Object.entries(current).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') return;
      if (Array.isArray(value)) {
        if (value.length) qs.set(key, value.join(','));
      } else if (typeof value === 'object' && key === 'dateRange') {
        qs.set(key, JSON.stringify(value));
      } else {
        qs.set(key, String(value));
      }
    });
    return qs.toString();
  }, []);

  const markOffline = useCallback((next: boolean) => {
    if (offlineTimerRef.current) window.clearTimeout(offlineTimerRef.current);
    if (next) {
      offlineTimerRef.current = window.setTimeout(() => setIsOffline(true), 250);
    } else {
      setIsOffline(false);
    }
  }, []);

  // ---------- Core fetch ----------
  const fetchAssets = useCallback(
    async (showLoading = true, force = false) => {
      // Prevent too frequent refreshes unless forced
      const now = Date.now();
      if (!force && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
        return;
      }
      lastFetchTime.current = now;

      // Cancel any in-flight request
      if (abortControllerRef.current) abortControllerRef.current.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const reqId = `${Date.now()}`;
      lastRequestRef.current = reqId;

      if (showLoading) setIsLoading(true);
      setIsValidating(true);
      setError(null);

      // reflect browser offline immediately
      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        markOffline(!navigator.onLine);
      }

      try {
        const queryString = createQueryString(filters);
        const path = `/api/assets${queryString ? `?${queryString}` : ''}`;

        // DEV: mock with slight delay
        if (import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_MOCKS !== '0') {
          await new Promise((r) => setTimeout(r, 800));
          if (lastRequestRef.current !== reqId) return;

          let filtered = mockAssets.slice();
          if (filters.search) {
            const s = filters.search.toLowerCase();
            filtered = filtered.filter(
              (a) =>
                a.name.toLowerCase().includes(s) ||
                (a.description?.toLowerCase() ?? '').includes(s) ||
                a.tags.some((t) => t.toLowerCase().includes(s))
            );
          }

          // Sorting (basic)
          const sortBy = filters.sortBy ?? 'updatedAt';
          const sortOrder = (filters.sortOrder ?? 'desc') === 'desc' ? -1 : 1;
          filtered.sort((a: any, b: any) =>
            a[sortBy] > b[sortBy] ? sortOrder : a[sortBy] < b[sortBy] ? -sortOrder : 0
          );

          // Paging
          const page = filters.page ?? 1;
          const limit = filters.limit ?? 20;
          const start = (page - 1) * limit;
          const pageItems = filtered.slice(start, start + limit);

          setAssets(pageItems);
          setPagination({
            page,
            limit,
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / limit),
            hasNext: start + limit < filtered.length,
            hasPrev: page > 1
          });
          setSummary(mockSummary);
          setRetryCount(0);
          markOffline(false);
          return;
        }

        // PROD: real API through unified client (handles retries/backoff)
        const data = await api.get<AssetsApiResponse>(path, { signal: controller.signal });

        if (lastRequestRef.current !== reqId) return; // ignore stale

        setAssets(Array.isArray(data.assets) ? data.assets : []);
        setPagination(
          data.pagination ?? {
            page: filters.page ?? 1,
            limit: filters.limit ?? 20,
            total: data.total ?? (data.assets?.length ?? 0),
            totalPages: Math.ceil((data.total ?? data.assets.length) / (filters.limit ?? 20)),
            hasNext: Boolean(
              (filters.page ?? 1) * (filters.limit ?? 20) < (data.total ?? data.assets.length)
            ),
            hasPrev: (filters.page ?? 1) > 1
          }
        );
        setSummary(data.summary ?? null);
        setRetryCount(0);
        markOffline(false);
      } catch (err: any) {
        if (lastRequestRef.current !== reqId) return;
        if (err?.name === 'AbortError') return;

        const msg = err?.message || 'Failed to fetch assets';
        setError(msg);

        // Heuristic: treat network-ish errors (or browser offline) as offline
        const looksNetworky =
          /NetworkError|Failed to fetch|TypeError: Failed to fetch|ECONNREFUSED|ERR_NETWORK/i.test(String(err)) ||
          (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine);
        if (looksNetworky) markOffline(true);

        if (!/Rate limit/i.test(msg) && retryCount < errorRetryCount) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 30_000);
          setTimeout(() => {
            if (lastRequestRef.current === reqId) {
              setRetryCount((n) => n + 1);
              // Do not show global spinner on retries
              fetchAssets(false);
            }
          }, delay);
        }
      } finally {
        if (lastRequestRef.current === reqId) {
          if (showLoading) setIsLoading(false);
          setIsValidating(false);
        }
      }
    },
    [api, filters, retryCount, errorRetryCount, createQueryString, markOffline]
  );

  // ---------- Filters ----------
  const updateFilters = useCallback((newFilters: Partial<AssetFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setError(null);
    setRetryCount(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setError(null);
    setRetryCount(0);
  }, [defaultFilters]);

  const refresh = useCallback(async () => {
    setRetryCount(0);
    await fetchAssets(true, true); // Force refresh
  }, [fetchAssets]);

  // ---------- Access request ----------
  const requestAccess = useCallback(
    async (
      assetId: string,
      reason?: string,
      options: { urgency?: 'low' | 'medium' | 'high' } = {}
    ): Promise<AccessRequestResponse> => {
      // DEV mocks
      if (import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_MOCKS !== '0') {
        await new Promise((r) => setTimeout(r, 250));
        return normalizeAccessResponse({
          requestId: `mock-${assetId}-${Date.now()}`,
          status: 'submitted',
          createdAt: new Date().toISOString()
        });
      }

      // Real call via unified client
      const raw = await api.post<any>('/api/access-requests', {
        assetId,
        reason,
        urgency: options.urgency ?? 'medium',
        timestamp: new Date().toISOString()
      });

      return normalizeAccessResponse(raw);
    },
    [api]
  );

  const mutate = useCallback(() => {
    // re-fetch without global spinner
    fetchAssets(false);
  }, [fetchAssets]);

  // Debounced version for filter changes
  const debouncedFetch = useMemo(
    () => debounce(() => fetchAssets(true, false), 500),
    [fetchAssets]
  );

  // ---------- Effects ----------
  // Initial fetch on mount
  useEffect(() => {
    if (!autoFetch) return;

    const delay = import.meta.env.MODE === 'development' ? 200 : 100;
    const t = setTimeout(() => fetchAssets(true, false), delay);
    return () => clearTimeout(t);
  }, []); // Only on mount

  // Fetch when filters change (debounced)
  useEffect(() => {
    if (!autoFetch || lastFetchTime.current === 0) return; // Skip on initial mount

    debouncedFetch();
  }, [filters, autoFetch, debouncedFetch]);

  useEffect(() => {
    if (refreshInterval > 0 && import.meta.env.MODE !== 'development') {
      const h = setInterval(() => fetchAssets(false), refreshInterval);
      return () => clearInterval(h);
    }
  }, [refreshInterval, fetchAssets]);

  useEffect(() => {
    if (revalidateOnFocus && import.meta.env.MODE !== 'development') {
      const onFocus = () => fetchAssets(false);
      const onVis = () => {
        if (document.visibilityState === 'visible') onFocus();
      };
      window.addEventListener('focus', onFocus);
      document.addEventListener('visibilitychange', onVis);
      return () => {
        window.removeEventListener('focus', onFocus);
        document.removeEventListener('visibilitychange', onVis);
      };
    }
  }, [revalidateOnFocus, fetchAssets]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  // ---------- Computed ----------
  const isEmpty = useMemo(() => assets.length === 0, [assets]);
  const hasFilters = useMemo(() => {
    return Object.entries(filters).some(([key, value]) => {
      if (key === 'page' && value === 1) return false;
      if (key === 'limit' && value === 20) return false;
      if (key === 'sortBy' && value === 'updatedAt') return false;
      if (key === 'sortOrder' && value === 'desc') return false;
      if (value === undefined || value === null || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      return true;
    });
  }, [filters]);

  return {
    assets,
    pagination,
    summary,
    isLoading,
    isOffline,
    error,
    isEmpty,
    hasFilters,
    isValidating,
    filters,
    updateFilters,
    clearFilters,
    refresh,
    requestAccess,
    mutate
  };
};
