import { openai } from '@config/openai';
import { logger } from '@utils/logger';
import axios from 'axios';
import { CacheService } from './CacheService';

export interface ClassificationPolicy {
  id: string;
  name: string;
  description: string;
  sensitivity: 'Public' | 'Internal' | 'Restricted' | 'Highly Confidential';
  owner: string;
  criteria: {
    schemas?: string[];
    tables?: string[];
    fieldPatterns?: string[];
    dataTypes?: string[];
    classifications?: string[];
  };
  actions: {
    applyClassification?: string;
    applySensitivity?: string;
    applyTags?: string[];
    requireReview?: boolean;
  };
  coverage: number;
  lastRun?: Date;
  nextRun?: Date;
  status: 'active' | 'paused' | 'draft';
  outstandingReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReviewItem {
  id: string;
  policyId: string;
  assetId: number;
  assetName: string;
  fieldName: string;
  currentClassification?: string;
  suggestedClassification: string;
  suggestedSensitivity: string;
  suggestedLabel: string;
  confidence: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: Date;
  comments?: string;
  createdAt: Date;
}

export interface ClassificationStats {
  labeledDatasets: number;
  autoApprovalsLast7Days: number;
  pendingReviews: number;
  policiesWithGaps: number;
  totalPolicies: number;
  coveragePercentage: number;
  classificationsThisWeek: number;
}

export interface PolicyRunResult {
  jobId: string;
  assetsProcessed: number;
  classificationsApplied: number;
  reviewQueueItems: number;
  errors: number;
  duration: number;
}

export class ClassificationService {
  private cacheService: CacheService;
  private dataServiceUrl: string;
  private policies: Map<string, ClassificationPolicy> = new Map();
  private reviewQueue: Map<string, ReviewItem> = new Map();

  constructor() {
    this.cacheService = new CacheService();
    this.dataServiceUrl = process.env.DATA_SERVICE_URL || 'http://localhost:3002';
    this.initializeDefaultPolicies();
  }

