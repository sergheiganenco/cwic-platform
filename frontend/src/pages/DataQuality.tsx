// src/pages/DataQuality.tsx
import { Button } from '@components/ui/Button'
import { Card, CardContent } from '@components/ui/Card'
import { AlertTriangle, Plus, Shield, TrendingUp } from 'lucide-react'
import * as React from 'react'

import { QualityOverview } from '@components/features/data-quality/QualityOverview'
// Import the *exact* types the UI components expect
import type { QualityRule, RuleStatus } from '@components/features/data-quality/QualityRules'
import { QualityRules } from '@components/features/data-quality/QualityRules'
import { QualityTrends } from '@components/features/data-quality/QualityTrends'
import type { Violation as UIViolation } from '@components/features/data-quality/ViolationsList'
import { ViolationsList } from '@components/features/data-quality/ViolationsList'

import { useQualityRules } from '@hooks/useQualityRules'

// Raw shapes coming from your hook (adjust if you have canonical types)
type RawRule = {
  id: string
  name: string
  status?: 'active' | 'disabled' | 'draft'
  severity?: 'low' | 'medium' | 'high' | 'critical'
  passRate?: number
  dataset?: string
}
type RawViolation = {
  id: string
  ruleId: string
  assetId?: string
  message?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  createdAt?: string
  // optionally these might exist already:
  ruleName?: string
  dataset?: string
  count?: number
  firstSeen?: string
  lastSeen?: string
}
type RawMetrics = {
  overallScore?: number
  passRate?: number
  failedCount?: number
  lastUpdated?: string
}

type TabId = 'overview' | 'rules' | 'violations' | 'trends'

export const DataQuality: React.FC = () => {
  const { rules: rr, violations: rv, metrics: rm, isLoading } =
    (useQualityRules() as
      | {
          rules?: RawRule[]
          violations?: RawViolation[]
          metrics?: RawMetrics | null
          isLoading?: boolean
        }
      | null
      | undefined) ?? {}

  const rawRules: RawRule[] = Array.isArray(rr) ? rr : []
  const rawViolations: RawViolation[] = Array.isArray(rv) ? rv : []
  const metrics: Required<Pick<RawMetrics, 'overallScore' | 'passRate'>> & Partial<RawMetrics> = {
    overallScore: Math.max(0, Math.min(100, Math.round(rm?.overallScore ?? 0))),
    passRate: Math.max(0, Math.min(100, Math.round(rm?.passRate ?? 0))),
    failedCount: rm?.failedCount,
    lastUpdated: rm?.lastUpdated,
  }

  const [activeTab, setActiveTab] = React.useState<TabId>('overview')

  // --------- Adapters to UI component types ---------------------------------

  // Map raw rule → UI QualityRule
  const toRuleStatus = (s?: string): RuleStatus => (s === 'active' || s === 'disabled' ? s : 'disabled')
  const rulesUI: QualityRule[] = rawRules.map((r) => ({
    id: r.id,
    name: r.name,
    dataset: r.dataset ?? 'Unspecified',
    status: toRuleStatus(r.status),
    severity: (r.severity ?? 'medium') as QualityRule['severity'],
    passRate: r.passRate,
  }))

  // Map raw violation → UI Violation
  const violationsUI: UIViolation[] = rawViolations.map((v) => ({
    id: v.id,
    ruleId: v.ruleId,
    ruleName: v.ruleName ?? `Rule ${v.ruleId}`,
    dataset: v.dataset ?? 'Unspecified',
    message: v.message ?? 'Violation detected',
    severity: (v.severity ?? 'medium') as UIViolation['severity'],
    count: typeof v.count === 'number' ? v.count : 1,
    firstSeen: v.firstSeen ?? v.createdAt ?? new Date().toISOString(),
    lastSeen: v.lastSeen ?? v.createdAt ?? new Date().toISOString(),
    assetId: v.assetId,
  }))

  const activeRules = rulesUI.filter((r) => r.status === 'active').length
  const totals = {
    rules: rulesUI.length,
    activeRules,
    violations: violationsUI.length,
  }

  // QualityOverview likely expects a compact props shape. If its type differs, this
  // adapter isolates the mismatch (kept loose on purpose).
  const overviewProps: any = {
    score: metrics.overallScore,
    passRate: metrics.passRate,
    totals,
    lastUpdated: metrics.lastUpdated ?? null,
  }

  // --------------------------------------------------------------------------

  function onAddRule() {
    // TODO: open rule creation flow
    console.log('Add Quality Rule')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Quality</h1>
          <p className="mt-1 text-gray-600">Monitor and manage data quality across all your assets.</p>
        </div>
        <Button onClick={onAddRule}>
          <Plus className="mr-2 h-4 w-4" />
          Add Quality Rule
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Score</p>
                <p className="text-3xl font-bold text-green-600">{isLoading ? '—' : `${metrics.overallScore}%`}</p>
              </div>
              <Shield className="h-8 w-8 text-green-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Rules</p>
                <p className="text-3xl font-bold text-blue-600">{isLoading ? '—' : activeRules}</p>
              </div>
              <Shield className="h-8 w-8 text-blue-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Violations</p>
                <p className="text-3xl font-bold text-red-600">{isLoading ? '—' : violationsUI.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pass Rate</p>
                <p className="text-3xl font-bold text-green-600">{isLoading ? '—' : `${metrics.passRate}%`}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Data quality sections">
          {([
            { id: 'overview', label: 'Overview', icon: Shield },
            { id: 'rules', label: 'Quality Rules', icon: Shield },
            { id: 'violations', label: 'Violations', icon: AlertTriangle },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
          ] as const).map((tab) => {
            const active = activeTab === tab.id
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-2 border-b-2 py-2 px-1 text-sm font-medium',
                  active ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'overview' && <QualityOverview {...overviewProps} />}

        {activeTab === 'rules' && <QualityRules rules={rulesUI} />}

        {activeTab === 'violations' && (
          // ViolationsList expects exact Violation[]
          <ViolationsList items={violationsUI} loading={!!isLoading} />
        )}

        {activeTab === 'trends' && <QualityTrends />}
      </div>
    </div>
  )
}

export default DataQuality
