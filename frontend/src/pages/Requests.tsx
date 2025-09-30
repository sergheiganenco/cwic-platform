// src/pages/Requests.tsx
import { Button } from '@components/ui/Button';
import { Card, CardContent } from '@components/ui/Card';
import { Modal } from '@components/ui/Modal';
import * as React from 'react';
import { toast } from 'sonner';

import type { RequestItem } from '@components/features/requests/RequestList';
import { RequestList } from '@components/features/requests/RequestList';

import type { RequestFormValues } from '@components/features/requests/RequestForm';
import { RequestForm } from '@components/features/requests/RequestForm';

import type { WorkflowStep } from '@components/features/requests/ApprovalWorkflow';
import { ApprovalWorkflow } from '@components/features/requests/ApprovalWorkflow';

import { RequestDetails } from '@components/features/requests/RequestDetails';
import { useRequests } from '@hooks/useRequests';

import { AlertTriangle, CheckCircle, Clock, Download, FileText, Plus, RefreshCw, Send } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

// ---------------- Raw shapes (from your data layer; tolerant/normalized) ----------------
type RawRequestStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';
type RawPriority = 'low' | 'medium' | 'high';
type RawStepStatus = 'waiting' | 'approved' | 'rejected' | 'running' | 'done';

type RawStep = {
  id: string | number;
  name: string;
  assignee?: string;
  status: RawStepStatus;
  startedAt?: string;
  completedAt?: string;
};

type RawRequest = {
  id: string | number;
  title: string;
  description?: string;
  status: RawRequestStatus;
  priority?: RawPriority;
  requester?: string;
  createdAt?: string;
  updatedAt?: string;
  steps?: RawStep[];
};

