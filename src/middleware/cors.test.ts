import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createCorsMiddleware } from './cors.js';

const ALLOWED_ORIGIN = 'http://localhost:5173';

function createTestApp(origins = ALLOWED_ORIGIN) {
  const app = express();
  app.use(createCorsMiddleware(origins));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}

describe('createCorsMiddleware', () => {
  it('allows a configured origin', async () => {
    const response = await request(createTestApp()).get('/health').set('Origin', ALLOWED_ORIGIN);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });

  it('answers preflight requests for the Authorization header', async () => {
    const response = await request(createTestApp())
      .options('/health')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });

  it('omits CORS headers for an unknown origin', async () => {
    const response = await request(createTestApp()).get('/health').set('Origin', 'https://evil.example.com');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows any origin when configured with a wildcard', async () => {
    const response = await request(createTestApp('*')).get('/health').set('Origin', 'https://any.example.com');

    expect(response.headers['access-control-allow-origin']).toBe('*');
  });
});
