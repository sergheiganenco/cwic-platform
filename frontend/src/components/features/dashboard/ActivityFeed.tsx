import { Badge } from '@components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'

export type Activity = {
  id: string
  time: string            // ISO
  title: string
  detail?: string
  type?: 'info' | 'success' | 'warning' | 'error'
}

export interface ActivityFeedProps {
  items?: Activity[]
  emptyText?: string
  title?: string
  loading?: boolean
}

export function ActivityFeed({
  items = [],
  emptyText = 'No recent activity.',
  title = 'Recent Activity',
  loading,
}: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <ul className="divide-y">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="py-3">
                <div className="h-4 w-56 rounded bg-gray-200 animate-pulse" />
                <div className="mt-2 h-4 w-72 rounded bg-gray-200 animate-pulse" />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="text-sm text-gray-600">{emptyText}</div>
        ) : (
          <ul className="divide-y">
            {items.map((a) => (
              <li key={a.id} className="py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{a.title}</div>
                    {a.detail && <div className="text-sm text-gray-600">{a.detail}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.type && <Badge tone={mapTone(a.type)}>{a.type}</Badge>}
                    <span className="text-xs text-gray-500">{fmt(a.time)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function mapTone(t: NonNullable<Activity['type']>) {
  return t === 'success' ? 'success'
    : t === 'warning' ? 'warning'
    : t === 'error' ? 'danger'
    : 'info'
}
function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
