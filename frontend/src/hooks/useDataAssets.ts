// frontend/src/hooks/useDataAssets.ts
import { useApi } from '@/hooks/useApi';
import type {
  AccessRequestResponse,
  Asset,
  AssetFilters,
  AssetSummary,
  PaginationInfo
} from '@/types/dataAssets';
import { debounce } from '@/utils/performanceUtils';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
    dataSourceName: 'Azure Feya',
    dataSourceType: 'mssql',
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
    dataSourceName: 'postgres',
    dataSourceType: 'postgresql',
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

const mockFlag = String((import.meta as any)?.env?.VITE_USE_MOCKS ?? '').toLowerCase();
const USE_MOCKS = mockFlag === '1' || mockFlag === 'true' || mockFlag === 'yes';
// Only use mocks if explicitly enabled via VITE_USE_MOCKS env var

// ---------- Helpers ----------
function normalizeAccessResponse(raw: any): AccessRequestResponse {
  const status: AccessRequestResponse['status'] =
    raw?.status === 'auto_approved' ? 'auto_approved' : 'submitted';

  return {
    requestId: String(raw?.requestId ?? raw?.id ?? raw?.request_id ?? ''),
    status,
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
    // include typical defaults + schema support (type allows it)
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
  const MIN_FETCH_INTERVAL = 500; // faster (0.5s) for a snappy UI

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
      const now = Date.now();
      if (!force && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
        return;
      }
      lastFetchTime.current = now;

      if (abortControllerRef.current) abortControllerRef.current.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const reqId = `${Date.now()}`;
      lastRequestRef.current = reqId;

      if (showLoading) setIsLoading(true);
      setIsValidating(true);
      setError(null);

      if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
        markOffline(!navigator.onLine);
      }

      try {
        const queryString = createQueryString(filters);
        const path = `/api/catalog/assets${queryString ? `?${queryString}` : ''}`;

        if (USE_MOCKS) {
          await new Promise((r) => setTimeout(r, 400));
          if (lastRequestRef.current !== reqId) return;

          // very light client-side mock filtering just for UI
          let filtered = mockAssets.slice();

          if (filters.dataSourceId) {
            filtered = filtered.filter((a) => a.dataSourceId === filters.dataSourceId);
          }
          if (filters.database) {
            filtered = filtered.filter((a) => (a as any).database === filters.database);
          }
          if (filters.schema) {
            filtered = filtered.filter((a) => a.schema === filters.schema);
          }
          if (filters.search) {
            const s = (filters.search ?? '').toLowerCase();
            filtered = filtered.filter((a) =>
              a.name.toLowerCase().includes(s) ||
              (a.description?.toLowerCase() ?? '').includes(s) ||
              (a.schema ?? '').toLowerCase().includes(s)
            );
          }

          const sortBy = filters.sortBy ?? 'updatedAt';
          const sortOrder = (filters.sortOrder ?? 'desc') === 'desc' ? -1 : 1;
          filtered.sort((a: any, b: any) =>
            a[sortBy] > b[sortBy] ? sortOrder : a[sortBy] < b[sortBy] ? -sortOrder : 0
          );
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

        // PROD call
        const response = await api.get<{ success: boolean; data: AssetsApiResponse }>(path, {
          signal: controller.signal
        });

        if (lastRequestRef.current !== reqId) return;

        // some api clients wrap payload under .data, some don't — normalize:
        const payload = (response as any).data?.data ?? (response as any).data ?? response;

        const arr = Array.isArray(payload.assets) ? payload.assets : [];
        const pg = payload.pagination as PaginationInfo | undefined;
        const total = payload.total ?? pg?.total ?? arr.length;

        setAssets(arr);
        setPagination(
          pg ?? {
            page: filters.page ?? 1,
            limit: filters.limit ?? 20,
            total,
            totalPages: Math.ceil(total / (filters.limit ?? 20)),
            hasNext: Boolean((filters.page ?? 1) * (filters.limit ?? 20) < total),
            hasPrev: (filters.page ?? 1) > 1
          }
        );
        setSummary(payload.summary ?? null);
        setRetryCount(0);
        markOffline(false);
      } catch (err: any) {
        if (lastRequestRef.current !== reqId) return;
        if (err?.name === 'AbortError') return;

        const msg: string =
          err?.response?.data?.message ||
          (err?.message as string) ||
          'Failed to fetch assets';
        setError(msg);

        const looksNetworky =
          /NetworkError|Failed to fetch|ECONNREFUSED|ERR_NETWORK/i.test(String(err)) ||
          (typeof navigator !== 'undefined' && 'onLine' in navigator && !navigator.onLine);
        if (looksNetworky) markOffline(true);

        if (!/Rate limit/i.test(msg) && retryCount < (options.errorRetryCount ?? 3)) {
          const delay = Math.min(800 * Math.pow(2, retryCount), 10_000);
          setTimeout(() => {
            if (lastRequestRef.current === reqId) {
              setRetryCount((n) => n + 1);
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
    [api, filters, retryCount, options.errorRetryCount, createQueryString, markOffline]
  );

  // ---------- Filters ----------
  const updateFilters = useCallback((newFilters: Partial<AssetFilters>) => {
    setFilters((prev) => {
      const merged = { ...prev, ...newFilters };

      // If page wasn't provided, reset to 1 whenever a non-page filter changed
      const nonPagingKeys: (keyof AssetFilters)[] = [
        'search',
        'type',
        'objectType',
        'dataSourceId',
        'database',
        'schema',
        'sortBy',
        'sortOrder'
      ];
      const changedNonPaging = nonPagingKeys.some((k) => (newFilters as any)[k] !== undefined);
      if (changedNonPaging && newFilters.page === undefined) {
        (merged as any).page = 1;
      }
      return merged;
    });
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
      if (USE_MOCKS) {
        await new Promise((r) => setTimeout(r, 250));
        return normalizeAccessResponse({
          requestId: `mock-${assetId}-${Date.now()}`,
          status: 'submitted',
          createdAt: new Date().toISOString()
        });
      }

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
    fetchAssets(false);
  }, [fetchAssets]);

  // Debounced fetch when filters change
  const debouncedFetch = useMemo(
    () => debounce(() => fetchAssets(true, false), 300),
    [fetchAssets]
  );

  // ---------- Effects ----------
  // Initial fetch on mount
  useEffect(() => {
    if (!autoFetch) return;
    const t = setTimeout(() => fetchAssets(true, false), 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch when filters change (debounced) — skip first render until initial fetch executed
  useEffect(() => {
    if (!autoFetch || lastFetchTime.current === 0) return;
    debouncedFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, autoFetch]);

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
