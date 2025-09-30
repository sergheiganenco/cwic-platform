// src/pages/DataSources.tsx
import {
  AlertTriangle,
  CheckCircle,
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

import AddConnectionWizard from '@/components/features/data-sources/AddConnectionWizard'
import DataSourceCard from '@/components/features/data-sources/DataSourceCard'
import { Button } from '@/components/ui/Button'
import { useDataSources } from '@/hooks/useDataSources'
import type {
  ConnectionTestResult,
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

  // per-connection database browsing
  const [browsedDatabases, setBrowsedDatabases] = useState<Record<string, string[]>>({})
  const [loadingDatabases, setLoadingDatabases] = useState<Record<string, boolean>>({})

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

  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)))

  /* ---------------------------- derived summary --------------------------- */
  const enhancedSummary = useMemo(() => {
    const serverLevel = items.filter(it => (it.connectionConfig as any)?.scope === 'server').length

    const totalDatabases = items.reduce((sum, it) => {
      const cfg = it.connectionConfig as any
      // count multiple only if repo stores them; otherwise count 1
      return sum + (Array.isArray(cfg?.databases) ? cfg.databases.length : 1)
    }, 0)

    const withUsage = items.filter(
      it => !!it.usage && (it.usage.queriesCount > 0 || !!it.usage.lastUsed),
    ).length

    const avgHealth =
      items.length === 0
        ? 0
        : items.reduce((acc, it) => {
            if (it.status === 'active') return acc + 100
            if (it.status === 'error') return acc + 0
            return acc + 50
          }, 0) / items.length

    return { ...summary, serverLevel, totalDatabases, withUsage, avgHealth }
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
      if (browsedDatabases[id]) {
        setBrowsedDatabases(prev => {
          const n = { ...prev }
          delete n[id]
          return n
        })
        return
      }

      setLoadingDatabases(prev => ({ ...prev, [id]: true }))
      try {
        // Find the data source
        const dataSource = items.find(item => item.id === id);
        if (!dataSource) {
          console.error('Data source not found:', id);
          setBrowsedDatabases(prev => ({ ...prev, [id]: [] }));
          return;
        }

        console.log('🔍 Browsing databases for:', dataSource.name, dataSource.type);

        // Use the same discovery endpoint as the wizard
        const response = await fetch('http://localhost:8000/api/data-sources/databases/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-dev-auth': '1',
          },
          body: JSON.stringify({
            type: dataSource.type,
            config: dataSource.connectionConfig,
          }),
        });

        const result = await response.json();
        console.log('🔍 Browse databases response:', result);
        
        if (response.ok && result.success && Array.isArray(result.data)) {
          const dbs = result.data.map((db: any) => db.name || db);
          console.log('✅ Found databases:', dbs);
          setBrowsedDatabases(prev => ({ ...prev, [id]: dbs }));
        } else {
          console.warn('❌ Database discovery failed:', result);
          setBrowsedDatabases(prev => ({ ...prev, [id]: [] }));
        }
      } catch (error) {
        console.error('❌ Browse databases error:', error);
        setBrowsedDatabases(prev => ({ ...prev, [id]: [] }));
      } finally {
        setLoadingDatabases(prev => ({ ...prev, [id]: false }));
      }
    },
    [browsedDatabases, items], // Add items to dependencies
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
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Sources</h1>
          <p className="text-gray-600 mt-1">
            Manage server-level connections and database discovery across your data infrastructure
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Connection
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        <StatCard
          label="Total Sources"
          value={enhancedSummary.total}
          icon={<Database className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="Server-Level"
          value={enhancedSummary.serverLevel}
          icon={<Server className="w-5 h-5" />}
          color="purple"
          subtitle={`${enhancedSummary.totalDatabases} databases`}
        />
        <StatCard
          label="Healthy"
          value={enhancedSummary.healthy}
          icon={<CheckCircle className="w-5 h-5" />}
          color="green"
        />
        <StatCard
          label="With Errors"
          value={enhancedSummary.error}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
        />
        <StatCard
          label="Active Usage"
          value={enhancedSummary.withUsage}
          icon={<TrendingUp className="w-5 h-5" />}
          color="indigo"
        />
        <StatCard
          label="Avg Health"
          value={`${Math.round(enhancedSummary.avgHealth)}%`}
          icon={<Shield className="w-5 h-5" />}
          color="emerald"
        />
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
          <Button variant="outline" onClick={refresh} className="mt-4 text-red-600 border-red-200 hover:bg-red-50">
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
                <div className="absolute left-3 top-3 z-10">
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
                    className="w-4 h-4 rounded border-gray-300 text-blue-600"
                  />
                </div>

                <DataSourceCard
                    ds={ds}
                    onTest={async (id: string) => {
                      try {
                        const res = (await test(id)) as ConnectionTestResult | any
                        // rely on `success` boolean (do not assume `connectionStatus`)
                        const ok = !!res?.success
                        const failMsg =
                          res?.message || (res as any)?.error || (res as any)?.errors?.[0] || 'Unknown error'
                        alert(ok ? 'Connection successful!' : `Test failed: ${failMsg}`)
                      } catch (err: any) {
                        alert(`Test failed: ${err?.message || 'Unknown error'}`)
                      }
                    }}
                    onSync={async (id: string) => {
                      try {
                        const res = (await sync(id)) as SyncResult | any
                        const syncId = res?.syncId ?? res?.id ?? res?.jobId ?? null
                        const status = res?.status ?? 'unknown'
                        alert(`Sync ${status}${syncId ? ` (ID: ${syncId})` : ''}`)
                      } catch (err: any) {
                        alert(`Sync failed: ${err?.message || 'Unknown error'}`)
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
                    // ADD THESE TWO HANDLERS:
                    onConfigure={(id: string) => {
                      console.log('Configure data source:', id);
                      // TODO: Navigate to configuration page
                      // Example: navigate(`/data-sources/${id}/configure`)
                      alert('Configuration page not implemented yet');
                    }}
                    onBrowseDatabases={handleBrowseDatabases}
                  />

                {/* Browse databases per DS */}
                <div className="mt-3">
                  <Button
                    variant="outline"
                    onClick={() => handleBrowseDatabases(ds.id)}
                    disabled={loadingDatabases[ds.id]}
                    className="w-full justify-center"
                  >
                    {loadingDatabases[ds.id] ? 'Loading databases…' : 'Browse Databases'}
                  </Button>

                  {browsedDatabases[ds.id] && (
                    <div className="mt-2 rounded-xl border">
                      {browsedDatabases[ds.id].length === 0 ? (
                        <div className="p-3 text-sm text-gray-500">No databases returned.</div>
                      ) : (
                        <ul className="max-h-56 overflow-auto">
                          {browsedDatabases[ds.id].map(db => (
                            <li key={db} className="border-b last:border-0">
                              <button
                                onClick={() => setScopeFromPick(ds as any, db)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                              >
                                {db}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
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
}

function StatCard({ label, value, icon, color, subtitle }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  } as const

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-bold text-gray-900">{value}</div>
          <div className="text-sm text-gray-600">{label}</div>
          {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
        </div>
        <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  )
}
