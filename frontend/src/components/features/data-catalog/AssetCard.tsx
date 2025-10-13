import { Badge } from '@components/ui/Badge'
import { Card, CardContent } from '@components/ui/Card'
import { cn } from '@utils'
import { Database } from 'lucide-react'

export type Asset = {
  id: string
  name: string
  description?: string
  type?: 'table' | 'view' | 'file' | 'dashboard' | 'ml-model' | string
  owner?: string
  tags?: string[]
  updatedAt?: string
  qualityScore?: number
  dataSourceName?: string
  dataSourceType?: string
  schema?: string
}

export interface AssetCardProps {
  asset: Asset
  onClick?: (id: string) => void
  className?: string
}

export function AssetCard({ asset, onClick, className }: AssetCardProps) {
  const tone = typeof asset.qualityScore === 'number'
    ? asset.qualityScore >= 90 ? 'success'
      : asset.qualityScore >= 75 ? 'warning'
      : 'danger'
    : 'neutral'

  return (
    <Card
      className={cn('cursor-pointer transition hover:shadow-md', className)}
      onClick={() => onClick?.(asset.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.(asset.id)}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold text-gray-900">{asset.name}</div>
            {(asset.dataSourceName || asset.schema) && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500">
                <Database className="h-3 w-3" />
                <span className="truncate">
                  {asset.dataSourceName}
                  {asset.schema && ` · ${asset.schema}`}
                </span>
              </div>
            )}
            {asset.description && (
              <div className="mt-1 line-clamp-2 text-sm text-gray-600">{asset.description}</div>
            )}
            <div className="mt-2 flex flex-wrap gap-1">
              {asset.tags?.slice(0, 4).map((t) => (
                <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">{t}</span>
              ))}
              {asset.tags && asset.tags.length > 4 && (
                <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">+{asset.tags.length - 4}</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <Badge tone="neutral">{asset.type ?? 'asset'}</Badge>
            {typeof asset.qualityScore === 'number' && (
              <div className="mt-2">
                <Badge tone={tone}>QS: {asset.qualityScore.toFixed(1)}%</Badge>
              </div>
            )}
          </div>
        </div>
        {asset.owner || asset.updatedAt ? (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
            {asset.owner && <span>Owner: {asset.owner}</span>}
            {asset.updatedAt && <span>Updated: {fmt(asset.updatedAt)}</span>}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
