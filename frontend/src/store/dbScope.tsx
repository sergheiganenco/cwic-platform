import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

/**
 * What the “scope” means in your UI. Tweak to your needs.
 * Kept intentionally generic so you can hang schema/table/asset on it.
 */
export type DbScope = {
  serverId?: string | null
  dbName?: string | null
  schema?: string | null
  table?: string | null
  assetId?: string | null
}

type ScopeStatus = 'idle' | 'ready'

type DbScopeState = {
  /** current selection */
  scope: DbScope
  /** merge in partial changes or replace entirely */
  setScope: (next: Partial<DbScope> | DbScope) => void
  /** convenience setters */
  setServer: (serverId: string | null) => void
  setDatabase: (dbName: string | null) => void
  setSchema: (schema: string | null) => void
  setTable: (table: string | null) => void
  setAsset: (assetId: string | null) => void
  /** reset everything */
  resetScope: () => void
  /** simple status; expand as needed */
  status: ScopeStatus
}

const STORAGE_KEY = 'cwic.db.scope.v1'
const DbScopeContext = createContext<DbScopeState | null>(null)

function readInitial(): DbScope {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') return parsed as DbScope
    }
  } catch {
    /* ignore */
  }
  return { serverId: null, dbName: null, schema: null, table: null, assetId: null }
}

export const DbScopeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [scope, setScopeState] = useState<DbScope>(() => readInitial())
  const [status] = useState<ScopeStatus>('ready')
  const saveTimer = useRef<number | null>(null)

  const persist = useCallback((next: DbScope) => {
    try {
      // debounce a touch in case you change several fields together
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
      saveTimer.current = window.setTimeout(() => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      }, 50)
    } catch {
      /* ignore */
    }
  }, [])

  const setScope = useCallback((next: Partial<DbScope> | DbScope) => {
    setScopeState(prev => {
      const merged = ('serverId' in next || 'dbName' in next || 'schema' in next || 'table' in next || 'assetId' in next)
        ? { ...prev, ...next }
        : (next as DbScope)
      persist(merged)
      return merged
    })
  }, [persist])

  const setServer = useCallback((serverId: string | null) => {
    setScopeState(prev => {
      // when server changes, clear lower-level selections
      const merged: DbScope = { ...prev, serverId, dbName: null, schema: null, table: null, assetId: null }
      persist(merged)
      return merged
    })
  }, [persist])

  const setDatabase = useCallback((dbName: string | null) => {
    setScopeState(prev => {
      const merged: DbScope = { ...prev, dbName, schema: null, table: null, assetId: null }
      persist(merged)
      return merged
    })
  }, [persist])

  const setSchema = useCallback((schema: string | null) => {
    setScopeState(prev => {
      const merged: DbScope = { ...prev, schema, table: null }
      persist(merged)
      return merged
    })
  }, [persist])

  const setTable = useCallback((table: string | null) => {
    setScopeState(prev => {
      const merged: DbScope = { ...prev, table }
      persist(merged)
      return merged
    })
  }, [persist])

  const setAsset = useCallback((assetId: string | null) => {
    setScopeState(prev => {
      const merged: DbScope = { ...prev, assetId }
      persist(merged)
      return merged
    })
  }, [persist])

  const resetScope = useCallback(() => {
    const empty: DbScope = { serverId: null, dbName: null, schema: null, table: null, assetId: null }
    setScopeState(empty)
    persist(empty)
  }, [persist])

  const value = useMemo<DbScopeState>(() => ({
    scope,
    setScope,
    setServer,
    setDatabase,
    setSchema,
    setTable,
    setAsset,
    resetScope,
    status,
  }), [scope, setScope, setServer, setDatabase, setSchema, setTable, setAsset, resetScope, status])

  return (
    <DbScopeContext.Provider value={value}>
      {children}
    </DbScopeContext.Provider>
  )
}

export function useDbScope(): DbScopeState {
  const ctx = useContext(DbScopeContext)
  if (!ctx) {
    // This is the error you’re seeing; mounting the provider fixes it.
    throw new Error('useDbScope must be used within DbScopeProvider')
  }
  return ctx
}
