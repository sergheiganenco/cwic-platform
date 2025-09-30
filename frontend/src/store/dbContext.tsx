// src/store/dbContext.tsx
import { useApi } from '@/hooks/useApi'
import * as React from 'react'

/** Engines are broader than your DataSourceType; fine to keep them decoupled. */
export type DbEngine =
  | 'postgres'
  | 'mysql'
  | 'mssql'
  | 'snowflake'
  | 'bigquery'
  | 'oracle'
  | 'duckdb'
  | string

export interface DataSourceServer {
  id: string
  name: string
  host?: string
  port?: number
  engine: DbEngine
  // optional metadata
  region?: string
  createdAt?: string
}

export interface DatabaseItem {
  name: string
  owner?: string
  createdAt?: string
}

export interface DbSelection {
  serverId: string
  dbName: string
}

type Status = 'idle' | 'loading' | 'error' | 'ready'

interface DbState {
  servers: DataSourceServer[]
  databases: DatabaseItem[]
  selection: DbSelection | null
  status: Status
  error: string | null
  // actions
  setServer: (serverId: string | null) => void
  setDatabase: (dbName: string | null) => void
  refreshServers: () => Promise<void>
  refreshDatabases: (serverId: string) => Promise<void>
}

const DbContext = React.createContext<DbState | null>(null)
const STORAGE_KEY = 'cwic.db.selection'

/** ---- Dev mocks (only used if VITE_USE_MOCKS !== '0' and MODE=development) ---- */
const devServers: DataSourceServer[] = [
  { id: 'pg-dev', name: 'Postgres Dev', host: 'localhost', port: 5432, engine: 'postgres' },
  { id: 'pg-prod', name: 'Postgres Prod', host: 'prod.db.local', port: 5432, engine: 'postgres' },
]

const devDatabases: Record<string, DatabaseItem[]> = {
  'pg-dev': [{ name: 'analytics' }, { name: 'appdb' }, { name: 'warehouse' }],
  'pg-prod': [{ name: 'prod_analytics' }, { name: 'prod_app' }],
}

/** ---- Provider ---- */
export const DbProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const api = useApi()
  const useMocks = import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_MOCKS !== '0'

  const [servers, setServers] = React.useState<DataSourceServer[]>([])
  const [databases, setDatabases] = React.useState<DatabaseItem[]>([])
  const [selection, setSelection] = React.useState<DbSelection | null>(null)
  const [status, setStatus] = React.useState<Status>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const abortRef = React.useRef<AbortController | null>(null)

  // hydrate selection from localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as DbSelection
        if (parsed?.serverId) setSelection(parsed)
      }
    } catch {
      /* ignore */
    }
  }, [])

  // persist selection
  React.useEffect(() => {
    try {
      if (selection) localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
      else localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }, [selection])

  const cancelInFlight = React.useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  const refreshServers = React.useCallback(async () => {
    setStatus('loading')
    setError(null)
    cancelInFlight()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      if (useMocks) {
        await new Promise((r) => setTimeout(r, 200))
        setServers(devServers)
        setStatus('ready')
        return
      }

      // IMPORTANT: keep endpoint consistent with the rest of your app:
      // services/api/dataSources.ts uses '/data-sources'
      const list = await api.get<DataSourceServer[]>('/data-sources', { signal: ctrl.signal })
      setServers(Array.isArray(list) ? list : [])
      setStatus('ready')
    } catch (e: any) {
      if (e?.name === 'AbortError') return
      setError(e?.message || 'Failed to load data sources')
      if (useMocks) {
        setServers(devServers)
        setStatus('ready')
      } else {
        setStatus('error')
      }
    }
  }, [api, useMocks, cancelInFlight])

  const refreshDatabases = React.useCallback(
    async (serverId: string) => {
      if (!serverId) {
        setDatabases([])
        return
      }
      setStatus('loading')
      setError(null)
      cancelInFlight()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      try {
        if (useMocks) {
          await new Promise((r) => setTimeout(r, 180))
          setDatabases(devDatabases[serverId] ?? [])
          setStatus('ready')
          return
        }

        // Keep endpoint consistent with backend (recommend):
        // GET /data-sources/:id/databases  -> [{ name, owner, createdAt }]
        const list = await api.get<DatabaseItem[]>(
          `/data-sources/${encodeURIComponent(serverId)}/databases`,
          { signal: ctrl.signal },
        )
        setDatabases(Array.isArray(list) ? list : [])
        setStatus('ready')
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        setError(e?.message || 'Failed to load databases')
        if (useMocks) {
          setDatabases(devDatabases[serverId] ?? [])
          setStatus('ready')
        } else {
          setStatus('error')
        }
      }
    },
    [api, useMocks, cancelInFlight],
  )

  // initial server load
  React.useEffect(() => {
    refreshServers()
    return () => cancelInFlight()
  }, [refreshServers, cancelInFlight])

  // auto-load databases when a server is selected (e.g., from persisted selection)
  React.useEffect(() => {
    if (selection?.serverId) refreshDatabases(selection.serverId)
  }, [selection?.serverId, refreshDatabases])

  const setServer = React.useCallback((serverId: string | null) => {
    setDatabases([])
    if (!serverId) {
      setSelection(null)
      return
    }
    setSelection((prev) => ({
      serverId,
      dbName: prev?.serverId === serverId ? (prev?.dbName ?? '') : '',
    }))
  }, [])

  const setDatabase = React.useCallback((dbName: string | null) => {
    if (!dbName) {
      setSelection((prev) => (prev ? { ...prev, dbName: '' } : null))
      return
    }
    setSelection((prev) => (prev ? { ...prev, dbName } : null))
  }, [])

  const value = React.useMemo<DbState>(
    () => ({
      servers,
      databases,
      selection,
      status,
      error,
      setServer,
      setDatabase,
      refreshServers,
      refreshDatabases,
    }),
    [servers, databases, selection, status, error, setServer, setDatabase, refreshServers, refreshDatabases],
  )

  return <DbContext.Provider value={value}>{children}</DbContext.Provider>
}

/** Consumer hook (full state) */
export function useDb() {
  const ctx = React.useContext(DbContext)
  if (!ctx) throw new Error('useDb must be used within DbProvider')
  return ctx
}

/** Lightweight helper for common case (selected server/db only) */
export function useDbSelection() {
  const { selection, setServer, setDatabase, servers, databases, status, error } = useDb()
  return { selection, setServer, setDatabase, servers, databases, status, error }
}
