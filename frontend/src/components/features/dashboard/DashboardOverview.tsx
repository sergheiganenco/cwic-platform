import type { Activity } from './ActivityFeed'
import { ActivityFeed } from './ActivityFeed'
import type { KPI } from './KPICards'
import { KPICards } from './KPICards'
import { QuickActions } from './QuickActions'

export interface DashboardOverviewProps {
  kpis: KPI[]
  activities: Activity[]
  loadingKpis?: boolean
  loadingActivity?: boolean
  onNewScan?: () => void
  onRefresh?: () => void
  onImport?: () => void
}

/** A layout helper that arranges KPI, actions, and activity into a single section */
export function DashboardOverview({
  kpis,
  activities,
  loadingKpis,
  loadingActivity,
  onNewScan,
  onRefresh,
  onImport,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <KPICards items={kpis} loading={loadingKpis} />
      <QuickActions onNewScan={onNewScan} onRefresh={onRefresh} onImport={onImport} />
      <ActivityFeed items={activities} loading={loadingActivity} />
    </div>
  )
}
