import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';
import { errorHandler, notFoundHandler } from './error-handler.js';

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/app-error', () => {
    throw AppError.notFound('Item not found');
  });

  app.get('/zod-error', () => {
    z.object({ id: z.string() }).parse({ id: 1 });
  });

  app.get('/unexpected', () => {
    throw new Error('database exploded');
  });

  app.post('/json', (req, res) => {
    res.json({ received: req.body });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

describe('errorHandler', () => {
  it('maps an AppError to its status, code and message', async () => {
    const response = await request(createTestApp()).get('/app-error');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Item not found',
      error: { code: 'NOT_FOUND' },
    });
  });

  it('maps a ZodError to 400 VALIDATION_ERROR with issue details', async () => {
    const response = await request(createTestApp()).get('/zod-error');

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Validation failed',
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(response.body.error.details).toEqual([
      { path: 'id', message: expect.any(String), code: expect.any(String) },
    ]);
  });

  it('hides unexpected error details from clients', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      const response = await request(createTestApp()).get('/unexpected');

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        message: 'Internal server error',
        error: { code: 'INTERNAL_SERVER_ERROR' },
      });
      expect(response.text).not.toContain('database exploded');
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('maps a malformed JSON body to 400 INVALID_JSON', async () => {
    const response = await request(createTestApp())
      .post('/json')
      .set('content-type', 'application/json')
      .send('{"broken":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Malformed JSON in request body',
      error: { code: 'INVALID_JSON' },
    });
  });
});

describe('notFoundHandler', () => {
  it('returns 404 in the standard error envelope', async () => {
    const response = await request(createTestApp()).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route GET /nope not found',
      error: { code: 'ROUTE_NOT_FOUND' },
    });
  });
});
