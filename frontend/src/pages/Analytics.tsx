import React, { useMemo, useState } from 'react'
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Download,
  Filter,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const metricCards = [
  { id: 'coverage', label: 'Catalog Coverage', value: '92%', delta: '+3.2%', tone: 'success', icon: BarChart3 },
  { id: 'adoption', label: 'Active Consumers', value: '148', delta: '+18', tone: 'neutral', icon: Users },
  { id: 'queries', label: 'Daily Queries', value: '12.4k', delta: '+6.7%', tone: 'success', icon: Activity },
  { id: 'trust', label: 'Trust Score', value: '87', delta: '+2', tone: 'warning', icon: Sparkles },
]

const insightFeed = [
  {
    id: 'insight-1',
    title: 'Product analytics dashboards trending',
    detail: 'Usage grew 32% week over week across GTM teams',
    impact: 'Adoption',
  },
  {
    id: 'insight-2',
    title: 'Data quality dip detected on marketing spend',
    detail: 'Null rate increased to 4.2% on paid_media.cost in the last load',
    impact: 'Quality',
  },
  {
    id: 'insight-3',
    title: 'Top search term: revenue by cohort',
    detail: 'Searches up 58% suggesting a new curated report opportunity',
    impact: 'Search',
  },
]

const dashboardInventory = [
  {
    id: 'dash-1',
    name: 'Executive Revenue Pulse',
    owner: 'Finance',
    lastRefreshed: '15 minutes ago',
    consumers: 64,
    health: 'healthy',
  },
  {
    id: 'dash-2',
    name: 'Data Quality Operations',
    owner: 'Data Platform',
    lastRefreshed: '42 minutes ago',
    consumers: 28,
    health: 'warning',
  },
  {
    id: 'dash-3',
    name: 'Customer Lifecycle',
    owner: 'Lifecycle Marketing',
    lastRefreshed: 'Yesterday',
    consumers: 51,
    health: 'healthy',
  },
]

const exportSchedules = [
  {
    id: 'exp-1',
    name: 'KPI Snapshot',
    cadence: 'Every weekday at 07:00',
    format: 'PDF + Slack',
    recipients: 12,
  },
  {
    id: 'exp-2',
    name: 'Attribution Deep Dive',
    cadence: 'Weekly on Monday',
    format: 'CSV + Email',
    recipients: 6,
  },
]

const ranges = [
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: '90d', label: 'Last 90 days' },
]

const Analytics: React.FC = () => {
  const [range, setRange] = useState('30d')
  const [filterHealth, setFilterHealth] = useState<'all' | 'healthy' | 'warning'>('all')

  const filteredInventory = useMemo(() => {
    if (filterHealth === 'all') return dashboardInventory
    return dashboardInventory.filter((dashboard) => dashboard.health === filterHealth)
  }, [filterHealth])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics Overview</h1>
          <p className="text-sm text-gray-600">
            Monitor adoption, track freshness, and identify the next best moves for the analytics program.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<CalendarDays className="h-4 w-4" />}>
            Plan KPI Review
          </Button>
          <Button leftIcon={<ArrowUpRight className="h-4 w-4" />}>
            Create Insight
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((metric) => {
          const Icon = metric.icon
          const toneClass =
            metric.tone === 'success'
              ? 'text-emerald-600'
              : metric.tone === 'warning'
              ? 'text-amber-600'
              : 'text-blue-600'
          return (
            <Card key={metric.id}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-gray-500">{metric.label}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-gray-900">{metric.value}</span>
                    <Badge tone={metric.tone === 'danger' ? 'danger' : metric.tone === 'warning' ? 'warning' : 'success'}>
                      {metric.delta}
                    </Badge>
                  </div>
                </div>
                <Icon className={`h-9 w-9 ${toneClass}`} />
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <CardTitle>Team Insights</CardTitle>
            <div className="flex gap-2">
              {ranges.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setRange(item.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    range === item.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {insightFeed.map((insight) => (
              <div key={insight.id} className="rounded-lg border border-gray-100 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-gray-900">{insight.title}</div>
                  <Badge tone="info">{insight.impact}</Badge>
                </div>
                <p className="mt-2 text-sm text-gray-600">{insight.detail}</p>
              </div>
            ))}
            <Button variant="outline" leftIcon={<TrendingUp className="h-4 w-4" />}>View full insight library</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Exports & Subscriptions</CardTitle>
            <Button variant="link" size="sm">Manage</Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {exportSchedules.map((exportItem) => (
              <div key={exportItem.id} className="rounded-md border border-gray-100 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">{exportItem.name}</h3>
                  <Badge tone="neutral">{exportItem.format}</Badge>
                </div>
                <p className="mt-2 text-xs text-gray-500">{exportItem.cadence}</p>
                <p className="mt-1 text-xs text-gray-500">Recipients: {exportItem.recipients}</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" leftIcon={<Download className="h-4 w-4" />}>Download</Button>
                  <Button size="sm" leftIcon={<Filter className="h-4 w-4" />}>Refine</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Dashboard Inventory</CardTitle>
          <div className="flex items-center gap-3">
            <select
              value={filterHealth}
              onChange={(event) => setFilterHealth(event.target.value as 'all' | 'healthy' | 'warning')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All</option>
              <option value="healthy">Healthy</option>
              <option value="warning">Needs attention</option>
            </select>
            <Button size="sm" variant="outline">Export list</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredInventory.map((dashboard) => (
            <div key={dashboard.id} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{dashboard.name}</p>
                  <p className="text-xs text-gray-500">Owned by {dashboard.owner}</p>
                </div>
                <Badge tone={dashboard.health === 'healthy' ? 'success' : 'warning'}>
                  {dashboard.health === 'healthy' ? 'Healthy' : 'Investigate'}
                </Badge>
              </div>
              <div className="mt-3 grid gap-3 text-xs text-gray-500 sm:grid-cols-3">
                <span>Last refreshed: {dashboard.lastRefreshed}</span>
                <span>Consumers: {dashboard.consumers}</span>
                <span>Type: Dashboard</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

export { Analytics }
export default Analytics
