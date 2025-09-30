// src/components/features/data-sources/DataSourceCard.tsx
import type { DataSource, DataSourceType } from '@/types/dataSources'
import {
  Activity,
  CheckCircle,
  Clock,
  Database,
  Globe,
  HardDrive,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Server,
  Settings,
  Shield,
  Trash2,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* --------------------------------- UI helpers -------------------------------- */

const statusChipClasses: Record<DataSource['status'], string> = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-gray-50 text-gray-600 border-gray-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  testing: 'bg-blue-50 text-blue-700 border-blue-200',
}

// Safe icon map; use Partial until your union surely includes 'oracle'
function getConnectorIcon(type: DataSourceType): string {
  const icons: Partial<Record<DataSourceType, string>> = {
    postgresql: '🐘',
    mysql: '🐬',
    mssql: '🏢',
    mongodb: '🍃',
    redis: '📦',
    snowflake: '❄️',
    bigquery: '📊',
    redshift: '🔴',
    databricks: '🧱',
    s3: '☁️',
    'azure-blob': '🟦',
    gcs: '☁️',
    kafka: '🚀',
    api: '🔌',
    file: '📁',
    ftp: '📡',
    elasticsearch: '🔍',
    // add 'oracle' to your DataSourceType to remove the cast
    oracle: '🟠' as any,
  }
  return icons[type] ?? '💾'
}

function getTypeDisplayName(type: DataSourceType): string {
  const names: Partial<Record<DataSourceType, string>> = {
    postgresql: 'PostgreSQL',
    mysql: 'MySQL',
    mssql: 'SQL Server',
    mongodb: 'MongoDB',
    redis: 'Redis',
    snowflake: 'Snowflake',
    bigquery: 'BigQuery',
    redshift: 'Amazon Redshift',
    databricks: 'Databricks',
    s3: 'Amazon S3',
    'azure-blob': 'Azure Blob Storage',
    gcs: 'Google Cloud Storage',
    kafka: 'Apache Kafka',
    api: 'REST API',
    file: 'File System',
    ftp: 'FTP/SFTP',
    elasticsearch: 'Elasticsearch',
    oracle: 'Oracle Database' as any,
  }
  return names[type] ?? type
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Never'
  try {
    const d = new Date(dateString)
    const diff = Date.now() - d.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 7) return d.toLocaleDateString()
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  } catch {
    return 'Unknown'
  }
}

/* ---------------------------- connection info ---------------------------- */

function getEnhancedConnectionInfo(
  config: DataSource['connectionConfig'],
  type: DataSourceType,
) {
  const info: {
    host?: string
    database?: string
    databases?: string[]
    bucket?: string
    baseUrl?: string
    scope?: 'server' | 'cluster' | 'database' | string
    discoveryMode?: string
    ssl?: boolean
    port?: number
  } = {}

  if (config && typeof config === 'object') {
    const anyCfg = config as any
    info.scope = anyCfg.scope || 'database'
    info.discoveryMode = anyCfg.discoveryMode
    if (Array.isArray(anyCfg.databases)) info.databases = anyCfg.databases
    info.ssl = Boolean(anyCfg.ssl ?? anyCfg.encrypt)
    if (typeof anyCfg.port === 'number') info.port = anyCfg.port
  }

  // DB-like
  if (['postgresql', 'mysql', 'mssql', 'mongodb', 'redis', 'elasticsearch', 'oracle'].includes(type)) {
    const anyCfg = config as any
    info.host = anyCfg?.host
    info.database = anyCfg?.database
  }
  // Object storage
  else if (['s3', 'azure-blob', 'gcs'].includes(type)) {
    const anyCfg = config as any
    info.bucket = anyCfg?.bucket || anyCfg?.containerName || anyCfg?.bucketName
  }
  // API
  else if (type === 'api') {
    const anyCfg = config as any
    info.baseUrl = anyCfg?.baseUrl
  }
  // Warehouses
  else if (['snowflake', 'bigquery', 'redshift', 'databricks'].includes(type)) {
    const anyCfg = config as any
    info.host = anyCfg?.host || anyCfg?.account
    info.database = anyCfg?.database || anyCfg?.projectId
  }

  return info
}

/* --------------------------------- props --------------------------------- */

interface DataSourceCardProps {
  ds: DataSource
  onTest: (id: string) => Promise<void>
  onSync: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onConfigure?: (id: string) => void
  onBrowseDatabases?: (id: string) => void
  showAdvanced?: boolean
}

/* --------------------------------- card ---------------------------------- */

