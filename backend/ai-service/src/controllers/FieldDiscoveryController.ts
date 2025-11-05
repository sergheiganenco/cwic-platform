import { FieldDiscoveryService } from '@services/FieldDiscoveryService';
import { APIError } from '@utils/errors';
import { logger } from '@utils/logger';
import { successResponse } from '@utils/responses';
import { NextFunction, Request, Response } from 'express';

export class FieldDiscoveryController {
  private fieldDiscoveryService: FieldDiscoveryService;

  constructor() {
    this.fieldDiscoveryService = new FieldDiscoveryService();
  }

  /**
   * POST /api/ai/field-discovery/discover
   * Trigger field discovery for a data source
   */
  public discoverFields = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dataSourceId, schemas, tables, forceRefresh } = req.body;
      const userId = (req as any).user?.id;

      if (!dataSourceId) {
        throw new APIError('Data source ID is required', 400);
      }

      logger.info('Starting field discovery', { dataSourceId, userId, schemas, tables });

      const discoveredFields = await this.fieldDiscoveryService.discoverFieldsFromSource(
        dataSourceId,
        { schemas, tables, forceRefresh }
      );

      res.status(200).json(successResponse({
        jobId: `disc-${Date.now()}`,
        status: 'completed',
        fieldsDiscovered: discoveredFields.length,
        fields: discoveredFields
      }, 'Field discovery completed'));

    } catch (error) {
      logger.error('Field discovery failed', { error });
      next(error);
    }
  };

  /**
   * GET /api/ai/field-discovery
   * Get discovered fields with filtering
   */
  public getDiscoveredFields = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        status,
        classification,
        sensitivity,
        search,
        limit = '50',
        offset = '0'
      } = req.query;

      const filter: any = {};

      if (status) filter.status = status as string;
      if (classification) filter.classification = classification as string;
      if (sensitivity) filter.sensitivity = sensitivity as string;
      if (search) filter.search = search as string;
      filter.limit = parseInt(limit as string);
      filter.offset = parseInt(offset as string);

      const result = await this.fieldDiscoveryService.getDiscoveredFields(filter);

      res.json(successResponse({
        fields: result.fields,
        total: result.total,
        limit: filter.limit,
        offset: filter.offset
      }));

    } catch (error) {
      logger.error('Failed to get discovered fields', { error });
      next(error);
    }
  };

  /**
   * GET /api/ai/field-discovery/stats
   * Get field discovery statistics
   */
  public getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await this.fieldDiscoveryService.getStats();

      res.json(successResponse(stats));

    } catch (error) {
      logger.error('Failed to get field discovery stats', { error });
      next(error);
    }
  };

  /**
   * GET /api/ai/field-discovery/drift-alerts
   * Get schema drift alerts
   */
  public getDriftAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const alerts = await this.fieldDiscoveryService.getDriftAlerts();

      res.json(successResponse({
        alerts,
        count: alerts.length
      }));

    } catch (error) {
      logger.error('Failed to get drift alerts', { error });
      next(error);
    }
  };

  /**
   * PATCH /api/ai/field-discovery/:id/status
   * Update field status (accept/reject/needs-review)
   */
  public updateFieldStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = (req as any).user?.id;

      if (!status || !['accepted', 'rejected', 'needs-review', 'pending'].includes(status)) {
        throw new APIError('Valid status is required (accepted, rejected, needs-review, pending)', 400);
      }

      // In a real implementation, this would update the database
      logger.info('Field status updated', { fieldId: id, status, userId });

      res.json(successResponse({
        id,
        status,
        updatedBy: userId,
        updatedAt: new Date()
      }, 'Field status updated'));

    } catch (error) {
      logger.error('Failed to update field status', { error });
      next(error);
    }
  };

  /**
   * POST /api/ai/field-discovery/:id/classify
   * Manually classify a field
   */
  public classifyField = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const { classification, sensitivity, tags, description } = req.body;
      const userId = (req as any).user?.id;

      if (!classification) {
        throw new APIError('Classification is required', 400);
      }

      // In a real implementation, this would update the asset in the data service
      logger.info('Field manually classified', { fieldId: id, classification, userId });

      res.json(successResponse({
        id,
        classification,
        sensitivity,
        tags,
        description,
        classifiedBy: userId,
        classifiedAt: new Date()
      }, 'Field classified successfully'));

    } catch (error) {
      logger.error('Failed to classify field', { error });
      next(error);
    }
  };

  /**
   * POST /api/ai/field-discovery/bulk-action
   * Perform bulk action on multiple fields
   */
  public bulkAction = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { fieldIds, action, value } = req.body;
      const userId = (req as any).user?.id;

      if (!fieldIds || !Array.isArray(fieldIds) || fieldIds.length === 0) {
        throw new APIError('Field IDs array is required', 400);
      }

      if (!action || !['accept', 'reject', 'classify', 'tag'].includes(action)) {
        throw new APIError('Valid action is required (accept, reject, classify, tag)', 400);
      }

      logger.info('Bulk action performed', { action, count: fieldIds.length, userId });

      res.json(successResponse({
        processed: fieldIds.length,
        action,
        value,
        performedBy: userId,
        performedAt: new Date()
      }, `Bulk ${action} completed`));

    } catch (error) {
      logger.error('Bulk action failed', { error });
      next(error);
    }
  };
}
