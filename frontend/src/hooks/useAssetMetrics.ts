// src/hooks/useAssetMetrics.ts
import { useApi } from '@/hooks/useApi';
import { AssetFilters } from '@/types/dataAssets';
import { useCallback, useEffect, useState } from 'react';

interface AssetMetrics {
  totalAssets: number;
  activeUsers: number;
  dailyViews: number;
  qualityScore: number;
  usageByType: Record<string, number>;
  qualityDistribution: Record<string, number>;
  recentActivity: Array<{
    date: string;
    views: number;
    searches: number;
    creations: number;
  }>;
}

interface AssetTrends {
  totalAssets?: { value: number; direction: 'up' | 'down'; period: string };
  activeUsers?: { value: number; direction: 'up' | 'down'; period: string };
  qualityScore?: { value: number; direction: 'up' | 'down'; period: string };
}

interface UseAssetMetricsOptions {
  filters?: AssetFilters;
  enabled?: boolean;
  refreshInterval?: number;
}

// Mock data for development
const mockMetrics: AssetMetrics = {
  totalAssets: 1247,
  activeUsers: 23,
  dailyViews: 892,
  qualityScore: 84,
  usageByType: { table: 650, view: 245, file: 198, api: 89, dashboard: 42, report: 23 },
  qualityDistribution: { high: 934, medium: 245, low: 68 },
  recentActivity: [
    { date: '2025-01-09', views: 156, searches: 89, creations: 5 },
    { date: '2025-01-08', views: 142, searches: 67, creations: 8 },
    { date: '2025-01-07', views: 178, searches: 94, creations: 3 }
  ]
};

const mockTrends: AssetTrends = {
  totalAssets: { value: 12, direction: 'up', period: 'this month' },
  activeUsers: { value: 8, direction: 'up', period: 'this week' },
  qualityScore: { value: 3, direction: 'up', period: 'this month' }
};

export const useAssetMetrics = (options: UseAssetMetricsOptions = {}) => {
  const api = useApi();
  const { filters = {}, enabled = true, refreshInterval = 0 } = options;
  const useMocks = import.meta.env.MODE === 'development' && import.meta.env.VITE_USE_MOCKS !== '0';

  const [metrics, setMetrics] = useState<AssetMetrics | null>(null);
  const [trends, setTrends] = useState<AssetTrends | null>(null);
  const [qualityScore, setQualityScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!enabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        if (Array.isArray(v)) qs.set(k, v.join(','));
        else qs.set(k, String(v));
      });

      if (useMocks) {
        await new Promise(r => setTimeout(r, 400));
        setMetrics(mockMetrics);
        setTrends(mockTrends);
        setQualityScore(mockMetrics.qualityScore);
        return;
      }

      const [m, t] = await Promise.all([
        api.get<any>(`/api/metrics/assets?${qs.toString()}`),
        api.get<any>(`/api/metrics/trends?${qs.toString()}`)
      ]);

      const mCoerced: AssetMetrics = {
        totalAssets: Number(m.totalAssets ?? m.total ?? 0),
        activeUsers: Number(m.activeUsers ?? 0),
        dailyViews: Number(m.dailyViews ?? 0),
        qualityScore: Number(m.qualityScore ?? 0),
        usageByType: (m.usageByType ?? {}) as Record<string, number>,
        qualityDistribution: (m.qualityDistribution ?? {}) as Record<string, number>,
        recentActivity: Array.isArray(m.recentActivity) ? m.recentActivity : []
      };

      const tCoerced: AssetTrends = {
        totalAssets: t?.totalAssets,
        activeUsers: t?.activeUsers,
        qualityScore: t?.qualityScore
      };

      setMetrics(mCoerced);
      setTrends(tCoerced);
      setQualityScore(mCoerced.qualityScore);
    } catch (e: any) {
      if (useMocks) {
        setMetrics(mockMetrics);
        setTrends(mockTrends);
        setQualityScore(mockMetrics.qualityScore);
      } else {
        setError(e?.message || 'Failed to fetch metrics');
      }
    } finally {
      setIsLoading(false);
    }
  }, [api, filters, enabled, useMocks]);

  const refresh = useCallback(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    const delay = import.meta.env.MODE === 'development' ? 1200 : 0;
    const t = setTimeout(fetchMetrics, delay);
    return () => clearTimeout(t);
  }, [fetchMetrics]);

  useEffect(() => {
    if (refreshInterval > 0 && import.meta.env.MODE !== 'development') {
      const id = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(id);
    }
  }, [refreshInterval, fetchMetrics]);

  return {
    metrics,
    trends,
    qualityScore,
    isLoading,
    error,
    refresh
  };
};
