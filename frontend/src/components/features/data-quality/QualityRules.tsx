import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { Filter, Plus } from 'lucide-react'
import * as React from 'react'

export type RuleSeverity = 'low' | 'medium' | 'high' | 'critical'
export type RuleStatus = 'active' | 'muted' | 'disabled'

export interface QualityRule {
  id: string
  name: string
  dataset: string
  severity: RuleSeverity
  status: RuleStatus
  lastRun?: string
  failures24h?: number
}

export interface QualityRulesProps {
  rules: QualityRule[]
  loading?: boolean
  onCreate?: () => void
  onToggleMute?: (id: string) => void
  onDisable?: (id: string) => void
}

export function QualityRules({ rules, loading, onCreate, onToggleMute, onDisable }: QualityRulesProps) {
  const [q, setQ] = React.useState('')
  const [sev, setSev] = React.useState('')
  const [status, setStatus] = React.useState('')

  const filtered = React.useMemo(() => {
    return rules.filter((r) => {
      const text = q.trim().toLowerCase()
      const matchText = !text || r.name.toLowerCase().includes(text) || r.dataset.toLowerCase().includes(text)
      const matchSev = !sev || r.severity === sev
      const matchStatus = !status || r.status === status
      return matchText && matchSev && matchStatus
    })
  }, [rules, q, sev, status])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Quality Rules</CardTitle>
          <Button onClick={onCreate} leftIcon={<Plus className="h-4 w-4" />}>New Rule</Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rules…" startIcon={<Filter className="h-4 w-4" />} />
          <Select
            label="Severity"
            value={sev}
            onChange={(e) => setSev(e.target.value)}
            options={[
              { label: 'All', value: '' },
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Critical', value: 'critical' },
            ]}
          />
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { label: 'All', value: '' },
              { label: 'Active', value: 'active' },
              { label: 'Muted', value: 'muted' },
              { label: 'Disabled', value: 'disabled' },
            ]}
          />
        </div>

        {/* Table */}
        {loading ? (
          <RulesSkeleton />
        ) : filtered.length === 0 ? (
          <div className="text-sm text-gray-600">No rules match your filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Rule</th>
                  <th className="py-2 pr-4">Dataset</th>
                  <th className="py-2 pr-4">Severity</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Failures (24h)</th>
                  <th className="py-2 pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-4 font-medium text-gray-900">{r.name}</td>
                    <td className="py-2 pr-4">{r.dataset}</td>
                    <td className="py-2 pr-4"><Badge tone={sevTone(r.severity)}>{r.severity}</Badge></td>
                    <td className="py-2 pr-4"><Badge tone={statusTone(r.status)}>{r.status}</Badge></td>
                    <td className="py-2 pr-4">{r.failures24h ?? 0}</td>
                    <td className="py-2 pr-0 text-right">
                      <div className="inline-flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => onToggleMute?.(r.id)}>
                          {r.status === 'muted' ? 'Unmute' : 'Mute'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => onDisable?.(r.id)}>Disable</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function sevTone(s: RuleSeverity) {
  return s === 'critical' ? 'danger' : s === 'high' ? 'warning' : s === 'medium' ? 'info' : 'neutral'
}
function statusTone(s: RuleStatus) {
  return s === 'active' ? 'success' : s === 'muted' ? 'neutral' : 'danger'
}

function RulesSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  )
}
