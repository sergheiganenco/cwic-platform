import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  Download,
  Filter,
  Info,
  Search,
  Server,
  ShieldCheck,
  TerminalSquare,
} from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'

const logs = [
  {
    id: 'log-1',
    time: '2024-01-15 10:24:19',
    actor: 'sarah.chen@cwic.io',
    action: 'Granted access to dataset marketing.touchpoints',
    resource: 'governance-policy',
    severity: 'info',
    source: 'Access Control',
  },
  {
    id: 'log-2',
    time: '2024-01-15 09:52:03',
    actor: 'system',
    action: 'Detected schema drift on payments.transactions',
    resource: 'data-source',
    severity: 'warning',
    source: 'Schema Monitor',
  },
  {
    id: 'log-3',
    time: '2024-01-15 09:15:45',
    actor: 'david.kim@cwic.io',
    action: 'Exported audit evidence package SOC2-Q4',
    resource: 'compliance-evidence',
    severity: 'info',
    source: 'Compliance',
  },
  {
    id: 'log-4',
    time: '2024-01-15 08:41:12',
    actor: 'system',
    action: 'Policy classification override rejected',
    resource: 'classification',
    severity: 'error',
    source: 'Classification Engine',
  },
]

const pipes = [
  { id: 'pipe-1', name: 'Warehouse Activity Stream', status: 'connected', output: 'S3://cwic-audit/history', lag: '12s' },
  { id: 'pipe-2', name: 'Admin Console Logs', status: 'connected', output: 'Splunk Cloud', lag: '21s' },
  { id: 'pipe-3', name: 'Access Requests', status: 'degraded', output: 'Snowflake', lag: '2m' },
]

const Audit: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState<'all' | 'info' | 'warning' | 'error'>('all')

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter
      const matchesSearch =
        searchTerm.trim() === '' ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.actor.toLowerCase().includes(searchTerm.toLowerCase())
      return matchesSeverity && matchesSearch
    })
  }, [searchTerm, severityFilter])

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-600">Tamper-evident audit trail for access, policy changes, and system events.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" leftIcon={<Filter className="h-4 w-4" />}>Advanced filters</Button>
          <Button leftIcon={<Download className="h-4 w-4" />}>Export CSV</Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Events (24h)</p>
              <p className="text-2xl font-semibold text-gray-900">3,482</p>
            </div>
            <Server className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Critical alerts</p>
              <p className="text-2xl font-semibold text-gray-900">4</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Signed evidence packages</p>
              <p className="text-2xl font-semibold text-gray-900">28</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-emerald-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-gray-500">Ingest pipelines</p>
              <p className="text-2xl font-semibold text-gray-900">3</p>
            </div>
            <TerminalSquare className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>Event stream</CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search actor or action"
                className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 sm:w-64"
              />
            </div>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value as 'all' | 'info' | 'warning' | 'error')}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="all">All severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredLogs.map((log) => (
            <div key={log.id} className="rounded-lg border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-500">{log.time}</p>
                </div>
                <Badge tone={log.severity === 'error' ? 'danger' : log.severity === 'warning' ? 'warning' : 'neutral'}>
                  {log.severity}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>Actor: {log.actor}</span>
                <span>Resource: {log.resource}</span>
                <span>Source: {log.source}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Pipeline health</CardTitle>
          <Button variant="outline" size="sm">Manage connections</Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {pipes.map((pipe) => (
            <div key={pipe.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">{pipe.name}</p>
                <p className="text-xs text-gray-500">Destination: {pipe.output}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={pipe.status === 'connected' ? 'success' : 'warning'}>
                  {pipe.status === 'connected' ? 'Connected' : 'Degraded'}
                </Badge>
                <span className="text-xs text-gray-500">Lag {pipe.lag}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retention & immutability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border border-dashed border-gray-200 p-4 text-sm text-gray-600">
            Evidence vault is configured with write-once storage and 365-day retention. Hash validation runs nightly.
          </div>
          <div className="rounded-lg border border-gray-100 p-4 text-xs text-gray-500">
            <Info className="mb-2 h-4 w-4 text-blue-500" />
            Tip: connect Splunk, Datadog, or Azure Sentinel to stream enriched audit logs for your security operations center.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { Audit }
export default Audit
