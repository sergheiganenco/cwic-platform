import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import type { RequestItem } from './RequestList'

export function RequestDetails({
  request,
  onApprove,
  onReject,
  onComplete,
}: {
  request: RequestItem | null
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onComplete?: (id: string) => void
}) {
  if (!request) return null

  const statusTone =
    request.status === 'approved'
      ? 'success'
      : request.status === 'rejected'
      ? 'danger'
      : request.status === 'in_review'
      ? 'info'
      : request.status === 'completed'
      ? 'neutral'
      : 'warning'

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{request.title}</CardTitle>
          <Badge tone={statusTone}>{request.status}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div><span className="text-gray-500">Requester: </span>{request.requester}</div>
        <div><span className="text-gray-500">Created: </span>{fmt(request.createdAt)}</div>
        {request.summary && <p className="text-gray-700">{request.summary}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onApprove?.(request.id)}>Approve</Button>
          <Button variant="ghost" onClick={() => onReject?.(request.id)}>Reject</Button>
          <Button onClick={() => onComplete?.(request.id)}>Mark Complete</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
