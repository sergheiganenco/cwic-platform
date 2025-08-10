// src/pages/Connections.tsx
import type { DataSource, TestResult } from '@/types/dataSources'
import { ConnectionForm } from '@components/features/connections/ConnectionForm'
import { ConnectionTest } from '@components/features/connections/ConnectionTest'
import { DataSourceList } from '@components/features/connections/DataSourceList'
import { HealthMonitor } from '@components/features/connections/HealthMonitor'
import { Button } from '@components/ui/Button'
import { Card, CardContent } from '@components/ui/Card'
import { Modal } from '@components/ui/Modal'
import { useDataSources } from '@hooks/useDataSources'
import { AlertTriangle, CheckCircle, Database, Plus } from 'lucide-react'
import * as React from 'react'

export const Connections: React.FC = () => {
  const { sources, isLoading } = useDataSources()
  const items: DataSource[] = Array.isArray(sources) ? sources : []

  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [showConnectionForm, setShowConnectionForm] = React.useState(false)
  const [showConnectionTest, setShowConnectionTest] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'sources' | 'health'>('sources')

  const selectedSource = React.useMemo(
    () => items.find((s) => s.id === selectedId) ?? null,
    [items, selectedId]
  )

  // Resilient counts: treat 'down' or 'error' as errors; keep 'warning' and 'healthy'
  const stats = React.useMemo(() => {
    const total = items.length
    const healthy = items.filter((ds) => ds.status === 'healthy').length
    const warning = items.filter((ds) => ds.status === 'warning').length
    const error = items.filter((ds) => ds.status === 'down' || ds.status === 'error').length
    return { total, healthy, warning, error }
  }, [items])

  function handleSelect(id: string) {
    setSelectedId(id)
    setShowConnectionTest(true)
  }

  async function handleSave(draft: Partial<DataSource>) {
    // TODO: call your API; on success, refresh sources in store/react-query
    console.log('Save connection', draft)
    setShowConnectionForm(false)
  }

  async function testConnection(conn?: DataSource): Promise<TestResult> {
    // TODO: replace with real API that validates the connection
    console.log('Testing connection', (conn ?? selectedSource)?.id)
    await new Promise((r) => setTimeout(r, 800))
    return 'ok'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
          <p className="mt-1 text-gray-600">
            Manage connections to Azure SQL, Synapse, Fabric, and other data sources.
          </p>
        </div>
        <Button onClick={() => setShowConnectionForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Connection
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Sources</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Database className="h-8 w-8 text-gray-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Healthy</p>
                <p className="text-3xl font-bold text-green-600">{stats.healthy}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Warning</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.warning}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Error</p>
                <p className="text-3xl font-bold text-red-600">{stats.error}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Connections sections">
          <TabButton onClick={() => setActiveTab('sources')} active={activeTab === 'sources'}>
            Data Sources
          </TabButton>
          <TabButton onClick={() => setActiveTab('health')} active={activeTab === 'health'}>
            Health Monitor
          </TabButton>
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'sources' ? (
          <Card>
            <CardContent>
              <DataSourceList items={items} onSelect={handleSelect} />
              {isLoading && (
                <div className="mt-3 text-sm text-gray-500">Loading sources…</div>
              )}
            </CardContent>
          </Card>
        ) : (
          // Keeping your HealthMonitor API (expects { dataSources })
          <HealthMonitor dataSources={items} />
        )}
      </div>

      {/* Add / Edit Connection */}
      <Modal
        isOpen={showConnectionForm}
        onClose={() => setShowConnectionForm(false)}
        title={selectedSource ? 'Edit Connection' : 'Add New Data Source'}
        size="lg"
      >
        <ConnectionForm
          initial={selectedSource ?? undefined}
          onSave={handleSave}
          onClose={() => setShowConnectionForm(false)}
        />
      </Modal>

      {/* Connection Test */}
      <Modal
        isOpen={showConnectionTest}
        onClose={() => setShowConnectionTest(false)}
        title={selectedSource ? `Connection Details — ${selectedSource.name}` : 'Connection Details'}
        size="lg"
      >
        {selectedSource ? (
          <ConnectionTest connection={selectedSource} onTest={testConnection} />
        ) : (
          <div className="text-sm text-gray-600">Select a data source to test.</div>
        )}
      </Modal>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'border-b-2 py-2 px-1 text-sm font-medium',
        active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700',
      ].join(' ')}
      aria-current={active ? 'page' : undefined}
    >
      {children}
    </button>
  )
}

export default Connections
