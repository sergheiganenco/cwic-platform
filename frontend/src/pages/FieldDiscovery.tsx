import {
  AlertCircle,
  ArrowRightCircle,
  CheckCircle,
  Database,
  Filter,
  MapPinned,
  Search,
  Sparkles,
  Tag,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const discoveries = [
  {
    id: 'disc-1',
    asset: 'sales.orders',
    field: 'payment_type',
    detectedType: 'Categorical',
    confidence: 0.92,
    suggestedTags: ['payments', 'sensitive'],
    status: 'pending',
    description: 'New column detected during last schema crawl.',
  },
  {
    id: 'disc-2',
    asset: 'marketing.touchpoints',
    field: 'utm_medium',
    detectedType: 'Enum',
    confidence: 0.88,
    suggestedTags: ['campaigns'],
    status: 'accepted',
    description: 'Suggested standardized list of mediums based on historical usage.',
  },
  {
    id: 'disc-3',
    asset: 'product.features',
    field: 'feature_release_notes',
    detectedType: 'Free text',
    confidence: 0.67,
    suggestedTags: ['documentation'],
    status: 'needs-review',
    description: 'Detected drift in description format requiring validation.',
  },
]

const driftAlerts = [
  {
    id: 'drift-1',
    asset: 'financial.metrics',
    field: 'currency_code',
    issue: 'New value detected: MXN',
    firstSeen: 'Today 04:12',
  },
  {
    id: 'drift-2',
    asset: 'support.tickets',
    field: 'priority',
    issue: 'Distribution shift detected (high increased by 17%)',
    firstSeen: 'Yesterday',
  },
]

const FieldDiscovery: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'needs-review'>('all')
  const [search, setSearch] = useState('')

  const filteredDiscoveries = useMemo(() => {
    return discoveries.filter((discovery) => {
      const matchesStatus = statusFilter === 'all' || discovery.status === statusFilter
      const matchesSearch =
        search.trim() === '' || discovery.asset.toLowerCase().includes(search.toLowerCase()) || discovery.field.toLowerCase().includes(search.toLowerCase())
      return matchesStatus && matchesSearch
    })
  }, [search, statusFilter])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Field Discovery</h1>
          <p className="text-sm text-gray-600">Track new schema elements, understand drift, and route documentation updates.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<MapPinned className="h-4 w-4" />}>Assign owner</Button>
          <Button leftIcon={<Sparkles className="h-4 w-4" />}>Trigger scan</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">New fields this week</p>
              <p className="text-2xl font-semibold text-gray-900">28</p>
            </div>
            <Tag className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Documentation complete</p>
              <p className="text-2xl font-semibold text-gray-900">76%</p>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Fields needing review</p>
              <p className="text-2xl font-semibold text-gray-900">14</p>
            </div>
            <AlertCircle className="h-8 w-8 text-amber-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Sources scanned</p>
              <p className="text-2xl font-semibold text-gray-900">37</p>
            </div>
            <Database className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Discoveries</CardTitle>
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
              onChange={(event) => setStatusFilter(event.target.value as 'all' | 'pending' | 'accepted' | 'needs-review')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="needs-review">Needs review</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredDiscoveries.map((discovery) => (
            <div key={discovery.id} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{discovery.asset}.{discovery.field}</p>
                  <p className="text-xs text-gray-500">{discovery.description}</p>
                </div>
                <Badge tone={discovery.status === 'accepted' ? 'success' : discovery.status === 'pending' ? 'neutral' : 'warning'}>
                  {discovery.status.replace('-', ' ')}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>Detected type: {discovery.detectedType}</span>
                <span>Confidence {(discovery.confidence * 100).toFixed(0)}%</span>
                <span>
                  Tags:
                  {discovery.suggestedTags.map((tag) => (
                    <span key={tag} className="ml-1 inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px]">
                      <Tag className="h-3 w-3 text-gray-400" /> {tag}
                    </span>
                  ))}
                </span>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="outline" leftIcon={<Filter className="h-4 w-4" />}>Route review</Button>
                <Button size="sm" leftIcon={<ArrowRightCircle className="h-4 w-4" />}>Accept</Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Active drift alerts</CardTitle>
          <Button variant="outline" size="sm">Download CSV</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {driftAlerts.map((alert) => (
            <div key={alert.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{alert.asset}.{alert.field}</p>
                <p className="text-xs text-gray-500">{alert.issue}</p>
              </div>
              <span className="text-xs text-gray-500">First seen {alert.firstSeen}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export { FieldDiscovery }
export default FieldDiscovery
