// src/hooks/useRequests.ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { debounce } from '@/utils/performanceUtils'

export type RequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'
export type RequestPriority = 'low' | 'medium' | 'high'
export type StepState = 'waiting' | 'approved' | 'rejected' | 'running' | 'done'

export interface RequestStep {
  id: string
  name: string
  assignee?: string
  status: StepState
  startedAt?: string
  completedAt?: string
}

export interface RequestRecord {
  id: string
  title: string
  description?: string
  status: RequestStatus
  priority?: RequestPriority
  requester?: string
  createdAt?: string
  updatedAt?: string
  steps?: RequestStep[]
}

export interface RequestFilters {
  q?: string
  status?: RequestStatus | 'all'
  requester?: string
  assetId?: string
  page?: number
  limit?: number
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

interface RequestsApiResponse {
  items: unknown[]
  pagination?: Partial<PaginationInfo>
  total?: number
}

/** ---------- Dev mocks ---------- */
const devItems: RequestRecord[] = [
  {
    id: 'req-1001',
    title: 'Access to sales_transactions',
    description: 'Need read access for analytics',
    status: 'pending',
    priority: 'high',
    requester: 'jane@company.com',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      { id: 's1', name: 'Manager approval', status: 'waiting', assignee: 'lead@company.com' },
      { id: 's2', name: 'Data owner approval', status: 'waiting', assignee: 'owner@company.com' },
    ],
  },
  {
    id: 'req-1002',
    title: 'Create data quality rule for PII',
    description: 'Mask PII in user_profiles',
    status: 'in_progress',
    priority: 'medium',
    requester: 'alex@company.com',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
    steps: [
      { id: 's1', name: 'Rule design', status: 'running', assignee: 'dq@company.com' },
      { id: 's2', name: 'Review', status: 'waiting', assignee: 'owner@company.com' },
    ],
  },
  {
    id: 'req-1003',
    title: 'Grant writer to staging schema',
    description: 'ETL job needs writer for ingestion',
    status: 'completed',
    priority: 'low',
    requester: 'etl-bot@company.com',
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    steps: [
      { id: 's1', name: 'Owner approval', status: 'approved', assignee: 'owner@company.com' },
      { id: 's2', name: 'Apply grant', status: 'done', assignee: 'dbadmin@company.com' },
    ],
  },
]

const DEFAULT_PAGINATION: PaginationInfo = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
}

const asString = (v: unknown, fb = ''): string => {
  if (v == null) return fb
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  try { return String(v) } catch { return fb }
}
const asStatus = (s: any): RequestStatus =>
  s === 'pending' || s === 'in_progress' || s === 'completed' || s === 'rejected' ? s : 'pending'
const asPriority = (p: any): RequestPriority => (p === 'low' || p === 'high' ? p : 'medium')
const asStepState = (s: any): StepState =>
  s === 'approved' || s === 'rejected' || s === 'running' || s === 'done' ? s : 'waiting'

function normalizeOne(x: any, idx: number): RequestRecord {
  const id = asString(x?.id ?? x?.requestId ?? `req-${Date.now()}-${idx}`)
  const steps: RequestStep[] = Array.isArray(x?.steps)
    ? x.steps.map((s: any, j: number): RequestStep => ({
        id: asString(s?.id ?? s?.stepId ?? `${id}-step-${j}`),
        name: asString(s?.name ?? s?.label ?? `Step ${j + 1}`),
        assignee: asString(s?.assignee ?? s?.approver ?? ''),
        status: asStepState(s?.status),
        startedAt: asString(s?.startedAt ?? s?.started_at ?? ''),
        completedAt: asString(s?.completedAt ?? s?.completed_at ?? ''),
      }))
    : []

  return {
    id,
    title: asString(x?.title ?? x?.name ?? 'Untitled request'),
    description: asString(x?.description ?? x?.details ?? ''),
    status: asStatus(x?.status),
    priority: asPriority(x?.priority),
    requester: asString(x?.requester ?? x?.owner ?? x?.createdBy ?? 'unknown'),
    createdAt: asString(x?.createdAt ?? x?.created_at ?? x?.dateCreated ?? new Date().toISOString()),
    updatedAt: asString(x?.updatedAt ?? x?.updated_at ?? x?.dateUpdated ?? ''),
    steps,
  }
}

