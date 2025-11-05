/**
 * Hook to fetch quality issue summary for assets
 */

import { useState, useEffect } from 'react';

export interface QualityIssueSummary {
  asset_id: string;
  table_name: string;
  schema_name: string;
  database_name: string;
  pii_column_count: number;
  columns_with_issues: number;
  total_issues: number;
  critical_issues: number;
  high_issues: number;
}

export function useQualityIssueSummary() {
  const [summaries, setSummaries] = useState<Map<string, QualityIssueSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIssueSummary();
  }, []);

  const fetchIssueSummary = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/quality/issue-summary');
      const result = await response.json();

      if (result.success && result.data) {
        const summaryMap = new Map<string, QualityIssueSummary>();
        result.data.forEach((summary: QualityIssueSummary) => {
          summaryMap.set(summary.asset_id, summary);
        });
        setSummaries(summaryMap);
      } else {
        throw new Error('Failed to fetch quality issue summary');
      }
    } catch (err) {
      console.error('Error fetching quality issue summary:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getIssueSummary = (assetId: string): QualityIssueSummary | undefined => {
    return summaries.get(assetId);
  };

  return {
    summaries,
    loading,
    error,
    getIssueSummary,
    refresh: fetchIssueSummary,
  };
}
