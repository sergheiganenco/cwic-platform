// src/types/dataAssets.ts
export type AssetLayer = 'Gold' | 'Silver' | 'Bronze'

export type Asset = {
  id: string
  name: string
  description?: string
  type?: string
  owner?: string
  tags?: string[]
  updatedAt?: string
  qualityScore?: number

  // NEW: lineage/graph metadata (all optional)
  layer?: AssetLayer
  lineage?: string[]          // e.g., ["Bronze: raw_orders", "Silver: orders_clean", "Gold: orders_mart"]
  dependencies?: string[]     // upstream names
  dependents?: string[]       // downstream names
}
