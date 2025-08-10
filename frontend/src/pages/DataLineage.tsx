import type { Asset, AssetLayer } from '@/types/dataAssets'
import { Button } from '@components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@components/ui/Card'
import { Select } from '@components/ui/Select'
import { useDataAssets } from '@hooks/useDataAssets'
import { ArrowRight, Database, GitBranch, Search } from 'lucide-react'
import * as React from 'react'

type ViewMode = 'flow' | 'impact' | 'dependencies'

export const DataLineage: React.FC = () => {
  const { assets: rawAssets } = useDataAssets()
  const assets: Asset[] = Array.isArray(rawAssets) ? rawAssets : []

  const [selectedAssetId, setSelectedAssetId] = React.useState<string>('')
  const [viewMode, setViewMode] = React.useState<ViewMode>('flow')

  const assetOptions = React.useMemo(
    () =>
      assets.map(a => ({
        value: String(a.id),
        label: a.name ?? '(unnamed asset)',
      })),
    [assets]
  )

  const selectedAsset: Asset | null = React.useMemo(
    () => assets.find(a => String(a.id) === selectedAssetId) ?? null,
    [assets, selectedAssetId]
  )

  function layerColors(layer?: AssetLayer) {
    if (layer === 'Gold') return { chip: 'bg-yellow-100 text-yellow-800', tag: 'bg-yellow-200 text-yellow-800', label: 'Gold Layer' }
    if (layer === 'Silver') return { chip: 'bg-gray-100 text-gray-800', tag: 'bg-gray-200 text-gray-800', label: 'Silver Layer' }
    return { chip: 'bg-orange-100 text-orange-800', tag: 'bg-orange-200 text-orange-800', label: 'Bronze Layer' } // default Bronze
  }

  function inferLayerFromStep(step: string): AssetLayer {
    return step.includes('Gold') ? 'Gold' : step.includes('Silver') ? 'Silver' : 'Bronze'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Lineage</h1>
          <p className="mt-1 text-gray-600">Trace data flow and dependencies across your data platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            options={[
              { value: 'flow', label: 'Flow View' },
              { value: 'impact', label: 'Impact Analysis' },
              { value: 'dependencies', label: 'Dependencies' },
            ]}
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as ViewMode)}
          />
          <Button variant="outline">
            <Search className="mr-2 h-4 w-4" />
            Search Lineage
          </Button>
        </div>
      </div>

      {/* Asset Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Data Asset</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Choose Asset"
              options={[{ value: '', label: 'Select an asset...' }, ...assetOptions]}
              value={selectedAssetId}
              onChange={(e) => setSelectedAssetId(e.target.value)}
            />
            {selectedAsset && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Layer:</span>
                  {(() => {
                    const { chip, label } = layerColors(selectedAsset.layer)
                    return <span className={`rounded-full px-2 py-1 text-xs ${chip}`}>{selectedAsset.layer ?? 'Bronze'}{selectedAsset.layer ? '' : ''}</span>
                  })()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Type:</span>
                  <span className="text-sm text-gray-600">{selectedAsset.type ?? '—'}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Lineage Visualization */}
      {selectedAsset ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Data Flow — {selectedAsset.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {(selectedAsset.lineage ?? []).map((step: string, index: number, arr: string[]) => {
                const layer = inferLayerFromStep(step)
                const { chip, tag, label } = layerColors(layer)
                return (
                  <div key={`${step}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`rounded-lg p-3 ${chip.replace('text-', 'text-gray-700 ')}`}>
                        <Database className="h-6 w-6 text-gray-700" aria-hidden />
                      </div>
                      <div className="ml-4">
                        <p className="font-medium text-gray-900">{step}</p>
                        <p className={`mt-1 inline-block rounded px-2 py-1 text-xs ${tag}`}>{label}</p>
                      </div>
                    </div>

                    {index < arr.length - 1 && <ArrowRight className="mx-4 h-6 w-6 text-gray-400" aria-hidden />}
                  </div>
                )
              })}
            </div>

            {/* Dependencies and Dependents */}
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                <h4 className="mb-3 font-medium text-gray-900">Dependencies (Upstream)</h4>
                <div className="space-y-2">
                  {(selectedAsset.dependencies ?? []).map((dep: string, i: number) => (
                    <div key={`up-${i}-${dep}`} className="flex items-center gap-2 rounded bg-blue-50 p-2">
                      <GitBranch className="h-4 w-4 text-blue-600" aria-hidden />
                      <span className="text-sm">{dep}</span>
                    </div>
                  ))}
                  {(!selectedAsset.dependencies || selectedAsset.dependencies.length === 0) && (
                    <p className="text-sm text-gray-500">No upstream dependencies.</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-3 font-medium text-gray-900">Dependents (Downstream)</h4>
                <div className="space-y-2">
                  {(selectedAsset.dependents ?? []).map((dep: string, i: number) => (
                    <div key={`down-${i}-${dep}`} className="flex items-center gap-2 rounded bg-green-50 p-2">
                      <GitBranch className="h-4 w-4 text-green-600" aria-hidden />
                      <span className="text-sm">{dep}</span>
                    </div>
                  ))}
                  {(!selectedAsset.dependents || selectedAsset.dependents.length === 0) && (
                    <p className="text-sm text-gray-500">No downstream dependents.</p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <GitBranch className="mx-auto mb-4 h-12 w-12 text-gray-400" aria-hidden />
            <h3 className="mb-2 text-lg font-medium text-gray-900">Select a Data Asset</h3>
            <p className="text-gray-600">Choose a data asset from the dropdown above to view its lineage and dependencies.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default DataLineage
