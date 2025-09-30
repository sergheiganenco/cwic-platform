// src/pages/Monitoring.tsx
import { Activity, AlertTriangle, Database, Monitor, RefreshCw, Server } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { MetricsCard } from '@/components/ui/MetricsCard';
import { Skeleton } from '@/components/ui/Skeleton';
import { useApi } from '@/hooks/useApi';

/** ——— Types ——— */
type Summary = {
  cpuPct: number; // 0..100
  memoryPct: number; // 0..100
  diskPct: number; // 0..100
  networkPct: number; // 0..100
  uptimePct?: number; // for SLO card if provided
  errorRatePct?: number; // platform-wide error rate (0..100)
  latencyP95Ms?: number; // ms
  throughputRps?: number;
  suppressedAlertsPct?: number; // "Noise Guard" metric: % alerts suppressed
};

type TSPoint = { t: string; v: number };
type Timeseries = {
  latencyP95: TSPoint[];
  errorRate: TSPoint[];
  rps: TSPoint[];
};

type Incident = {
  id: string | number;
  title: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  startedAt: string; // ISO
  resolved: boolean;
  service?: string;
};

type RangeKey = '1h' | '24h' | '7d' | '30d';
type AutoRefreshKey = 'off' | '30s' | '1m' | '5m';

/** ——— Coercion helpers ——— */
const asNumber = (n: unknown, fb = 0): number => {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : fb;
};
const asString = (v: unknown, fb = ''): string => {
  if (v == null) return fb;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v.toLocaleString();
  try { return String(v); } catch { return fb; }
};

/** ——— Dev mocks ——— */
const devSummary: Summary = {
  cpuPct: 45,
  memoryPct: 67,
  diskPct: 23,
  networkPct: 89,
  uptimePct: 99.92,
  errorRatePct: 0.42,
  latencyP95Ms: 384,
  throughputRps: 1284,
  suppressedAlertsPct: 36,
};
const devTS: Timeseries = {
  latencyP95: Array.from({ length: 24 }).map((_, i) => ({
    t: new Date(Date.now() - (23 - i) * 3600_000).toISOString(),
    v: 250 + Math.round(Math.random() * 300),
  })),
  errorRate: Array.from({ length: 24 }).map((_, i) => ({
    t: new Date(Date.now() - (23 - i) * 3600_000).toISOString(),
    v: Number((0.2 + Math.random() * 0.5).toFixed(2)),
  })),
  rps: Array.from({ length: 24 }).map((_, i) => ({
    t: new Date(Date.now() - (23 - i) * 3600_000).toISOString(),
    v: 800 + Math.round(Math.random() * 900),
  })),
};
const devIncidents: Incident[] = [
  { id: 'inc-101', title: 'Spike in 5xx errors on ingest', severity: 'error', startedAt: new Date(Date.now() - 2 * 3600_000).toISOString(), resolved: false, service: 'ingest' },
  { id: 'inc-102', title: 'Latency regression on lineage API', severity: 'warning', startedAt: new Date(Date.now() - 6 * 3600_000).toISOString(), resolved: false, service: 'lineage' },
  { id: 'inc-103', title: 'Scheduler backlog spiked', severity: 'critical', startedAt: new Date(Date.now() - 9 * 3600_000).toISOString(), resolved: true, service: 'scheduler' },
];

