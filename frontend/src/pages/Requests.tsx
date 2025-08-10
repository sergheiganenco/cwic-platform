// src/pages/Requests.tsx
import { Button } from '@components/ui/Button'
import { Card, CardContent } from '@components/ui/Card'
import { Modal } from '@components/ui/Modal'
import * as React from 'react'

import type { RequestItem } from '@components/features/requests/RequestList'
import { RequestList } from '@components/features/requests/RequestList'

import type { RequestFormValues } from '@components/features/requests/RequestForm'
import { RequestForm } from '@components/features/requests/RequestForm'

import type { WorkflowStep } from '@components/features/requests/ApprovalWorkflow'
import { ApprovalWorkflow } from '@components/features/requests/ApprovalWorkflow'

import { RequestDetails } from '@components/features/requests/RequestDetails'
import { useRequests } from '@hooks/useRequests'

import { AlertTriangle, CheckCircle, Clock, FileText, Plus } from 'lucide-react'

// ---------------- Raw shapes (from your data layer; tolerant/normalized) ----------------
type RawRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected'
type RawPriority = 'low' | 'medium' | 'high'
type RawStepStatus = 'waiting' | 'approved' | 'rejected' | 'running' | 'done'

type RawStep = {
  id: string | number
  name: string
  assignee?: string
  status: RawStepStatus
  startedAt?: string
  completedAt?: string
}

type RawRequest = {
  id: string | number
  title: string
  description?: string
  status: RawRequestStatus
  priority?: RawPriority
  requester?: string
  createdAt?: string
  updatedAt?: string
  steps?: RawStep[]
}

