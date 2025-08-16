import { APIError } from '@/utils/errors';
import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';

const discoveryRequestSchema = Joi.object({
  dataSourceId: Joi.string().uuid().required(),
  schemas: Joi.array().items(Joi.string()).optional(),
  tables: Joi.array().items(Joi.string()).optional(),
  options: Joi.object({
    sampleSize: Joi.number().min(10).max(10000).default(100),
    includeData: Joi.boolean().default(true),
    analysisDepth: Joi.string().valid('basic', 'detailed', 'comprehensive').default('detailed')
  }).optional()
});

const nlQuerySchema = Joi.object({
  query: Joi.string().min(3).max(500).required(),
  context: Joi.object({
    schemas: Joi.array().items(Joi.string()).optional(),
    tables: Joi.array().items(Joi.string()).optional(),
    fields: Joi.array().items(Joi.string()).optional()
  }).optional()
});

const analysisRequestSchema = Joi.object({
  schema: Joi.object({
    name: Joi.string().required(),
    tables: Joi.array().items(Joi.object({
      schema: Joi.string().required(),
      name: Joi.string().required(),
      columns: Joi.array().items(Joi.object({
        name: Joi.string().required(),
        type: Joi.string().required(),
        nullable: Joi.boolean().required(),
        description: Joi.string().optional()
      })).required()
    })).required()
  }).required()
});

export const validateDiscoveryRequest = (req: Request, res: Response, next: NextFunction): void => {
  void res;
  const { error } = discoveryRequestSchema.validate(req.body);
  if (error) {
    next(new APIError(`Validation error: ${error.details[0].message}`, 400));
    return;
  }
  next();
};

export const validateNLQuery = (req: Request, res: Response, next: NextFunction): void => {
  void res;
  const { error } = nlQuerySchema.validate(req.body);
  if (error) {
    next(new APIError(`Validation error: ${error.details[0].message}`, 400));
    return;
  }
  next();
};

export const validateAnalysisRequest = (req: Request, res: Response, next: NextFunction): void => {
  void res;
  const { error } = analysisRequestSchema.validate(req.body);
  if (error) {
    next(new APIError(`Validation error: ${error.details[0].message}`, 400));
    return;
  }
  next();
};
