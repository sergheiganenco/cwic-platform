// src/hooks/useDataSources.ts
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createDataSource,
  deleteDataSource,
  listDataSources,
  syncDataSource,
  testDataSource,
} from '@/services/api/dataSources';

import type {
  ConnectionTestResult,
  CreateDataSourcePayload,
  DataSource,
  DataSourceStatus,
  DataSourceType,
  PaginatedDataSources,
  SyncResult,
} from '@/types/dataSources';

import { toUserMessage } from '@/services/httpError';

/* ------------------------------------------------------------------ */
/* Query params (match what your backend actually accepts)            */
/* ------------------------------------------------------------------ */
type SortKey = 'name' | 'type' | 'status' | 'createdAt' | 'updatedAt';

interface ListParams {
  page?: number;
  limit?: number;
  sortBy?: SortKey;
  sortOrder?: 'asc' | 'desc';
  status?: string;        // NOTE: send server values here
  type?: DataSourceType;
}

/* ------------------------------------------------------------------ */
/* Local summary model                                                */
/* ------------------------------------------------------------------ */
interface DataSourceSummary {
  total: number;
  healthy: number;
  warning: number;
  error: number;
}

/* Track per-item operations without mutating `status` to fake values */
interface OperationState {
  testing: Set<string>;
  syncing: Set<string>;
  deleting: Set<string>;
}

/* --------------------------- status mapping ------------------------ */
// UI -> API
function toServerStatus(s: DataSourceStatus | ''): string | undefined {
  if (!s) return undefined;
  if (s === 'active') return 'connected';
  if (s === 'inactive') return 'disconnected';
  // pending/testing/error exist on both sides; pass through
  return s;
}

// API -> UI
function toUiStatus(s: string | undefined): DataSourceStatus {
  switch (s) {
    case 'connected': return 'active';
    case 'disconnected': return 'inactive';
    case 'warning': return 'pending';
    case 'syncing': return 'testing';
    case 'pending':
    case 'testing':
    case 'error':
    case 'active':
    case 'inactive':
      return s as DataSourceStatus;
    default:
      // unknown -> treat as pending (neutral)
      return 'pending';
  }
}

function normalizeFromServer(ds: any): DataSource {
  return {
    ...ds,
    status: toUiStatus(ds?.status),
  } as DataSource;
}