function withDefaults(
  p: Partial<PaginationInfo> | undefined,
  fallbackTotal = 0,
  page = 1,
  limit = 20
): PaginationInfo {
  const total = p?.total ?? fallbackTotal
  const effLimit = (p?.limit ?? limit) || 1 // avoid div-by-zero
  const totalPages = Math.ceil(total / effLimit)
  const current = {
    page: p?.page ?? page,
    limit: p?.limit ?? limit,
    total,
    totalPages,
  }
  return {
    ...current,
    hasPrev: current.page > 1,
    hasNext: current.page * current.limit < current.total,
  }
}

const isApiResponse = (x: unknown): x is RequestsApiResponse =>
  !!x && typeof x === 'object' && 'items' in (x as any)

function useMockFlag() {
  const isProd = import.meta.env.MODE === 'production'
  const raw = import.meta.env.VITE_USE_MOCKS
  if (raw != null) return String(raw) !== '0'
  return !isProd // default: dev=true, prod=false
}

export function useRequests(initial: Partial<RequestFilters> = {}) {
  const useMocks = useMockFlag()

  const [filters, setFilters] = useState<RequestFilters>({
    q: '',
    status: 'all',
    page: 1,
    limit: 20,
    ...initial,
  })

  const [requests, setRequests] = useState<RequestRecord[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>(DEFAULT_PAGINATION)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)
  const fallbackToMocks = useRef(false)
  const hadDataRef = useRef(false) // tracks whether we loaded any real data

  const apiBase = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')
  const url = (p: string) => (apiBase ? `${apiBase}${p}` : p)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      if (useMocks || fallbackToMocks.current) {
        await new Promise((r) => setTimeout(r, 200))
        // local filtering/paging on mocks
        let items = [...devItems]
        if (filters.q) {
          const ql = filters.q.toLowerCase()
          items = items.filter(
            (i) =>
              i.title.toLowerCase().includes(ql) ||
              (i.description ?? '').toLowerCase().includes(ql) ||
              (i.requester ?? '').toLowerCase().includes(ql),
          )
        }
        if (filters.status && filters.status !== 'all') {
          items = items.filter((i) => i.status === filters.status)
        }
        const page = filters.page ?? 1
        const limit = filters.limit ?? 20
        const total = items.length
        const start = (page - 1) * limit
        const pageItems = items.slice(start, start + limit)

        setRequests(pageItems)
        setPagination(withDefaults({ total, page, limit }, total, page, limit))
        hadDataRef.current = pageItems.length > 0
        return
      }

      const qs = new URLSearchParams()
      if (filters.q) qs.set('q', String(filters.q))
      if (filters.status && filters.status !== 'all') qs.set('status', filters.status)
      if (filters.requester) qs.set('requester', String(filters.requester))
      if (filters.assetId) qs.set('assetId', String(filters.assetId))
      qs.set('page', String(filters.page ?? 1))
      qs.set('limit', String(filters.limit ?? 20))

      const res = await fetch(url(`/api/requests?${qs.toString()}`), {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const raw: unknown = await res.json()

      const itemsArr: unknown[] = Array.isArray(raw)
        ? raw
        : isApiResponse(raw) && Array.isArray(raw.items)
        ? raw.items
        : []

      const normalized = itemsArr.map((x, i) => normalizeOne(x, i))

      const apiPagination: Partial<PaginationInfo> | undefined =
        !Array.isArray(raw) && isApiResponse(raw) ? raw.pagination : undefined

      const apiTotal: number | undefined =
        !Array.isArray(raw) && isApiResponse(raw) && typeof raw.total === 'number' ? raw.total : undefined

      const total = apiTotal ?? apiPagination?.total ?? normalized.length

      setRequests(normalized)
      setPagination(withDefaults(apiPagination, total, filters.page ?? 1, filters.limit ?? 20))
      hadDataRef.current = normalized.length > 0
    } catch (e: any) {
      const msg = String(e?.message || e)
      setError(msg)
      if (!import.meta.env.SSR && /ECONNREFUSED|Failed to fetch|NetworkError/i.test(msg)) {
        fallbackToMocks.current = true
      }
      if (!hadDataRef.current) {
        // show something if we never loaded
        const page = filters.page ?? 1
        const limit = filters.limit ?? 20
        const total = devItems.length
        const start = (page - 1) * limit
        setRequests(devItems.slice(start, start + limit))
        setPagination(withDefaults(undefined, total, page, limit))
      }
    } finally {
      setIsLoading(false)
    }
  }, [filters, useMocks, apiBase]) // ← 🛠️ NO requests.length here

  // Debounce refresh to prevent multiple simultaneous calls
  const debouncedRefresh = useMemo(
    () => debounce(refresh, 300),
    [refresh]
  )

  // Initial load with slight delay to prevent race conditions
  useEffect(() => {
    const timer = setTimeout(() => {
      refresh()
    }, 150) // Small delay to allow other hooks to settle
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, []) // Only on mount

  // Refresh when filters change, but debounced
  useEffect(() => {
    if (filters.page !== 1 || filters.status !== 'all') {
      debouncedRefresh()
    }
  }, [filters, debouncedRefresh])

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page: Math.max(1, page) }))
  }, [])

  const setStatus = useCallback((status: RequestFilters['status']) => {
    setFilters((prev) => ({ ...prev, status, page: 1 }))
  }, [])

  const approveRequest = useCallback(
    async (id: string) => {
      setBusyIds((prev) => new Set(prev).add(id))
      try {
        if (useMocks || fallbackToMocks.current) {
          await new Promise((r) => setTimeout(r, 300))
          setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'completed' } : r)))
          return
        }
        const res = await fetch(url(`/api/requests/${encodeURIComponent(id)}/approve`), { method: 'POST' })
        if (!res.ok) throw new Error(`Approve HTTP ${res.status}`)
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'completed' } : r)))
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [useMocks, apiBase],
  )

  const denyRequest = useCallback(
    async (id: string) => {
      setBusyIds((prev) => new Set(prev).add(id))
      try {
        if (useMocks || fallbackToMocks.current) {
          await new Promise((r) => setTimeout(r, 300))
          setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)))
          return
        }
        const res = await fetch(url(`/api/requests/${encodeURIComponent(id)}/deny`), { method: 'POST' })
        if (!res.ok) throw new Error(`Deny HTTP ${res.status}`)
        setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: 'rejected' } : r)))
      } finally {
        setBusyIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    [useMocks, apiBase],
  )

  const commentRequest = useCallback(
    async (id: string, message: string) => {
      const payload = { message, at: new Date().toISOString() }
      if (useMocks || fallbackToMocks.current) {
        await new Promise((r) => setTimeout(r, 200))
        return { ok: true, ...payload }
      }
      const res = await fetch(url(`/api/requests/${encodeURIComponent(id)}/comment`), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`Comment HTTP ${res.status}`)
      return res.json().catch(() => payload)
    },
    [useMocks, apiBase],
  )

  const createRequest = useCallback(
    async (data: { title: string; description?: string; priority?: RequestPriority }) => {
      if (useMocks || fallbackToMocks.current) {
        await new Promise((r) => setTimeout(r, 250))
        const rec: RequestRecord = {
          id: `req-${Date.now()}`,
          title: data.title,
          description: data.description,
          status: 'pending',
          priority: data.priority ?? 'medium',
          requester: 'you@company.com',
          createdAt: new Date().toISOString(),
          steps: [{ id: 's1', name: 'Manager approval', status: 'waiting', assignee: 'lead@company.com' }],
        }
        setRequests((prev) => [rec, ...prev])
        return rec
      }
      const res = await fetch(url('/api/requests'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(`Create HTTP ${res.status}`)
      const created = normalizeOne(await res.json(), 0)
      setRequests((prev) => [created, ...prev])
      return created
    },
    [useMocks, apiBase],
  )

  const kpis = useMemo(() => {
    const total = pagination.total || requests.length
    const pending = requests.filter((r) => r.status === 'pending').length
    const inProgress = requests.filter((r) => r.status === 'in_progress').length
    const completed = requests.filter((r) => r.status === 'completed').length
    return { total, pending, inProgress, completed }
  }, [requests, pagination.total])

  return {
    requests,
    pagination,
    isLoading,
    error,
    filters,
    setFilters,
    setPage,
    setStatus,
    refresh,
    createRequest,
    approveRequest,
    denyRequest,
    commentRequest,
    busyIds,
    kpis,
  }
}
