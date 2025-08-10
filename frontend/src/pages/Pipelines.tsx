// src/pages/Pipelines.tsx
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Modal } from '@components/ui/Modal'
import { useToast } from '@components/ui/Notification'
import { Select } from '@components/ui/Select'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@utils'
import { ChevronRight, Clock, GitBranch, Pause, Play, RefreshCcw, Server, Shield } from 'lucide-react'
import * as React from 'react'

/** Types (keep local to avoid import coupling; match your backend shape) */
type PipelineStatus = 'idle' | 'running' | 'failed' | 'succeeded' | 'paused'
type Environment = 'dev' | 'test' | 'stage' | 'prod'

interface Pipeline {
  id: string
  name: string
  description?: string
  status: PipelineStatus
  environment: Environment
  lastRun?: string // ISO
  owner?: string
  repo?: string
  branch?: string
  tags?: string[]
}

interface Deployment {
  id: string
  pipelineId: string
  version: string
  startedAt: string
  finishedAt?: string
  status: PipelineStatus
  commit?: string
  triggeredBy?: string
}

/** API helpers */
async function getPipelines(params: { q?: string; env?: string; status?: string }) {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.env) query.set('environment', params.env)
  if (params.status) query.set('status', params.status)

  const res = await fetch(`/api/pipelines?${query.toString()}`)
  if (!res.ok) throw new Error(`Failed to fetch pipelines: ${res.status}`)
  const data = (await res.json()) as Pipeline[]
  return data
}

async function getDeployments(pipelineId: string) {
  const res = await fetch(`/api/pipelines/${pipelineId}/deployments`)
  if (!res.ok) throw new Error(`Failed to fetch deployments: ${res.status}`)
  const data = (await res.json()) as Deployment[]
  return data
}

/** Utils */
function statusTone(s: PipelineStatus) {
  switch (s) {
    case 'running':
      return { tone: 'info' as const, label: 'Running' }
    case 'failed':
      return { tone: 'danger' as const, label: 'Failed' }
    case 'succeeded':
      return { tone: 'success' as const, label: 'Succeeded' }
    case 'paused':
      return { tone: 'warning' as const, label: 'Paused' }
    default:
      return { tone: 'neutral' as const, label: 'Idle' }
  }
}
function envBadge(e: Environment) {
  switch (e) {
    case 'dev': return { className: 'bg-gray-100 text-gray-800', label: 'DEV' }
    case 'test': return { className: 'bg-blue-100 text-blue-800', label: 'TEST' }
    case 'stage': return { className: 'bg-purple-100 text-purple-800', label: 'STAGE' }
    case 'prod': return { className: 'bg-green-100 text-green-800', label: 'PROD' }
  }
}
function fmtTime(iso?: string) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString()
  } catch {
    return iso
  }
}

