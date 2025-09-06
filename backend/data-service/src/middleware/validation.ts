// src/middleware/validation.ts - Data source validation rules
import { NextFunction, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';

/**
 * Validate request and return errors if any
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessage = formatValidationError(errors.array());
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: errorMessage,
      details: errors.array(),
      timestamp: new Date().toISOString(),
    });
  }
  
  next();
};

/**
 * Validation error formatter
 */
export const formatValidationError = (errors: any[]): string => {
  return errors.map(error => {
    if (error.type === 'field') {
      return `${error.path}: ${error.msg}`;
    }
    return error.msg;
  }).join(', ');
};

/**
 * Data source validation rules
 */
export const validateDataSource = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('type')
    .isIn(['postgres', 'mysql', 'sqlserver', 'mongodb', 's3', 'api', 'file'])
    .withMessage('Invalid data source type'),
  
  body('host')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Host must be between 1 and 255 characters'),
  
  body('port')
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage('Port must be between 1 and 65535'),
  
  body('database')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Database name must be between 1 and 100 characters'),
  
  body('username')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Username must be between 1 and 100 characters'),
  
  body('password')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Password must be between 1 and 255 characters'),
  
  body('ssl')
    .optional()
    .isBoolean()
    .withMessage('SSL must be a boolean value'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('tags.*')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),

  validateRequest
];

/**
 * Data source update validation rules
 */
export const validateDataSourceUpdate = [
  param('id')
    .isUUID()
    .withMessage('Invalid data source ID'),
  
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('host')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Host must be between 1 and 255 characters'),
  
  body('port')
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage('Port must be between 1 and 65535'),
  
  body('database')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Database name must be between 1 and 100 characters'),
  
  body('username')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Username must be between 1 and 100 characters'),
  
  body('password')
    .optional()
    .isLength({ min: 1, max: 255 })
    .withMessage('Password must be between 1 and 255 characters'),
  
  body('ssl')
    .optional()
    .isBoolean()
    .withMessage('SSL must be a boolean value'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),

  validateRequest
];

/**
 * Asset validation rules
 */
export const validateAsset = [
  body('name')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name must be between 1 and 100 characters'),
  
  body('type')
    .isIn(['table', 'view', 'procedure', 'function', 'schema'])
    .withMessage('Invalid asset type'),
  
  body('dataSourceId')
    .isUUID()
    .withMessage('Invalid data source ID'),
  
  body('schemaName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Schema name must be between 1 and 100 characters'),
  
  body('tableName')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Table name must be between 1 and 100 characters'),
  
  body('description')
    .optional()
    .isLength({ max: 500 })
    .withMessage('Description must be less than 500 characters'),
  
  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
  
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'deprecated'])
    .withMessage('Invalid status'),

  validateRequest
];

/**
 * ID parameter validation
 */
export const validateId = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format'),
  
  validateRequest
];

/**
 * Pagination validation
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters'),

  validateRequest
];

/**
 * Connection test validation
 */
export const validateConnectionTest = [
  body('type')
    .isIn(['postgres', 'mysql', 'sqlserver', 'mongodb', 's3', 'api'])
    .withMessage('Invalid connection type'),
  
  body('host')
    .isLength({ min: 1, max: 255 })
    .withMessage('Host is required and must be less than 255 characters'),
  
  body('port')
    .isInt({ min: 1, max: 65535 })
    .withMessage('Port must be between 1 and 65535'),
  
  body('database')
    .optional()
    .isLength({ min: 1, max: 100 })
    .withMessage('Database name must be between 1 and 100 characters'),
  
  body('username')
    .isLength({ min: 1, max: 100 })
    .withMessage('Username is required and must be less than 100 characters'),
  
  body('password')
    .isLength({ min: 1, max: 255 })
    .withMessage('Password is required and must be less than 255 characters'),

  validateRequest
];

/**
 * Tags validation
 */
export const validateTags = [
  body('tags')
    .isArray({ min: 1 })
    .withMessage('Tags must be a non-empty array'),
  
  body('tags.*')
    .isString()
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Each tag must be between 1 and 50 characters'),

  validateRequest
];