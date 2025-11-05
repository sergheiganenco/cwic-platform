import {
  AlertCircle,
  ArrowRightCircle,
  CheckCircle,
  Database,
  Filter,
  Loader2,
  MapPinned,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFieldDiscovery, useFieldDiscoveryFilters, useFieldSelection } from '@/hooks/useFieldDiscovery'

const FieldDiscovery: React.FC = () => {
  const {
    fields,
    stats,
    driftAlerts,
    loading,
    error,
    total,
    fetchFields,
    fetchStats,
    fetchDriftAlerts,
    updateFieldStatus,
    bulkAction,
    refresh,
  } = useFieldDiscovery()

  const { filters, updateFilter, resetFilters } = useFieldDiscoveryFilters()
  const { selectedFieldIds, toggleField, selectAll, clearSelection } = useFieldSelection()

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'needs-review' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [isScanning, setIsScanning] = useState(false)

  // Initial data load
  useEffect(() => {
    refresh()
  }, [])

  // Apply filters when they change
  useEffect(() => {
    const appliedFilters = {
      ...filters,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search.trim() || undefined,
    }
    fetchFields(appliedFilters)
  }, [statusFilter, search, filters])

  const handleAcceptField = async (fieldId: string) => {
    try {
      await updateFieldStatus(fieldId, { status: 'accepted' })
      // Refresh stats after status change
      await fetchStats()
    } catch (err) {
      console.error('Failed to accept field:', err)
    }
  }

  const handleRejectField = async (fieldId: string) => {
    try {
      await updateFieldStatus(fieldId, { status: 'rejected' })
      await fetchStats()
    } catch (err) {
      console.error('Failed to reject field:', err)
    }
  }

  const handleBulkAccept = async () => {
    if (selectedFieldIds.length === 0) return
    try {
      await bulkAction({
        fieldIds: selectedFieldIds,
        action: 'accept',
      })
      clearSelection()
      await fetchStats()
    } catch (err) {
      console.error('Failed to bulk accept:', err)
    }
  }

  const handleTriggerScan = async () => {
    setIsScanning(true)
    try {
      // In real implementation, would trigger scan via API
      // For now, just refresh data
      await refresh()
    } catch (err) {
      console.error('Failed to trigger scan:', err)
    } finally {
      setIsScanning(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    return `${diffDays} days ago`
  }

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Discovery</h1>
          <p className="text-sm text-gray-600">Track new schema elements, understand drift, and route documentation updates.</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedFieldIds.length > 0 && (
            <>
              <Button variant="outline" onClick={handleBulkAccept} leftIcon={<CheckCircle className="h-4 w-4" />}>
                Accept selected ({selectedFieldIds.length})
              </Button>
              <Button variant="outline" onClick={clearSelection} leftIcon={<X className="h-4 w-4" />}>
                Clear
              </Button>
            </>
          )}
          <Button variant="outline" leftIcon={<MapPinned className="h-4 w-4" />}>Assign owner</Button>
          <Button
            onClick={handleTriggerScan}
            disabled={isScanning}
            leftIcon={isScanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          >
            {isScanning ? 'Scanning...' : 'Trigger scan'}
          </Button>
        </div>
      </header>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Total fields discovered</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.totalFields || 0}
              </p>
            </div>
            <Tag className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Average confidence</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : `${Math.round((stats?.averageConfidence || 0) * 100)}%`}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Fields needing review</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.byStatus?.['needs-review'] || 0}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Pending review</p>
              <p className="text-2xl font-semibold text-gray-900">
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : stats?.byStatus?.['pending'] || 0}
              </p>
            </div>
            <Database className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Discoveries ({total})</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search asset or field"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as any)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="needs-review">Needs review</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && fields.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Database className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No discovered fields found</p>
              <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or trigger a new scan</p>
            </div>
          ) : (
            fields.map((field) => (
              <div
                key={field.id}
                className={`rounded-lg border p-4 transition-colors ${
                  selectedFieldIds.includes(field.id)
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-100 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedFieldIds.includes(field.id)}
                      onChange={() => toggleField(field.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">
                        {field.schemaName}.{field.tableName}.{field.columnName}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">{field.description || 'No description available'}</p>
                    </div>
                  </div>
                  <Badge tone={
                    field.status === 'accepted' ? 'success' :
                    field.status === 'rejected' ? 'danger' :
                    field.status === 'pending' ? 'neutral' :
                    'warning'
                  }>
                    {field.status.replace('-', ' ')}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                  <span>Type: {field.dataType}</span>
                  <span>Classification: {field.classification}</span>
                  <span>Confidence: {(field.confidence * 100).toFixed(0)}%</span>
                  <span>Sensitivity: {field.sensitivity}</span>
                  {field.tags && field.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      Tags:
                      {field.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">
                          <Tag className="h-3 w-3 text-gray-400" /> {tag}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                {field.status === 'pending' && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectField(field.id)}
                      leftIcon={<X className="h-4 w-4" />}
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleAcceptField(field.id)}
                      leftIcon={<ArrowRightCircle className="h-4 w-4" />}
                    >
                      Accept
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Active drift alerts ({driftAlerts.length})</CardTitle>
          <Button variant="outline" size="sm">Download CSV</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && driftAlerts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : driftAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-emerald-300 mb-2" />
              <p className="text-sm text-gray-500">No active drift alerts</p>
            </div>
          ) : (
            driftAlerts.map((alert) => (
              <div key={alert.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className={`h-5 w-5 mt-0.5 ${
                    alert.severity === 'critical' ? 'text-red-500' :
                    alert.severity === 'high' ? 'text-orange-500' :
                    alert.severity === 'medium' ? 'text-amber-500' :
                    'text-yellow-500'
                  }`} />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{alert.fieldName}</p>
                    <p className="text-xs text-gray-500">{alert.description}</p>
                    <p className="text-xs text-gray-400 mt-1">Type: {alert.alertType.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge tone={
                    alert.severity === 'critical' || alert.severity === 'high' ? 'danger' :
                    alert.severity === 'medium' ? 'warning' :
                    'neutral'
                  }>
                    {alert.severity}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">Detected {formatDate(alert.detectedAt)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { FieldDiscovery }
export default FieldDiscovery
