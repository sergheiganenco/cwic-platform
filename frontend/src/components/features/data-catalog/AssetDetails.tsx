import type { Asset } from '@/types/dataAssets'
import { Badge } from '@components/ui/Badge'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Modal } from '@components/ui/Modal'
import * as React from 'react'

export function AssetDetails({
  asset,
  isOpen,
  onClose,
  onRequestAccess,
}: {
  asset: Asset | null
  isOpen: boolean
  onClose: () => void
  onRequestAccess?: (assetId: string) => void
}) {
  if (!asset) return null

  const scoreTone =
    typeof asset.qualityScore === 'number'
      ? asset.qualityScore >= 90 ? 'success' : asset.qualityScore >= 75 ? 'warning' : 'danger'
      : 'neutral'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Asset • ${asset.name}`} size="lg">
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Detail label="Type"><Badge tone="neutral">{asset.type ?? 'asset'}</Badge></Detail>
              <Detail label="Owner">{asset.owner ?? '—'}</Detail>
              <Detail label="Updated">{asset.updatedAt ? fmt(asset.updatedAt) : '—'}</Detail>
              <Detail label="Quality">
                {typeof asset.qualityScore === 'number'
                  ? <Badge tone={scoreTone}>{asset.qualityScore.toFixed(1)}%</Badge>
                  : '—'}
              </Detail>
            </div>
            {asset.description && <p className="text-gray-700">{asset.description}</p>}
            {asset.tags?.length ? (
              <div className="flex flex-wrap gap-1">
                {asset.tags.map((t) => (
                  <span key={t} className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{t}</span>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={() => asset && onRequestAccess?.(asset.id)}>Request Access</Button>
        </div>
      </div>
    </Modal>
  )
}

function Detail({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm text-gray-900">{children}</div>
    </div>
  )
}

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}
