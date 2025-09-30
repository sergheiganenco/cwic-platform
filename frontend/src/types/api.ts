export type Quality = 'high' | 'medium' | 'low'
export type Classification = 'public' | 'internal' | 'confidential' | 'restricted'
export type AssetType = 'table' | 'view' | 'file' | 'api' | 'dashboard' | 'report'

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface Asset {
  id: string
  name: string
  type: AssetType
  description?: string
  dataSourceId: string
  schema: string
  table: string
  owner: string
  quality: Quality
  classification: Classification
  tags: string[]
  metadata?: Record<string, unknown>
  lastUpdated?: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
  viewCount?: number
  isBookmarked?: boolean
}

export interface AssetSummary {
  total: number
  byType: Record<string, number>
  byQuality: Record<Quality, number>
  byClassification: Record<Classification, number>
  byOwner: Record<string, number>
  recentlyUpdated: number
}

export interface AssetsApiResponse {
  assets: Asset[]
  pagination: PaginationInfo
  summary?: AssetSummary
  total?: number
}

export interface DataSource {
  id: string
  name: string
  type: string
  status: 'online' | 'offline' | 'degraded'
}

export interface OverviewStats {
  assets: number
  dataSources: number
  owners: number
  updatedLast24h: number
}
