import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { errorHandler } from './error-handler.js';
import { getValidated, validate } from './validate.js';

const createItemSchema = z.object({
  name: z.string().min(1),
  quantity: z.coerce.number().int(),
});

const searchSchema = z.object({ q: z.string().min(2) });

type CreateItem = z.infer<typeof createItemSchema>;
type SearchQuery = z.infer<typeof searchSchema>;

function createTestApp() {
  const app = express();
  app.use(express.json());

  app.post('/items', validate({ body: createItemSchema }), (_req, res) => {
    res.json({ validated: getValidated<CreateItem>(res) });
  });

  app.get('/search', validate({ query: searchSchema }), (_req, res) => {
    res.json({ validated: getValidated<SearchQuery>(res, 'query') });
  });

  app.use(errorHandler);

  return app;
}

describe('validate', () => {
  it('parses the body and exposes the result on res.locals', async () => {
    const response = await request(createTestApp())
      .post('/items')
      .send({ name: 'example', quantity: '3' });

    expect(response.status).toBe(200);
    expect(response.body.validated).toEqual({ name: 'example', quantity: 3 });
  });

  it('rejects an invalid body with 400 VALIDATION_ERROR', async () => {
    const response = await request(createTestApp()).post('/items').send({ name: '' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Validation failed',
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('validates the query string', async () => {
    const response = await request(createTestApp()).get('/search').query({ q: 'ab' });

    expect(response.status).toBe(200);
    expect(response.body.validated).toEqual({ q: 'ab' });

    const invalid = await request(createTestApp()).get('/search').query({ q: 'a' });

    expect(invalid.status).toBe(400);
  });
});
