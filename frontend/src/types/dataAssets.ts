// src/types/dataAssets.ts - Complete Updated Version
export interface Asset {
  id: string;
  name: string;
  type: 'table' | 'view' | 'file' | 'api' | 'dashboard' | 'report';
  urn?: string;
  description?: string;
  dataSourceId: string;
  dataSourceName?: string; // Name of the data source (server/database)
  dataSourceType?: string; // Type of data source (postgresql, mysql, etc.)
  databaseName?: string; // Database name within the data source
  schema: string;
  table: string;
  rowCount?: number | null; // Row count for tables/views
  columnCount?: number | null; // Column count for tables/views
  owner: string;
  quality: 'high' | 'medium' | 'low';
  qualityScore?: number; // Numeric quality score (0-100)
  trustScore?: number; // Trust score (0-100) - calculated from various metrics
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  tags: string[];
  metadata: Record<string, any>;
  lastUpdated: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
  accessRequests?: number;
  viewCount?: number; // Usage: number of times viewed
  ratingAvg?: number | null; // Average user rating (1-5)
  bookmarkCount?: number; // Number of users who bookmarked
  commentCount?: number; // Number of comments
  ownerId?: string; // UUID of owner
  lastProfiledAt?: string; // When data profiling last ran
  isBookmarked?: boolean;
  lineageDepth?: number;
}

// Updated AssetFilters with proper optional typing
export interface AssetFilters {
  page?: number;
  limit?: number;
  search?: string;
  type?: Asset['type'] | string;
  owner?: string;
  quality?: Asset['quality'];
  classification?: Asset['classification'];
  dataSourceId?: string;
  database?: string;
  databases?: string[];  // Added support for multiple databases
  schema?: string;
  tags?: string[];
  objectType?: 'user' | 'system';
  sortBy?: 'name' | 'updatedAt' | 'createdAt' | 'quality' | 'owner' | 'rows' | string;
  sortOrder?: 'asc' | 'desc';
  dateRange?: {
    start: string;
    end: string;
  };
}

// Type for URL parsing to handle string conversion
export interface AssetFiltersFromUrl {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  owner?: string;
  quality?: string;
  classification?: string;
  dataSourceId?: string;
  database?: string;
  schema?: string;
  tags?: string[];
  objectType?: string;
  sortBy?: string;
  sortOrder?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface CreateAssetData {
  name: string;
  type: Asset['type'];
  description?: string;
  dataSourceId: string;
  schema: string;
  table: string;
  classification: Asset['classification'];
  quality: Asset['quality'];
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface UpdateAssetData extends Partial<CreateAssetData> {
  id: string;
  updatedBy?: string;
}

export interface AssetSummary {
  total: number;
  byType: Record<Asset['type'], number>;
  byQuality: Record<Asset['quality'], number>;
  byClassification: Record<Asset['classification'], number>;
  byOwner: Record<string, number>;
  recentlyUpdated: number;
  lastSyncedAt?: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Access Request related types
export interface AccessRequest {
  id: string;
  assetId: string;
  requesterId: string;
  requesterEmail: string;
  reason?: string;
  urgency: 'low' | 'medium' | 'high';
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  approvalExpiry?: string;
  metadata?: Record<string, any>;
}

export interface AccessRequestData {
  assetId: string;
  reason?: string;
  urgency?: 'low' | 'medium' | 'high';
}

export interface AccessRequestResponse {
  requestId: string;
  status: 'submitted' | 'auto_approved';
  message: string;
  estimatedReviewTime?: string;
}

// Search and filtering helpers
export interface SearchResult<T = Asset> {
  items: T[];
  pagination: PaginationInfo;
  summary?: AssetSummary;
  facets?: {
    types: Record<string, number>;
    owners: Record<string, number>;
    quality: Record<string, number>;
    classification: Record<string, number>;
    dataSources: Record<string, number>;
    tags: Record<string, number>;
  };
}

export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: AssetFilters;
  createdBy: string;
  createdAt: string;
  isPublic: boolean;
  usageCount: number;
}

// Asset relationship types
export interface AssetLineage {
  upstream: Asset[];
  downstream: Asset[];
  depth: number;
  totalRelationships: number;
}

export interface AssetRelationship {
  id: string;
  fromAssetId: string;
  toAssetId: string;
  relationshipType: 'derives_from' | 'transforms_to' | 'copies_from' | 'aggregates_from';
  confidence: number;
  metadata?: Record<string, any>;
  createdAt: string;
  createdBy: string;
}

// Data quality types
export interface DataQualityMetrics {
  assetId: string;
  overallScore: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  timeliness: number;
  validity: number;
  lastAssessedAt: string;
  rules: DataQualityRule[];
}

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  expression: string;
  weight: number;
  status: 'pass' | 'fail' | 'warning';
  lastRunAt: string;
  impact: 'high' | 'medium' | 'low';
}

// Asset usage and analytics
export interface AssetUsageStats {
  assetId: string;
  viewCount: number;
  downloadCount: number;
  queryCount: number;
  uniqueUsers: number;
  averageRating: number;
  popularityScore: number;
  trendDirection: 'up' | 'down' | 'stable';
  lastAccessedAt: string;
  peakUsageTime: string;
  usageByTimeOfDay: Record<string, number>;
  usageByDayOfWeek: Record<string, number>;
}

export interface AssetComment {
  id: string;
  assetId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isEdited: boolean;
  parentCommentId?: string;
  replies?: AssetComment[];
}

export interface AssetBookmark {
  id: string;
  assetId: string;
  userId: string;
  createdAt: string;
  tags?: string[];
  notes?: string;
}

// Asset versioning
export interface AssetVersion {
  id: string;
  assetId: string;
  version: string;
  changes: AssetChangeRecord[];
  createdAt: string;
  createdBy: string;
  description?: string;
  isActive: boolean;
}

export interface AssetChangeRecord {
  field: keyof Asset;
  oldValue: any;
  newValue: any;
  changeType: 'created' | 'updated' | 'deleted';
  timestamp: string;
  userId: string;
  reason?: string;
}

// Error and API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metadata?: {
    requestId: string;
    timestamp: string;
    duration: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, any>;
  timestamp: string;
  path?: string;
  method?: string;
}

