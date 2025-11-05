import { useState, useEffect, useCallback } from 'react';
import {
  classificationAPI,
  ClassificationPolicy,
  ReviewItem,
  ClassificationStats,
  CreatePolicyRequest,
  UpdatePolicyRequest,
  GetPoliciesFilter,
  GetReviewQueueFilter,
  ReviewDecisionRequest,
  BulkApproveRequest,
} from '@/services/api/classification';

/**
 * Custom hook for classification functionality
 * Provides state management and API interaction for classification features
 */
export const useClassification = () => {
  const [policies, setPolicies] = useState<ClassificationPolicy[]>([]);
  const [reviewQueue, setReviewQueue] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<ClassificationStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewTotal, setReviewTotal] = useState(0);

  /**
   * Fetch all classification policies
   */
  const fetchPolicies = useCallback(async (filter?: GetPoliciesFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.getPolicies(filter);
      setPolicies(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch policies';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch a single policy
   */
  const fetchPolicy = useCallback(async (policyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.getPolicy(policyId);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch policy';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Create a new classification policy
   */
  const createPolicy = useCallback(async (request: CreatePolicyRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.createPolicy(request);
      setPolicies((prev) => [...prev, result]);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create policy';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an existing policy
   */
  const updatePolicy = useCallback(async (policyId: string, request: UpdatePolicyRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.updatePolicy(policyId, request);
      setPolicies((prev) =>
        prev.map((policy) => (policy.id === policyId ? result : policy))
      );
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update policy';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Delete a policy
   */
  const deletePolicy = useCallback(async (policyId: string) => {
    setLoading(true);
    setError(null);
    try {
      await classificationAPI.deletePolicy(policyId);
      setPolicies((prev) => prev.filter((policy) => policy.id !== policyId));
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to delete policy';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Execute a classification policy
   */
  const runPolicy = useCallback(async (policyId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.runPolicy(policyId);
      // Update lastRunAt in local state
      setPolicies((prev) =>
        prev.map((policy) =>
          policy.id === policyId
            ? { ...policy, lastRunAt: new Date().toISOString() }
            : policy
        )
      );
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to run policy';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch review queue items
   */
  const fetchReviewQueue = useCallback(async (filter?: GetReviewQueueFilter) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.getReviewQueue(filter);
      setReviewQueue(result.items);
      setReviewTotal(result.total);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch review queue';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Review a classification (approve/reject)
   */
  const reviewItem = useCallback(async (itemId: string, request: ReviewDecisionRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.reviewItem(itemId, request);
      // Update local state
      setReviewQueue((prev) =>
        prev.map((item) => (item.id === itemId ? result : item))
      );
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to review item';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Bulk approve classifications
   */
  const bulkApprove = useCallback(async (request: BulkApproveRequest) => {
    setLoading(true);
    setError(null);
    try {
      const result = await classificationAPI.bulkApprove(request);
      // Refresh review queue after bulk approve
      await fetchReviewQueue();
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to bulk approve';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchReviewQueue]);

  /**
   * Fetch classification statistics
   */
  const fetchStats = useCallback(async () => {
    try {
      const result = await classificationAPI.getStats();
      setStats(result);
      return result;
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to fetch stats';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async (
    policiesFilter?: GetPoliciesFilter,
    reviewFilter?: GetReviewQueueFilter
  ) => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        fetchPolicies(policiesFilter),
        fetchReviewQueue(reviewFilter),
        fetchStats(),
      ]);
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to refresh data';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchPolicies, fetchReviewQueue, fetchStats]);

  return {
    // State
    policies,
    reviewQueue,
    stats,
    loading,
    error,
    reviewTotal,

    // Policy Actions
    fetchPolicies,
    fetchPolicy,
    createPolicy,
    updatePolicy,
    deletePolicy,
    runPolicy,

    // Review Actions
    fetchReviewQueue,
    reviewItem,
    bulkApprove,

    // Stats
    fetchStats,

    // Utility
    refresh,
  };
};

/**
 * Hook for managing selected review items (for bulk operations)
 */
export const useReviewSelection = () => {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  const selectItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => [...prev, itemId]);
  }, []);

  const deselectItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
  }, []);

  const toggleItem = useCallback((itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  }, []);

  const selectAll = useCallback((itemIds: string[]) => {
    setSelectedItemIds(itemIds);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItemIds([]);
  }, []);

  const isSelected = useCallback(
    (itemId: string) => selectedItemIds.includes(itemId),
    [selectedItemIds]
  );

  return {
    selectedItemIds,
    selectItem,
    deselectItem,
    toggleItem,
    selectAll,
    clearSelection,
    isSelected,
  };
};

/**
 * Hook for policy form management
 */
export const usePolicyForm = (initialPolicy?: ClassificationPolicy) => {
  const [formData, setFormData] = useState<Partial<CreatePolicyRequest>>(
    initialPolicy || {
      name: '',
      description: '',
      status: 'draft',
      sensitivity: 'internal',
      criteria: {},
      actions: [],
    }
  );

  const updateField = useCallback((field: keyof CreatePolicyRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateCriteria = useCallback((criteria: Partial<CreatePolicyRequest['criteria']>) => {
    setFormData((prev) => ({
      ...prev,
      criteria: { ...prev.criteria, ...criteria },
    }));
  }, []);

  const addAction = useCallback((action: CreatePolicyRequest['actions'][0]) => {
    setFormData((prev) => ({
      ...prev,
      actions: [...(prev.actions || []), action],
    }));
  }, []);

  const removeAction = useCallback((index: number) => {
    setFormData((prev) => ({
      ...prev,
      actions: prev.actions?.filter((_, i) => i !== index) || [],
    }));
  }, []);

  const resetForm = useCallback(() => {
    setFormData(
      initialPolicy || {
        name: '',
        description: '',
        status: 'draft',
        sensitivity: 'internal',
        criteria: {},
        actions: [],
      }
    );
  }, [initialPolicy]);

  const isValid = useCallback(() => {
    return (
      formData.name &&
      formData.description &&
      formData.sensitivity &&
      formData.criteria &&
      formData.actions &&
      formData.actions.length > 0
    );
  }, [formData]);

  return {
    formData,
    updateField,
    updateCriteria,
    addAction,
    removeAction,
    resetForm,
    isValid,
  };
};

/**
 * Hook for review queue filters
 */
export const useReviewQueueFilters = () => {
  const [filters, setFilters] = useState<GetReviewQueueFilter>({
    limit: 50,
    offset: 0,
  });

  const updateFilter = useCallback((key: keyof GetReviewQueueFilter, value: any) => {
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
