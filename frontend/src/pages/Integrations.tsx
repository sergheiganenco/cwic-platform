import React, { useMemo, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Cloud,
  DownloadCloud,
  Plug,
  RefreshCw,
  Search,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const INTEGRATIONS = [
  {
    id: 'snowflake',
    name: 'Snowflake',
    description: 'Bidirectional metadata and usage sync for your Snowflake warehouse.',
    category: 'Data Platform',
    status: 'healthy',
    lastSync: '12 minutes ago',
    owner: 'Data Engineering',
  },
  {
    id: 's3',
    name: 'Amazon S3',
    description: 'Continuous inventory and lineage ingest from S3 buckets.',
    category: 'Storage',
    status: 'warning',
    lastSync: '48 minutes ago',
    owner: 'Platform Ops',
  },
  {
    id: 'looker',
    name: 'Looker',
    description: 'Model, explore, and dashboard sync to keep BI assets in sync.',
    category: 'Business Intelligence',
    status: 'healthy',
    lastSync: '4 minutes ago',
    owner: 'Analytics',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    description: 'Bring CRM objects, usage, and schema drift alerts into the catalog.',
    category: 'Applications',
    status: 'error',
    lastSync: 'Sync failed · 2 hours ago',
    owner: 'RevOps',
  },
  {
    id: 'kafka',
    name: 'Apache Kafka',
    description: 'Track stream lineage and consumer health with real-time sync.',
    category: 'Streaming',
    status: 'healthy',
    lastSync: 'Just now',
    owner: 'Streaming Platform',
  },
]

const STATUS_META: Record<string, { label: string; tone: 'success' | 'warning' | 'danger'; icon: React.ComponentType<any>; badge: string }> = {
  healthy: { label: 'Healthy', tone: 'success', icon: CheckCircle, badge: 'bg-emerald-100 text-emerald-700' },
  warning: { label: 'Degraded', tone: 'warning', icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700' },
  error: { label: 'Action required', tone: 'danger', icon: AlertCircle, badge: 'bg-red-100 text-red-700' },
}

const CATEGORIES = Array.from(new Set(INTEGRATIONS.map((i) => i.category)))

const Integrations: React.FC = () => {
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const filtered = useMemo(() => {
    return INTEGRATIONS.filter((integration) => {
      const matchesCategory = selectedCategory === 'all' || integration.category === selectedCategory
      const matchesQuery = query.trim() === '' || integration.name.toLowerCase().includes(query.toLowerCase())
      return matchesCategory && matchesQuery
    })
  }, [query, selectedCategory])

  const healthyCount = INTEGRATIONS.filter((i) => i.status === 'healthy').length
  const warningCount = INTEGRATIONS.filter((i) => i.status === 'warning').length
  const errorCount = INTEGRATIONS.filter((i) => i.status === 'error').length

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
          <p className="text-gray-600">Connect warehouses, BI, and applications to keep context flowing through CWIC.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<RefreshCw className="h-4 w-4" />}>
            Sync All
          </Button>
          <Button leftIcon={<UploadCloud className="h-4 w-4" />}>
            New Integration
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Connected</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-gray-900">{INTEGRATIONS.length}</div>
            <Cloud className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Healthy</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-emerald-600">{healthyCount}</div>
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Needs Attention</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-amber-600">{warningCount}</div>
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">Errors</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="text-3xl font-semibold text-red-600">{errorCount}</div>
            <AlertCircle className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Integration Inventory</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search integrations"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
              No integrations match your filter.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((integration) => {
                const statusMeta = STATUS_META[integration.status]
                const StatusIcon = statusMeta.icon
                return (
                  <li key={integration.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-gray-900">{integration.name}</span>
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </div>
                      <p className="mt-1 max-w-2xl text-sm text-gray-600">{integration.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1">
                          <Plug className="h-3.5 w-3.5" />
                          {integration.category}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Owner: {integration.owner}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                          {integration.lastSync}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" size="sm" leftIcon={<DownloadCloud className="h-4 w-4" />}>
                        Logs
                      </Button>
                      <Button size="sm" leftIcon={<StatusIcon className="h-4 w-4" />}>
                        {integration.status === 'healthy' ? 'Sync now' : 'Retry'}
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export { Integrations }
export default Integrations



