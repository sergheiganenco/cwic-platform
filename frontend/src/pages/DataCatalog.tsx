import type { Asset } from '@/types/dataAssets'
import { AssetDetails } from '@components/features/data-catalog/AssetDetails'
import { AssetGrid } from '@components/features/data-catalog/AssetGrid'
import { SearchFilters } from '@components/features/data-catalog/SearchFilters'
import { Button } from '@components/ui/Button'
import { useDataAssets } from '@hooks/useDataAssets'
import { Plus } from 'lucide-react'
import * as React from 'react'

export const DataCatalog: React.FC = () => {
  const { assets: rawAssets, isLoading } = useDataAssets()

  // Null-safe list
  const assets: Asset[] = Array.isArray(rawAssets) ? rawAssets : []

  // Filters: align with SearchFilters API (q, type, owner)
  const [q, setQ] = React.useState('')
  const [type, setType] = React.useState('')   // e.g., dataset/table/view/etc.
  const [owner, setOwner] = React.useState('') // owner name/email

  // Selection + details
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [showDetails, setShowDetails] = React.useState(false)

  const selectedAsset = React.useMemo<Asset | null>(
    () => assets.find(a => a.id === selectedId) ?? null,
    [assets, selectedId]
  )

  // Derived filtering (case-insensitive)
  const filtered = React.useMemo(() => {
    const text = q.trim().toLowerCase()
    return assets.filter(a => {
      const matchesText =
        !text ||
        a.name?.toLowerCase().includes(text) ||
        a.description?.toLowerCase().includes(text) ||
        a.owner?.toLowerCase().includes(text) ||
        (a.tags?.some(t => t.toLowerCase().includes(text)) ?? false)

      const matchesType = !type || (a.type ?? '').toLowerCase() === type.toLowerCase()
      const matchesOwner = !owner || (a.owner ?? '').toLowerCase() === owner.toLowerCase()

      return matchesText && matchesType && matchesOwner
    })
  }, [assets, q, type, owner])

  function handleSelect(id: string) {
    setSelectedId(id)
    setShowDetails(true)
  }

  async function handleRequestAccess(assetId: string) {
    // TODO: wire to your requests service
    console.log('request-access', assetId)
  }

  function handleRefresh() {
    // TODO: trigger a refetch (React Query or Redux thunk)
    console.log('refresh assets')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Catalog</h1>
          <p className="mt-1 text-gray-600">
            Discover and manage all your data assets across your platform.
          </p>
        </div>
        <Button onClick={() => console.log('register-asset')}>
          <Plus className="mr-2 h-4 w-4" />
          Register Asset
        </Button>
      </div>

      {/* Filters (API: q, setQ, type, setType, owner, setOwner, onRefresh?) */}
      <SearchFilters
        q={q}
        setQ={setQ}
        type={type}
        setType={setType}
        owner={owner}
        setOwner={setOwner}
        onRefresh={handleRefresh}
      />

      {/* Asset Grid (API: items, onSelect, loading) */}
      <AssetGrid
        items={filtered}
        onSelect={handleSelect}
        loading={isLoading}
      />

      {/* Details (API: asset, isOpen, onClose, onRequestAccess?) */}
      <AssetDetails
        asset={selectedAsset}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        onRequestAccess={handleRequestAccess}
      />
    </div>
  )
}

export default DataCatalog
