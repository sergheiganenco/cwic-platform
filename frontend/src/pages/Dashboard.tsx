// src/pages/Dashboard.tsx
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { DashboardOverview, KPICards, QuickActions, type Activity, type KPI } from '@components/features/dashboard'
import { Badge } from '@components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'

import { useAuth } from '@hooks/useAuth'
import { useDataAssets } from '@hooks/useDataAssets'
import { usePipelines } from '@hooks/usePipelines'
import { useRequests } from '@hooks/useRequests'



type Priority = 'high' | 'medium' | 'low'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Assuming your hooks expose these shapes; if not, tweak the names below:
  const { assets = [], isLoading: assetsLoading, error: assetsError } = useDataAssets() as {
    assets: Array<{ id: string }>
    isLoading?: boolean
    error?: unknown
  }

  const { pipelines = [], isLoading: pipesLoading, error: pipesError } = usePipelines() as {
    pipelines: Array<{ id: string; status: 'running' | 'failed' | 'succeeded' | 'paused' | 'idle' }>
    isLoading?: boolean
    error?: unknown
  }

  const { requests = [], isLoading: reqLoading, error: reqError } = useRequests() as {
    requests: Array<{ id: string; status: 'open' | 'in_progress' | 'completed' | string }>
    isLoading?: boolean
    error?: unknown
  }

  const loading = !!(assetsLoading || pipesLoading || reqLoading)
  const hasError = !!(assetsError || pipesError || reqError)

  // ---- KPIs (map to the component contract) ----
  const kpis: KPI[] = [
    {
      id: 'assets',
      label: 'Total Assets',
      value: assets.length,
      diff: 4.2,
      trend: 'up',
      icon: 'database',
    },
    {
      id: 'quality',
      label: 'Quality Score',
      value: '89.7%', // Replace with real score if available
      diff: 0.8,
      trend: 'up',
      icon: 'shield',
    },
    {
      id: 'pipelines',
      label: 'Active Pipelines',
      value: pipelines.filter((p) => p.status === 'running').length,
      diff: 1.1,
      trend: 'up',
      icon: 'activity',
    },
    {
      id: 'requests',
      label: 'Open Requests',
      value: requests.filter((r) => r.status !== 'completed').length,
      diff: 0.0,
      trend: 'flat',
      icon: 'users',
    },
  ]

  // ---- Example activity feed (replace with your real events when ready) ----
  const activities: Activity[] = [
    {
      id: '1',
      time: new Date().toISOString(),
      title: 'Scan completed',
      detail: 'Azure SQL • 32 tables profiled',
      type: 'success',
    },
    {
      id: '2',
      time: new Date().toISOString(),
      title: 'Policy updated',
      detail: 'PII tagging rule refined',
      type: 'info',
    },
  ]

  // ---- Sidebar "Upcoming Events" seed ----
  const events: Array<{ title: string; time: string; priority: Priority }> = [
    { title: 'Customer Pipeline Deploy', time: 'in 3h 45m', priority: 'high' },
    { title: 'Quality Check Retry', time: 'in 2h 15m', priority: 'medium' },
    { title: 'Data Backup Scheduled', time: 'Tomorrow 2:00 AM', priority: 'low' },
  ]

  function toneForPriority(p: Priority): 'danger' | 'warning' | 'neutral' {
    if (p === 'high') return 'danger'
    if (p === 'medium') return 'warning'
    return 'neutral'
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="mb-2 text-2xl font-bold">Welcome back, {user?.name ?? 'there'}! 👋</h1>
            <p className="text-blue-100">Here’s what’s happening with your data platform today.</p>
          </div>
          <div className="hidden md:block">
            <div className="rounded-lg bg-white/20 p-4 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold">{new Date().toLocaleDateString()}</div>
              <div className="text-sm text-blue-100">Today</div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards items={kpis} loading={loading} />

      {/* Error callout (non-blocking) */}
      {hasError && (
        <Card>
          <CardContent>
            <div className="text-sm text-red-700">
              Some data failed to load. You can continue using the dashboard; try refreshing in a moment.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Overview + Activity */}
        <div className="space-y-6 lg:col-span-2">
          {/* The overview component composes KPIs + actions + activity, but we already render KPIs above.
              So here we can either omit it, or use it for Actions + Activity. We'll pass data to keep flexible. */}
          <DashboardOverview
            kpis={kpis}
            activities={activities}
            loadingKpis={loading}
            loadingActivity={false}
            onNewScan={() => navigate('/pipelines')}
            onRefresh={() => window.location.reload()}
            onImport={() => navigate('/connections')}
          />

          {/* Or, if you prefer a separate activity block below: */}
          {/* <ActivityFeed items={activities} loading={false} /> */}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <QuickActions
            onNewScan={() => navigate('/pipelines')}
            onRefresh={() => window.location.reload()}
            onImport={() => navigate('/connections')}
          />

          {/* System Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">System Health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: 'Data Sources', status: 'healthy' as const, value: '4/4 online' },
                { name: 'Pipelines', status: 'warning' as const, value: '2/3 running' },
                { name: 'AI Service', status: 'healthy' as const, value: '99.9% uptime' },
                { name: 'Data Quality', status: 'healthy' as const, value: '89.7% avg score' },
              ].map((h) => (
                <div key={h.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={[
                        'inline-block h-3 w-3 rounded-full',
                        h.status === 'healthy' ? 'bg-green-500' : h.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500',
                      ].join(' ')}
                      aria-hidden
                    />
                    <span className="text-sm font-medium">{h.name}</span>
                  </div>
                  <span className="text-sm text-gray-600">{h.value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Upcoming Events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {events.map((e) => (
                <div key={e.title} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className="text-xs text-gray-600">{e.time}</p>
                  </div>
                  <Badge tone={toneForPriority(e.priority)}>{e.priority}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
