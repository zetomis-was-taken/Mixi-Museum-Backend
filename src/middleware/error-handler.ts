import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { HttpStatus, sendError } from '../utils/response.js';

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

/** Flattens a ZodError into client-friendly issues. */
export function toValidationDetails(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/** Replies with the standard 404 envelope for routes that do not exist. */
export const notFoundHandler: RequestHandler = (req, res) => {
  sendError(res, HttpStatus.NOT_FOUND, {
    code: 'ROUTE_NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

/**
 * Global error handler: maps thrown errors to the standard error envelope.
 * Must be registered last, after every route and the not-found handler.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    sendError(res, HttpStatus.BAD_REQUEST, {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: toValidationDetails(error),
    });
    return;
  }

  if (error instanceof AppError) {
    sendError(res, error.status, {
      code: error.code,
      message: error.message,
      details: error.details,
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    sendError(res, HttpStatus.BAD_REQUEST, {
      code: 'INVALID_JSON',
      message: 'Malformed JSON in request body',
    });
    return;
  }

  console.error('Unhandled error:', error);
  sendError(res, HttpStatus.INTERNAL_SERVER_ERROR, {
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Internal server error',
  });
};
