import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('GET /health', () => {
  it('returns the service status', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'OK',
      data: { status: 'ok', env: 'test' },
    });
  });
});

describe('unknown routes', () => {
  it('returns 404 in the standard error envelope', async () => {
    const response = await request(createApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route GET /does-not-exist not found',
      error: { code: 'ROUTE_NOT_FOUND' },
    });
  });
});