/** ——— Tiny sparkline (no lib dependency) ——— */
const Sparkline: React.FC<{ points?: TSPoint[]; suffix?: string }> = ({ points = [], suffix }) => {
  const w = 320, h = 60, pad = 6;
  if (points.length < 2) return <div className="text-xs text-gray-400">No data</div>;
  const xs = points.map((_, i) => i);
  const ys = points.map((p) => p.v);
  const minX = 0, maxX = xs[xs.length - 1];
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  const d = points
    .map((p, i) => {
      const x = pad + ((i - minX) / Math.max(1, maxX - minX)) * (w - pad * 2);
      const y = h - pad - ((p.v - minY) / Math.max(1, maxY - minY)) * (h - pad * 2);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const last = points[points.length - 1];
  return (
    <svg width={w} height={h} className="block">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500" />
      <text x={w - pad} y={h - 2} textAnchor="end" className="fill-gray-400 text-[10px]">
        {asNumber(last.v).toLocaleString()}{suffix ?? ''}
      </text>
    </svg>
  );
};

/** ——— CSV export helper ——— */
function exportIncidentsCSV(items: Incident[]) {
  const rows = [
    ['id', 'title', 'severity', 'status', 'startedAt', 'service'],
    ...items.map((i) => [
      asString(i.id),
      asString(i.title),
      i.severity,
      i.resolved ? 'resolved' : 'open',
      new Date(i.startedAt).toISOString(),
      asString(i.service),
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `incidents-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** ——— Page ——— */
export default function Monitoring() {
  const api = useApi();
  const [timeRange, setTimeRange] = useState<RangeKey>('24h');
  const [autoRefresh, setAutoRefresh] = useState<AutoRefreshKey>('off');

  const [summary, setSummary] = useState<Summary | null>(null);
  const [series, setSeries] = useState<Timeseries | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);
  const useMocks = import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_MOCKS !== '0';

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      if (useMocks) {
        await new Promise((r) => setTimeout(r, 300));
        setSummary(devSummary);
        setSeries(devTS);
        setIncidents(devIncidents);
      } else {
        const qs = `?range=${encodeURIComponent(timeRange)}`;
        const [s, ts, inc] = await Promise.all([
          api.get<any>(`/api/monitoring/summary${qs}`),
          api.get<any>(`/api/monitoring/timeseries${qs}`),
          api.get<any>(`/api/monitoring/incidents${qs}&limit=10`),
        ]);

        setSummary({
          cpuPct: asNumber(s.cpuPct ?? s.cpu ?? s.cpu_usage),
          memoryPct: asNumber(s.memoryPct ?? s.memory ?? s.memory_usage),
          diskPct: asNumber(s.diskPct ?? s.disk ?? s.disk_usage),
          networkPct: asNumber(s.networkPct ?? s.network ?? s.network_usage),
          uptimePct: asNumber(s.uptimePct ?? s.uptime),
          errorRatePct: asNumber(s.errorRatePct ?? s.error_rate),
          latencyP95Ms: asNumber(s.latencyP95Ms ?? s.latency_p95_ms),
          throughputRps: asNumber(s.throughputRps ?? s.rps),
          suppressedAlertsPct: asNumber(s.suppressedAlertsPct ?? s.noise_guard_pct),
        });

        setSeries({
          latencyP95: (ts.latencyP95 ?? ts.latency_p95 ?? []).map((p: any) => ({
            t: asString(p?.t, new Date().toISOString()),
            v: asNumber(p?.v),
          })),
          errorRate: (ts.errorRate ?? ts.error_rate ?? []).map((p: any) => ({
            t: asString(p?.t, new Date().toISOString()),
            v: asNumber(p?.v),
          })),
          rps: (ts.rps ?? ts.throughput ?? []).map((p: any) => ({
            t: asString(p?.t, new Date().toISOString()),
            v: asNumber(p?.v),
          })),
        });

        const list = Array.isArray(inc?.items) ? inc.items : Array.isArray(inc) ? inc : [];
        const items: Incident[] = list.map((it: any, i: number) => ({
          id: it.id ?? `inc-${i}`,
          title: asString(it.title, 'Incident'),
          severity: (it.severity ?? 'warning') as Incident['severity'],
          startedAt: asString(it.startedAt ?? it.start_time, new Date().toISOString()),
          resolved: Boolean(it.resolved ?? it.closed),
          service: asString(it.service ?? it.component, ''),
        }));
        setIncidents(items);
      }
    } catch (e: any) {
      setErr(e?.message || 'Failed to load monitoring data');
      // graceful fallback to mocks if first load fails
      if (!summary) setSummary(devSummary);
      if (!series) setSeries(devTS);
      if (incidents.length === 0) setIncidents(devIncidents);
    } finally {
      setLoading(false);
    }
  }, [api, timeRange, useMocks, summary, series, incidents.length]);

  // Initial & on-range change fetch
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto refresh
  useEffect(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoRefresh !== 'off') {
      const ms = autoRefresh === '30s' ? 30_000 : autoRefresh === '1m' ? 60_000 : 300_000;
      intervalRef.current = window.setInterval(fetchAll, ms);
    }
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchAll]);

  const systemMetrics = useMemo(
    () => ({
      cpu: asNumber(summary?.cpuPct, 0),
      memory: asNumber(summary?.memoryPct, 0),
      disk: asNumber(summary?.diskPct, 0),
      network: asNumber(summary?.networkPct, 0),
    }),
    [summary],
  );

  // Derived SLOs
  const uptimeTarget = 99.9;
  const uptime = asNumber(summary?.uptimePct ?? 0);
  const slaOk = uptime >= uptimeTarget;

  return (
    <ErrorBoundary>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Monitoring
              {loading && <RefreshCw className="ml-2 inline-block h-4 w-4 animate-spin text-gray-400" />}
            </h1>
            <p className="mt-1 text-gray-600">Live system health, SLOs, and incidents. Calm UI, no flicker.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as RangeKey)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <select
              value={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.value as AutoRefreshKey)}
              className="rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
              title="Auto refresh"
            >
              <option value="off">Auto-Refresh: Off</option>
              <option value="30s">Every 30s</option>
              <option value="1m">Every 1m</option>
              <option value="5m">Every 5m</option>
            </select>
            <Button variant="outline" onClick={fetchAll} disabled={loading}>
              {loading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
              {loading ? 'Refreshing' : 'Refresh'}
            </Button>
          </div>
        </div>

        {/* KPI Deck */}
        {!summary ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
            <MetricsCard title="Uptime" value={`${uptime.toFixed(2)}%`} icon="shield-check" variant={slaOk ? 'success' : 'warning'} />
            <MetricsCard title="Error Rate" value={`${asNumber(summary?.errorRatePct, 0).toFixed(2)}%`} icon="check-circle" variant={asNumber(summary?.errorRatePct, 0) > 1 ? 'error' : 'default'} />
            <MetricsCard title="P95 Latency" value={`${asNumber(summary?.latencyP95Ms, 0).toLocaleString()} ms`} icon="grid" />
            <MetricsCard title="Throughput" value={`${asNumber(summary?.throughputRps, 0).toLocaleString()} rps`} icon="database" />
            <MetricsCard title="Noise Guard" value={`${asNumber(summary?.suppressedAlertsPct, 0).toFixed(0)}%`} icon="users" percentage={asNumber(summary?.suppressedAlertsPct, 0)} />
            <MetricsCard title="Open Incidents" value={incidents.filter((i) => !i.resolved).length.toString()} icon="table" />
          </div>
        )}

        {/* System Health Overview */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {[
            { label: 'CPU Usage', value: systemMetrics.cpu, color: 'blue', Icon: Server },
            { label: 'Memory', value: systemMetrics.memory, color: 'yellow', Icon: Database },
            { label: 'Disk Usage', value: systemMetrics.disk, color: 'green', Icon: Server },
            { label: 'Network', value: systemMetrics.network, color: 'purple', Icon: Monitor },
          ].map((m) => (
            <Card key={m.label}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{m.label}</p>
                    <p className={`text-3xl font-bold text-${m.color}-600`}>{m.value}%</p>
                  </div>
                  <m.Icon className={`h-8 w-8 text-${m.color}-600`} />
                </div>
                <div className="mt-3 h-2 w-full rounded-full bg-gray-200">
                  <div
                    className={`h-2 rounded-full bg-${m.color}-600`}
                    style={{ width: `${Math.max(0, Math.min(100, m.value))}%` }}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.max(0, Math.min(100, m.value))}
                    role="progressbar"
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Timeseries */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Latency (P95)</div>
                <div className="text-xs text-gray-500">{series ? `${series.latencyP95.length} pts` : ''}</div>
              </div>
              {series ? <Sparkline points={series.latencyP95} suffix=" ms" /> : <Skeleton className="mt-3 h-16 rounded-md" />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Error Rate</div>
                <div className="text-xs text-gray-500">{series ? `${series.errorRate.length} pts` : ''}</div>
              </div>
              {series ? <Sparkline points={series.errorRate} suffix=" %" /> : <Skeleton className="mt-3 h-16 rounded-md" />}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Throughput (RPS)</div>
                <div className="text-xs text-gray-500">{series ? `${series.rps.length} pts` : ''}</div>
              </div>
              {series ? <Sparkline points={series.rps} /> : <Skeleton className="mt-3 h-16 rounded-md" />}
            </CardContent>
          </Card>
        </div>

        {/* SLO Tracker */}
        <Card>
          <CardHeader>
            <CardTitle>SLO Tracker</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricsCard title="Uptime Target" value={`${uptimeTarget}%`} icon="shield-check" />
            <MetricsCard
              title="Current Uptime"
              value={`${uptime.toFixed(2)}%`}
              icon="check-circle"
              variant={slaOk ? 'success' : 'warning'}
              trend={
                summary?.uptimePct
                  ? {
                      value: Math.max(-5, Math.min(5, uptime - uptimeTarget)),
                      direction: uptime >= uptimeTarget ? 'up' : 'down',
                      period: 'vs target',
                    }
                  : undefined
              }
            />
            <MetricsCard
              title="Error Budget Remaining"
              value={`${Math.max(0, (100 - uptimeTarget) - Math.max(0, uptimeTarget - uptime)).toFixed(3)}%`}
              icon="grid"
            />
          </CardContent>
        </Card>

        {/* Incidents */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Recent Incidents</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => exportIncidentsCSV(incidents)} disabled={incidents.length === 0}>
                Export CSV
              </Button>
              <span className="text-xs text-gray-500">{incidents.length} shown</span>
            </div>
          </CardHeader>
          <CardContent>
            {incidents.length === 0 ? (
              <div className="text-sm text-gray-500">No recent incidents.</div>
            ) : (
              <ul className="divide-y">
                {incidents.map((i) => (
                  <li key={asString(i.id)} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-gray-900">{asString(i.title)}</div>
                      <div className="text-xs text-gray-500">
                        Service: {asString(i.service, '—')} · {new Date(i.startedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          i.severity === 'critical'
                            ? 'text-red-600'
                            : i.severity === 'error'
                            ? 'text-red-500'
                            : i.severity === 'warning'
                            ? 'text-amber-600'
                            : 'text-gray-500'
                        }`}
                        aria-label={`Severity ${i.severity}`}
                      />
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          i.resolved ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {i.resolved ? 'Resolved' : 'Open'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Error surface (non-blocking) */}
        {err && <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">{err}</div>}
      </div>
    </ErrorBoundary>
  );
}
