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

  it('reports the database as connected', async () => {
    mockCheckDb.mockResolvedValue(true);

    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'OK',
      data: { status: 'ok', env: 'test', database: 'connected' },
    });
  });

  it('reports the database as disconnected', async () => {
    mockCheckDb.mockResolvedValue(false);

    const response = await request(createApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'OK',
      data: { status: 'ok', env: 'test', database: 'disconnected' },
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
