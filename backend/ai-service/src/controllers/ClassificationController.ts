import { ClassificationService } from '@services/ClassificationService';
import { APIError } from '@utils/errors';
import { logger } from '@utils/logger';
import { successResponse } from '@utils/responses';
import { NextFunction, Request, Response } from 'express';

export class ClassificationController {
  private classificationService: ClassificationService;

  constructor() {
    this.classificationService = new ClassificationService();
  }

  /**
   * GET /api/ai/classification/policies
   * Get all classification policies
   */
  public getPolicies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { status, sensitivity, search } = req.query;

      const filter: any = {};
      if (status) filter.status = status as string;
      if (sensitivity) filter.sensitivity = sensitivity as string;
      if (search) filter.search = search as string;

      const policies = await this.classificationService.getPolicies(filter);

      res.json(successResponse({
        policies,
        count: policies.length
      }));

    } catch (error) {
      logger.error('Failed to get policies', { error });
      next(error);
    }
  };

  /**
   * GET /api/ai/classification/policies/:id
   * Get a single policy
   */
  public getPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const policy = await this.classificationService.getPolicy(id);

      if (!policy) {
        throw new APIError('Policy not found', 404);
      }

      res.json(successResponse(policy));

    } catch (error) {
      logger.error('Failed to get policy', { error });
      next(error);
    }
  };

  /**
   * POST /api/ai/classification/policies
   * Create a new classification policy
   */
  public createPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const policyData = req.body;
      const userId = (req as any).user?.id;

      // Validate required fields
      if (!policyData.name) {
        throw new APIError('Policy name is required', 400);
      }

      if (!policyData.owner) {
        policyData.owner = userId || 'System';
      }

      const policy = await this.classificationService.createPolicy(policyData);

      logger.info('Policy created', { policyId: policy.id, userId });

      res.status(201).json(successResponse(policy, 'Policy created successfully'));

    } catch (error) {
      logger.error('Failed to create policy', { error });
      next(error);
    }
  };

  /**
   * PATCH /api/ai/classification/policies/:id
   * Update an existing policy
   */
  public updatePolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const userId = (req as any).user?.id;

      const policy = await this.classificationService.updatePolicy(id, updates);

      logger.info('Policy updated', { policyId: id, userId });

      res.json(successResponse(policy, 'Policy updated successfully'));

    } catch (error) {
      logger.error('Failed to update policy', { error });
      next(error);
    }
  };

  /**
   * DELETE /api/ai/classification/policies/:id
   * Delete a policy
   */
  public deletePolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      await this.classificationService.deletePolicy(id);

      logger.info('Policy deleted', { policyId: id, userId });

      res.json(successResponse(null, 'Policy deleted successfully'));

    } catch (error) {
      logger.error('Failed to delete policy', { error });
      next(error);
    }
  };

  /**
   * POST /api/ai/classification/policies/:id/run
   * Execute a classification policy
   */
  public runPolicy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const userId = (req as any).user?.id;

      logger.info('Running classification policy', { policyId: id, userId });

      const result = await this.classificationService.runPolicy(id);

      res.json(successResponse(result, 'Policy executed successfully'));

    } catch (error) {
      logger.error('Policy execution failed', { error });
      next(error);
    }
  };

  /**
   * GET /api/ai/classification/review-queue
   * Get review queue items
   */
  public getReviewQueue = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        policyId,
        status,
        minConfidence,
        maxConfidence,
        limit = '50',
        offset = '0'
      } = req.query;

      const filter: any = {};
      if (policyId) filter.policyId = policyId as string;
      if (status) filter.status = status as string;
      if (minConfidence) filter.minConfidence = parseFloat(minConfidence as string);
      if (maxConfidence) filter.maxConfidence = parseFloat(maxConfidence as string);
      filter.limit = parseInt(limit as string);
      filter.offset = parseInt(offset as string);

      const result = await this.classificationService.getReviewQueue(filter);

      res.json(successResponse({
        items: result.items,
        total: result.total,
        limit: filter.limit,
        offset: filter.offset
      }));

    } catch (error) {
      logger.error('Failed to get review queue', { error });
      next(error);
    }
  };

  /**
   * POST /api/ai/classification/review/:id
   * Review a classification (approve/reject)
   */
  public reviewItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { decision, comments } = req.body;
      const userId = (req as any).user?.id || 'system';

      if (!decision || !['approved', 'rejected'].includes(decision)) {
        throw new APIError('Valid decision is required (approved or rejected)', 400);
      }

      const reviewedItem = await this.classificationService.reviewClassification(
        id,
        decision,
        userId,
        comments
      );

      logger.info('Classification reviewed', { itemId: id, decision, userId });

      res.json(successResponse(reviewedItem, `Classification ${decision}`));

    } catch (error) {
      logger.error('Review failed', { error });
      next(error);
    }
  };

  /**
   * POST /api/ai/classification/review/bulk-approve
   * Bulk approve classifications
   */
  public bulkApprove = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { itemIds } = req.body;
      const userId = (req as any).user?.id || 'system';

      if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
        throw new APIError('Item IDs array is required', 400);
      }

      const approvedCount = await this.classificationService.bulkApprove(itemIds, userId);

      logger.info('Bulk approval completed', { total: itemIds.length, approved: approvedCount, userId });

      res.json(successResponse({
        total: itemIds.length,
        approved: approvedCount,
        failed: itemIds.length - approvedCount
      }, 'Bulk approval completed'));

    } catch (error) {
      logger.error('Bulk approval failed', { error });
      next(error);
    }
  };

  /**
   * GET /api/ai/classification/stats
   * Get classification statistics
   */
  public getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.classificationService.getStats();

      res.json(successResponse(stats));

    } catch (error) {
      logger.error('Failed to get classification stats', { error });
      next(error);
    }
  };
}
