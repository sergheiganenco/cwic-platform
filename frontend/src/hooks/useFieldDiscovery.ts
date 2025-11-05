import { useState, useEffect, useCallback } from 'react';
import {
  fieldDiscoveryAPI,
  DiscoveredField,
  FieldDiscoveryStats,
  DriftAlert,
  DiscoverFieldsRequest,
  GetFieldsFilter,
  UpdateFieldStatusRequest,
  ClassifyFieldRequest,
  BulkActionRequest,
} from '@/services/api/fieldDiscovery';

/**
 * Custom hook for field discovery functionality
 * Provides state management and API interaction for field discovery features
 */
export const useFieldDiscovery = () => {
  const [fields, setFields] = useState<DiscoveredField[]>([]);
  const [stats, setStats] = useState<FieldDiscoveryStats | null>(null);
  const [driftAlerts, setDriftAlerts] = useState<DriftAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  /**
   * Trigger field discovery for a data source
   */
  const discoverFields = useCallback(async (request: DiscoverFieldsRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fieldDiscoveryAPI.discoverFields(request);
      setFields(result.fields);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to discover fields';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch discovered fields with filtering
   */
  const fetchFields = useCallback(async (filter?: GetFieldsFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fieldDiscoveryAPI.getDiscoveredFields(filter);
      setFields(result.fields);
      setTotal(result.total);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch fields';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch field discovery statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      const result = await fieldDiscoveryAPI.getStats();
      setStats(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch stats';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Fetch drift alerts
   */
  const fetchDriftAlerts = useCallback(async () => {
    try {
      const result = await fieldDiscoveryAPI.getDriftAlerts();
      setDriftAlerts(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch drift alerts';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Update field status (accept/reject/needs-review/pending)
   */
  const updateFieldStatus = useCallback(async (fieldId: string, request: UpdateFieldStatusRequest) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await fieldDiscoveryAPI.updateFieldStatus(fieldId, request);
      // Update local state
      setFields((prev) =>
        prev.map((field) => (field.id === fieldId ? { ...field, ...updated } : field))
      );
      return updated;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update field status';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Manually classify a field
   */
  const classifyField = useCallback(async (fieldId: string, request: ClassifyFieldRequest) => {
    setLoading(true);
    setError(null);
    try {
      const updated = await fieldDiscoveryAPI.classifyField(fieldId, request);
      // Update local state
      setFields((prev) =>
        prev.map((field) => (field.id === fieldId ? { ...field, ...updated } : field))
      );
      return updated;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to classify field';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Perform bulk action on multiple fields
   */
  const bulkAction = useCallback(async (request: BulkActionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fieldDiscoveryAPI.bulkAction(request);
      // Refresh fields after bulk action
      await fetchFields();
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to perform bulk action';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchFields]);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async (filter?: GetFieldsFilter) => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([fetchFields(filter), fetchStats(), fetchDriftAlerts()]);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to refresh data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchFields, fetchStats, fetchDriftAlerts]);

  return {
    // State
    fields,
    stats,
    driftAlerts,
    loading,
    error,
    total,

    // Actions
    discoverFields,
    fetchFields,
    fetchStats,
    fetchDriftAlerts,
    updateFieldStatus,
    classifyField,
    bulkAction,
    refresh,
  };
};

/**
 * Hook for managing selected fields (for bulk operations)
 */
export const useFieldSelection = () => {
  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  const selectField = useCallback((fieldId: string) => {
    setSelectedFieldIds((prev) => [...prev, fieldId]);
  }, []);

  const deselectField = useCallback((fieldId: string) => {
    setSelectedFieldIds((prev) => prev.filter((id) => id !== fieldId));
  }, []);

  const toggleField = useCallback((fieldId: string) => {
    setSelectedFieldIds((prev) =>
      prev.includes(fieldId) ? prev.filter((id) => id !== fieldId) : [...prev, fieldId]
    );
  }, []);

  const selectAll = useCallback((fieldIds: string[]) => {
    setSelectedFieldIds(fieldIds);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedFieldIds([]);
  }, []);

  const isSelected = useCallback(
    (fieldId: string) => selectedFieldIds.includes(fieldId),
    [selectedFieldIds]
  );

  return {
    selectedFieldIds,
    selectField,
    deselectField,
    toggleField,
    selectAll,
    clearSelection,
    isSelected,
  };
};

/**
 * Hook for field discovery filters
 */
export const useFieldDiscoveryFilters = () => {
  const [filters, setFilters] = useState<GetFieldsFilter>({
    limit: 50,
    offset: 0,
  });

  const updateFilter = useCallback((key: keyof GetFieldsFilter, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ limit: 50, offset: 0 });
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, offset: page * (prev.limit || 50) }));
  }, []);

  return {
    filters,
    updateFilter,
    resetFilters,
    setPage,
  };
};
