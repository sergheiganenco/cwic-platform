// src/pages/DataSources.tsx
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Database,
  Grid,
  Info,
  List,
  Plus,
  RefreshCw,
  Search,
  Server,
  Shield,
  TrendingUp,
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import AddConnectionWizard from '@/components/features/data-sources/AddConnectionWizard'
import DataSourceCard from '@/components/features/data-sources/DataSourceCard'
import DataSourceConfigModal from '@/components/features/data-sources/DataSourceConfigModal'
import { Button } from '@/components/ui/Button'
import { GradientIcon } from '@/components/ui/GradientIcon'
import { GradientText } from '@/components/ui/GradientText'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useDataSources } from '@/hooks/useDataSources'
import type {
  ConnectionTestResult,
  DataSource,
  DataSourceStatus,
  DataSourceType,
  SyncResult
} from '@/types/dataSources'

type ViewMode = 'grid' | 'list'

interface FilterState {
  search: string
  status: DataSourceStatus | ''
  type: DataSourceType | ''
  scope: 'all' | 'server' | 'database'
  hasError: boolean
  hasUsage: boolean
  tags: string[]
}

export default function DataSourcesPage() {
  const {
    items,
    page,
    setPage,
    limit,
    setLimit,
    total,
    status: apiStatus,
    setStatus: setApiStatus,
    type: apiType,
    setType: setApiType,
    loading,
    error,
    refresh,
    summary,
    create,
    update,
    remove,
    test,
    sync,
    listDatabases,
    setScopeFromPick,
  } = useDataSources()

  /* ------------------------------- UI state ------------------------------- */
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showWizard, setShowWizard] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false)
  const [configuringDataSource, setConfiguringDataSource] = useState<DataSource | null>(null)
  const [syncingDataSources, setSyncingDataSources] = useState<Set<string>>(new Set())

  // per-connection database browsing
  const [browsedDatabases, setBrowsedDatabases] = useState<Record<string, string[]>>({})
  const [loadingDatabases, setLoadingDatabases] = useState<Record<string, boolean>>({})
  const [databaseSearchTerms, setDatabaseSearchTerms] = useState<Record<string, string>>({})
  const [discoveredDatabaseCount, setDiscoveredDatabaseCount] = useState<number>(0)

  // filters (decoupled from hook to allow richer UI)
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: '',
    type: '',
    scope: 'all',
    hasError: false,
    hasUsage: false,
    tags: [],
  })

  // debounce search
  const [searchInput, setSearchInput] = useState('')
  const debounceRef = useRef<number | null>(null)
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput.trim() }))
      setPage(1)
    }, 250)
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current)
    }
  }, [searchInput, setPage])

  // keep server-side filters in sync
  useEffect(() => {
    setApiStatus(filters.status)
    setApiType(filters.type)
  }, [filters.status, filters.type, setApiStatus, setApiType])

  // Function to fetch discovered database counts
  const fetchDatabaseCounts = useCallback(async () => {
    if (items.length === 0) {
      setDiscoveredDatabaseCount(0)
      return
    }

    try {
      const counts = await Promise.all(
        items.map(async (source) => {
          try {
            const dbs = await listDatabases(source.id)
            return dbs.length
          } catch {
            return 1 // fallback to 1 if can't list
          }
        })
      )
      setDiscoveredDatabaseCount(counts.reduce((sum, count) => sum + count, 0))
    } catch (error) {
      console.error('Failed to fetch database counts:', error)
      setDiscoveredDatabaseCount(items.length) // fallback to source count
    }
  }, [items, listDatabases])

  // Fetch discovered database count for all sources on mount and when items change
  useEffect(() => {
    fetchDatabaseCounts()
  }, [fetchDatabaseCounts])

  // Custom refresh handler that also updates database counts
  const handleRefresh = useCallback(async () => {
    await refresh()
    await fetchDatabaseCounts()
  }, [refresh, fetchDatabaseCounts])

  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)))

  /* ---------------------------- derived summary --------------------------- */
  const enhancedSummary = useMemo(() => {
    const serverLevel = items.filter(it => (it.connectionConfig as any)?.scope === 'server').length
    const databaseLevel = items.length - serverLevel

    // Count total databases being tracked
    const totalDatabases = items.reduce((sum, it) => {
      const cfg = it.connectionConfig as any
      // count multiple only if repo stores them; otherwise count 1
      return sum + (Array.isArray(cfg?.databases) ? cfg.databases.length : 1)
    }, 0)

    // Count unique servers (group by host:port)
    const uniqueServers = new Set(
      items.map(it => {
        const cfg = it.connectionConfig as any
        const host = cfg?.host || cfg?.server || 'unknown'
        const port = cfg?.port || ''
        return `${host}:${port}`
      })
    ).size

    const activeCount = items.filter(it => it.status === 'active' || it.status === 'connected').length
    const errorCount = items.filter(it => it.status === 'error' || it.healthStatus?.status === 'down').length
    const healthyCount = items.filter(it =>
      (it.status === 'active' || it.status === 'connected') &&
      (!it.healthStatus || it.healthStatus.status === 'healthy')
    ).length

    const avgHealth =
      items.length === 0
        ? 0
        : items.reduce((acc, it) => {
            if (it.status === 'active' || it.status === 'connected') return acc + 100
            if (it.status === 'error') return acc + 0
            return acc + 50
          }, 0) / items.length

    // Find most recent activity
    const allDates = items.flatMap(it => [it.lastSyncAt, it.lastTestAt].filter(Boolean))
    const mostRecentActivity = allDates.length > 0
      ? new Date(Math.max(...allDates.map(d => new Date(d!).getTime())))
      : null

    return {
      ...summary,
      serverLevel,
      databaseLevel,
      totalDatabases,
      uniqueServers,
      activeCount,
      errorCount,
      healthyCount,
      avgHealth,
      mostRecentActivity
    }
  }, [items, summary])

  /* ------------------------------ tag catalog ----------------------------- */
  const availableTags = useMemo(() => {
    const s = new Set<string>()
    for (const it of items) (it.tags || []).forEach(t => s.add(t))
    return Array.from(s).sort()
  }, [items])

  /* ------------------------------ local filter ---------------------------- */
  const filteredItems = useMemo(() => {
    const q = filters.search.toLowerCase()
    return items.filter(item => {
      const cfg = item.connectionConfig as any
      const scope = (cfg?.scope as string) || 'database'

      if (q) {
        const hit =
          item.name.toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          item.type.toLowerCase().includes(q) ||
          (cfg?.host || '').toLowerCase().includes(q) ||
          (cfg?.database || '').toLowerCase().includes(q)
        if (!hit) return false
      }

      if (filters.status && item.status !== filters.status) return false
      if (filters.type && item.type !== filters.type) return false
      if (filters.scope === 'server' && scope !== 'server') return false
      if (filters.scope === 'database' && scope === 'server') return false

      if (filters.hasError && !(item.status === 'error' || item.healthStatus?.status === 'down'))
        return false

      if (
        filters.hasUsage &&
        !(item.usage && (item.usage.queriesCount > 0 || item.usage.lastUsed))
      )
        return false

      if (filters.tags.length > 0) {
        const itemTags = item.tags || []
        const match = filters.tags.some(t => itemTags.includes(t))
        if (!match) return false
      }

      return true
    })
  }, [items, filters])

  /* ---------------------- helpers: filters + pagination ------------------- */
  const updateFilter = useCallback(
    <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
      setFilters(prev => ({ ...prev, [key]: value }))
      setPage(1)
    },
    [setPage],
  )

  const clearFilters = useCallback(() => {
    setFilters({
      search: '',
      status: '',
      type: '',
      scope: 'all',
      hasError: false,
      hasUsage: false,
      tags: [],
    })
    setSearchInput('')
    setPage(1)
  }, [setPage])

  /* --------------------------- after create test -------------------------- */
  const handleTestAfterCreate = useCallback(
    async (id: string) => {
      try {
        const result = await test(id)

        // Prefer explicit flags if present
        const explicit =
          (result as any)?.success ??
          (result as any)?.ok ??
          (result as any)?.connected

        // Fall back to textual status fields (no ?? on boolean)
        const status =
          (result as any)?.status ??
          (result as any)?.state ??
          (result as any)?.connectionStatus

        const ok = typeof explicit === 'boolean' ? explicit : status === 'connected'

        const message =
          (result as any)?.message ||
          (result as any)?.error ||
          ((result as any)?.errors?.[0] as string | undefined) ||
          (ok ? 'Test completed' : 'Test failed')

        return { success: !!ok, message }
      } catch (err: any) {
        return { success: false, message: err?.message || 'Test failed' }
      }
    },
    [test],
  )

  /* -------------------------- browse databases UI ------------------------- */
  const handleBrowseDatabases = useCallback(
    async (id: string) => {
      // Toggle: if already loaded, collapse
      if (browsedDatabases[id]) {
        setBrowsedDatabases(prev => {
          const n = { ...prev }
          delete n[id]
          return n
        })
        return
      }

      // Load databases
      setLoadingDatabases(prev => ({ ...prev, [id]: true }))
      try {
        const dbs = await listDatabases(id);
        setBrowsedDatabases(prev => ({ ...prev, [id]: dbs }));
      } catch (error) {
        console.error('Failed to load databases:', error);
        setBrowsedDatabases(prev => ({ ...prev, [id]: [] }));
      } finally {
        setLoadingDatabases(prev => ({ ...prev, [id]: false }));
      }
    },
    [browsedDatabases, listDatabases],
  )

  /* ------------------------------ bulk actions ---------------------------- */
  const handleBulkOperation = useCallback(
    async (op: 'test' | 'sync' | 'delete') => {
      if (selectedItems.size === 0) return
      setBulkOperationLoading(true)
      const ids = Array.from(selectedItems)

      const results = await Promise.allSettled(
        ids.map(id => (op === 'test' ? test(id) : op === 'sync' ? sync(id) : remove(id))),
      )

      const ok = results.filter(r => r.status === 'fulfilled').length
      const fail = results.length - ok
      alert(`Bulk ${op}: ${ok} succeeded, ${fail} failed`)
      setSelectedItems(new Set())
      setBulkOperationLoading(false)
      refresh()
    },
    [selectedItems, test, sync, remove, refresh],
  )

  /* --------------------------------- UI ----------------------------------- */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:items-start lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold flex items-center gap-3 mb-2">
            <GradientIcon icon={Server} color="blue" size="lg" animate />
            <GradientText from="blue-600" via="indigo-600" to="purple-600">
              Data Sources
            </GradientText>
          </h1>
          <p className="text-gray-600 text-lg">
            Server-level connections • One connection, all databases • 60-80% less configuration
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 hover:scale-105 transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-xl transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Summary - Quality-focused 4-card layout */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Sources & Health Overview */}
        <div className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 ring-2 ring-blue-200 ring-offset-2">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-1">
                {enhancedSummary.total}
              </div>
              <div className="text-sm text-gray-600 font-semibold">Total Sources</div>
              <div className="text-xs text-blue-600 font-medium mt-1">
                {enhancedSummary.healthyCount}/{enhancedSummary.total} Healthy
              </div>
            </div>
            <GradientIcon icon={Database} color="blue" size="lg" animate />
          </div>
          <ProgressBar
            value={enhancedSummary.avgHealth}
            color="blue"
            height="sm"
            animate
          />
          <div className="mt-2 text-xs text-gray-500 text-center">
            {Math.round(enhancedSummary.avgHealth)}% Overall Health
          </div>
        </div>

        {/* Card 2: Server & Database Coverage */}
        <div className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300 ring-2 ring-purple-200 ring-offset-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="text-sm text-gray-600 font-semibold mb-2">Coverage</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-gray-700">Servers</span>
                  </div>
                  <span className="text-2xl font-bold text-purple-600">{enhancedSummary.uniqueServers}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-gray-700">Databases</span>
                  </div>
                  <span className="text-2xl font-bold text-blue-600">{discoveredDatabaseCount || enhancedSummary.totalDatabases}</span>
                </div>
              </div>
            </div>
            <GradientIcon icon={Database} color="purple" size="lg" animate />
          </div>
          <div className="mt-3 p-2 bg-purple-50 rounded-lg border border-purple-200">
            <div className="text-xs text-purple-700 text-center font-medium">
              {discoveredDatabaseCount > enhancedSummary.totalDatabases
                ? `${enhancedSummary.totalDatabases} tracked • ${discoveredDatabaseCount - enhancedSummary.totalDatabases} available`
                : discoveredDatabaseCount > 0
                ? `All ${discoveredDatabaseCount} databases tracked`
                : 'No databases discovered yet'}
            </div>
          </div>
        </div>

        {/* Card 3: Connection Status */}
        <div className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1">
              <div className="text-sm text-gray-600 font-semibold mb-2">Connection Status</div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">Active</span>
                  </div>
                  <span className="text-2xl font-bold text-green-600">{enhancedSummary.activeCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="text-sm text-gray-700">Errors</span>
                  </div>
                  <span className="text-2xl font-bold text-red-600">{enhancedSummary.errorCount}</span>
                </div>
              </div>
            </div>
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              enhancedSummary.errorCount === 0
                ? 'bg-gradient-to-br from-green-400 to-emerald-600'
                : 'bg-gradient-to-br from-amber-400 to-orange-600'
            }`}>
              {enhancedSummary.errorCount === 0 ? (
                <CheckCircle className="w-8 h-8 text-white" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-white" />
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Last Activity */}
        <div className="bg-white rounded-2xl border-2 shadow-lg p-6 hover:shadow-2xl hover:scale-105 transition-all duration-300">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <div className="text-sm text-gray-600 font-semibold mb-2">Last Activity</div>
              {enhancedSummary.mostRecentActivity ? (
                <>
                  <div className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-1">
                    {(() => {
                      const diff = Date.now() - new Date(enhancedSummary.mostRecentActivity).getTime()
                      const minutes = Math.floor(diff / 60000)
                      const hours = Math.floor(minutes / 60)
                      const days = Math.floor(hours / 24)

                      if (days > 0) return `${days}d ago`
                      if (hours > 0) return `${hours}h ago`
                      if (minutes > 0) return `${minutes}m ago`
                      return 'Just now'
                    })()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(enhancedSummary.mostRecentActivity).toLocaleString()}
                  </div>
                </>
              ) : (
                <div className="text-lg text-gray-400 font-medium">No activity yet</div>
              )}
            </div>
            <GradientIcon icon={TrendingUp} color="indigo" size="lg" animate />
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="mt-3 w-full p-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-center gap-1.5 text-xs text-indigo-700 font-medium">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Refreshing...' : 'Refresh to update'}</span>
            </div>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border shadow-sm p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search (debounced) */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search connections, hosts, databases..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              aria-label="Search data sources"
            />
          </div>

          {/* Quick filters */}
          <div className="flex flex-wrap gap-3">
            <select
              value={filters.status}
              onChange={e => updateFilter('status', e.target.value as DataSourceStatus | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="pending">Pending</option>
              <option value="error">Error</option>
              <option value="testing">Testing</option>
            </select>

            <select
              value={filters.type}
              onChange={e => updateFilter('type', e.target.value as DataSourceType | '')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Types</option>
              <option value="postgresql">PostgreSQL</option>
              <option value="mysql">MySQL</option>
              <option value="mssql">SQL Server</option>
              <option value="mongodb">MongoDB</option>
              <option value="redis">Redis</option>
              <option value="snowflake">Snowflake</option>
              <option value="bigquery">BigQuery</option>
              <option value="redshift">Redshift</option>
              <option value="databricks">Databricks</option>
              <option value="s3">Amazon S3</option>
              <option value="azure-blob">Azure Blob</option>
              <option value="gcs">Google Cloud Storage</option>
              <option value="kafka">Kafka</option>
              <option value="api">REST API</option>
              <option value="file">File</option>
              <option value="ftp">FTP/SFTP</option>
              <option value="elasticsearch">Elasticsearch</option>
              <option value="oracle">Oracle</option>
            </select>

            <select
              value={filters.scope}
              onChange={e => updateFilter('scope', e.target.value as FilterState['scope'])}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="all">All Scopes</option>
              <option value="server">Server-Level</option>
              <option value="database">Database-Level</option>
            </select>

            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Advanced toggles */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasError}
              onChange={e => updateFilter('hasError', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span>Has Errors</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.hasUsage}
              onChange={e => updateFilter('hasUsage', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span>Has Usage Data</span>
          </label>

          {/* Tag chips */}
          {availableTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-500">Tags:</span>
              {availableTags.map(tag => {
                const active = filters.tags.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() =>
                      updateFilter('tags', active ? filters.tags.filter(t => t !== tag) : [...filters.tags, tag])
                    }
                    className={`px-2 py-1 rounded-full text-xs border ${
                      active
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                    aria-pressed={active}
                  >
                    {tag}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Results summary + view & page size */}
        <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center text-sm text-gray-600">
          <div>
            Showing {filteredItems.length} of {total} connections
            {filters.search && ` matching "${filters.search}"`}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span>View:</span>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                aria-label="Grid view"
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <select
              value={limit}
              onChange={e => {
                setLimit(Number(e.target.value))
                setPage(1)
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm"
              aria-label="Items per page"
            >
              <option value={12}>12 per page</option>
              <option value={24}>24 per page</option>
              <option value={48}>48 per page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk actions */}
      {selectedItems.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Info className="w-5 h-5 text-blue-600" />
              <span className="text-blue-800 font-medium">
                {selectedItems.size} connection{selectedItems.size > 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkOperation('test')}
                disabled={bulkOperationLoading}
              >
                Test All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkOperation('sync')}
                disabled={bulkOperationLoading}
              >
                Sync All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedItems(new Set())}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="rounded-2xl border p-12 text-center">
          <div className="inline-flex items-center gap-3 text-gray-500">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-lg">Loading data sources...</span>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-6 h-6" />
            <div>
              <h3 className="font-medium">Failed to load data sources</h3>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleRefresh} className="mt-4 text-red-600 border-red-200 hover:bg-red-50">
            Try Again
          </Button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 p-16 text-center">
          <div className="text-6xl mb-6">🔌</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">
            {items.length === 0 ? 'No data sources yet' : 'No matches found'}
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {items.length === 0
              ? 'Connect to databases, APIs, and storage systems with our server-level approach that reduces configuration overhead by 60–80%.'
              : "Try adjusting your search terms or filters to find the connections you're looking for."}
          </p>
          {items.length === 0 ? (
            <Button onClick={() => setShowWizard(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Connection
            </Button>
          ) : (
            <Button variant="outline" onClick={clearFilters}>
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6' : 'space-y-4'}>
          {filteredItems.map(ds => {
            const isChecked = selectedItems.has(ds.id)
            return (
              <div key={ds.id} className="relative">
                {/* Selection checkbox overlay */}
                <div className="absolute left-4 top-4 z-20">
                  <label className="flex items-center justify-center w-6 h-6 bg-white rounded-lg border-2 border-gray-300 hover:border-blue-500 cursor-pointer transition-all shadow-sm hover:shadow-md">
                    <input
                      aria-label={`Select ${ds.name}`}
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => {
                        setSelectedItems(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(ds.id)
                          else next.delete(ds.id)
                          return next
                        })
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    />
                  </label>
                </div>

                <DataSourceCard
                    ds={ds}
                    syncing={syncingDataSources.has(ds.id)}
                    onTest={async (id: string) => {
                      const toastId = toast.loading('Testing connection...')
                      try {
                        const res = (await test(id)) as ConnectionTestResult | any
                        const ok = !!res?.success
                        const failMsg =
                          res?.message || (res as any)?.error || (res as any)?.errors?.[0] || 'Unknown error'

                        if (ok) {
                          toast.success('Connection successful!', { id: toastId })
                          await handleRefresh()
                        } else {
                          toast.error(`Test failed: ${failMsg}`, { id: toastId })
                        }
                      } catch (err: any) {
                        toast.error(`Test failed: ${err?.message || 'Unknown error'}`, { id: toastId })
                      }
                    }}
                    onSync={async (id: string) => {
                      // Add to syncing set
                      setSyncingDataSources(prev => new Set(prev).add(id))

                      const toastId = toast.loading('Starting sync...')
                      try {
                        const res = (await sync(id)) as SyncResult | any
                        const ok = res?.success !== false

                        if (ok) {
                          // Show progress toast
                          toast.success('Sync in progress - click Refresh to see updated timestamp', {
                            id: toastId,
                            duration: 5000
                          })

                          // Auto-stop spinner after 15 seconds
                          setTimeout(() => {
                            setSyncingDataSources(prev => {
                              const next = new Set(prev)
                              next.delete(id)
                              return next
                            })
                          }, 15000)
                        } else {
                          toast.error('Sync failed to start', { id: toastId })
                          setSyncingDataSources(prev => {
                            const next = new Set(prev)
                            next.delete(id)
                            return next
                          })
                        }
                      } catch (err: any) {
                        toast.error(`Sync failed: ${err?.message || 'Unknown error'}`, { id: toastId })
                        setSyncingDataSources(prev => {
                          const next = new Set(prev)
                          next.delete(id)
                          return next
                        })
                      }
                    }}
                    onDelete={async (id: string) => {
                      if (confirm('Delete this data source? This cannot be undone.')) {
                        try {
                          await remove(id)
                          alert('Data source deleted successfully')
                          refresh()
                        } catch (err: any) {
                          alert(`Delete failed: ${err.message}`)
                        }
                      }
                    }}
                    onConfigure={(id: string) => {
                      const dataSource = items.find(item => item.id === id)
                      if (dataSource) {
                        setConfiguringDataSource(dataSource)
                      }
                    }}
                    onBrowseDatabases={handleBrowseDatabases}
                  />

                {/* Browse databases per DS - Manual Button to Load */}
                <div className="mt-3">
                  {/* Show/Hide Databases button */}
                  {!browsedDatabases[ds.id] && !loadingDatabases[ds.id] && (
                    <Button
                      variant="outline"
                      onClick={() => handleBrowseDatabases(ds.id)}
                      className="w-full justify-center gap-2 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50 transition-all bg-gradient-to-br from-purple-50/30 to-blue-50/30"
                    >
                      <Database className="w-4 h-4" />
                      Show Available Databases
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  )}

                    {/* Loading state */}
                    {loadingDatabases[ds.id] && !browsedDatabases[ds.id] && (
                      <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-blue-50 p-6 text-center">
                        <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-2" />
                        <p className="text-sm font-medium text-purple-700">Discovering databases...</p>
                      </div>
                    )}

                    {/* Databases Display - Compact Grid/Chip Layout */}
                    {browsedDatabases[ds.id] && (() => {
                      // Filter databases based on search term
                      const searchTerm = (databaseSearchTerms[ds.id] || '').toLowerCase().trim()
                      const allDatabases = browsedDatabases[ds.id]
                      const filteredDatabases = searchTerm
                        ? allDatabases.filter(db => db.toLowerCase().includes(searchTerm))
                        : allDatabases
                      const hasSearch = searchTerm.length > 0
                      const showSearchBar = allDatabases.length > 5 // Only show search if more than 5 databases

                      return (
                        <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50/30 to-blue-50/30 overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-300">
                          {/* Header with collapse button */}
                          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2.5 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-white">
                              <Database className="w-4 h-4" />
                              <span className="font-bold text-sm">Available Databases</span>
                              <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs font-bold">
                                {allDatabases.length}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                handleBrowseDatabases(ds.id) // Toggle collapse
                                // Clear search when collapsing
                                setDatabaseSearchTerms(prev => {
                                  const next = { ...prev }
                                  delete next[ds.id]
                                  return next
                                })
                              }}
                              disabled={loadingDatabases[ds.id]}
                              className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-all"
                              title="Hide databases"
                            >
                              <ChevronUp className="w-4 h-4" />
                            </button>
                          </div>

                          {allDatabases.length === 0 ? (
                            <div className="p-6 text-center">
                              <Database className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                              <p className="text-sm text-gray-600 font-medium">No databases found</p>
                              <p className="text-xs text-gray-500 mt-1">Check connection permissions</p>
                            </div>
                          ) : (
                            <>
                              {/* Search bar (only shown when > 5 databases) */}
                              {showSearchBar && (
                                <div className="px-4 pt-3 pb-2 bg-white/40 border-b border-purple-200">
                                  <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                    <input
                                      type="text"
                                      placeholder="Search databases..."
                                      value={databaseSearchTerms[ds.id] || ''}
                                      onChange={(e) => setDatabaseSearchTerms(prev => ({ ...prev, [ds.id]: e.target.value }))}
                                      className="w-full pl-9 pr-3 py-1.5 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
                                    />
                                    {hasSearch && (
                                      <button
                                        onClick={() => setDatabaseSearchTerms(prev => {
                                          const next = { ...prev }
                                          delete next[ds.id]
                                          return next
                                        })}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                        title="Clear search"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Compact chip grid display */}
                              <div className="p-4 max-h-80 overflow-y-auto">
                                {filteredDatabases.length === 0 ? (
                                  <div className="text-center py-8">
                                    <Search className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">No databases match "{searchTerm}"</p>
                                    <button
                                      onClick={() => setDatabaseSearchTerms(prev => {
                                        const next = { ...prev }
                                        delete next[ds.id]
                                        return next
                                      })}
                                      className="text-xs text-purple-600 hover:text-purple-700 mt-2 underline"
                                    >
                                      Clear search
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex flex-wrap gap-2">
                                    {filteredDatabases.map((db, idx) => {
                                      // Find the original index for numbering
                                      const originalIdx = allDatabases.indexOf(db)
                                      return (
                                        <button
                                          key={db}
                                          onClick={() => setScopeFromPick(ds as any, db)}
                                          className="group flex items-center gap-2 px-3 py-2 bg-white hover:bg-purple-50 border border-purple-200 hover:border-purple-400 rounded-lg transition-all duration-200 hover:shadow-md hover:scale-105"
                                          title={`Click to create connection for ${db}`}
                                        >
                                          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-sm">
                                            {originalIdx + 1}
                                          </div>
                                          <span className="text-sm font-medium text-gray-700 group-hover:text-purple-700 transition-colors truncate max-w-[200px]">
                                            {db}
                                          </span>
                                          <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover:text-purple-600 transform group-hover:rotate-90 transition-transform flex-shrink-0" />
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>

                              {/* Footer with instructions */}
                              <div className="bg-white/60 px-4 py-2 border-t border-purple-200 flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <Info className="w-3 h-3" />
                                  Click a database chip to create a focused connection
                                </div>
                                <div className="text-xs text-purple-600 font-medium">
                                  {hasSearch && filteredDatabases.length !== allDatabases.length
                                    ? `${filteredDatabases.length} of ${allDatabases.length}`
                                    : `${allDatabases.length} database${allDatabases.length !== 1 ? 's' : ''}`
                                  }
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {filteredItems.length > 0 && (
        <div className="flex items-center justify-between bg-white rounded-2xl border shadow-sm p-4">
          <div className="text-sm text-gray-600">
            Showing {Math.min((page - 1) * limit + 1, total)} to {Math.min(page * limit, total)} of {total} connections
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {getPageWindow(page, pages, 5).map(pn => (
                <button
                  key={pn}
                  onClick={() => setPage(pn)}
                  className={`w-8 h-8 text-sm rounded ${
                    pn === page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                >
                  {pn}
                </button>
              ))}
            </div>

            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Configuration Modal */}
      {configuringDataSource && (
        <DataSourceConfigModal
          open={!!configuringDataSource}
          onClose={() => setConfiguringDataSource(null)}
          dataSource={configuringDataSource}
          onSave={async (id, updates) => {
            await update(id, updates)
            await handleRefresh()
          }}
          onTest={async (id, config) => {
            // Test with the form configuration (not saved config)
            const { testDataSourceConfig } = await import('@/services/api/dataSources')
            return await testDataSourceConfig(configuringDataSource.type, config)
          }}
        />
      )}

      {/* Wizard */}
        {showWizard && (
            <AddConnectionWizard
              open={showWizard}
              onClose={() => setShowWizard(false)}
              onCreate={create}
              existingConnections={items}
              onTestConnection={async (payload, signal) => {
              // Debug logging
              console.log('🔍 Wizard payload received:', payload);
              
              // Map wizard payload -> backend contract
              let cfg = payload?.connectionConfig;
              console.log('🔍 Connection config extracted:', cfg);
              
              // If someone accidentally passed a JSON string, try to parse it
              if (typeof cfg === 'string') {
                try { cfg = JSON.parse(cfg); } catch { /* leave as-is */ }
              }
              
              // As a final guard, ensure we send an object
              if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
                console.error('❌ Config validation failed:', cfg);
                return { success: false, message: 'Config must be an object' };
              }
              
              const body = { type: payload.type, config: cfg };
              console.log('🚀 Sending to backend:', JSON.stringify(body, null, 2));
              
              const res = await fetch('http://localhost:8000/api/data-sources/test', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-dev-auth': '1',
                },
                body: JSON.stringify(body),
                signal,
              });
              
              const text = await res.text();
              console.log('📥 Backend response:', text);
              
              let json: any = null;
              try { json = JSON.parse(text); } catch { /* no-op */ }
              if (!res.ok) {
                // Mirror express-validator's format into a single message
                const msg =
                  json?.error?.message ||
                  json?.message ||
                  (Array.isArray(json?.details) && json.details.map((e: any) => `${e.path}: ${e.msg}`).join(', ')) ||
                  text ||
                  `HTTP ${res.status}`;
                console.error('❌ Backend error:', msg);
                return { success: false, message: msg };
              }
              const data = json?.data ?? {};
              return {
                success: !!data.success,
                message: data.error || data.connectionStatus || 'Test completed',
                databases: undefined,
                metadata: undefined,
              };
            }}
            />
          )}


    </div>
  )
}

/* --------------------------------- utils ---------------------------------- */

function getPageWindow(current: number, total: number, size: number): number[] {
  if (total <= size) return Array.from({ length: total }, (_, i) => i + 1)
  const half = Math.floor(size / 2)
  let start = Math.max(1, current - half)
  let end = start + size - 1
  if (end > total) {
    end = total
    start = Math.max(1, end - size + 1)
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/* ----------------------------- stat card ---------------------------------- */

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  color: 'blue' | 'purple' | 'green' | 'red' | 'indigo' | 'emerald'
  subtitle?: string
  gradient?: boolean
  highlight?: boolean
  progressValue?: number
}

function StatCard({ label, value, icon, color, subtitle, gradient, highlight, progressValue }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  } as const

  const gradientColors = {
    blue: 'blue',
    purple: 'purple',
    green: 'green',
    red: 'red',
    indigo: 'indigo',
    emerald: 'teal',
  } as const

  return (
    <div className={`bg-white rounded-2xl border shadow-lg p-5 hover:shadow-2xl hover:scale-105 transition-all duration-300 ${
      highlight ? 'ring-2 ring-purple-300 ring-offset-2' : ''
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1">
          <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            {value}
          </div>
          <div className="text-sm text-gray-600 font-semibold">{label}</div>
          {subtitle && <div className="text-xs text-purple-600 font-medium mt-1">{subtitle}</div>}
        </div>
        {gradient ? (
          <GradientIcon
            icon={icon.type as any}
            color={gradientColors[color]}
            size="md"
            animate
          />
        ) : (
          <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${colorClasses[color]}`}>
            {icon}
          </div>
        )}
      </div>

      {progressValue !== undefined && (
        <ProgressBar
          value={progressValue}
          color={gradientColors[color] as any}
          height="sm"
          animate
        />
      )}
    </div>
  )
}