export function useDataSources() {
  /* ------------------------------ data ----------------------------- */
  const [items, setItems] = useState<DataSource[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  /* Single-value filters (UI values) */
  const [status, setStatus] = useState<DataSourceStatus | ''>('');
  const [type, setType] = useState<DataSourceType | ''>('');

  /* ---------------------------- ui state --------------------------- */
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* per-card operation state */
  const [ops, setOps] = useState<OperationState>({
    testing: new Set(),
    syncing: new Set(),
    deleting: new Set(),
  });

  /* last known operation results */
  const [lastTests, setLastTests] = useState<Map<string, ConnectionTestResult>>(new Map());
  const [lastSyncs, setLastSyncs] = useState<Map<string, SyncResult>>(new Map());

  /* --------------------------- list params ------------------------- */
  const listParams = useMemo<ListParams>(() => {
    const p: ListParams = {
      page,
      limit,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
    };
    // map UI -> API before sending
    const sv = toServerStatus(status);
    if (sv) p.status = sv;
    if (type) p.type = type;
    return p;
  }, [page, limit, status, type]);

  /* --------------------------- small helpers ----------------------- */
  const setOp = useCallback((kind: keyof OperationState, id: string, active: boolean) => {
    setOps(prev => {
      const next: OperationState = {
        testing: new Set(prev.testing),
        syncing: new Set(prev.syncing),
        deleting: new Set(prev.deleting),
      };
      const set = next[kind];
      if (active) set.add(id); else set.delete(id);
      return next;
    });
  }, []);

  const updateItem = useCallback((id: string, patch: Partial<DataSource>) => {
    setItems(prev => prev.map(ds => (ds.id === id ? { ...ds, ...patch } : ds)));
  }, []);

  /* ----------------------------- actions --------------------------- */
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: PaginatedDataSources = await listDataSources(listParams);
      // map API -> UI statuses on the way in
      const normalized = res.data.map(normalizeFromServer);
      setItems(normalized);
      setTotal(res.pagination.total);
      setTotalPages(res.pagination.totalPages);
    } catch (e: any) {
      setError(toUserMessage(e));
      setItems([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [listParams]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (draft: CreateDataSourcePayload) => {
      const created = await createDataSource(draft);
      await refresh();
      return created;
    },
    [refresh],
  );

  const remove = useCallback(
    async (id: string) => {
      setOp('deleting', id, true);
      try {
        await deleteDataSource(id);
        setItems(prev => prev.filter(x => x.id !== id));
        setTotal(t => Math.max(0, t - 1));
        setLastTests(prev => {
          const m = new Map(prev);
          m.delete(id);
          return m;
        });
        setLastSyncs(prev => {
          const m = new Map(prev);
          m.delete(id);
          return m;
        });
      } catch (e: any) {
        await refresh();
        throw new Error(toUserMessage(e));
      } finally {
        setOp('deleting', id, false);
      }
    },
    [refresh, setOp],
  );

  const test = useCallback(
    async (id: string): Promise<ConnectionTestResult> => {
      setOp('testing', id, true);
      // optimistic cue
      updateItem(id, { status: 'testing' });

      try {
        const result = await testDataSource(id);
        setLastTests(prev => new Map(prev).set(id, result));

        const ok =
          (result as any)?.connectionStatus === 'connected' ||
          (result as any)?.success === true;

        updateItem(id, {
          status: ok ? 'active' : 'error',
          ...(result as any)?.testedAt
            ? ({ lastTestAt: (result as any).testedAt } as any)
            : ({ lastTestAt: new Date().toISOString() } as any),
        });

        return result;
      } catch (e: any) {
        const msg = toUserMessage(e);
        setLastTests(prev =>
          new Map(prev).set(id, {
            success: false,
            message: msg,
          } as unknown as ConnectionTestResult),
        );
        updateItem(id, {
          status: 'error',
          ...( { lastTestAt: new Date().toISOString() } as any),
        });
        throw new Error(msg);
      } finally {
        setOp('testing', id, false);
      }
    },
    [setOp, updateItem],
  );

  const sync = useCallback(
    async (id: string): Promise<SyncResult> => {
      setOp('syncing', id, true);
      try {
        const result = await syncDataSource(id);
        setLastSyncs(prev => new Map(prev).set(id, result));

        updateItem(id, {
          ...(result.completedAt
            ? ({ lastSyncAt: result.completedAt } as any)
            : ({ lastSyncAt: new Date().toISOString() } as any)),
        });

        return result;
      } catch (e: any) {
        const msg = toUserMessage(e);
        setLastSyncs(prev =>
          new Map(prev).set(id, {
            syncId: `error-${Date.now()}`,
            status: 'failed',
            tablesScanned: 0,
            newTables: 0,
            updatedTables: 0,
            errors: [msg],
            startedAt: new Date().toISOString(),
          }),
        );
        throw new Error(msg);
      } finally {
        setOp('syncing', id, false);
      }
    },
    [setOp, updateItem],
  );

  /* --------------------------- batch helpers ----------------------- */
  const testMultiple = useCallback(async (ids: string[]) => {
    await Promise.allSettled(ids.map(id => test(id)));
    return new Map(lastTests);
  }, [test, lastTests]);

  const syncMultiple = useCallback(async (ids: string[]) => {
    await Promise.allSettled(ids.map(id => sync(id)));
    return new Map(lastSyncs);
  }, [sync, lastSyncs]);

  /* ----------------------------- summary --------------------------- */
  const summary = useMemo<DataSourceSummary>(() => {
    const s: DataSourceSummary = { total, healthy: 0, warning: 0, error: 0 };
    for (const ds of items) {
      if (ds.status === 'active') s.healthy += 1;
      else if (ds.status === 'error') s.error += 1;
      else if (ds.status === 'pending' || ds.status === 'testing') s.warning += 1;
    }
    return s;
  }, [items, total]);

  /* ------------------------------ getters -------------------------- */
  const getDataSourceById = useCallback(
    (id: string) => items.find(d => d.id === id),
    [items],
  );

  const clearFilters = useCallback(() => {
    setStatus('');
    setType('');
    setPage(1);
  }, []);

  /* --------------------------- selectors --------------------------- */
  const isDataSourceTesting = useCallback((id: string) => ops.testing.has(id), [ops.testing]);
  const isDataSourceSyncing = useCallback((id: string) => ops.syncing.has(id), [ops.syncing]);
  const isDataSourceDeleting = useCallback((id: string) => ops.deleting.has(id), [ops.deleting]);

  const getLastTestResult = useCallback((id: string) => lastTests.get(id), [lastTests]);
  const getLastSyncResult = useCallback((id: string) => lastSyncs.get(id), [lastSyncs]);

  const clearTestResult = useCallback((id: string) => {
    setLastTests(prev => {
      const m = new Map(prev);
      m.delete(id);
      return m;
    });
  }, []);

  const clearSyncResult = useCallback((id: string) => {
    setLastSyncs(prev => {
      const m = new Map(prev);
      m.delete(id);
      return m;
    });
  }, []);

  /* ------------------------------ return --------------------------- */
  return {
    /* data */
    items,
    total,
    totalPages,

    /* pagination */
    page,
    setPage,
    limit,
    setLimit,

    /* filters */
    status,
    setStatus,
    type,
    setType,
    clearFilters,

    /* state */
    loading,
    error,
    summary,

    /* actions */
    refresh,
    create,
    remove,
    test,
    sync,

    /* batch */
    testMultiple,
    syncMultiple,

    /* selectors */
    getDataSourceById,
    isDataSourceTesting,
    isDataSourceSyncing,
    isDataSourceDeleting,
    getLastTestResult,
    getLastSyncResult,
    clearTestResult,
    clearSyncResult,

    /* computed */
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    isEmpty: !loading && items.length === 0,

    /* operation counts (for badges/spinners) */
    activeOperations: {
      testing: ops.testing.size,
      syncing: ops.syncing.size,
      deleting: ops.deleting.size,
    },
  };
}
