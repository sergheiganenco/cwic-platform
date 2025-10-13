export type AssetType =
  | 'table' | 'view' | 'file' | 'api_endpoint' | 'stream' | 'model'
  | 'procedure' | 'function' | 'schema';

export type AssetStatus = 'active' | 'inactive' | 'deprecated';

export interface Column {
  name: string;
  type?: string;
  dataType?: string;
  nullable: boolean;
  primaryKey?: boolean;
  isPrimaryKey?: boolean;
  foreignKey?: { table: string; column: string };
  description?: string;
  tags?: string[];
}

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  dataSourceId: string;
  dataSourceName?: string;
  dataSourceType?: string;
  schemaName?: string;
  schema?: string;
  tableName?: string;
  table?: string;
  description?: string;
  columns?: Column[];
  tags?: string[];
  status?: AssetStatus;
  rowCount?: string | number | null;
  columnCount?: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  metadata?: Record<string, any>;
}

export interface AssetStats {
  accessCount: number;
  lastAccessed: string | Date | null;
  avgQueryTime: number;
  dataVolume: { current: number; trend: 'increasing' | 'decreasing' | 'stable'; changePercent: number };
  qualityScore: number;
  usageMetrics: { date: string; count: number }[];
}
