import type { Response } from 'express';

/** HTTP status codes used by the API, grouped by intent. */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

const STATUS_MESSAGES: Record<number, string> = {
  [HttpStatus.OK]: 'OK',
  [HttpStatus.CREATED]: 'Created',
  [HttpStatus.ACCEPTED]: 'Accepted',
  [HttpStatus.NO_CONTENT]: 'No Content',
  [HttpStatus.BAD_REQUEST]: 'Bad request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
  [HttpStatus.TOO_MANY_REQUESTS]: 'Too many requests',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal server error',
};

/** Standard message for an HTTP status, used when a response does not provide one. */
export function statusMessage(status: number): string {
  return STATUS_MESSAGES[status] ?? 'Unknown';
}

export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ErrorBody {
  success: false;
  message: string;
  error: {
    code: string;
    details?: unknown;
  };
}

/**
 * Sends a successful response in the standard envelope:
 * `{ success: true, message, data }`.
 *
 * `message` defaults to the standard text for the status (e.g. `OK`, `Created`).
 * `204 No Content` is sent without a body.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  status: HttpStatusCode = HttpStatus.OK,
  message?: string,
): Response {
  if (status === HttpStatus.NO_CONTENT) {
    return res.status(status).end();
  }

  const body: SuccessBody<T> = {
    success: true,
    message: message ?? statusMessage(status),
    data,
  };

  return res.status(status).json(body);
}

export interface SendErrorOptions {
  /** Stable machine-readable code, defaults to `ERROR`. */
  code?: string;
  /** Defaults to the standard message for the status. */
  message?: string;
  /** Extra context for the client; omit for anything sensitive. */
  details?: unknown;
}

/**
 * Sends an error response in the standard envelope:
 * `{ success: false, message, error: { code, details } }`.
 *
 * Prefer throwing an `AppError` in controllers and letting `errorHandler` reply.
 */
export function sendError(
  res: Response,
  status: HttpStatusCode,
  options: SendErrorOptions = {},
): Response {
  const body: ErrorBody = {
    success: false,
    message: options.message ?? statusMessage(status),
    error: {
      code: options.code ?? 'ERROR',
      details: options.details,
    },
  };

  return res.status(status).json(body);
}
