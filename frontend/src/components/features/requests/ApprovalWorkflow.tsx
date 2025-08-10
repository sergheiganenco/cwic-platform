import { Badge } from '@components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Check, Clock, X } from 'lucide-react'

export type StepState = 'pending' | 'approved' | 'rejected'

export interface WorkflowStep {
  id: string
  label: string
  approver: string
  state: StepState
  updatedAt?: string
}

export function ApprovalWorkflow({ steps = [] as WorkflowStep[] }: { steps?: WorkflowStep[] }) {
  if (!steps.length) {
    return (
      <Card>
        <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
        <CardContent className="text-sm text-gray-600">No workflow configured.</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader><CardTitle>Approval Workflow</CardTitle></CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-xs font-semibold">
                  {i + 1}
                </span>
                <div>
                  <div className="text-sm font-medium text-gray-900">{s.label}</div>
                  <div className="text-xs text-gray-600">Approver: {s.approver}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={tone(s.state)} className="capitalize">{s.state}</Badge>
                <span className="text-xs text-gray-500">{s.updatedAt ? fmt(s.updatedAt) : ''}</span>
                {icon(s.state)}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}

function tone(s: StepState) {
  return s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'info'
}
function icon(s: StepState) {
  const cls = 'h-4 w-4'
  if (s === 'approved') return <Check className={cls} />
  if (s === 'rejected') return <X className={cls} />
  return <Clock className={cls} />
}
function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
