// src/types/bulkActions.ts - Updated types to match the expected interface
export interface BulkAction {
  type: 'update_tags' | 'update_classification' | 'archive' | 'delete';
  assetIds: string[];
  params: Record<string, any>;
}

export interface BulkActionResult {
  total: number;
  successful: number;
  failed: number;
  errors?: Array<{
    assetId: string;
    message: string;
  }>;
}