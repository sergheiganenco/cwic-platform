import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Activity, AlertTriangle, Database, Monitor, Server } from 'lucide-react'
import React, { useState } from 'react'

export const Monitoring: React.FC = () => {
  const [timeRange, setTimeRange] = useState('24h')

  const systemMetrics = { cpu: 45, memory: 67, disk: 23, network: 89 }

  const alerts = [
    { id: 1, title: 'High CPU Usage', severity: 'warning', time: '5 minutes ago', resolved: false },
    { id: 2, title: 'Database Connection Timeout', severity: 'critical', time: '1 hour ago', resolved: false },
    { id: 3, title: 'Pipeline Failure', severity: 'error', time: '2 hours ago', resolved: true },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Monitoring</h1>
          <p className="text-gray-600 mt-1">
            Monitor system health, performance metrics, and alerts across your data platform.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <Button variant="outline">
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">CPU Usage</p>
                <p className="text-3xl font-bold text-blue-600">{systemMetrics.cpu}%</p>
              </div>
              <Server className="h-8 w-8 text-blue-600" />
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full bg-blue-600" style={{ width: `${systemMetrics.cpu}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Memory</p>
                <p className="text-3xl font-bold text-yellow-600">{systemMetrics.memory}%</p>
              </div>
              <Database className="h-8 w-8 text-yellow-600" />
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full bg-yellow-600" style={{ width: `${systemMetrics.memory}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Disk Usage</p>
                <p className="text-3xl font-bold text-green-600">{systemMetrics.disk}%</p>
              </div>
              <Server className="h-8 w-8 text-green-600" />
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full bg-green-600" style={{ width: `${systemMetrics.disk}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Network</p>
                <p className="text-3xl font-bold text-purple-600">{systemMetrics.network}%</p>
              </div>
              <Monitor className="h-8 w-8 text-purple-600" />
            </div>
            <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
              <div className="h-2 rounded-full bg-purple-600" style={{ width: `${systemMetrics.network}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div className="flex items-center gap-3">
                  <AlertTriangle className={`h-4 w-4 ${
                    a.severity === 'critical' ? 'text-red-600' :
                    a.severity === 'error' ? 'text-red-500' :
                    a.severity === 'warning' ? 'text-yellow-600' : 'text-gray-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-gray-600">{a.time}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  a.resolved ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {a.resolved ? 'Resolved' : 'Open'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
