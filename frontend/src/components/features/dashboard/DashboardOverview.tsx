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
  actionsBusy?: boolean
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
  actionsBusy,
}: DashboardOverviewProps) {
  return (
    <div className="space-y-6">
      <KPICards items={kpis} loading={loadingKpis} />
      <QuickActions onNewScan={onNewScan} onRefresh={onRefresh} onImport={onImport} busy={actionsBusy} />
      <ActivityFeed items={activities} loading={loadingActivity} />
    </div>
  )
}