/** Page */
export const Pipelines: React.FC = () => {
  const { push } = useToast()

  // Filters
  const [q, setQ] = React.useState('')
  const [env, setEnv] = React.useState<string>('')
  const [status, setStatus] = React.useState<string>('')

  // Selected pipeline
  const [selected, setSelected] = React.useState<Pipeline | null>(null)

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['pipelines', { q, env, status }],
    queryFn: () => getPipelines({ q, env, status }),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const { data: deployments, isLoading: isDepsLoading, isError: isDepsError, error: depsError, refetch: refetchDeps } =
    useQuery({
      queryKey: ['deployments', selected?.id],
      queryFn: () => getDeployments(selected!.id),
      enabled: !!selected,
      staleTime: 30_000,
    })

  function handleStart(p: Pipeline) {
    // TODO: POST /api/pipelines/:id/start
    push({ type: 'info', message: `Starting pipeline "${p.name}"…` })
  }
  function handlePause(p: Pipeline) {
    // TODO: POST /api/pipelines/:id/pause
    push({ type: 'warning', message: `Pausing pipeline "${p.name}"…` })
  }
  function handleRerun(p: Pipeline) {
    // TODO: POST /api/pipelines/:id/rerun
    push({ type: 'success', message: `Re-running pipeline "${p.name}"…` })
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Pipelines</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, owner, tag…"
              startIcon={<SearchIcon />}
            />
            <Select
              label="Environment"
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              options={[
                { label: 'All environments', value: '' },
                { label: 'DEV', value: 'dev' },
                { label: 'TEST', value: 'test' },
                { label: 'STAGE', value: 'stage' },
                { label: 'PROD', value: 'prod' },
              ]}
            />
            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[
                { label: 'All statuses', value: '' },
                { label: 'Idle', value: 'idle' },
                { label: 'Running', value: 'running' },
                { label: 'Succeeded', value: 'succeeded' },
                { label: 'Failed', value: 'failed' },
                { label: 'Paused', value: 'paused' },
              ]}
            />
            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={() => { setQ(''); setEnv(''); setStatus('') }}>
                Reset
              </Button>
              <Button variant="secondary" onClick={() => refetch()} leftIcon={<RefreshCcw className="h-4 w-4" />}>
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {isLoading ? (
        <GridSkeleton />
      ) : isError ? (
        <Card>
          <CardContent>
            <div className="text-sm text-red-700">Failed to load pipelines: {(error as Error)?.message}</div>
          </CardContent>
        </Card>
      ) : !data || data.length === 0 ? (
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">No pipelines found</div>
                <div className="text-sm text-gray-600">Adjust filters or create a pipeline.</div>
              </div>
              <Button leftIcon={<GitBranch className="h-4 w-4" />}>New Pipeline</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => {
            const tone = statusTone(p.status)
            const envT = envBadge(p.environment)
            return (
              <Card key={p.id} className="hover:shadow-md transition">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-gray-900">{p.name}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', envT.className)}>
                          {envT.label}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-600 line-clamp-2">{p.description ?? '—'}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge tone={tone.tone}>{tone.label}</Badge>
                        {p.branch && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <GitBranch className="h-3.5 w-3.5" /> {p.branch}
                          </span>
                        )}
                        {p.owner && (
                          <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                            <Shield className="h-3.5 w-3.5" /> {p.owner}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="h-3.5 w-3.5" /> Last run: {fmtTime(p.lastRun)}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" aria-label="Open details" onClick={() => setSelected(p)}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    {p.status !== 'running' ? (
                      <Button onClick={() => handleStart(p)} leftIcon={<Play className="h-4 w-4" />}>
                        Start
                      </Button>
                    ) : (
                      <Button variant="outline" onClick={() => handlePause(p)} leftIcon={<Pause className="h-4 w-4" />}>
                        Pause
                      </Button>
                    )}
                    <Button variant="outline" onClick={() => handleRerun(p)} leftIcon={<RefreshCcw className="h-4 w-4" />}>
                      Re-run
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Details Drawer */}
      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={
          selected ? (
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-blue-600" />
              <span className="font-semibold">{selected.name}</span>
              <span className="text-xs text-gray-500">({selected.environment.toUpperCase()})</span>
            </div>
          ) : null
        }
        size="lg"
      >
        {selected ? (
          <div className="space-y-5">
            <div className="text-sm text-gray-700">{selected.description ?? 'No description.'}</div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Detail label="Status">
                <Badge tone={statusTone(selected.status).tone}>{statusTone(selected.status).label}</Badge>
              </Detail>
              <Detail label="Owner">{selected.owner ?? '—'}</Detail>
              <Detail label="Repository">{selected.repo ?? '—'}</Detail>
              <Detail label="Branch">{selected.branch ?? '—'}</Detail>
              <Detail label="Last Run">{fmtTime(selected.lastRun)}</Detail>
              <Detail label="Tags">
                {selected.tags?.length ? selected.tags.map((t) => (
                  <span key={t} className="mr-1 inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{t}</span>
                )) : '—'}
              </Detail>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Deployment History</CardTitle>
              </CardHeader>
              <CardContent>
                {isDepsLoading ? (
                  <div className="text-sm text-gray-600">Loading deployments…</div>
                ) : isDepsError ? (
                  <div className="text-sm text-red-700">Failed to load: {(depsError as Error)?.message}</div>
                ) : !deployments?.length ? (
                  <div className="text-sm text-gray-600">No deployments yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="py-2 pr-4">Version</th>
                          <th className="py-2 pr-4">Status</th>
                          <th className="py-2 pr-4">Started</th>
                          <th className="py-2 pr-4">Finished</th>
                          <th className="py-2 pr-4">Commit</th>
                          <th className="py-2 pr-4">Triggered By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deployments.map((d) => (
                          <tr key={d.id} className="border-t">
                            <td className="py-2 pr-4 font-medium">{d.version}</td>
                            <td className="py-2 pr-4">
                              <Badge tone={statusTone(d.status).tone}>{statusTone(d.status).label}</Badge>
                            </td>
                            <td className="py-2 pr-4">{fmtTime(d.startedAt)}</td>
                            <td className="py-2 pr-4">{fmtTime(d.finishedAt)}</td>
                            <td className="py-2 pr-4">{d.commit ?? '—'}</td>
                            <td className="py-2 pr-4">{d.triggeredBy ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => refetchDeps()}>Refresh</Button>
              <Button onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}

/** Small pieces */
const Detail: React.FC<{ label: string; children?: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-xs text-gray-500">{label}</div>
    <div className="text-sm text-gray-900">{children}</div>
  </div>
)

const GridSkeleton: React.FC = () => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <Card key={i}>
        <CardContent className="p-5">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="mt-4 flex gap-2">
            <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
            <div className="h-9 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
)

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

export default Pipelines
