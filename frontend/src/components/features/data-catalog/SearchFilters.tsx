import { Button } from '@components/ui/Button'
import { Input } from '@components/ui/Input'
import { Select } from '@components/ui/Select'
import { RefreshCcw } from 'lucide-react'

export function SearchFilters({
  q,
  setQ,
  type,
  setType,
  owner,
  setOwner,
  onRefresh,
}: {
  q: string
  setQ: (v: string) => void
  type: string
  setType: (v: string) => void
  owner: string
  setOwner: (v: string) => void
  onRefresh?: () => void
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, tag, column…"
      />
      <Select
        label="Type"
        value={type}
        onChange={(e) => setType(e.target.value)}
        options={[
          { label: 'All types', value: '' },
          { label: 'Tables', value: 'table' },
          { label: 'Views', value: 'view' },
          { label: 'Files', value: 'file' },
          { label: 'Dashboards', value: 'dashboard' },
          { label: 'ML Models', value: 'ml-model' },
        ]}
      />
      <Input
        value={owner}
        onChange={(e) => setOwner(e.target.value)}
        placeholder="Owner (email or name)"
      />
      <div className="flex items-end">
        <Button variant="secondary" onClick={onRefresh} leftIcon={<RefreshCcw className="h-4 w-4" />}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
