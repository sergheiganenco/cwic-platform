import type { DataSource } from '@/types/dataSources'
import { Badge } from '@components/ui/Badge'
import { Card, CardContent } from '@components/ui/Card'

export function DataSourceList({
  items = [],
  onSelect,
}: {
  items?: DataSource[]
  onSelect?: (id: string) => void
}) {
  if (!items.length) {
    return <div className="text-sm text-gray-600">No data sources connected.</div>
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((ds) => (
        <Card
          key={ds.id}
          className="cursor-pointer transition hover:shadow-sm"
          onClick={() => onSelect?.(ds.id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect?.(ds.id)}
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <div className="truncate text-base font-semibold text-gray-900">{ds.name}</div>
                <div className="mt-1 text-sm text-gray-600">{ds.host ?? '—'}</div>
              </div>
              <div className="text-right">
                <Badge tone="neutral" className="capitalize">{ds.type}</Badge>
                {ds.status && (
                  <div className="mt-2">
                    <Badge tone={ds.status === 'healthy' ? 'success' : ds.status === 'warning' ? 'warning' : 'danger'}>
                      {ds.status}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
            {ds.updatedAt && (
              <div className="mt-3 text-xs text-gray-500">Updated {new Date(ds.updatedAt).toLocaleString()}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
