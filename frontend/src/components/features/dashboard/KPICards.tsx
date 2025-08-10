import { Badge } from '@components/ui/Badge'
import { Card, CardContent } from '@components/ui/Card'
import { Activity, Database, Shield, Users } from 'lucide-react'

export type Trend = 'up' | 'down' | 'flat'

export interface KPI {
  id: string
  label: string
  value: number | string
  diff?: number // percentage points
  trend?: Trend
  icon?: 'activity' | 'shield' | 'database' | 'users'
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'
}

export interface KPICardsProps {
  items: KPI[]
  loading?: boolean
}

export function KPICards({ items, loading }: KPICardsProps) {
  if (loading) return <KPISkeleton />
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <Card key={k.id} className="transition hover:shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">{k.label}</div>
              <Icon name={k.icon} />
            </div>

            <div className="mt-2 text-2xl font-semibold text-gray-900">{k.value}</div>

            {typeof k.diff === 'number' && (
              <div className="mt-2">
                <Badge tone={diffTone(k.trend)}>{diffLabel(k.diff, k.trend)}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function Icon({ name }: { name?: KPI['icon'] }) {
  const cls = 'h-6 w-6 text-blue-600'
  if (name === 'shield') return <Shield className={cls} />
  if (name === 'database') return <Database className={cls} />
  if (name === 'users') return <Users className={cls} />
  return <Activity className={cls} />
}

function diffLabel(diff: number, trend?: Trend) {
  const sign = trend === 'down' ? '−' : trend === 'up' ? '+' : ''
  return `${sign}${Math.abs(diff).toFixed(1)}%`
}
function diffTone(trend?: Trend): NonNullable<KPI['tone']> {
  if (trend === 'up') return 'success'
  if (trend === 'down') return 'danger'
  return 'neutral'
}

function KPISkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="h-6 w-6 animate-pulse rounded bg-gray-200" />
            </div>
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-5 w-16 animate-pulse rounded bg-gray-200" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
