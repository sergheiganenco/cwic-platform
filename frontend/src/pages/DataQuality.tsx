// src/pages/DataQuality.tsx
import {
  AlertTriangle,
  Beaker,
  Plus,
  RefreshCw,
  Shield,
  Sliders,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@components/ui/Button';
import { Card, CardContent } from '@components/ui/Card';

import { QualityOverview } from '@components/features/data-quality/QualityOverview';
// UI contracts already used in your app:
import type { QualityRule, RuleStatus } from '@components/features/data-quality/QualityRules';
import { QualityRules } from '@components/features/data-quality/QualityRules';
import { QualityTrends } from '@components/features/data-quality/QualityTrends';
import type { Violation as UIViolation } from '@components/features/data-quality/ViolationsList';
import { ViolationsList } from '@components/features/data-quality/ViolationsList';

import { useQualityRules } from '@hooks/useQualityRules';

// NEW: real data hooks (safe dev mocks)
import { useQualityIssues } from '@/hooks/useQualityIssues';
import { useQualitySummary } from '@/hooks/useQualitySummary';

// ---------------- Local Types mapping to your hook shapes ----------------
type RawRule = {
  id: string;
  name: string;
  status?: 'active' | 'disabled' | 'draft';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  passRate?: number;
  dataset?: string;
};

type RawViolation = {
  id: string;
  ruleId: string;
  assetId?: string;
  message?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  createdAt?: string;
  ruleName?: string;
  dataset?: string;
  count?: number;
  firstSeen?: string;
  lastSeen?: string;
};

type RawMetrics = {
  overallScore?: number;
  passRate?: number;
  failedCount?: number;
  lastUpdated?: string;
};

type TabId = 'overview' | 'rules' | 'violations' | 'trends' | 'simulator' | 'playbooks';

export const DataQuality: React.FC = () => {
  // Existing hook (kept)
  const { rules: rr, violations: rv, metrics: rm, isLoading: loadingLegacy } =
    (useQualityRules() as
      | {
          rules?: RawRule[];
          violations?: RawViolation[];
          metrics?: RawMetrics | null;
          isLoading?: boolean;
        }
      | null
      | undefined) ?? {};

  // New: live summary + issue list (with dev-mode mocks)
  const { data: summary, isLoading: loadingSummary, refresh: refreshSummary } = useQualitySummary({
    refreshInterval: 60_000,
  });

  const {
    items: issues,
    total: totalIssues,
    filters: issueFilters,
    updateFilters: updateIssueFilters,
    isLoading: loadingIssues,
    refresh: refreshIssues,
  } = useQualityIssues({ page: 1, limit: 20 });

  // Compose KPIs (prefer new summary; fall back to legacy metrics)
  const metrics = {
    overallScore: Math.max(
      0,
      Math.min(
        100,
        Math.round(
          summary?.overallScore ??
            (typeof rm?.overallScore === 'number' ? rm.overallScore : 0),
        ),
      ),
    ),
    passRate: Math.max(
      0,
      Math.min(
        100,
        Math.round(summary?.byDimension?.validity ?? rm?.passRate ?? 0),
      ),
    ),
    failedCount:
      summary?.failedChecks ??
      (typeof rm?.failedCount === 'number' ? rm.failedCount : undefined),
    lastUpdated: rm?.lastUpdated ?? undefined,
  };

  const rawRules: RawRule[] = Array.isArray(rr) ? rr : [];
  // Prefer new issues list when available
  const rawViolations: RawViolation[] =
    issues.length > 0 ? (issues as unknown as RawViolation[]) : Array.isArray(rv) ? rv : [];

  const [activeTab, setActiveTab] = React.useState<TabId>('overview');

  // ---------------- Adapters to UI component types ----------------
  const toRuleStatus = (s?: string): RuleStatus =>
    s === 'active' || s === 'disabled' ? s : 'disabled';

  const rulesUI: QualityRule[] = rawRules.map((r) => ({
    id: r.id,
    name: r.name,
    dataset: r.dataset ?? 'Unspecified',
    status: toRuleStatus(r.status),
    severity: (r.severity ?? 'medium') as QualityRule['severity'],
    passRate: r.passRate,
  }));

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
  }));

  const activeRules = rulesUI.filter((r) => r.status === 'active').length;
  const totals = {
    rules: rulesUI.length,
    activeRules,
    violations: totalIssues || violationsUI.length,
  };

  const overviewProps: any = {
    score: metrics.overallScore,
    passRate: metrics.passRate,
    totals,
    lastUpdated: metrics.lastUpdated ?? null,
    // unique: pass dimension breakdown if available (your component can ignore extras)
    dimensions: summary?.byDimension ?? null,
  };

  // ---------------- Unique Add-ons ----------------

  // Impact Simulator (what-if thresholding)
  const [sim, setSim] = React.useState({
    threshold: 0.98, // e.g., 98% validity required
    severityWeight: 1.0,
    windowDays: 7,
  });

  // very rough estimation model (client-side only; replace with /api/quality/simulate)
  const estimatedAlerts = React.useMemo(() => {
    const base = totals.violations || 0;
    // fewer alerts if threshold loosens, more if tightened; severity weight amplifies
    const tightness = Math.max(0, Math.min(1, (sim.threshold - 0.95) / 0.05)); // 0..1 for 95–100%
    const amp = 0.6 + sim.severityWeight * 0.4; // 0.6..1.0
    const windowFactor = Math.max(0.4, Math.min(1.2, sim.windowDays / 7));
    const est = Math.round(base * (0.8 + tightness * 1.1) * amp * windowFactor);
    const coverage = Math.round(60 + tightness * 35); // % coverage improves as threshold tightens
    return { alerts: est, coverage };
  }, [totals.violations, sim]);

  // Autofix Playbooks (curated suggestions)
  const playbooks: Array<{
    id: string;
    title: string;
    description: string;
    steps: string[];
    appliesTo: string[];
  }> = React.useMemo(
    () => [
      {
        id: 'pb-null-barrier',
        title: 'Null Barrier for Critical Columns',
        description:
          'Prevents nulls on business-critical columns by backfilling from authoritative sources and enforcing constraints.',
        steps: [
          'Profile columns to detect null-hotspots',
          'Generate backfill plan using reference dataset',
          'Apply NOT NULL + default constraints',
          'Create monitoring rule for drift',
        ],
        appliesTo: ['completeness', 'validity'],
      },
      {
        id: 'pb-foreign-key-repair',
        title: 'Foreign Key Repair & Guard',
        description:
          'Reconciles orphan records, creates FK guard rails, and schedules nightly referential audits.',
        steps: [
          'Detect orphan rows via anti-joins',
          'Quarantine or soft-delete orphans (configurable)',
          'Create FK constraints with ON UPDATE/DELETE rules',
          'Add audit query to nightly pipeline',
        ],
        appliesTo: ['consistency', 'accuracy'],
      },
      {
        id: 'pb-dup-pruning',
        title: 'Duplicate Pruning with Deterministic Keys',
        description:
          'Builds a deterministic hash key, prunes duplicates, and enforces uniqueness.',
        steps: [
          'Create deterministic key via column concat + hash',
          'Deduplicate with window rank keep=1',
          'Add UNIQUE index/constraint',
          'Add real-time duplicate rule on ingest',
        ],
        appliesTo: ['uniqueness'],
      },
    ],
    [],
  );

  // ---------------- Handlers ----------------
  function onAddRule() {
    // TODO: open rule creation flow
    console.log('Add Quality Rule');
  }
  const refreshAll = () => {
    refreshSummary();
    refreshIssues();
  };

  const isLoadingAny =
    !!loadingLegacy || !!loadingSummary || !!loadingIssues;

  // ---------------- Render ----------------
  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">
            Data Quality
            {isLoadingAny && (
              <RefreshCw className="inline-block ml-2 h-4 w-4 animate-spin text-gray-400" />
            )}
          </h1>
          <p className="mt-1 text-gray-600">
            Monitor, remediate, and simulate data quality across your platform.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button onClick={onAddRule}>
            <Plus className="mr-2 h-4 w-4" />
            Add Quality Rule
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overall Score</p>
                <p className="text-3xl font-bold" style={{ color: metrics.overallScore >= 80 ? '#16a34a' : metrics.overallScore >= 60 ? '#ca8a04' : '#dc2626' }}>
                  {isLoadingAny ? '—' : `${metrics.overallScore}%`}
                </p>
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
                <p className="text-3xl font-bold text-blue-600">
                  {isLoadingAny ? '—' : activeRules}
                </p>
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
                <p className="text-3xl font-bold text-red-600">
                  {isLoadingAny ? '—' : totals.violations}
                </p>
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
                <p className="text-3xl font-bold text-green-600">
                  {isLoadingAny ? '—' : `${metrics.passRate}%`}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-6" aria-label="Data quality sections">
          {([
            { id: 'overview', label: 'Overview', icon: Shield },
            { id: 'rules', label: 'Quality Rules', icon: Shield },
            { id: 'violations', label: 'Violations', icon: AlertTriangle },
            { id: 'trends', label: 'Trends', icon: TrendingUp },
            { id: 'simulator', label: 'Impact Simulator', icon: Sliders },      // UNIQUE
            { id: 'playbooks', label: 'Autofix Playbooks', icon: Wand2 },       // UNIQUE
          ] as const).map((tab) => {
            const active = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                aria-current={active ? 'page' : undefined}
                className={[
                  'flex items-center gap-2 border-b-2 py-2 px-1 text-sm font-medium',
                  active
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                ].join(' ')}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6 space-y-6">
        {activeTab === 'overview' && <QualityOverview {...overviewProps} />}

        {activeTab === 'rules' && <QualityRules rules={rulesUI} />}

        {activeTab === 'violations' && (
          <div className="space-y-4">
            {/* Quick filters (status + severity) */}
            <div className="flex flex-wrap items-center gap-3">
              <select
                className="rounded-md border border-gray-300 text-sm px-2 py-1"
                value={issueFilters.status ?? ''}
                onChange={(e) =>
                  updateIssueFilters({
                    status: (e.target.value || undefined) as any,
                  })
                }
              >
                <option value="">All statuses</option>
                <option value="open">Open</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
              <select
                className="rounded-md border border-gray-300 text-sm px-2 py-1"
                value={issueFilters.severity ?? ''}
                onChange={(e) =>
                  updateIssueFilters({
                    severity: (e.target.value || undefined) as any,
                  })
                }
              >
                <option value="">All severities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateIssueFilters({ page: 1 })}
              >
                Apply
              </Button>
            </div>

            {/* Violations list */}
            <ViolationsList items={violationsUI} loading={!!loadingIssues} />

            {/* Simple pager */}
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                Showing {(issueFilters.page ?? 1)} · Total {totalIssues.toLocaleString()}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(issueFilters.page ?? 1) <= 1 || loadingIssues}
                  onClick={() =>
                    updateIssueFilters({ page: Math.max(1, (issueFilters.page ?? 1) - 1) })
                  }
                >
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={loadingIssues || violationsUI.length < (issueFilters.limit ?? 20)}
                  onClick={() =>
                    updateIssueFilters({ page: (issueFilters.page ?? 1) + 1 })
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && <QualityTrends />}

        {/* UNIQUE: Impact Simulator */}
        {activeTab === 'simulator' && (
          <Card>
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">Impact Simulator</h3>
                  <p className="text-sm text-gray-600">
                    Estimate how threshold tweaks impact alert volume and coverage before you deploy.
                  </p>
                </div>
                <Beaker className="h-6 w-6 text-purple-600" />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-700">Validity Threshold</label>
                  <input
                    type="range"
                    min={0.95}
                    max={1.0}
                    step={0.001}
                    value={sim.threshold}
                    onChange={(e) => setSim((s) => ({ ...s, threshold: Number(e.target.value) }))}
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">{Math.round(sim.threshold * 100)}%</div>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Severity Weight</label>
                  <input
                    type="range"
                    min={0.5}
                    max={1.5}
                    step={0.1}
                    value={sim.severityWeight}
                    onChange={(e) =>
                      setSim((s) => ({ ...s, severityWeight: Number(e.target.value) }))
                    }
                    className="w-full"
                  />
                  <div className="text-xs text-gray-500">{sim.severityWeight.toFixed(1)}x</div>
                </div>
                <div>
                  <label className="text-sm text-gray-700">Evaluation Window (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={sim.windowDays}
                    onChange={(e) =>
                      setSim((s) => ({ ...s, windowDays: Math.max(1, Number(e.target.value || 7)) }))
                    }
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="text-sm text-gray-600">Estimated Alerts</div>
                    <div className="text-3xl font-bold">{estimatedAlerts.alerts.toLocaleString()}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Based on current volume ({totals.violations.toLocaleString()})
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="text-sm text-gray-600">Projected Coverage</div>
                    <div className="text-3xl font-bold">{estimatedAlerts.coverage}%</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Share of critical paths covered by rules (est.)
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    // Optional: call backend simulate endpoint; current UI is client-only
                    try {
                      // await fetch('/api/quality/simulate', { method: 'POST', body: JSON.stringify(sim) })
                      console.log('simulate', sim);
                    } catch (e) {
                      /* no-op */
                    }
                  }}
                >
                  <Sliders className="mr-2 h-4 w-4" />
                  Save as Draft Policy
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* UNIQUE: Autofix Playbooks */}
        {activeTab === 'playbooks' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {playbooks.map((pb) => (
              <Card key={pb.id} className="overflow-hidden">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{pb.title}</h3>
                      <div className="text-xs text-gray-500">
                        Applies to: {pb.appliesTo.join(', ')}
                      </div>
                    </div>
                    <Wand2 className="h-5 w-5 text-indigo-600" />
                  </div>
                  <p className="text-sm text-gray-700">{pb.description}</p>
                  <ol className="list-decimal pl-5 text-sm text-gray-800 space-y-1">
                    {pb.steps.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ol>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Hook up to a flow that scaffolds a new pipeline / rule set
                        console.log('Apply playbook', pb.id);
                      }}
                    >
                      Apply Playbook
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataQuality;