// Bulk operations
export interface BulkOperation<T = any> {
  operationType: 'update' | 'delete' | 'archive' | 'restore';
  assetIds: string[];
  parameters: T;
  options?: {
    continueOnError?: boolean;
    notifyUsers?: boolean;
    skipValidation?: boolean;
  };
}

export interface BulkOperationResult {
  operationId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'partial';
  total: number;
  processed: number;
  successful: number;
  failed: number;
  startedAt: string;
  completedAt?: string;
  errors?: Array<{
    assetId: string;
    error: string;
    code: string;
  }>;
  results?: Array<{
    assetId: string;
    success: boolean;
    data?: any;
  }>;
}

// Asset validation
export interface AssetValidationRule {
  field: keyof Asset;
  rule: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'custom';
  value: any;
  message: string;
}

export interface AssetValidationResult {
  isValid: boolean;
  errors: Array<{
    field: keyof Asset;
    message: string;
    code: string;
  }>;
  warnings?: Array<{
    field: keyof Asset;
    message: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// Export/Import types
export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  fields?: (keyof Asset)[];
  filters?: AssetFilters;
  includeMetadata?: boolean;
  includeLineage?: boolean;
  compression?: boolean;
}

export interface ImportResult {
  importId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errors?: Array<{
    row: number;
    field?: string;
    message: string;
  }>;
  warnings?: Array<{
    row: number;
    message: string;
  }>;
}

// Type guards for runtime type checking
// Updated type guards that handle undefined values
export const isValidAssetType = (type: string | undefined): type is Asset['type'] => {
  return type !== undefined && ['table', 'view', 'file', 'api', 'dashboard', 'report'].includes(type);
};

export const isValidQuality = (quality: string | undefined): quality is Asset['quality'] => {
  return quality !== undefined && ['high', 'medium', 'low'].includes(quality);
};

export const isValidClassification = (classification: string | undefined): classification is Asset['classification'] => {
  return classification !== undefined && ['public', 'internal', 'confidential', 'restricted'].includes(classification);
};

export const isValidSortBy = (sortBy: string | undefined): sortBy is NonNullable<AssetFilters['sortBy']> => {
  return sortBy !== undefined && ['name', 'updatedAt', 'createdAt', 'quality', 'owner'].includes(sortBy);
};

export const isValidSortOrder = (sortOrder: string | undefined): sortOrder is NonNullable<AssetFilters['sortOrder']> => {
  return sortOrder !== undefined && ['asc', 'desc'].includes(sortOrder);
};

// Alternative approach - separate functions for strict typing
export const isStrictAssetType = (type: string): type is Asset['type'] => {
  return ['table', 'view', 'file', 'api', 'dashboard', 'report'].includes(type);
};

export const isStrictQuality = (quality: string): quality is Asset['quality'] => {
  return ['high', 'medium', 'low'].includes(quality);
};

export const isStrictClassification = (classification: string): classification is Asset['classification'] => {
  return ['public', 'internal', 'confidential', 'restricted'].includes(classification);
};

// Helper function to create empty asset filters
export const createEmptyFilters = (): AssetFilters => ({
  page: 1,
  limit: 20,
  sortBy: 'updatedAt',
  sortOrder: 'desc'
});

// Helper function to validate asset data
export const validateAssetData = (data: Partial<CreateAssetData>): AssetValidationResult => {
  const errors: AssetValidationResult['errors'] = [];
  const warnings: AssetValidationResult['warnings'] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Asset name is required', code: 'REQUIRED' });
  }