export default function DataSourceCard({
  ds,
  onTest,
  onSync,
  onDelete,
  onConfigure,
  onBrowseDatabases,
  showAdvanced = false,
}: DataSourceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  const connectionInfo = useMemo(
    () => getEnhancedConnectionInfo(ds.connectionConfig, ds.type),
    [ds.connectionConfig, ds.type],
  )

  const hasError = ds.status === 'error' || ds.healthStatus?.status === 'down'
  const isLoading = ds.status === 'testing' || ds.syncStatus?.status === 'syncing'
  const isServerLevel =
    connectionInfo.scope === 'server' || connectionInfo.scope === 'cluster'
  const dbList = Array.isArray(connectionInfo.databases) ? connectionInfo.databases : []

  const healthScore = useMemo(() => {
    if (hasError) return 0
    if (ds.status === 'active' && ds.healthStatus?.status === 'healthy') return 100
    if (ds.status === 'active') return 80
    if (ds.status === 'pending') return 60
    return 40
  }, [ds.status, ds.healthStatus, hasError])

  // Close menu on outside click / Esc
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuOpen) return
      const t = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(t) &&
        triggerRef.current &&
        !triggerRef.current.contains(t)
      ) {
        setMenuOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) triggerRef.current?.focus()
  }, [menuOpen])

  const handleAction = useCallback(
    async (action: 'test' | 'sync' | 'delete' | 'configure' | 'browse') => {
      try {
        if (action === 'test') await onTest(ds.id)
        else if (action === 'sync') await onSync(ds.id)
        else if (action === 'delete') await onDelete(ds.id)
        else if (action === 'configure') onConfigure?.(ds.id)
        else if (action === 'browse') onBrowseDatabases?.(ds.id)
      } catch (err) {
        console.error(`[DataSourceCard] ${action} failed`, err)
      } finally {
        setMenuOpen(false)
      }
    },
    [ds.id, onTest, onSync, onDelete, onConfigure, onBrowseDatabases],
  )

  return (
    // IMPORTANT: no overflow-hidden here, so the menu can render outside
    <div className="group rounded-2xl border bg-white shadow-sm hover:shadow-md transition-all duration-300">
      {/* Header */}
      <div className="p-6 pb-4">
        <div className="flex items-start justify-between">
          {/* Left */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-2xl border border-blue-100">
                {getConnectorIcon(ds.type)}
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">{getTypeDisplayName(ds.type)}</div>
                {isServerLevel && (
                  <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                    <Server className="w-3 h-3" />
                    Server-Level Connection
                  </div>
                )}
              </div>
            </div>

            <div className="mb-3">
              <h3 className="text-lg font-semibold text-gray-900 truncate mb-1" title={ds.name}>
                {ds.name}
              </h3>
              {ds.description && (
                <p className="text-sm text-gray-600 line-clamp-2" title={ds.description}>
                  {ds.description}
                </p>
              )}
            </div>
          </div>

          {/* Right: status + actions */}
          <div className="flex flex-col items-end gap-2">
            <div className={`rounded-full px-3 py-1 text-xs font-medium border ${statusChipClasses[ds.status]}`}>
              <div className="flex items-center gap-1">
                {ds.status === 'active' && <CheckCircle className="w-3 h-3" />}
                {ds.status === 'error' && <XCircle className="w-3 h-3" />}
                {ds.status === 'testing' && <Clock className="w-3 h-3 animate-pulse" />}
                {ds.status === 'pending' && <Clock className="w-3 h-3" />}
                {ds.status === 'inactive' && <Pause className="w-3 h-3" />}
                {ds.status.charAt(0).toUpperCase() + ds.status.slice(1)}
              </div>
            </div>

            {isLoading && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                {ds.status === 'testing' ? 'Testing...' : 'Syncing...'}
              </div>
            )}

            <div className="relative" ref={menuRef}>
              <button
                ref={triggerRef}
                onClick={() => setMenuOpen(v => !v)}
                className="p-1 rounded-lg hover:bg-gray-100 transition-colors"
                title="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className="w-4 h-4 text-gray-500" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-8 bg-white border rounded-lg shadow-lg z-20 min-w-[180px] overflow-hidden"
                >
                  <button
                    role="menuitem"
                    onClick={() => handleAction('test')}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Play className="w-4 h-4" />
                    Test Connection
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => handleAction('sync')}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Sync Data
                  </button>
                  {isServerLevel && (
                    <button
                      role="menuitem"
                      onClick={() => handleAction('browse')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Database className="w-4 h-4" />
                      Browse Databases
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => handleAction('configure')}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Configure
                  </button>
                  <hr className="my-1" />
                  <button
                    role="menuitem"
                    onClick={() => handleAction('delete')}
                    disabled={isLoading}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connection Details */}
      <div className="px-6 pb-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          {connectionInfo.host && (
            <div className="flex items-center gap-1">
              <Globe className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">Host:</span>
              <span className="font-medium text-gray-900 truncate">{connectionInfo.host}</span>
              {connectionInfo.port && <span className="text-gray-500">:{connectionInfo.port}</span>}
            </div>
          )}

          {isServerLevel && dbList.length > 0 && (
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">Databases:</span>
              <span className="font-medium text-blue-600">{dbList.length}</span>
            </div>
          )}

          {!isServerLevel && connectionInfo.database && (
            <div className="flex items-center gap-1">
              <Database className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">Database:</span>
              <span className="font-medium text-gray-900 truncate">{connectionInfo.database}</span>
            </div>
          )}

          {connectionInfo.bucket && (
            <div className="flex items-center gap-1">
              <HardDrive className="w-3 h-3 text-gray-400" />
              <span className="text-gray-500">Bucket:</span>
              <span className="font-medium text-gray-900 truncate">{connectionInfo.bucket}</span>
            </div>
          )}

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-400" />
            <span className="text-gray-500">Last Sync:</span>
            <span className="font-medium text-gray-900">{formatRelativeTime(ds.lastSyncAt)}</span>
          </div>

          <div className="flex items-center gap-1">
            <Activity className="w-3 h-3 text-gray-400" />
            <span className="text-gray-500">Last Test:</span>
            <span className="font-medium text-gray-900">{formatRelativeTime(ds.lastTestedAt)}</span>
          </div>
        </div>

        {connectionInfo.baseUrl && (
          <div className="mt-2 flex items-center gap-1 text-xs">
            <Globe className="w-3 h-3 text-gray-400" />
            <span className="text-gray-500">URL:</span>
            <span className="font-medium text-gray-900 truncate flex-1">{connectionInfo.baseUrl}</span>
          </div>
        )}
      </div>

      {/* Security & Discovery */}
      <div className="px-6 pb-4">
        <div className="flex items-center gap-3">
          {connectionInfo.ssl && (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Shield className="w-3 h-3" />
              <span>SSL Enabled</span>
            </div>
          )}
          {connectionInfo.discoveryMode && (
            <div className="flex items-center gap-1 text-xs text-purple-600">
              <Zap className="w-3 h-3" />
              <span className="capitalize">{connectionInfo.discoveryMode} Discovery</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  healthScore >= 80 ? 'bg-green-500' : healthScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
              />
              <span className="text-gray-500">Health: {healthScore}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {hasError && ds.healthStatus?.message && (
        <div className="mx-6 mb-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-red-800">Connection Error</div>
              <div className="text-xs text-red-600 mt-1">{ds.healthStatus.message}</div>
            </div>
          </div>
        </div>
      )}

      {/* Usage */}
      {ds.usage && (ds.usage.queriesCount > 0 || ds.usage.lastUsed) && (
        <div className="mx-6 mb-4 rounded-lg bg-blue-50 border border-blue-200 p-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {ds.usage.queriesCount > 0 && (
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-blue-500" />
                <span className="text-blue-600">Queries:</span>
                <span className="font-medium text-blue-800">{ds.usage.queriesCount.toLocaleString()}</span>
              </div>
            )}
            {ds.usage.lastUsed && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-500" />
                <span className="text-blue-600">Last Used:</span>
                <span className="font-medium text-blue-800">{formatRelativeTime(ds.usage.lastUsed)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tags */}
      {ds.tags && ds.tags.length > 0 && (
        <div className="px-6 pb-4">
          <div className="flex flex-wrap gap-1">
            {ds.tags.slice(0, isExpanded ? ds.tags.length : 3).map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              >
                {tag}
              </span>
            ))}
            {ds.tags.length > 3 && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
              >
                +{ds.tags.length - 3} more
              </button>
            )}
          </div>
        </div>
      )}

      {/* Server-level DB list */}
      {isServerLevel && dbList.length > 0 && (
        <div className="border-t border-gray-100">
          <div className="p-4 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-900">Managed Databases</span>
                <span className="text-xs text-gray-500">({dbList.length})</span>
              </div>
              {onBrowseDatabases && (
                <button
                  onClick={() => onBrowseDatabases(ds.id)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Browse All
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {dbList.slice(0, isExpanded ? dbList.length : 4).map(dbName => (
                <div key={dbName} className="flex items-center gap-2 text-xs">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-gray-700 truncate">{dbName}</span>
                </div>
              ))}
            </div>
            {dbList.length > 4 && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="mt-2 text-xs text-gray-500 hover:text-gray-700"
              >
                Show {dbList.length - 4} more databases
              </button>
            )}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="border-top border-gray-100 p-4 bg-gray-50">
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('test')}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-white hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {ds.status === 'testing' ? (
              <>
                <div className="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Test
              </>
            )}
          </button>

          <button
            onClick={() => handleAction('sync')}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {ds.syncStatus?.status === 'syncing' ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Sync
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>Created {formatRelativeTime(ds.createdAt)}</span>
          <div className="flex items-center gap-3">
            {ds.createdBy && <span>by {ds.createdBy}</span>}
            {showAdvanced && <span className="text-gray-400">ID: {ds.id.slice(-8)}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
