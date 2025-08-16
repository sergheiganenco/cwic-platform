// src/utils/validator.ts
import type { RequestHandler } from 'express';
import Joi, { Schema, ValidationOptions } from 'joi';

/**
 * Common primitives
 */
const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv5'] });

const email = Joi.string()
  .email({ tlds: { allow: false } })
  .max(254);

const password = Joi.string()
  .min(8)
  // at least one lowercase, one uppercase, one digit, one special
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[ !"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]).{8,}$/)
  .messages({
    'string.pattern.base':
      'Password must include upper & lower case letters, a number, and a special character.',
  });

/**
 * E.164-ish phone: optional leading +, then 7–15 digits (first digit cannot be 0)
 * If you want strictly E.164 (1–15 digits, no leading 0), use /^\+[1-9]\d{1,14}$/
 */
const phone = Joi.string()
  .pattern(/^\+?[1-9]\d{6,14}$/)
  .messages({
    'string.pattern.base': 'Phone must be a valid international number (e.g., +15551234567).',
  });

const nonEmptyString = Joi.string().trim().min(1);

const dateISO = Joi.date().iso();

/**
 * Reusable “field” library
 */
export const Fields = {
  uuid,
  email,
  password,
  phone,
  nonEmptyString,
  dateISO,
  // add as needed:
  // intId: Joi.number().integer().positive(),
  // url: Joi.string().uri({ scheme: [/https?/] }),
};

/**
 * Example composed schemas you can import directly
 */
export const Schemas = {
  // Auth
  register: Joi.object({
    email: Fields.email.required(),
    password: Fields.password.required(),
    fullName: Fields.nonEmptyString.required(),
    phone: Fields.phone.optional(),
  }),

  login: Joi.object({
    email: Fields.email.required(),
    password: Joi.string().required(),
  }),

  // Users
  userCreate: Joi.object({
    email: Fields.email.required(),
    password: Fields.password.required(),
    firstName: Fields.nonEmptyString.required(),
    lastName: Fields.nonEmptyString.required(),
    phone: Fields.phone.optional(),
  }),

  userUpdate: Joi.object({
    email: Fields.email.optional(),
    firstName: Fields.nonEmptyString.optional(),
    lastName: Fields.nonEmptyString.optional(),
    phone: Fields.phone.optional(),
  }).min(1), // at least one field

  // Generic id param
  idParam: Joi.object({ id: Fields.uuid.required() }),

  // Pagination / filtering example
  paginationQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(200).default(25),
    search: Joi.string().trim().max(200).optional(),
    sortBy: Joi.string().trim().max(64).optional(),
    sortDir: Joi.string().valid('asc', 'desc').default('asc'),
  }),
} as const;

/**
 * Central validator helper (useful outside of Express too)
 */
export function validate<T>(
  value: unknown,
  schema: Schema,
  options: ValidationOptions = { abortEarly: false, stripUnknown: true }
): T {
  const { error, value: out } = schema.validate(value, options);
  if (error) {
    // Throw a structured error (you may map to your APIError)
    const details = error.details.map(d => d.message);
    throw new Error(`Validation failed: ${details.join('; ')}`);
  }
  return out as T;
}

/**
 * Express middlewares for validation
 */
type MiddlewareBuilder = (schema: Schema, options?: ValidationOptions) => RequestHandler;

export const validateBody: MiddlewareBuilder = (schema, options = { abortEarly: false, stripUnknown: true }) =>
  (req, _res, next) => {
    try {
      req.body = validate(req.body, schema, options);
      next();
    } catch (e) {
      next(e);
    }
  };

export const validateQuery: MiddlewareBuilder = (schema, options = { abortEarly: false, stripUnknown: true }) =>
  (req, _res, next) => {
    try {
      req.query = validate(req.query, schema, options);
      next();
    } catch (e) {
      next(e);
    }
  };

export const validateParams: MiddlewareBuilder = (schema, options = { abortEarly: false, stripUnknown: true }) =>
  (req, _res, next) => {
    try {
      req.params = validate(req.params, schema, options);
      next();
    } catch (e) {
      next(e);
    }
  };
