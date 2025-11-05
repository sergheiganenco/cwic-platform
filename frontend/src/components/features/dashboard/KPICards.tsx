import { Badge } from '@components/ui/Badge'
import { Card, CardContent } from '@components/ui/Card'
import { GradientIcon } from '@components/ui/GradientIcon'
import { TrendBadge } from '@components/ui/TrendBadge'
import { Activity, Database, Shield, Users, TrendingUp, Brain } from 'lucide-react'

export type Trend = 'up' | 'down' | 'flat'

export interface KPI {
  id: string
  label: string
  value: number | string
  diff?: number // percentage points
  trend?: Trend
  icon?: 'activity' | 'shield' | 'database' | 'users' | 'trending' | 'brain'
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
        <Card key={k.id} className="transition-all duration-300 hover:shadow-2xl hover:scale-105 border-0 shadow-lg bg-white/95 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-4">
              <GradientIcon
                icon={getIconComponent(k.icon)}
                color={getIconColor(k.icon)}
                size="lg"
                animate
              />
              {typeof k.diff === 'number' && (
                <TrendBadge
                  value={k.diff}
                  trend={k.trend}
                  size="md"
                />
              )}
            </div>

            <div className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-1">
              {k.value}
            </div>
            <div className="text-sm text-gray-600 font-semibold">{k.label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function getIconComponent(name?: KPI['icon']) {
  if (name === 'shield') return Shield
  if (name === 'database') return Database
  if (name === 'users') return Users
  if (name === 'trending') return TrendingUp
  if (name === 'brain') return Brain
  return Activity
}

function getIconColor(name?: KPI['icon']): 'blue' | 'purple' | 'green' | 'orange' {
  if (name === 'shield') return 'green'
  if (name === 'database') return 'blue'
  if (name === 'users') return 'purple'
  if (name === 'brain') return 'purple'
  return 'orange'
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
