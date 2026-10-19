import { HttpStatus, type HttpStatusCode } from './response.js';

const ERROR_CODES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'UNPROCESSABLE_ENTITY',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_SERVER_ERROR',
};

/** Default machine-readable code for an HTTP status. */
export function errorCodeForStatus(status: number): string {
  return ERROR_CODES[status] ?? 'ERROR';
}

export interface AppErrorOptions {
  status?: HttpStatusCode;
  code?: string;
  details?: unknown;
  cause?: unknown;
}

/**
 * Expected error with an HTTP status. Throw it from controllers/services and let
 * the global `errorHandler` turn it into the standard error envelope.
 */
export class AppError extends Error {
  readonly status: HttpStatusCode;
  readonly code: string;
  readonly details: unknown;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });

    this.name = 'AppError';
    this.status = options.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    this.code = options.code ?? errorCodeForStatus(this.status);
    this.details = options.details;
  }

  static badRequest(message = 'Bad request', details?: unknown): AppError {
    return new AppError(message, { status: HttpStatus.BAD_REQUEST, details });
  }

  static unauthorized(message = 'Unauthorized', details?: unknown): AppError {
    return new AppError(message, { status: HttpStatus.UNAUTHORIZED, details });
  }

  static forbidden(message = 'Forbidden', details?: unknown): AppError {
    return new AppError(message, { status: HttpStatus.FORBIDDEN, details });
  }

  static notFound(message = 'Not found', details?: unknown): AppError {
    return new AppError(message, { status: HttpStatus.NOT_FOUND, details });
  }

  static conflict(message = 'Conflict', details?: unknown): AppError {
    return new AppError(message, { status: HttpStatus.CONFLICT, details });
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}
