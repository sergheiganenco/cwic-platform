import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import * as React from 'react'

export interface RequestFormValues {
  title: string
  description: string
  priority: 'low' | 'medium' | 'high'
  dataset?: string
}

export function RequestForm({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value?: Partial<RequestFormValues>
  onChange?: (v: Partial<RequestFormValues>) => void
  onSubmit?: (v: RequestFormValues) => Promise<void> | void
  busy?: boolean
}) {
  const [form, setForm] = React.useState<RequestFormValues>({
    title: value?.title ?? '',
    description: value?.description ?? '',
    priority: (value?.priority as RequestFormValues['priority']) ?? 'medium',
    dataset: value?.dataset ?? '',
  })

  function patch<K extends keyof RequestFormValues>(k: K, v: RequestFormValues[K]) {
    const next = { ...form, [k]: v }
    setForm(next)
    onChange?.(next)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await onSubmit?.(form)
  }

  return (
    <Card>
      <CardHeader><CardTitle>Create New Request</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <Input placeholder="Title" value={form.title} onChange={(e) => patch('title', e.target.value)} />
          <Input
            placeholder="Dataset / Asset (optional)"
            value={form.dataset ?? ''}
            onChange={(e) => patch('dataset', e.target.value)}
          />
          <textarea
            value={form.description}
            onChange={(e) => patch('description', e.target.value)}
            placeholder="Describe the business requirement…"
            className="w-full rounded-xl border border-gray-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => patch('priority', e.target.value as RequestFormValues['priority'])}
              options={[
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
              ]}
            />
            <div className="flex items-end justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? 'Submitting…' : 'Create Request'}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
