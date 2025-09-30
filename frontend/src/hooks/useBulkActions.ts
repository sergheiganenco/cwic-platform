// src/hooks/useBulkActions.ts
import { BulkOperationResult } from '@/types/dataAssets';
import { useCallback, useState } from 'react';

export const useBulkActions = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    completed: number;
    current?: string;
  } | null>(null);
  const [results, setResults] = useState<BulkOperationResult | null>(null);

  const performBulkAction = useCallback(async (
    action: { type: string; params: any }, 
    assetIds: string[]
  ): Promise<BulkOperationResult> => {
    setIsProcessing(true);
    setProgress({ total: assetIds.length, completed: 0 });
    setResults(null);

    try {
      const response = await fetch('/api/assets/bulk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          operationType: action.type,
          assetIds,
          parameters: action.params
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Bulk action failed');
      }

      const result = await response.json();
      setResults(result);
      return result;

    } catch (error: any) {
      const errorResult: BulkOperationResult = {
        operationId: 'failed',
        status: 'failed',
        total: assetIds.length,
        processed: 0,
        successful: 0,
        failed: assetIds.length,
        startedAt: new Date().toISOString(),
        errors: [{ assetId: 'all', error: error.message, code: 'BULK_OPERATION_FAILED' }]
      };
      setResults(errorResult);
      throw error;
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  }, []);

  const resetResults = useCallback(() => {
    setResults(null);
    setProgress(null);
  }, []);

  return { 
    performBulkAction, 
    isProcessing, 
    progress, 
    results, 
    resetResults 
  };
};