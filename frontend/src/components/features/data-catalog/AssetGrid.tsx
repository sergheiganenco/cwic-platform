import { AssetCard } from '@/components/features/data-catalog/AssetCard'
import type { Asset } from '@/types/dataAssets'


export function AssetGrid({
  items = [],
  onSelect,
  loading,
}: {
  items?: Asset[]
  onSelect?: (id: string) => void
  loading?: boolean
}) {
  if (loading) return <GridSkeleton />
  if (!items.length) return <div className="text-sm text-gray-600">No assets found.</div>

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((a) => (
        <AssetCard key={a.id} asset={a} onClick={onSelect} />
      ))}
    </div>
  )
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="h-5 w-40 animate-pulse rounded bg-gray-200" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-gray-200" />
          <div className="mt-1 h-4 w-3/4 animate-pulse rounded bg-gray-200" />
          <div className="mt-3 flex gap-2">
            <div className="h-5 w-16 animate-pulse rounded bg-gray-200" />
            <div className="h-5 w-12 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  )
}