// ----------------------------------- Page -----------------------------------
export const Requests: React.FC = () => {
  const {
    requests: hookRequests,
    isLoading,
    error,
    refresh,
    createRequest,
    approveRequest,
    denyRequest,
    commentRequest,
    filters,
    setFilters,
    setStatus,
    pagination,
    setPage,
    busyIds,
    kpis,
  } = useRequests();

  // Defensive normalization from unknown[] → RawRequest[]
  const rawArray: any[] = Array.isArray(hookRequests) ? (hookRequests as any[]) : [];

  const toRawStatus = (s: any): RawRequestStatus =>
    s === 'pending' || s === 'in_progress' || s === 'completed' || s === 'rejected' ? s : 'pending';

  const toPriority = (p: any): RawPriority => (p === 'low' || p === 'high' ? p : 'medium');

  const toStepStatus = (s: any): RawStepStatus =>
    s === 'approved' || s === 'rejected' || s === 'running' || s === 'done' ? s : 'waiting';

  let uid = 0;
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
  });

  const raw: RawRequest[] = rawArray.map(normalize);

  // Keep raw statuses for KPIs/filters (avoids union clashes with UI types)
  const [activeTab, setActiveTab] = React.useState<'all' | RawRequestStatus>('all');
  React.useEffect(() => {
    setStatus(activeTab);
  }, [activeTab, setStatus]);

  // Deep-link support: /requests/:id opens the details modal
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // Adapt RawRequest → RequestItem (UI type) right at the boundary
  const items: RequestItem[] = raw.map((r) => ({
    id: String(r.id),
    title: r.title,
    status: (r.status as unknown) as RequestItem['status'],
    priority: (r.priority as unknown) as RequestItem['priority'],
    requester: r.requester ?? 'unknown',
    createdAt: r.createdAt!,
    updatedAt: r.updatedAt,
  }));

  // Filter using RAW statuses
  const filteredIds = React.useMemo(() => {
    if (activeTab === 'all') return new Set(raw.map((r) => String(r.id)));
    return new Set(raw.filter((r) => r.status === activeTab).map((r) => String(r.id)));
  }, [raw, activeTab]);

  const filteredItems = React.useMemo(
    () => items.filter((i) => filteredIds.has(i.id)),
    [items, filteredIds]
  );

  // Selection (keep both raw + UI versions available)
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (params.id) setSelectedId(params.id);
  }, [params.id]);

  const closeDetails = () => {
    setSelectedId(null);
    if (params.id) navigate('/requests');
  };

  const selectedRaw: RawRequest | null = React.useMemo(
    () => raw.find((r) => String(r.id) === selectedId) ?? null,
    [raw, selectedId]
  );
  const selectedItem: RequestItem | null = React.useMemo(
    () => items.find((i) => i.id === selectedId) ?? null,
    [items, selectedId]
  );

  // ApprovalWorkflow expects WorkflowStep[] with { id, label, approver, state }
  const steps: WorkflowStep[] = React.useMemo(() => {
    const s = selectedRaw?.steps ?? [];
    return s.map((st) => ({
      id: String(st.id),
      label: st.name,
      approver: st.assignee ?? '',
      state: (st.status as unknown) as WorkflowStep['state'],
    }));
  }, [selectedRaw]);

  // Create form (controlled)
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [formValue, setFormValue] = React.useState<Partial<RequestFormValues>>({
    title: '',
    description: '',
    priority: 'medium',
  });

  async function handleSubmit(v: RequestFormValues) {
    setCreating(true);
    try {
      await createRequest({ title: v.title, description: v.description, priority: v.priority as any });
      setShowCreate(false);
      toast.success('Request created');
      setFormValue({ title: '', description: '', priority: 'medium' });
      refresh();
    } catch (e: any) {
      toast.error('Failed to create request', { description: e?.message || 'Unknown error' });
    } finally {
      setCreating(false);
    }
  }

  // KPIs from hook
  const stats = kpis;

  // CSV export
  function exportCSV() {
    const rows = [
      ['id', 'title', 'status', 'priority', 'requester', 'createdAt', 'updatedAt'],
      ...raw.map((r) => [
        String(r.id),
        r.title,
        r.status,
        r.priority ?? '',
        r.requester ?? '',
        r.createdAt ?? '',
        r.updatedAt ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `requests-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Workflow Requests
            {isLoading && <RefreshCw className="ml-2 inline h-4 w-4 animate-spin text-gray-400" />}
          </h1>
          <p className="mt-1 text-gray-600">
            Create and track data-related requests, approvals, and workflow automation.
          </p>
          {error && <p className="mt-1 text-sm text-amber-700">Note: {String(error)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refresh()} disabled={isLoading}>
            {isLoading ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Request
          </Button>
        </div>
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
        <nav className="-mb-px flex flex-wrap gap-4" aria-label="Request filters">
          {[
            { id: 'all', label: 'All Requests' },
            { id: 'pending', label: 'Pending' },
            { id: 'in_progress', label: 'In Progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'rejected', label: 'Rejected' },
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
              aria-current={activeTab === (tab.id as typeof activeTab) ? 'page' : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Requests List */}
      <RequestList
        items={filteredItems}
        loading={isLoading}
        onSelect={(id) => setSelectedId(id)}
        onNew={() => setShowCreate(true)}
        // If your RequestList supports pagination, wire it:
        // page={pagination.page}
        // total={pagination.total}
        // pageSize={pagination.limit}
        // onPageChange={setPage}
      />

      {/* Create Request Modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Request" size="lg">
        <RequestForm value={formValue} onChange={setFormValue} onSubmit={handleSubmit} busy={creating} />
      </Modal>

      {/* Request Details + Workflow */}
      <Modal
        isOpen={!!selectedItem}
        onClose={closeDetails}
        title={selectedItem ? `Request Details — ${selectedItem.title}` : 'Request Details'}
        size="xl"
      >
        {selectedItem && (
          <div className="space-y-6">
            <RequestDetails request={selectedItem} />
            <ApprovalWorkflow steps={steps} />

            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await denyRequest(selectedItem.id);
                    toast.success('Request rejected');
                    closeDetails();
                  } catch (e: any) {
                    toast.error('Failed to reject', { description: e?.message || 'Unknown error' });
                  }
                }}
                disabled={busyIds.has(selectedItem.id)}
              >
                Reject
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await approveRequest(selectedItem.id);
                    toast.success('Request approved');
                    closeDetails();
                  } catch (e: any) {
                    toast.error('Failed to approve', { description: e?.message || 'Unknown error' });
                  }
                }}
                disabled={busyIds.has(selectedItem.id)}
              >
                Approve
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Add a quick comment…"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && selectedItem) {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (!val) return;
                    try {
                      await commentRequest(selectedItem.id, val);
                      (e.target as HTMLInputElement).value = '';
                      toast.success('Comment posted');
                    } catch (err: any) {
                      toast.error('Failed to comment', { description: err?.message || 'Unknown error' });
                    }
                  }
                }}
              />
              <Button variant="outline" title="Press Enter to send">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Requests;
