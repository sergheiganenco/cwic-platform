// Advanced Catalog Types

export interface CatalogDatabase {
  id: number;
  datasourceId: string;
  name: string;
  objectCount?: number;
  lastScanAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSchema {
  id: number;
  databaseId: number;
  datasourceId: string;
  name: string;
  objectCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type ObjectType = 'table' | 'view' | 'materialized_view' | 'stored_procedure' | 'function' | 'trigger' | 'index' | 'sequence';
export type Classification = 'Public' | 'Internal' | 'Confidential' | 'Sensitive' | 'PII';

export interface CatalogObject {
  id: number;
  schemaId: number;
  databaseId: number;
  datasourceId: string;
  name: string;
  objectType: ObjectType;
  fullyQualifiedName: string;
  description?: string;
  qualityScore?: number;
  classification?: Classification;
  tags?: string[];
  rowCount?: number;
  columnCount?: number;
  sizeBytes?: number;
  popularityScore?: number;
  accessCount?: number;
  lastAccessedAt?: string;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  schemaName?: string;
  databaseName?: string;
  sourceName?: string;
  sourceType?: string;
  bookmarkCount?: number;
  commentCount?: number;
}

export interface CatalogColumn {
  id: number;
  objectId: number;
  name: string;
  dataType: string;
  ordinalPosition: number;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  description?: string;
  classification?: Classification;
  distinctCount?: number;
  nullCount?: number;
  minValue?: string;
  maxValue?: string;
  avgLength?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LineageRelation {
  id: string;
  name: string;
  fullyQualifiedName: string;
  lineageType: string;
}

export interface ObjectDetails extends CatalogObject {
  columns: CatalogColumn[];
  lineage: {
    upstream: LineageRelation[];
    downstream: LineageRelation[];
  };
}

export type ScanStatus = 'pending' | 'connecting' | 'discovering' | 'profiling' | 'classifying' | 'completed' | 'failed';
export type ScanType = 'full' | 'incremental' | 'metadata_only';

export interface ScanOptions {
  includeSystemSchemas: boolean;
  profileData: boolean;
  classifyData: boolean;
  discoverLineage: boolean;
  sampleSize: number;
}

export interface ScanConfig {
  datasourceId: string;
  scanType: ScanType;
  databases?: string[];
  schemas?: string[];
  options: ScanOptions;
}

export interface ScanProgress {
  scanId: string;
  status: ScanStatus;
  currentPhase?: string;
  progress: number;
  stats: {
    databasesDiscovered: number;
    schemasDiscovered: number;
    objectsDiscovered: number;
    columnsDiscovered: number;
    objectsProfiled: number;
    objectsClassified: number;
  };
  errors: Array<{
    phase: string;
    objectName: string;
    error: string;
    timestamp: string;
  }>;
  startedAt: string;
  completedAt?: string;
  message?: string;
}

export interface ScanHistoryItem {
  scanId: string;
  datasourceId: string;
  sourceName: string;
  scanType: ScanType;
  status: ScanStatus;
  databasesScanned: string[];
  objectsDiscovered: number;
  objectsUpdated: number;
  errorCount: number;
  triggeredBy: string;
  startedAt: string;
  completedAt?: string;
}

export interface HierarchySource {
  id: string;
  name: string;
  type: string;
  databases: HierarchyDatabase[];
}

export interface HierarchyDatabase {
  id: number;
  name: string;
  schemas: HierarchySchema[];
}

export interface HierarchySchema {
  id: number;
  name: string;
  objects: HierarchyObject[];
}

export interface HierarchyObject {
  id: number;
  name: string;
  type: ObjectType;
  fqn: string;
  qualityScore?: number;
  classification?: Classification;
  rowCount?: number;
  columnCount?: number;
}

export interface CatalogObjectsFilter {
  search?: string;
  sourceIds?: string[];
  databaseIds?: number[];
  schemaIds?: number[];
  objectTypes?: ObjectType[];
  classifications?: Classification[];
  minQuality?: number;
  tags?: string[];
  page?: number;
  limit?: number;
}

export interface CatalogObjectsResponse {
  success: boolean;
  data: {
    objects: CatalogObject[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface CatalogBookmark {
  id: number;
  objectId: number;
  userId: string;
  createdAt: string;
}

export interface CatalogComment {
  id: number;
  objectId: number;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}