// ----------------------------------- Page -----------------------------------
export const Requests: React.FC = () => {
  // Read whatever the hook returns, but don't cast to a specific shape yet
  const hookResult = (useRequests() ?? {}) as {
    requests?: unknown
    isLoading?: boolean
    error?: unknown
  }

  // Defensive normalization from unknown[] → RawRequest[]
  const rawArray: any[] = Array.isArray(hookResult.requests) ? (hookResult.requests as any[]) : []

  const toRawStatus = (s: any): RawRequestStatus =>
    s === 'pending' || s === 'in_progress' || s === 'completed' || s === 'rejected' ? s : 'pending'

  const toPriority = (p: any): RawPriority => (p === 'low' || p === 'high' ? p : 'medium')

  const toStepStatus = (s: any): RawStepStatus =>
    s === 'approved' || s === 'rejected' || s === 'running' || s === 'done' ? s : 'waiting'

  let uid = 0
  const normalize = (x: any, i: number): RawRequest => ({
    id: x?.id ?? x?.requestId ?? `${Date.now()}-${i}-${uid++}`,
    title: x?.title ?? x?.name ?? 'Untitled request',
    description: x?.description ?? x?.details ?? '',
    status: toRawStatus(x?.status),
    priority: toPriority(x?.priority),
    requester: x?.requester ?? x?.owner ?? x?.createdBy ?? 'unknown',
    createdAt: x?.createdAt ?? x?.created_at ?? x?.dateCreated ?? new Date().toISOString(),
    updatedAt: x?.updatedAt ?? x?.updated_at ?? x?.dateUpdated,
    steps: Array.isArray(x?.steps)
      ? x.steps.map((s: any, j: number): RawStep => ({
          id: s?.id ?? s?.stepId ?? `${Date.now()}-${i}-${j}`,
          name: s?.name ?? s?.label ?? `Step ${j + 1}`,
          assignee: s?.assignee ?? s?.approver ?? '',
          status: toStepStatus(s?.status),
          startedAt: s?.startedAt ?? s?.started_at,
          completedAt: s?.completedAt ?? s?.completed_at,
        }))
      : [],
  })

  const raw: RawRequest[] = rawArray.map(normalize)
  const isLoading = !!hookResult.isLoading

  // Keep raw statuses for KPIs/filters (avoids union clashes with UI types)
  const [activeTab, setActiveTab] = React.useState<'all' | RawRequestStatus>('all')

  // Adapt RawRequest → RequestItem (UI type) right at the boundary
  const items: RequestItem[] = raw.map((r) => ({
    id: String(r.id),
    title: r.title,
    status: (r.status as unknown) as RequestItem['status'], // mapped literal
    priority: (r.priority as unknown) as RequestItem['priority'],
    requester: r.requester ?? 'unknown',
    createdAt: r.createdAt!,
    updatedAt: r.updatedAt,
  }))

  // Filter using RAW statuses
  const filteredIds = React.useMemo(() => {
    if (activeTab === 'all') return new Set(raw.map((r) => String(r.id)))
    return new Set(raw.filter((r) => r.status === activeTab).map((r) => String(r.id)))
  }, [raw, activeTab])

  const filteredItems = React.useMemo(
    () => items.filter((i) => filteredIds.has(i.id)),
    [items, filteredIds]
  )

  // Selection (keep both raw + UI versions available)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const selectedRaw: RawRequest | null = React.useMemo(
    () => raw.find((r) => String(r.id) === selectedId) ?? null,
    [raw, selectedId]
  )
  const selectedItem: RequestItem | null = React.useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  )

  // ApprovalWorkflow expects WorkflowStep[] with { id, label, approver, state }
  const steps: WorkflowStep[] = React.useMemo(() => {
    const s = selectedRaw?.steps ?? []
    return s.map((st) => ({
      id: String(st.id),
      label: st.name, // rename
      approver: st.assignee ?? '', // rename
      state: (st.status as unknown) as WorkflowStep['state'], // cast at the edge
      // NOTE: do not include startedAt/completedAt if WorkflowStep doesn't declare them
    }))
  }, [selectedRaw])

  // Create form (controlled). Ensure fields exist in RequestFormValues.
  const [showCreate, setShowCreate] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [formValue, setFormValue] = React.useState<Partial<RequestFormValues>>({
    title: '',
    description: '',
    priority: 'medium',
  })

  async function handleSubmit(v: RequestFormValues) {
    setCreating(true)
    try {
      // TODO: call your API to create request
      console.log('create request', v)
      setShowCreate(false)
      // TODO: refresh list (via hook/React Query/RTK)
    } finally {
      setCreating(false)
    }
  }

  // KPIs use raw (safe literal comparisons)
  const stats = React.useMemo(() => {
    const total = raw.length
    const pending = raw.filter((r) => r.status === 'pending').length
    const inProgress = raw.filter((r) => r.status === 'in_progress').length
    const completed = raw.filter((r) => r.status === 'completed').length
    return { total, pending, inProgress, completed }
  }, [raw])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Requests</h1>
          <p className="mt-1 text-gray-600">
            Create and track data-related requests, approvals, and workflow automation.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Request
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-blue-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" aria-hidden />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-600" aria-hidden />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs (use raw status literals) */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={[
                'border-b-2 py-2 px-1 text-sm font-medium',
                activeTab === (tab.id as typeof activeTab)
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Requests List (expects items/loading/onSelect/onNew) */}
      <RequestList
        items={filteredItems}
        loading={isLoading}
        onSelect={(id) => setSelectedId(id)}
        onNew={() => setShowCreate(true)}
      />

      {/* Create Request Modal (RequestForm is controlled) */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create New Request"
        size="lg"
      >
        <RequestForm
          value={formValue}
          onChange={setFormValue}
          onSubmit={handleSubmit}
          busy={creating}
        />
      </Modal>

      {/* Request Details + Workflow */}
      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedId(null)}
        title={selectedItem ? `Request Details — ${selectedItem.title}` : 'Request Details'}
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-6">
            {/* RequestDetails expects a RequestItem */}
            <RequestDetails request={selectedItem} />
            {/* ApprovalWorkflow expects { steps } with { id, label, approver, state } */}
            <ApprovalWorkflow steps={steps} />
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Requests
