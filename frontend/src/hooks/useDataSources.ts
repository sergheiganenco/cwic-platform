// src/hooks/useDataSources.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  createDataSource,
  deleteDataSource,
  listDataSourceDatabases,
  listDataSources,
  syncDataSource,
  testDataSource,
  updateDataSource,
} from '@/services/api/dataSources'

import type {
  ConnectionTestResult,
  CreateDataSourcePayload,
  DataSource,
  DataSourceStatus,
  DataSourceType,
  PaginatedDataSources,
  SyncResult,
  UpdateDataSourcePayload,
} from '@/types/dataSources'

import { toUserMessage } from '@/services/httpError'
import { useDbScope } from '@/store/dbScope'
import { debounce } from '@/utils/performanceUtils'

type SortKey = 'name' | 'type' | 'status' | 'createdAt' | 'updatedAt'

interface ListParams {
  page?: number
  limit?: number
  sortBy?: SortKey
  sortOrder?: 'asc' | 'desc'
  status?: string
  type?: DataSourceType
}

interface DataSourceSummary {
  total: number
  healthy: number
  warning: number
  error: number
}

interface OperationState {
  testing: Set<string>
  syncing: Set<string>
  deleting: Set<string>
}

/* ----------------------------- UI<->API status map ----------------------- */

function toServerStatus(s: DataSourceStatus | ''): string | undefined {
  if (!s) return undefined
  if (s === 'active') return 'connected'
  if (s === 'inactive') return 'disconnected'
  return s
}
function toUiStatus(s: string | undefined): DataSourceStatus {
  switch (s) {
    case 'connected':
      return 'active'
    case 'disconnected':
      return 'inactive'
    case 'warning':
      return 'pending'
    case 'syncing':
      return 'testing'
    case 'pending':
    case 'testing':
    case 'error':
    case 'active':
    case 'inactive':
      return s as DataSourceStatus
    default:
      return 'pending'
  }
}
function normalizeFromServer(ds: any): DataSource {
  return { ...ds, status: toUiStatus(ds?.status) } as DataSource
}

/* --------------------------- Hook implementation ------------------------- */