  if (data.name && data.name.length > 255) {
    errors.push({ field: 'name', message: 'Asset name must be less than 255 characters', code: 'MAX_LENGTH' });
  }

  if (!data.type || !isValidAssetType(data.type)) {
    errors.push({ field: 'type', message: 'Valid asset type is required', code: 'INVALID_VALUE' });
  }

  if (!data.dataSourceId || data.dataSourceId.trim().length === 0) {
    errors.push({ field: 'dataSourceId', message: 'Data source ID is required', code: 'REQUIRED' });
  }

  if (!data.schema || data.schema.trim().length === 0) {
    errors.push({ field: 'schema', message: 'Schema name is required', code: 'REQUIRED' });
  }

  if (!data.table || data.table.trim().length === 0) {
    errors.push({ field: 'table', message: 'Table name is required', code: 'REQUIRED' });
  }

  if (data.classification && !isValidClassification(data.classification)) {
    errors.push({ field: 'classification', message: 'Valid classification is required', code: 'INVALID_VALUE' });
  }

  if (data.quality && !isValidQuality(data.quality)) {
    errors.push({ field: 'quality', message: 'Valid quality level is required', code: 'INVALID_VALUE' });
  }

  if (data.tags && data.tags.length > 20) {
    warnings.push({ field: 'tags', message: 'Consider using fewer than 20 tags for better organization', severity: 'medium' });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings: warnings.length > 0 ? warnings : undefined
  };
};

// Constants for UI use
export const ASSET_TYPES: Array<{ value: Asset['type']; label: string; icon: string }> = [
  { value: 'table', label: 'Table', icon: 'database' },
  { value: 'view', label: 'View', icon: 'eye' },
  { value: 'file', label: 'File', icon: 'file' },
  { value: 'api', label: 'API', icon: 'globe' },
  { value: 'dashboard', label: 'Dashboard', icon: 'bar-chart' },
  { value: 'report', label: 'Report', icon: 'file-text' }
];

export const QUALITY_LEVELS: Array<{ value: Asset['quality']; label: string; color: string }> = [
  { value: 'high', label: 'High Quality', color: 'green' },
  { value: 'medium', label: 'Medium Quality', color: 'yellow' },
  { value: 'low', label: 'Low Quality', color: 'red' }
];

export const CLASSIFICATION_LEVELS: Array<{ value: Asset['classification']; label: string; color: string }> = [
  { value: 'public', label: 'Public', color: 'blue' },
  { value: 'internal', label: 'Internal', color: 'gray' },
  { value: 'confidential', label: 'Confidential', color: 'orange' },
  { value: 'restricted', label: 'Restricted', color: 'red' }
];

export const SORT_OPTIONS: Array<{ value: AssetFilters['sortBy']; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'quality', label: 'Quality Score' },
  { value: 'owner', label: 'Owner' }
];