  /**
   * Initialize with some default policies
   */
  private initializeDefaultPolicies(): void {
    const defaultPolicies: ClassificationPolicy[] = [
      {
        id: 'pol-pii-detection',
        name: 'Customer PII Classification',
        description: 'Automatically detect and classify personally identifiable information',
        sensitivity: 'Restricted',
        owner: 'Data Governance',
        criteria: {
          fieldPatterns: ['email', 'phone', 'ssn', 'name', 'address'],
          classifications: ['PII']
        },
        actions: {
          applyClassification: 'PII',
          applySensitivity: 'High',
          applyTags: ['pii', 'gdpr', 'sensitive'],
          requireReview: true
        },
        coverage: 0,
        status: 'active',
        outstandingReviews: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'pol-financial-data',
        name: 'Revenue Metrics',
        description: 'Classify financial and revenue-related data',
        sensitivity: 'Internal',
        owner: 'Finance Analytics',
        criteria: {
          fieldPatterns: ['amount', 'price', 'revenue', 'payment', 'salary'],
          classifications: ['Financial']
        },
        actions: {
          applyClassification: 'Financial',
          applySensitivity: 'Medium',
          applyTags: ['financial', 'confidential'],
          requireReview: false
        },
        coverage: 0,
        status: 'active',
        outstandingReviews: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    defaultPolicies.forEach(policy => {
      this.policies.set(policy.id, policy);
    });
  }

  /**
   * Get all classification policies
   */
  public async getPolicies(filter?: {
    status?: 'active' | 'paused' | 'draft';
    sensitivity?: string;
    search?: string;
  }): Promise<ClassificationPolicy[]> {
    try {
      let policies = Array.from(this.policies.values());

      // Update coverage for each policy
      for (const policy of policies) {
        policy.coverage = await this.calculatePolicyCoverage(policy);
        policy.outstandingReviews = await this.countOutstandingReviews(policy.id);
      }

      // Apply filters
      if (filter?.status) {
        policies = policies.filter(p => p.status === filter.status);
      }

      if (filter?.sensitivity) {
        policies = policies.filter(p => p.sensitivity === filter.sensitivity);
      }

      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        policies = policies.filter(p =>
          p.name.toLowerCase().includes(searchLower) ||
          p.description.toLowerCase().includes(searchLower)
        );
      }

      return policies;

    } catch (error) {
      logger.error('Failed to get policies', { error });
      throw error;
    }
  }

  /**
   * Get a single policy by ID
   */
  public async getPolicy(policyId: string): Promise<ClassificationPolicy | null> {
    const policy = this.policies.get(policyId);
    if (!policy) return null;

    // Update coverage
    policy.coverage = await this.calculatePolicyCoverage(policy);
    policy.outstandingReviews = await this.countOutstandingReviews(policyId);

    return policy;
  }

  /**
   * Create a new classification policy
   */
  public async createPolicy(policyData: Omit<ClassificationPolicy, 'id' | 'coverage' | 'outstandingReviews' | 'createdAt' | 'updatedAt'>): Promise<ClassificationPolicy> {
    try {
      const policy: ClassificationPolicy = {
        ...policyData,
        id: `pol-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        coverage: 0,
        outstandingReviews: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.policies.set(policy.id, policy);

      logger.info('Policy created', { policyId: policy.id, name: policy.name });

      return policy;

    } catch (error) {
      logger.error('Failed to create policy', { error });
      throw error;
    }
  }

  /**
   * Update an existing policy
   */
  public async updatePolicy(policyId: string, updates: Partial<ClassificationPolicy>): Promise<ClassificationPolicy> {
    const policy = this.policies.get(policyId);

    if (!policy) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    const updated = {
      ...policy,
      ...updates,
      id: policy.id, // Prevent ID change
      updatedAt: new Date()
    };

    this.policies.set(policyId, updated);

    logger.info('Policy updated', { policyId });

    return updated;
  }

  /**
   * Delete a policy
   */
  public async deletePolicy(policyId: string): Promise<void> {
    if (!this.policies.has(policyId)) {
      throw new Error(`Policy not found: ${policyId}`);
    }

    this.policies.delete(policyId);

    // Also delete associated review items
    for (const [itemId, item] of this.reviewQueue.entries()) {
      if (item.policyId === policyId) {
        this.reviewQueue.delete(itemId);
      }
    }

    logger.info('Policy deleted', { policyId });
  }

  /**
   * Run a classification policy
   */
  public async runPolicy(policyId: string): Promise<PolicyRunResult> {
    try {
      const startTime = Date.now();
      const policy = this.policies.get(policyId);

      if (!policy) {
        throw new Error(`Policy not found: ${policyId}`);
      }

      logger.info('Running classification policy', { policyId, name: policy.name });

      // Fetch assets that match policy criteria
      const matchingAssets = await this.findMatchingAssets(policy);

      let classificationsApplied = 0;
      let reviewQueueItems = 0;
      let errors = 0;

      // Process each matching asset
      for (const asset of matchingAssets) {
        try {
          const result = await this.classifyAsset(asset, policy);

          if (result.requiresReview) {
            // Add to review queue
            const reviewItem = this.createReviewItem(asset, policy, result);
            this.reviewQueue.set(reviewItem.id, reviewItem);
            reviewQueueItems++;
          } else {
            // Auto-apply classification
            await this.applyClassification(asset, policy, result);
            classificationsApplied++;
          }
        } catch (error) {
          logger.error('Failed to classify asset', { assetId: asset.id, error });
          errors++;
        }
      }

      // Update policy
      policy.lastRun = new Date();
      policy.coverage = await this.calculatePolicyCoverage(policy);
      policy.outstandingReviews = await this.countOutstandingReviews(policyId);
      this.policies.set(policyId, policy);

      const duration = Date.now() - startTime;

      const result: PolicyRunResult = {
        jobId: `job-${Date.now()}`,
        assetsProcessed: matchingAssets.length,
        classificationsApplied,
        reviewQueueItems,
        errors,
        duration
      };

      logger.info('Policy run completed', { policyId, result });

      return result;

    } catch (error) {
      logger.error('Policy run failed', { policyId, error });
      throw error;
    }
  }

  /**
   * Get review queue items
   */
  public async getReviewQueue(filter?: {
    policyId?: string;
    status?: 'pending' | 'approved' | 'rejected';
    minConfidence?: number;
    maxConfidence?: number;
    limit?: number;
    offset?: number;
  }): Promise<{ items: ReviewItem[]; total: number }> {
    try {
      let items = Array.from(this.reviewQueue.values());

      // Apply filters
      if (filter?.policyId) {
        items = items.filter(i => i.policyId === filter.policyId);
      }

      if (filter?.status) {
        items = items.filter(i => i.status === filter.status);
      }

      if (filter?.minConfidence !== undefined) {
        items = items.filter(i => i.confidence >= filter.minConfidence!);
      }

      if (filter?.maxConfidence !== undefined) {
        items = items.filter(i => i.confidence <= filter.maxConfidence!);
      }

      // Sort by confidence descending
      items.sort((a, b) => b.confidence - a.confidence);

      const total = items.length;
      const offset = filter?.offset || 0;
      const limit = filter?.limit || 50;
      const paginated = items.slice(offset, offset + limit);

      return { items: paginated, total };

    } catch (error) {
      logger.error('Failed to get review queue', { error });
      throw error;
    }
  }

  /**
   * Review a classification (approve/reject)
   */
  public async reviewClassification(
    itemId: string,
    decision: 'approved' | 'rejected',
    reviewedBy: string,
    comments?: string
  ): Promise<ReviewItem> {
    try {
      const item = this.reviewQueue.get(itemId);

      if (!item) {
        throw new Error(`Review item not found: ${itemId}`);
      }

      item.status = decision;
      item.reviewedBy = reviewedBy;
      item.reviewedAt = new Date();
      item.comments = comments;

      this.reviewQueue.set(itemId, item);

      // If approved, apply the classification
      if (decision === 'approved') {
        const policy = this.policies.get(item.policyId);
        if (policy) {
          await this.applyClassificationToAsset(item.assetId, {
            classification: item.suggestedClassification,
            sensitivity: item.suggestedSensitivity,
            tags: policy.actions.applyTags
          });
        }
      }

      // Update policy's outstanding reviews count
      const policy = this.policies.get(item.policyId);
      if (policy) {
        policy.outstandingReviews = await this.countOutstandingReviews(item.policyId);
        this.policies.set(item.policyId, policy);
      }

      logger.info('Classification reviewed', { itemId, decision, reviewedBy });

      return item;

    } catch (error) {
      logger.error('Failed to review classification', { itemId, error });
      throw error;
    }
  }

  /**
   * Bulk approve classifications
   */
  public async bulkApprove(itemIds: string[], reviewedBy: string): Promise<number> {
    let approved = 0;

    for (const itemId of itemIds) {
      try {
        await this.reviewClassification(itemId, 'approved', reviewedBy);
        approved++;
      } catch (error) {
        logger.error('Failed to approve item in bulk', { itemId, error });
      }
    }

    logger.info('Bulk approval completed', { total: itemIds.length, approved });

    return approved;
  }

  /**
   * Get classification statistics
   */
  public async getStats(): Promise<ClassificationStats> {
    try {
      // Fetch assets from data service
      const assets = await this.fetchAssets();
      const columns = assets.filter(a => a.type === 'column');

      // Calculate statistics
      const labeledDatasets = columns.filter(c => c.classification && c.classification !== 'General').length;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const recentReviews = Array.from(this.reviewQueue.values()).filter(r =>
        r.status === 'approved' &&
        r.reviewedAt &&
        new Date(r.reviewedAt) > sevenDaysAgo
      );

      const autoApprovals = recentReviews.filter(r => r.confidence >= 0.85);
      const autoApprovalsLast7Days = recentReviews.length > 0
        ? Math.round((autoApprovals.length / recentReviews.length) * 100)
        : 0;

      const pendingReviews = Array.from(this.reviewQueue.values()).filter(r => r.status === 'pending').length;

      const policies = Array.from(this.policies.values());
      const policiesWithGaps = policies.filter(p => p.coverage < 80).length;

      const coveragePercentage = columns.length > 0
        ? Math.round((labeledDatasets / columns.length) * 100)
        : 0;

      const classificationsThisWeek = recentReviews.length;

      return {
        labeledDatasets,
        autoApprovalsLast7Days,
        pendingReviews,
        policiesWithGaps,
        totalPolicies: policies.length,
        coveragePercentage,
        classificationsThisWeek
      };

    } catch (error) {
      logger.error('Failed to get classification stats', { error });
      return {
        labeledDatasets: 0,
        autoApprovalsLast7Days: 0,
        pendingReviews: 0,
        policiesWithGaps: 0,
        totalPolicies: 0,
        coveragePercentage: 0,
        classificationsThisWeek: 0
      };
    }
  }

  // Private helper methods

  private async calculatePolicyCoverage(policy: ClassificationPolicy): Promise<number> {
    try {
      const assets = await this.fetchAssets();
      const matchingAssets = await this.findMatchingAssets(policy);
      const classifiedAssets = matchingAssets.filter(a => a.classification);

      if (matchingAssets.length === 0) return 0;

      return Math.round((classifiedAssets.length / matchingAssets.length) * 100);

    } catch (error) {
      logger.error('Failed to calculate policy coverage', { policyId: policy.id, error });
      return 0;
    }
  }

  private async countOutstandingReviews(policyId: string): Promise<number> {
    return Array.from(this.reviewQueue.values()).filter(r =>
      r.policyId === policyId && r.status === 'pending'
    ).length;
  }

  private async findMatchingAssets(policy: ClassificationPolicy): Promise<any[]> {
    try {
      const assets = await this.fetchAssets();
      let matching = assets.filter(a => a.type === 'column');

      const criteria = policy.criteria;

      if (criteria.schemas && criteria.schemas.length > 0) {
        matching = matching.filter(a => criteria.schemas!.includes(a.schema));
      }

      if (criteria.tables && criteria.tables.length > 0) {
        matching = matching.filter(a => criteria.tables!.includes(a.tableName));
      }

      if (criteria.fieldPatterns && criteria.fieldPatterns.length > 0) {
        matching = matching.filter(a => {
          const name = a.name.toLowerCase();
          return criteria.fieldPatterns!.some(pattern =>
            name.includes(pattern.toLowerCase())
          );
        });
      }

      if (criteria.dataTypes && criteria.dataTypes.length > 0) {
        matching = matching.filter(a => {
          const type = (a.dataType || a.type || '').toLowerCase();
          return criteria.dataTypes!.some(dt => type.includes(dt.toLowerCase()));
        });
      }

      if (criteria.classifications && criteria.classifications.length > 0) {
        matching = matching.filter(a =>
          criteria.classifications!.includes(a.classification)
        );
      }

      return matching;

    } catch (error) {
      logger.error('Failed to find matching assets', { policyId: policy.id, error });
      return [];
    }
  }

  private async classifyAsset(asset: any, policy: ClassificationPolicy): Promise<{
    classification: string;
    sensitivity: string;
    confidence: number;
    reason: string;
    requiresReview: boolean;
  }> {
    // Use AI if available for high confidence classification
    if (openai.isAvailable() && policy.actions.requireReview) {
      try {
        const aiResult = await this.classifyWithAI(asset);
        return {
          ...aiResult,
          requiresReview: policy.actions.requireReview || aiResult.confidence < 0.85
        };
      } catch (error) {
        logger.error('AI classification failed, using policy rules', { error });
      }
    }

    // Use policy-based classification
    return {
      classification: policy.actions.applyClassification || 'General',
      sensitivity: policy.actions.applySensitivity || 'Low',
      confidence: 0.75,
      reason: `Matched policy criteria: ${policy.name}`,
      requiresReview: policy.actions.requireReview || false
    };
  }

  private async classifyWithAI(asset: any): Promise<{
    classification: string;
    sensitivity: string;
    confidence: number;
    reason: string;
  }> {
    try {
      const prompt = `Classify this database field:
Name: ${asset.name}
Type: ${asset.dataType || asset.type}
Table: ${asset.tableName}
Schema: ${asset.schema}

Classify as: General, PII, PHI, or Financial
Determine sensitivity: Low, Medium, High, or Critical
Provide reasoning.

Respond in JSON format:
{
  "classification": "...",
  "sensitivity": "...",
  "reason": "...",
  "confidence": 0.0-1.0
}`;

      const response = await openai.createChatCompletion({
        model: process.env.OPENAI_MODEL || 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a data classification expert.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || '{}');

      return {
        classification: result.classification || 'General',
        sensitivity: result.sensitivity || 'Low',
        confidence: result.confidence || 0.7,
        reason: result.reason || 'AI classification'
      };

    } catch (error) {
      logger.error('AI classification failed', { error });
      throw error;
    }
  }

  private createReviewItem(asset: any, policy: ClassificationPolicy, result: any): ReviewItem {
    return {
      id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      policyId: policy.id,
      assetId: asset.id,
      assetName: `${asset.schema}.${asset.tableName}.${asset.name}`,
      fieldName: asset.name,
      currentClassification: asset.classification,
      suggestedClassification: result.classification,
      suggestedSensitivity: result.sensitivity,
      suggestedLabel: `${result.classification} - ${result.sensitivity}`,
      confidence: result.confidence,
      reason: result.reason,
      status: 'pending',
      createdAt: new Date()
    };
  }

  private async applyClassification(asset: any, policy: ClassificationPolicy, result: any): Promise<void> {
    await this.applyClassificationToAsset(asset.id, {
      classification: result.classification,
      sensitivity: result.sensitivity,
      tags: policy.actions.applyTags
    });
  }

  private async applyClassificationToAsset(assetId: number, classification: {
    classification: string;
    sensitivity: string;
    tags?: string[];
  }): Promise<void> {
    try {
      // In a real implementation, this would update the asset in the data service
      await axios.patch(`${this.dataServiceUrl}/api/assets/${assetId}`, classification, {
        timeout: 5000
      });

      logger.info('Classification applied to asset', { assetId, classification });

    } catch (error) {
      logger.error('Failed to apply classification', { assetId, error });
      // Don't throw - this is a best-effort operation
    }
  }

  private async fetchAssets(): Promise<any[]> {
    try {
      const response = await axios.get(`${this.dataServiceUrl}/api/assets`, {
        params: { limit: 1000 },
        timeout: 10000
      });

      return response.data?.data || response.data || [];

    } catch (error) {
      logger.error('Failed to fetch assets', { error });
      return [];
    }
  }
}
