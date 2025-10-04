// src/pages/DataSourceConfiguration.tsx
import { AlertTriangle, ArrowLeft, CheckCircle, Database, Save, TestTube, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/Button';
import { env } from '@/config/environment';
import { useDataSources } from '@/hooks/useDataSources';
import type { ConnectionConfig, DataSource } from '@/types/dataSources';

export default function DataSourceConfigurationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { items, loading, error, update, remove /* delete fn name in your hook */, refresh } = useDataSources()

  const [dataSource, setDataSource] = useState<DataSource | null>(null)
  const [config, setConfig] = useState<ConnectionConfig>({} as ConnectionConfig)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Resolve API base once
  const apiBase = useMemo(() => (env.apiBaseUrl?.replace(/\/+$/, '') || ''), [])

  // Load data source on mount / when list updates
  useEffect(() => {
    if (!id) return
    const ds = items.find(it => it.id === id)
    if (ds) {
      setDataSource(ds)
      setConfig(ds.connectionConfig || ({} as ConnectionConfig))
    } else if (!loading) {
      // If the list is loaded but item not found, bounce back.
      // If your hook has fetchById, you can call it here instead.
      navigate('/data-sources')
    }
  }, [id, items, loading, navigate])

  // Track changes
  useEffect(() => {
    if (!dataSource) return
    setHasChanges(JSON.stringify(config) !== JSON.stringify(dataSource.connectionConfig || {}))
  }, [config, dataSource])

  const handleFieldChange = useCallback((field: keyof ConnectionConfig, value: any) => {
    setConfig(prev => ({ ...prev, [field]: value }))
    if (validationErrors[field as string]) {
      setValidationErrors(prev => {
        const copy = { ...prev }
        delete copy[field as string]
        return copy
      })
    }
  }, [validationErrors])

  const validateConfig = useCallback(() => {
    const errs: Record<string, string> = {}

    // Accept either connectionString OR host (+ optional port)
    const hasConnStr = !!config.connectionString && String(config.connectionString).trim().length > 0
    const hasHost = !!config.host && String(config.host).trim().length > 0

    if (!hasConnStr && !hasHost) {
      errs.host = 'Provide either a connection string or host'
    }

    // Some drivers need creds (your backend’s SQL Server placeholder requires them)
    if (dataSource?.type === 'mssql') {
      if (!config.username) errs.username = 'Username is required'
      if (!config.password) errs.password = 'Password is required'
    }

    setValidationErrors(errs)
    return Object.keys(errs).length === 0
  }, [config, dataSource])

  const handleTestConnection = useCallback(async () => {
    if (!dataSource) return
    if (!validateConfig()) return

    setIsTesting(true)
    setTestResult(null)

    try {
      // Controller exposes "testConfig" → route should be /data-sources/test-config
      const res = await fetch(`${apiBase}/data-sources/test-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // include your dev auth header if your backend expects it locally
          'x-dev-auth': '1',
        },
        body: JSON.stringify({
          type: dataSource.type,
          // backend accepts { config } or { connection }, send both to be safe
          config,
          connection: config,
        }),
      })

      const json = await res.json()
      const ok = res.ok && !!json?.success && !!json?.data?.success

      setTestResult({
        success: ok,
        message: ok
          ? 'Connection successful!'
          : (json?.error?.message || json?.data?.error || 'Connection test failed'),
      })
    } catch (e: any) {
      setTestResult({ success: false, message: e?.message || 'Network error while testing' })
    } finally {
      setIsTesting(false)
    }
  }, [apiBase, config, dataSource, validateConfig])

  const handleSave = useCallback(async () => {
    if (!dataSource) return
    if (!validateConfig()) return

    setIsSaving(true)
    try {
      // Send a PATCH-like update with only the changed part
      await update(dataSource.id, { connectionConfig: config } as Partial<DataSource>)
      setHasChanges(false)
      // Optional: refresh list so the card reflects new status quickly
      refresh?.()
      navigate('/data-sources')
    } catch (e: any) {
      alert(`Save failed: ${e?.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
  }, [dataSource, config, update, refresh, navigate, validateConfig])

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      if (!confirm('You have unsaved changes. Leave without saving?')) return
    }
    navigate('/data-sources')
  }, [hasChanges, navigate])

  const handleDelete = useCallback(async () => {
    if (!dataSource) return
    if (!confirm('Delete this data source? This cannot be undone.')) return
    try {
      if (remove) {
        await remove(dataSource.id)
      } else {
        // Fallback to raw fetch if your hook doesn’t expose remove()
        await fetch(`${apiBase}/data-sources/${encodeURIComponent(dataSource.id)}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'x-dev-auth': '1' },
        })
      }
      navigate('/data-sources')
    } catch (e: any) {
      alert(`Delete failed: ${e?.message || 'Unknown error'}`)
    }
  }, [apiBase, dataSource, navigate, remove])

  if (loading && !dataSource) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-sm text-gray-600">Loading…</div>
      </div>
    )
  }

  if (error || !dataSource) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Data Source not found</h2>
          <p className="text-gray-600 mb-4">The requested data source could not be loaded.</p>
          <Button onClick={() => navigate('/data-sources')}>Back to Data Sources</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={handleCancel} className="flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Configure Data Source</h1>
                <p className="text-gray-600">{dataSource.name} · <span className="uppercase">{dataSource.type}</span></p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={isTesting /* allow testing even without changes */}
                className="flex items-center gap-2"
              >
                {isTesting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    Testing…
                  </>
                ) : (
                  <>
                    <TestTube className="w-4 h-4" />
                    Test Connection
                  </>
                )}
              </Button>

              <Button
                onClick={handleSave}
                disabled={isSaving || !hasChanges || Object.keys(validationErrors).length > 0}
                className="flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Test Result */}
        {testResult && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              <span className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                {testResult.message}
              </span>
            </div>
          </div>
        )}

        {/* Configuration Form */}
        <div className="bg-white rounded-2xl border shadow-sm">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <Database className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-semibold">Connection Configuration</h2>
                <p className="text-gray-600">Update your {dataSource.type} connection settings</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Connection String */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection String (optional alternative to Host/Port)
              </label>
              <input
                type="text"
                value={config.connectionString || ''}
                onChange={(e) => handleFieldChange('connectionString', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g. Server=tcp:host,1433;Database=db;User Id=...;Password=...;Encrypt=true;"
              />
            </div>

            {/* Host */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Host {(!config.connectionString) && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={config.host || ''}
                onChange={(e) => handleFieldChange('host', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.host ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Database host address"
              />
              {validationErrors.host && <p className="mt-1 text-sm text-red-600">{validationErrors.host}</p>}
            </div>

            {/* Port */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
              <input
                type="number"
                value={(config.port as any) ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  handleFieldChange('port', v === '' ? undefined : Number(v))
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={dataSource.type === 'mssql' ? '1433' : 'Port'}
              />
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username {dataSource.type === 'mssql' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={config.username || ''}
                onChange={(e) => handleFieldChange('username', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.username ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Database username"
              />
              {validationErrors.username && <p className="mt-1 text-sm text-red-600">{validationErrors.username}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password {dataSource.type === 'mssql' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={config.password || ''}
                onChange={(e) => handleFieldChange('password', e.target.value)}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  validationErrors.password ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Database password"
              />
              {validationErrors.password && <p className="mt-1 text-sm text-red-600">{validationErrors.password}</p>}
            </div>

            {/* SSL */}
            <div>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={!!config.ssl}
                  onChange={(e) => handleFieldChange('ssl', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">Enable SSL/TLS encryption</span>
              </label>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="mt-8 bg-white rounded-2xl border border-red-200 shadow-sm">
          <div className="p-6 border-b border-red-200">
            <h3 className="text-lg font-semibold text-red-700">Danger Zone</h3>
            <p className="text-red-600">Irreversible and destructive actions</p>
          </div>
          <div className="p-6 flex items-center">
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Data Source
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
