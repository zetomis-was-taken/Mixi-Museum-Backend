import type { RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

export const VALIDATION_SOURCES = ['body', 'query', 'params'] as const;

export type ValidationSource = (typeof VALIDATION_SOURCES)[number];

export type ValidationSchemas = Partial<Record<ValidationSource, ZodType>>;

export type ValidatedValues = Partial<Record<ValidationSource, unknown>>;

/**
 * Validates the selected request parts with Zod before the route handler runs.
 * The parsed values are stored on `res.locals.validated` and can be read with
 * `getValidated`. Invalid input throws a `ZodError`, which `errorHandler` maps to
 * a `400 VALIDATION_ERROR` response.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, res, next) => {
    try {
      const validated: ValidatedValues = {};

      for (const source of VALIDATION_SOURCES) {
        const schema = schemas[source];

        if (schema) {
          validated[source] = schema.parse(req[source]);
        }
      }

      res.locals.validated = validated;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Reads a value parsed by `validate` from `res.locals`. */
export function getValidated<T>(res: Response, source: ValidationSource = 'body'): T | undefined {
  const validated = res.locals.validated as ValidatedValues | undefined;

  return validated?.[source] as T | undefined;
}
