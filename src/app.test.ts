import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';
import { checkDb } from './db/index.js';

vi.mock('./db/index.js', () => ({ checkDb: vi.fn() }));

const mockCheckDb = vi.mocked(checkDb);

describe('GET /health', () => {
  beforeEach(() => {
    mockCheckDb.mockReset();
  });

  it('reports the application as live without checking the database', async () => {
    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(mockCheckDb).not.toHaveBeenCalled();
    expect(response.body).toEqual({
      success: true,
      message: 'OK',
      data: { status: 'ok', env: 'test' },
    });
  });
});

describe('GET /health/ready', () => {
  beforeEach(() => {
    mockCheckDb.mockReset();
  });

  it('reports readiness when the database is connected', async () => {
    mockCheckDb.mockResolvedValue(true);

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'OK',
      data: { status: 'ok', env: 'test', database: 'connected' },
    });
  });

  it('returns service unavailable when the database is disconnected', async () => {
    mockCheckDb.mockResolvedValue(false);

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      message: 'Service unavailable',
      error: { code: 'SERVICE_UNAVAILABLE', details: { database: 'disconnected' } },
    });
  });

  it('returns service unavailable when the database check fails', async () => {
    mockCheckDb.mockRejectedValue(new Error('database unavailable'));

    const response = await request(createApp()).get('/health/ready');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      success: false,
      message: 'Service unavailable',
      error: { code: 'SERVICE_UNAVAILABLE', details: { database: 'disconnected' } },
    });
  });
});

describe('CORS', () => {
  it('allows the configured frontend origin on preflight', async () => {
    const response = await request(createApp())
      .options('/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
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
