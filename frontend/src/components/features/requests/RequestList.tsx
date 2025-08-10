import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'

export type RequestStatus = 'open' | 'in_review' | 'approved' | 'rejected' | 'completed'

export interface RequestItem {
  id: string
  title: string
  requester: string
  createdAt: string  // ISO
  priority?: 'low' | 'medium' | 'high'
  status: RequestStatus
  summary?: string
}

export function RequestList({
  items = [],
  loading,
  onSelect,
  onNew,
}: {
  items?: RequestItem[]
  loading?: boolean
  onSelect?: (id: string) => void
  onNew?: () => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Requests</CardTitle>
          <Button onClick={onNew}>Create Request</Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ListSkeleton />
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600">No requests found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">Requester</th>
                  <th className="py-2 pr-4">Priority</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2 pr-0 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 pr-4 font-medium text-gray-900">{r.title}</td>
                    <td className="py-2 pr-4">{r.requester}</td>
                    <td className="py-2 pr-4">
                      <Badge tone={r.priority === 'high' ? 'danger' : r.priority === 'medium' ? 'warning' : 'neutral'}>
                        {r.priority ?? 'low'}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="py-2 pr-4">{fmt(r.createdAt)}</td>
                    <td className="py-2 pr-0 text-right">
                      <Button variant="outline" size="sm" onClick={() => onSelect?.(r.id)}>
                        View
                      </Button>
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

function statusTone(s: RequestStatus) {
  return s === 'approved'
    ? 'success'
    : s === 'rejected'
    ? 'danger'
    : s === 'in_review'
    ? 'info'
    : s === 'completed'
    ? 'neutral'
    : 'warning'
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 w-full animate-pulse rounded bg-gray-200" />
      ))}
    </div>
  )
}