export function useDataSources() {
  const [items, setItems] = useState<DataSource[]>([])
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const [status, setStatus] = useState<DataSourceStatus | ''>('')
  const [type, setType] = useState<DataSourceType | ''>('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [ops, setOps] = useState<OperationState>({
    testing: new Set(),
    syncing: new Set(),
    deleting: new Set(),
  })

  const [lastTests, setLastTests] = useState<Map<string, ConnectionTestResult>>(new Map())
  const [lastSyncs, setLastSyncs] = useState<Map<string, SyncResult>>(new Map())

  const mountedRef = useRef(true)
  const lastFetchTime = useRef(0)
  const MIN_FETCH_INTERVAL = 5000 // Minimum 5 seconds between fetches

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  // IMPORTANT: use the hook's return directly; do not access getState
  const dbScope = useDbScope() as unknown as { setScope: (next: any) => void }

  const listParams = useMemo<ListParams>(() => {
    const p: ListParams = { page, limit, sortBy: 'updatedAt', sortOrder: 'desc' }
    const sv = toServerStatus(status)
    if (sv) p.status = sv
    if (type) p.type = type
    return p
  }, [page, limit, status, type])

  const setOp = useCallback((kind: keyof OperationState, id: string, active: boolean) => {
    setOps(prev => {
      const next: OperationState = {
        testing: new Set(prev.testing),
        syncing: new Set(prev.syncing),
        deleting: new Set(prev.deleting),
      }
      const set = next[kind]
      if (active) set.add(id)
      else set.delete(id)
      return next
    })
  }, [])

  const updateItem = useCallback((id: string, patch: Partial<DataSource>) => {
    setItems(prev => prev.map(ds => (ds.id === id ? { ...ds, ...patch } : ds)))
  }, [])

  const refreshInternal = useCallback(async (force = false) => {
    // Prevent too frequent refreshes unless forced
    const now = Date.now()
    if (!force && now - lastFetchTime.current < MIN_FETCH_INTERVAL) {
      return
    }

    setLoading(true)
    setError(null)
    lastFetchTime.current = now

    try {
      const res: PaginatedDataSources = await listDataSources(listParams)
      if (!mountedRef.current) return

      const normalized = res?.data?.map(normalizeFromServer) ?? []
      setItems(normalized)
      setTotal(res?.pagination?.total ?? normalized.length)
      setTotalPages(res?.pagination?.totalPages ?? 1)
    } catch (e: any) {
      if (!mountedRef.current) return
      setError(toUserMessage(e))
      setItems([])
      setTotal(0)
      setTotalPages(0)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [listParams])

  const refresh = useCallback(async () => {
    return refreshInternal(true)
  }, [refreshInternal])

  // Create a debounced version for automatic refresh
  const debouncedRefresh = useMemo(
    () => debounce(() => refreshInternal(false), 500),
    [refreshInternal]
  )

  // Initial fetch with delay to prevent simultaneous calls on page load
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshInternal(false)
    }, 100)
    return () => clearTimeout(timer)
  }, []) // Only run once on mount

  // Refresh when filters change, but debounced
  useEffect(() => {
    if (lastFetchTime.current > 0) { // Skip if this is the initial mount
      debouncedRefresh()
    }
  }, [listParams, debouncedRefresh])

  const create = useCallback(async (draft: CreateDataSourcePayload) => {
    const created = await createDataSource(draft)
    await refresh()
    return created
  }, [refresh])

  const update = useCallback(
    async (id: string, patch: UpdateDataSourcePayload | Partial<DataSource>) => {
      // optimistic local merge for snappy UI
      updateItem(id, patch as Partial<DataSource>)
      try {
        const updated = await updateDataSource(id, patch as UpdateDataSourcePayload)
        if (updated && typeof updated === 'object') {
          updateItem(id, normalizeFromServer(updated))
        }
        await refresh()
      } catch (e: any) {
        await refresh() // revert optimistic state by reloading
        throw new Error(toUserMessage(e))
      }
    },
    [refresh, updateItem],
  )

  const remove = useCallback(async (id: string) => {
    setOp('deleting', id, true)
    try {
      await deleteDataSource(id)
      setItems(prev => prev.filter(x => x.id !== id))
      setTotal(t => Math.max(0, t - 1))
      setLastTests(prev => { const m = new Map(prev); m.delete(id); return m })
      setLastSyncs(prev => { const m = new Map(prev); m.delete(id); return m })
    } catch (e: any) {
      await refresh()
      throw new Error(toUserMessage(e))
    } finally {
      setOp('deleting', id, false)
    }
  }, [refresh, setOp])

  const test = useCallback(async (id: string): Promise<ConnectionTestResult> => {
    setOp('testing', id, true)
    updateItem(id, { status: 'testing' })
    try {
      const result = await testDataSource(id)
      setLastTests(prev => new Map(prev).set(id, result))
      const ok = (result as any)?.connectionStatus === 'connected' || (result as any)?.success === true
      updateItem(id, {
        status: ok ? 'active' : 'error',
        ...(result as any)?.testedAt
          ? ({ lastTestAt: (result as any).testedAt } as any)
          : ({ lastTestAt: new Date().toISOString() } as any),
      })
      return result
    } catch (e: any) {
      const msg = toUserMessage(e)
      setLastTests(prev => new Map(prev).set(id, { success: false, message: msg } as any))
      updateItem(id, { status: 'error', ...( { lastTestAt: new Date().toISOString() } as any) })
      throw new Error(msg)
    } finally {
      setOp('testing', id, false)
    }
  }, [setOp, updateItem])

  const sync = useCallback(async (id: string, database?: string): Promise<SyncResult> => {
    setOp('syncing', id, true)
    try {
      // Optimistic UI: mark as running so the card can reflect activity
      updateItem(id, { syncStatus: { status: 'running', progress: 1 } as any })
      const result = await syncDataSource(id, database)
      setLastSyncs(prev => new Map(prev).set(id, result))
      // Reflect completion timestamp and final status. Use client NOW to avoid
      // any clock/serialization drift so the card updates immediately.
      updateItem(
        id,
        {
          lastSyncAt: new Date().toISOString() as any,
          syncStatus: {
            status: (result as any)?.status ?? 'completed',
            progress: (result as any)?.progress ?? 100,
            completedAt: (result as any)?.completedAt,
          } as any,
        },
      )
      // Ensure server-driven fields are reflected
      await refresh()
      return result
    } catch (e: any) {
      const msg = toUserMessage(e)
      setLastSyncs(prev => new Map(prev).set(id, {
        syncId: `error-${Date.now()}`,
        status: 'failed',
        tablesScanned: 0,
        newTables: 0,
        updatedTables: 0,
        errors: [msg],
        startedAt: new Date().toISOString(),
      } as any))
      updateItem(id, { syncStatus: { status: 'failed', progress: 0 } as any })
      throw new Error(msg)
    } finally {
      setOp('syncing', id, false)
    }
  }, [setOp, updateItem, refresh])

  const listDatabases = useCallback(async (id: string): Promise<string[]> => {
    const r = await listDataSourceDatabases(id)
    if (Array.isArray(r) && r.length > 0) {
      if (typeof r[0] === 'string') return r as string[]
      if (typeof r[0] === 'object' && 'name' in (r[0] as any)) return (r as Array<{ name: string }>).map(x => x.name)
    }
    if (r && typeof r === 'object' && Array.isArray((r as any).databases)) {
      const dbs = (r as any).databases
      if (dbs.length === 0) return []
      if (typeof dbs[0] === 'string') return dbs as string[]
      if (typeof dbs[0] === 'object' && 'name' in dbs[0]) return dbs.map((x: any) => x.name)
    }
    return []
  }, [])

  /**
   * Update the global DB scope from a picked data source + database.
   * We rely on the hook instance (dbScope) and call dbScope.setScope directly.
   */
  const setScopeFromPick = useCallback(
    async (src: DataSource, database: string, schema?: string | null) => {
      const vendor = (src as any)?.vendor || (src as any)?.type || 'postgresql'
      const cfg = (src.connectionConfig as any) || {}
      const host = (src as any)?.host || cfg.host
      const port = (src as any)?.port || cfg.port

      dbScope.setScope({
        connectionId: (src as any).id,
        vendor,
        server: (host || port) ? { host, port } : undefined,
        database,
        schema: schema ?? null,
        role: null,
      } as any)
    },
    [dbScope],
  )

  const testMultiple = useCallback(async (ids: string[]) => {
    await Promise.allSettled(ids.map(id => test(id)))
    return new Map(lastTests)
  }, [test, lastTests])

  const syncMultiple = useCallback(async (ids: string[]) => {
    await Promise.allSettled(ids.map(id => sync(id)))
    return new Map(lastSyncs)
  }, [sync, lastSyncs])

  const summary = useMemo<DataSourceSummary>(() => {
    const s: DataSourceSummary = { total, healthy: 0, warning: 0, error: 0 }
    for (const ds of items) {
      if (ds.status === 'active') s.healthy += 1
      else if (ds.status === 'error') s.error += 1
      else if (ds.status === 'pending' || ds.status === 'testing') s.warning += 1
    }
    return s
  }, [items, total])

  const getDataSourceById = useCallback((id: string) => items.find(d => d.id === id), [items])

  const clearFilters = useCallback(() => {
    setStatus('')
    setType('')
    setPage(1)
  }, [])

  const isDataSourceTesting = useCallback((id: string) => ops.testing.has(id), [ops.testing])
  const isDataSourceSyncing = useCallback((id: string) => ops.syncing.has(id), [ops.syncing])
  const isDataSourceDeleting = useCallback((id: string) => ops.deleting.has(id), [ops.deleting])

  const getLastTestResult = useCallback((id: string) => lastTests.get(id), [lastTests])
  const getLastSyncResult = useCallback((id: string) => lastSyncs.get(id), [lastSyncs])

  const clearTestResult = useCallback((id: string) => {
    setLastTests(prev => { const m = new Map(prev); m.delete(id); return m })
  }, [])
  const clearSyncResult = useCallback((id: string) => {
    setLastSyncs(prev => { const m = new Map(prev); m.delete(id); return m })
  }, [])

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
    update, // ← added
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

    /* operation counts */
    activeOperations: {
      testing: ops.testing.size,
      syncing: ops.syncing.size,
      deleting: ops.deleting.size,
    },

    /* database helpers */
    listDatabases,
    setScopeFromPick,
  }
}
