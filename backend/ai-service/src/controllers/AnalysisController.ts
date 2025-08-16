import { AnalysisService } from '@/services/AnalysisService';
import { APIError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { successResponse } from '@/utils/responses';
import { NextFunction, Request, Response } from 'express';

export class AnalysisController {
  private analysisService: AnalysisService;

  constructor() {
    this.analysisService = new AnalysisService();
  }

  public analyzeSchema = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { schema } = req.body;
      const userId = (req as any).user.id;

      if (!schema) {
        throw new APIError('Schema information is required', 400);
      }

      const analysis = await this.analysisService.analyzeSchema(schema, userId);

      logger.info('Schema analysis completed', { 
        userId, 
        schema: schema.name,
        tables: schema.tables?.length || 0
      });

      res.json(successResponse(analysis, 'Schema analysis completed'));

    } catch (error) {
      next(error);
    }
  };

  public analyzeDataSample = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { samples } = req.body;
      const userId = (req as any).user.id;

      if (!samples || !Array.isArray(samples)) {
        throw new APIError('Data samples are required', 400);
      }

      const analysis = await this.analysisService.analyzeDataSample(samples, userId);

      logger.info('Data sample analysis completed', { 
        userId,
        samplesAnalyzed: samples.length
      });

      res.json(successResponse(analysis, 'Data sample analysis completed'));

    } catch (error) {
      next(error);
    }
  };

  public performQualityCheck = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { dataSourceId, rules } = req.body;
      const userId = (req as any).user.id;

      if (!dataSourceId) {
        throw new APIError('Data source ID is required', 400);
      }

      const qualityReport = await this.analysisService.performQualityCheck(dataSourceId, rules, userId);

      logger.info('Quality check completed', { 
        userId,
        dataSourceId,
        rulesChecked: rules?.length || 0
      });

      res.json(successResponse(qualityReport, 'Quality check completed'));

    } catch (error) {
      next(error);
    }
  };
}