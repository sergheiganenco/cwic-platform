import axios, { AxiosInstance } from 'axios';

// Types
export interface ClassificationPolicy {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'draft';
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  owner: string;
  criteria: PolicyCriteria;
  actions: PolicyAction[];
  schedule?: PolicySchedule;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string;
  metadata?: Record<string, any>;
}

export interface PolicyCriteria {
  patterns?: string[];
  keywords?: string[];
  dataTypes?: string[];
  schemas?: string[];
  tables?: string[];
  minConfidence?: number;
  customRules?: string;
}

export interface PolicyAction {
  type: 'classify' | 'tag' | 'alert' | 'workflow';
  parameters: Record<string, any>;
}

export interface PolicySchedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  time?: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

export interface CreatePolicyRequest {
  name: string;
  description: string;
  status?: 'active' | 'inactive' | 'draft';
  sensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  owner?: string;
  criteria: PolicyCriteria;
  actions: PolicyAction[];
  schedule?: PolicySchedule;
}

export interface UpdatePolicyRequest {
  name?: string;
  description?: string;
  status?: 'active' | 'inactive' | 'draft';
  sensitivity?: 'public' | 'internal' | 'confidential' | 'restricted';
  criteria?: PolicyCriteria;
  actions?: PolicyAction[];
  schedule?: PolicySchedule;
}

export interface PolicyRunResult {
  policyId: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'partial' | 'failed';
  assetsProcessed: number;
  classificationsCreated: number;
  reviewItemsCreated: number;
  errors?: string[];
}

export interface ReviewItem {
  id: string;
  policyId: string;
  assetId: number;
  assetName: string;
  currentClassification?: string;
  proposedClassification: string;
  proposedSensitivity: 'public' | 'internal' | 'confidential' | 'restricted';
  confidence: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  comments?: string;
}

export interface GetPoliciesFilter {
  status?: string;
  sensitivity?: string;
  search?: string;
}

export interface GetReviewQueueFilter {
  policyId?: string;
  status?: string;
  minConfidence?: number;
  maxConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface GetReviewQueueResponse {
  items: ReviewItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ReviewDecisionRequest {
  decision: 'approved' | 'rejected';
  comments?: string;
}

export interface BulkApproveRequest {
  itemIds: string[];
}

export interface BulkApproveResponse {
  total: number;
  approved: number;
  failed: number;
}

export interface ClassificationStats {
  totalPolicies: number;
  activePolicies: number;
  totalClassifications: number;
  pendingReviews: number;
  byStatus: Record<string, number>;
  bySensitivity: Record<string, number>;
  recentActivity: {
    policiesRun: number;
    classificationsCreated: number;
    reviewsCompleted: number;
  };
}

/**
 * Classification API Client
 * Handles all API calls related to classification functionality
 */
export class ClassificationAPI {
  private readonly api: AxiosInstance;
  private readonly basePath = '/classification';

  constructor() {
    this.api = axios.create({
      baseURL: '/api/ai',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token interceptor
    this.api.interceptors.request.use((config) => {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  /**
   * Get all classification policies
   * GET /api/ai/classification/policies
   */
  async getPolicies(filter?: GetPoliciesFilter): Promise<ClassificationPolicy[]> {
    const params = new URLSearchParams();

    if (filter?.status) params.append('status', filter.status);
    if (filter?.sensitivity) params.append('sensitivity', filter.sensitivity);
    if (filter?.search) params.append('search', filter.search);

    const response = await this.api.get(`${this.basePath}/policies?${params.toString()}`);
    return response.data.data.policies;
  }

  /**
   * Get a single policy
   * GET /api/ai/classification/policies/:id
   */
  async getPolicy(policyId: string): Promise<ClassificationPolicy> {
    const response = await this.api.get(`${this.basePath}/policies/${policyId}`);
    return response.data.data;
  }

  /**
   * Create a new classification policy
   * POST /api/ai/classification/policies
   */
  async createPolicy(request: CreatePolicyRequest): Promise<ClassificationPolicy> {
    const response = await this.api.post(`${this.basePath}/policies`, request);
    return response.data.data;
  }

  /**
   * Update an existing policy
   * PATCH /api/ai/classification/policies/:id
   */
  async updatePolicy(policyId: string, request: UpdatePolicyRequest): Promise<ClassificationPolicy> {
    const response = await this.api.patch(`${this.basePath}/policies/${policyId}`, request);
    return response.data.data;
  }

  /**
   * Delete a policy
   * DELETE /api/ai/classification/policies/:id
   */
  async deletePolicy(policyId: string): Promise<void> {
    await this.api.delete(`${this.basePath}/policies/${policyId}`);
  }

  /**
   * Execute a classification policy
   * POST /api/ai/classification/policies/:id/run
   */
  async runPolicy(policyId: string): Promise<PolicyRunResult> {
    const response = await this.api.post(`${this.basePath}/policies/${policyId}/run`);
    return response.data.data;
  }

  /**
   * Get review queue items
   * GET /api/ai/classification/review-queue
   */
  async getReviewQueue(filter?: GetReviewQueueFilter): Promise<GetReviewQueueResponse> {
    const params = new URLSearchParams();

    if (filter?.policyId) params.append('policyId', filter.policyId);
    if (filter?.status) params.append('status', filter.status);
    if (filter?.minConfidence !== undefined) params.append('minConfidence', filter.minConfidence.toString());
    if (filter?.maxConfidence !== undefined) params.append('maxConfidence', filter.maxConfidence.toString());
    if (filter?.limit) params.append('limit', filter.limit.toString());
    if (filter?.offset) params.append('offset', filter.offset.toString());

    const response = await this.api.get(`${this.basePath}/review-queue?${params.toString()}`);
    return response.data.data;
  }

  /**
   * Review a classification (approve/reject)
   * POST /api/ai/classification/review/:id
   */
  async reviewItem(itemId: string, request: ReviewDecisionRequest): Promise<ReviewItem> {
    const response = await this.api.post(`${this.basePath}/review/${itemId}`, request);
    return response.data.data;
  }

  /**
   * Bulk approve classifications
   * POST /api/ai/classification/review/bulk-approve
   */
  async bulkApprove(request: BulkApproveRequest): Promise<BulkApproveResponse> {
    const response = await this.api.post(`${this.basePath}/review/bulk-approve`, request);
    return response.data.data;
  }

  /**
   * Get classification statistics
   * GET /api/ai/classification/stats
   */
  async getStats(): Promise<ClassificationStats> {
    const response = await this.api.get(`${this.basePath}/stats`);
    return response.data.data;
  }
}

// Export singleton instance
export const classificationAPI = new ClassificationAPI();
