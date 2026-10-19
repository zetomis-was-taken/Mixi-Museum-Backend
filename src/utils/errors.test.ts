import { describe, expect, it } from 'vitest';
import { AppError, isAppError } from './errors.js';
import { HttpStatus } from './response.js';

describe('AppError', () => {
  it('defaults to a 500 with a matching code', () => {
    const error = new AppError('boom');

    expect(error.name).toBe('AppError');
    expect(error.message).toBe('boom');
    expect(error.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(error.details).toBeUndefined();
  });

  it('accepts an explicit status, code and details', () => {
    const error = new AppError('already exists', {
      status: HttpStatus.CONFLICT,
      code: 'ITEM_EXISTS',
      details: { name: 'example' },
    });

    expect(error.status).toBe(HttpStatus.CONFLICT);
    expect(error.code).toBe('ITEM_EXISTS');
    expect(error.details).toEqual({ name: 'example' });
  });

  it('keeps the original cause', () => {
    const cause = new Error('connection refused');

    expect(new AppError('boom', { cause }).cause).toBe(cause);
  });

  it('exposes helpers for common client errors', () => {
    expect(AppError.badRequest('bad').status).toBe(HttpStatus.BAD_REQUEST);
    expect(AppError.unauthorized().status).toBe(HttpStatus.UNAUTHORIZED);
    expect(AppError.forbidden().status).toBe(HttpStatus.FORBIDDEN);
    expect(AppError.notFound('missing').status).toBe(HttpStatus.NOT_FOUND);
    expect(AppError.notFound('missing').code).toBe('NOT_FOUND');
    expect(AppError.conflict('duplicate').status).toBe(HttpStatus.CONFLICT);
  });
});

describe('isAppError', () => {
  it('detects AppError instances only', () => {
    expect(isAppError(new AppError('x'))).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
    expect(isAppError('x')).toBe(false);
  });
});
