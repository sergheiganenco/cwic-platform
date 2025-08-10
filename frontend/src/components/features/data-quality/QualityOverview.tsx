// src/components/features/data-quality/QualityOverview.tsx
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { AlertTriangle, Shield, TrendingUp } from 'lucide-react'

type Totals = {
  rules: number
  activeRules: number
  violations: number
}

export type QualityOverviewProps = {
  /** Overall data quality score, 0..100 */
  score?: number
  /** Overall pass rate, 0..100 */
  passRate?: number
  /** Aggregate counts */
  totals?: Partial<Totals>
  /** ISO date string or null */
  lastUpdated?: string | null
}

/** Coerce maybe-number -> sane bounded number */
function coercePercent(v: unknown, fallback = 0): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, n))
}

/** Safe number formatter: returns e.g. "97.2%" */
function pctText(v: unknown, digits = 1, fallback = '—%'): string {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return `${n.toFixed(digits)}%`
}

export function QualityOverview(props: QualityOverviewProps) {
  const score = coercePercent(props.score, 0)
  const passRate = coercePercent(props.passRate, 0)

  const activeRules = Math.max(0, Math.trunc(props.totals?.activeRules ?? 0))
  const violations = Math.max(0, Math.trunc(props.totals?.violations ?? 0))

  const updated =
    props.lastUpdated ? new Date(props.lastUpdated).toLocaleString() : 'Not available'

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">Overall Score</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-3xl font-bold text-green-600">{pctText(score, 0)}</p>
          <Shield className="h-8 w-8 text-green-600" aria-hidden />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">Pass Rate</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-3xl font-bold text-blue-600">{pctText(passRate, 0)}</p>
          <TrendingUp className="h-8 w-8 text-blue-600" aria-hidden />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">Active Rules</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-3xl font-bold text-gray-900">{activeRules}</p>
          <Shield className="h-8 w-8 text-gray-700" aria-hidden />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-gray-600">Violations</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <p className="text-3xl font-bold text-red-600">{violations}</p>
          <AlertTriangle className="h-8 w-8 text-red-600" aria-hidden />
        </CardContent>
      </Card>

      <div className="md:col-span-4 text-xs text-gray-500">Last updated: {updated}</div>
    </div>
  )
}

export default QualityOverview
