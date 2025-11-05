// src/components/features/data-sources/DataSourceConfigModal.tsx
import { AlertTriangle, Check, CheckCircle, Database, Info, Lock, Server, Settings, Shield, Tag, Zap, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import type { ConnectionTestResult, DataSource, DataSourceType } from '@/types/dataSources'

interface DataSourceConfigModalProps {
  open: boolean
  onClose: () => void
  dataSource: DataSource
  onSave: (id: string, updates: Partial<DataSource>) => Promise<void>
  onTest?: (id: string, config: any) => Promise<ConnectionTestResult>
}

type TabId = 'connection' | 'advanced' | 'metadata'

interface Tab {
  id: TabId
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const TABS: Tab[] = [
  { id: 'connection', label: 'Connection', icon: Database },
  { id: 'advanced', label: 'Advanced', icon: Settings },
  { id: 'metadata', label: 'Metadata', icon: Tag },
]

export default function DataSourceConfigModal({
  open,
  onClose,
  dataSource,
  onSave,
  onTest,
}: DataSourceConfigModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('connection')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    connectionConfig: {} as any,
    tags: [] as string[],
    metadata: {} as any,
  })

  // Initialize form data when dataSource changes
  useEffect(() => {
    if (dataSource) {
      setFormData({
        name: dataSource.name || '',
        description: dataSource.description || '',
        connectionConfig: { ...(dataSource.connectionConfig || {}) },
        tags: [...(dataSource.tags || [])],
        metadata: { ...(dataSource.metadata || {}) },
      })
    }
  }, [dataSource])

  // Close on escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  const updateConnectionConfig = useCallback((key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      connectionConfig: {
        ...prev.connectionConfig,
        [key]: value,
      },
    }))
  }, [])

  const updateMetadata = useCallback((key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [key]: value,
      },
    }))
  }, [])

  const addTag = useCallback((tag: string) => {
    const trimmed = tag.trim()
    if (!trimmed || formData.tags.includes(trimmed)) return
    setFormData(prev => ({
      ...prev,
      tags: [...prev.tags, trimmed],
    }))
  }, [formData.tags])

  const removeTag = useCallback((tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }))
  }, [])

  const handleTest = useCallback(async () => {
    if (!onTest) return

    setError(null)
    setTestResult(null)
    setTesting(true)

    try {
      console.log('🧪 Testing connection with form data:', {
        type: dataSource.type,
        config: formData.connectionConfig,
        password: formData.connectionConfig.password ? '***' : undefined
      })

      const result = await onTest(dataSource.id, formData.connectionConfig)

      console.log('🧪 Test result:', result)
      setTestResult(result)

      if (!result.success) {
        setError(result.error || 'Connection test failed')
      }
    } catch (err: any) {
      console.error('🧪 Test error:', err)
      setError(err?.message || 'Failed to test connection')
      setTestResult({
        success: false,
        connectionStatus: 'failed',
        error: err?.message || 'Test failed',
        responseTime: 0,
        testedAt: new Date().toISOString(),
      })
    } finally {
      setTesting(false)
    }
  }, [dataSource.id, dataSource.type, formData.connectionConfig, onTest])

  const handleSave = useCallback(async () => {
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const updates: Partial<DataSource> = {
        name: formData.name,
        description: formData.description,
        connectionConfig: formData.connectionConfig,
        tags: formData.tags,
        metadata: formData.metadata,
      }

      await onSave(dataSource.id, updates)
      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1500)
    } catch (err: any) {
      setError(err?.message || 'Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }, [dataSource.id, formData, onSave, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Configure Data Source</h2>
                  <p className="text-sm text-blue-100">{dataSource.name}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/20 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex gap-1 px-6">
              {TABS.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-3 font-medium text-sm border-b-2 transition-all ${
                      isActive
                        ? 'border-blue-600 text-blue-600 bg-white'
                        : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-white/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {/* Success/Error Messages */}
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-800">Error</div>
                  <div className="text-sm text-red-600 mt-1">{error}</div>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
                <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-green-800">Success!</div>
                  <div className="text-sm text-green-600 mt-1">Configuration saved successfully</div>
                </div>
              </div>
            )}

            {testResult && (
              <div className={`mb-4 p-4 rounded-lg border flex items-start gap-3 ${
                testResult.success
                  ? 'bg-green-50 border-green-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className={`font-medium ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
                    {testResult.success ? 'Connection Successful!' : 'Connection Failed'}
                  </div>
                  <div className={`text-sm mt-1 ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.success ? (
                      <>
                        Connection established successfully in {testResult.responseTime}ms
                        {testResult.details?.version && (
                          <div className="mt-1 text-xs opacity-75">
                            Server: {testResult.details.version}
                          </div>
                        )}
                      </>
                    ) : (
                      testResult.error || 'Unable to connect to the database'
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab Content */}
            {activeTab === 'connection' && (
              <ConnectionTab
                dataSource={dataSource}
                formData={formData}
                setFormData={setFormData}
                updateConnectionConfig={updateConnectionConfig}
                onTest={onTest ? handleTest : undefined}
                testing={testing}
                testResult={testResult}
              />
            )}

            {activeTab === 'advanced' && (
              <AdvancedTab
                dataSource={dataSource}
                connectionConfig={formData.connectionConfig}
                updateConnectionConfig={updateConnectionConfig}
              />
            )}

            {activeTab === 'metadata' && (
              <MetadataTab
                formData={formData}
                setFormData={setFormData}
                addTag={addTag}
                removeTag={removeTag}
                updateMetadata={updateMetadata}
              />
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                <Info className="w-3 h-3 inline mr-1" />
                {testResult?.success ? (
                  <span className="text-green-600 font-medium">Connection verified - safe to save</span>
                ) : (
                  'Changes will be saved to the database'
                )}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={onClose} disabled={saving || testing}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || success || testing}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      Saving...
                    </>
                  ) : success ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved!
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================== Connection Tab ============================== */

interface ConnectionTabProps {
  dataSource: DataSource
  formData: any
  setFormData: (data: any) => void
  updateConnectionConfig: (key: string, value: any) => void
  onTest?: () => Promise<void>
  testing?: boolean
  testResult?: ConnectionTestResult | null
}

function ConnectionTab({
  dataSource,
  formData,
  setFormData,
  updateConnectionConfig,
  onTest,
  testing,
  testResult,
}: ConnectionTabProps) {
  const config = formData.connectionConfig || {}
  const isServerLevel = config.scope === 'server'

  return (
    <div className="space-y-6">
      {/* Basic Info */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Basic Information
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connection Name
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My Database Connection"
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional description..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </Card>

      {/* Connection Details */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-indigo-600" />
          Connection Details
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Host
            </label>
            <Input
              value={config.host || ''}
              onChange={(e) => updateConnectionConfig('host', e.target.value)}
              placeholder="localhost"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Port
            </label>
            <Input
              type="number"
              value={config.port || ''}
              onChange={(e) => updateConnectionConfig('port', parseInt(e.target.value) || 0)}
              placeholder="5432"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <Input
              value={config.user || config.username || ''}
              onChange={(e) => {
                updateConnectionConfig('user', e.target.value)
                updateConnectionConfig('username', e.target.value)
              }}
              placeholder="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <Input
              type="password"
              value={config.password || ''}
              onChange={(e) => updateConnectionConfig('password', e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <strong>Server-Level Connection</strong>
              <p className="mt-1">
                This connection provides access to the entire database server.
                Select which databases to work with using the <strong>database filter</strong> in Data Catalog, Data Quality, and other pages.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Security */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-green-600" />
          Security
        </h3>

        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!config.ssl}
              onChange={(e) => updateConnectionConfig('ssl', e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700">Enable SSL/TLS encryption</span>
          </label>

          {config.ssl && (
            <div className="ml-6 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-xs text-green-700">
                SSL encryption is enabled. The connection will use encrypted transport.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Test Connection Quick Action */}
      {onTest && (
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-blue-900">
                <Zap className="w-5 h-5 text-blue-600" />
                Test Your Changes
              </h3>
              <p className="text-sm text-blue-700 mb-3">
                Verify your connection settings before saving. This will attempt to connect using your current configuration.
              </p>
              {testResult && (
                <div className={`text-sm font-medium ${
                  testResult.success ? 'text-green-600' : 'text-red-600'
                }`}>
                  {testResult.success ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      <span>Connection verified! ({testResult.responseTime}ms)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <XCircle className="w-4 h-4" />
                      <span>Connection failed - check your settings</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button
              onClick={onTest}
              disabled={testing}
              className="bg-blue-600 text-white hover:bg-blue-700 shrink-0"
            >
              {testing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  Test Now
                </>
              )}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

/* =============================== Advanced Tab =============================== */

interface AdvancedTabProps {
  dataSource: DataSource
  connectionConfig: any
  updateConnectionConfig: (key: string, value: any) => void
}

function AdvancedTab({ dataSource, connectionConfig, updateConnectionConfig }: AdvancedTabProps) {
  const config = connectionConfig || {}

  return (
    <div className="space-y-6">
      {/* Connection Pool */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-600" />
          Connection Pool Settings
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Connections
            </label>
            <Input
              type="number"
              value={config.maxConnections || 10}
              onChange={(e) => updateConnectionConfig('maxConnections', parseInt(e.target.value) || 10)}
              placeholder="10"
              min="1"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum number of concurrent connections</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Min Connections
            </label>
            <Input
              type="number"
              value={config.minConnections || 1}
              onChange={(e) => updateConnectionConfig('minConnections', parseInt(e.target.value) || 1)}
              placeholder="1"
              min="0"
              max="50"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum number of idle connections</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Idle Timeout (ms)
            </label>
            <Input
              type="number"
              value={config.idleTimeout || 30000}
              onChange={(e) => updateConnectionConfig('idleTimeout', parseInt(e.target.value) || 30000)}
              placeholder="30000"
              step="1000"
            />
            <p className="text-xs text-gray-500 mt-1">Time before idle connections are closed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connection Timeout (ms)
            </label>
            <Input
              type="number"
              value={config.connectionTimeout || 10000}
              onChange={(e) => updateConnectionConfig('connectionTimeout', parseInt(e.target.value) || 10000)}
              placeholder="10000"
              step="1000"
            />
            <p className="text-xs text-gray-500 mt-1">Timeout for establishing connection</p>
          </div>
        </div>
      </Card>

      {/* Query Settings */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-600" />
          Query Settings
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Statement Timeout (ms)
            </label>
            <Input
              type="number"
              value={config.statementTimeout || 60000}
              onChange={(e) => updateConnectionConfig('statementTimeout', parseInt(e.target.value) || 60000)}
              placeholder="60000"
              step="1000"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum query execution time</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Retry Attempts
            </label>
            <Input
              type="number"
              value={config.retryAttempts || 3}
              onChange={(e) => updateConnectionConfig('retryAttempts', parseInt(e.target.value) || 3)}
              placeholder="3"
              min="0"
              max="10"
            />
            <p className="text-xs text-gray-500 mt-1">Number of retry attempts on failure</p>
          </div>
        </div>
      </Card>

      {/* Discovery Mode */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-600" />
          Discovery Settings
        </h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discovery Mode
            </label>
            <select
              value={config.discoveryMode || 'auto'}
              onChange={(e) => updateConnectionConfig('discoveryMode', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="auto">Automatic</option>
              <option value="manual">Manual</option>
              <option value="scheduled">Scheduled</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">How metadata discovery is triggered</p>
          </div>
        </div>
      </Card>
    </div>
  )
}

/* =============================== Metadata Tab =============================== */

interface MetadataTabProps {
  formData: any
  setFormData: (data: any) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  updateMetadata: (key: string, value: any) => void
}

function MetadataTab({ formData, setFormData, addTag, removeTag, updateMetadata }: MetadataTabProps) {
  const [newTag, setNewTag] = useState('')
  const [newMetadataKey, setNewMetadataKey] = useState('')
  const [newMetadataValue, setNewMetadataValue] = useState('')

  const handleAddTag = () => {
    if (newTag.trim()) {
      addTag(newTag)
      setNewTag('')
    }
  }

  const handleAddMetadata = () => {
    if (newMetadataKey.trim()) {
      updateMetadata(newMetadataKey.trim(), newMetadataValue)
      setNewMetadataKey('')
      setNewMetadataValue('')
    }
  }

  return (
    <div className="space-y-6">
      {/* Tags */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-purple-600" />
          Tags
        </h3>

        <div className="space-y-3">
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-purple-50 border border-purple-200 rounded-full text-sm text-purple-700"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="Add a tag..."
              className="flex-1"
            />
            <Button onClick={handleAddTag} variant="outline">
              Add
            </Button>
          </div>
        </div>
      </Card>

      {/* Custom Metadata */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-blue-600" />
          Custom Metadata
        </h3>

        <div className="space-y-3">
          {Object.keys(formData.metadata || {}).length > 0 && (
            <div className="space-y-2">
              {Object.entries(formData.metadata).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-200">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-700">{key}</div>
                    <div className="text-xs text-gray-500">{String(value)}</div>
                  </div>
                  <button
                    onClick={() => {
                      const newMetadata = { ...formData.metadata }
                      delete newMetadata[key]
                      setFormData({ ...formData, metadata: newMetadata })
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors"
                    aria-label={`Remove metadata ${key}`}
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={newMetadataKey}
              onChange={(e) => setNewMetadataKey(e.target.value)}
              placeholder="Key"
            />
            <div className="flex gap-2">
              <Input
                value={newMetadataValue}
                onChange={(e) => setNewMetadataValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddMetadata()
                  }
                }}
                placeholder="Value"
                className="flex-1"
              />
              <Button onClick={handleAddMetadata} variant="outline">
                Add
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
