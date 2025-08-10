import type { DataSource, DataSourceType } from '@/types/dataSources'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import * as React from 'react'

export interface ConnectionFormProps {
  initial?: Partial<DataSource>
  onSave?: (draft: Partial<DataSource>) => Promise<void> | void
  onClose?: () => void // <-- make onClose valid; your page is passing it
}

export function ConnectionForm({ initial, onSave, onClose }: ConnectionFormProps) {
  const [draft, setDraft] = React.useState<Partial<DataSource>>({
    name: initial?.name ?? '',
    type: (initial?.type as DataSourceType) ?? 'azure-sql',
    host: initial?.host ?? '',
    database: initial?.database ?? '',
    schema: initial?.schema ?? '',
    username: initial?.username ?? '',
  })

  function patch<K extends keyof DataSource>(k: K, v: DataSource[K] | string) {
    setDraft((d) => ({ ...d, [k]: v as any }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    await onSave?.(draft)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{initial?.id ? 'Edit Connection' : 'New Connection'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={submit}>
          <Input placeholder="Name" value={draft.name ?? ''} onChange={(e) => patch('name', e.target.value)} />
          <Select
            label="Type"
            value={(draft.type as string) ?? 'azure-sql'}
            onChange={(e) => patch('type', e.target.value)}
            options={[
              { label: 'Azure SQL', value: 'azure-sql' },
              { label: 'Synapse', value: 'synapse' },
              { label: 'Fabric', value: 'fabric' },
              { label: 'Data Lake', value: 'data-lake' },
              { label: 'Postgres', value: 'postgres' },
              { label: 'Snowflake', value: 'snowflake' },
            ]}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input placeholder="Host" value={draft.host ?? ''} onChange={(e) => patch('host', e.target.value)} />
            <Input placeholder="Database" value={draft.database ?? ''} onChange={(e) => patch('database', e.target.value)} />
            <Input placeholder="Schema" value={draft.schema ?? ''} onChange={(e) => patch('schema', e.target.value)} />
            <Input placeholder="Username" value={draft.username ?? ''} onChange={(e) => patch('username', e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
