import { Badge } from '@components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'

export interface Violation {
  id: string
  ruleName: string
  dataset: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  count: number
  firstSeen: string // ISO
  lastSeen: string  // ISO
}

export function ViolationsList({ items = [], loading }: { items?: Violation[]; loading?: boolean }) {
  if (loading) return <ListSkeleton />
  if (!items.length) return <Card><CardContent>No violations in the selected window.</CardContent></Card>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Violations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2 pr-4">Rule</th>
                <th className="py-2 pr-4">Dataset</th>
                <th className="py-2 pr-4">Severity</th>
                <th className="py-2 pr-4">Count</th>
                <th className="py-2 pr-4">Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="py-2 pr-4 font-medium text-gray-900">{v.ruleName}</td>
                  <td className="py-2 pr-4">{v.dataset}</td>
                  <td className="py-2 pr-4">
                    <Badge tone={v.severity === 'critical' ? 'danger' : v.severity === 'high' ? 'warning' : v.severity === 'medium' ? 'info' : 'neutral'}>
                      {v.severity}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">{v.count}</td>
                  <td className="py-2 pr-4">{fmt(v.lastSeen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  )
}
