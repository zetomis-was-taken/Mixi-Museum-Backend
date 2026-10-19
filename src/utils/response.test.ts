import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { HttpStatus, sendError, sendSuccess, statusMessage } from './response.js';

function createTestApp() {
  const app = express();

  app.get('/ok', (_req, res) => {
    sendSuccess(res, { id: 1 });
  });

  app.post('/items', (_req, res) => {
    sendSuccess(res, { id: 1 }, HttpStatus.CREATED);
  });

  app.delete('/items/1', (_req, res) => {
    sendSuccess(res, null, HttpStatus.NO_CONTENT);
  });

  app.get('/not-found', (_req, res) => {
    sendError(res, HttpStatus.NOT_FOUND, { code: 'NOT_FOUND', message: 'Item not found' });
  });

  app.get('/bad-request', (_req, res) => {
    sendError(res, HttpStatus.BAD_REQUEST);
  });

  return app;
}

describe('statusMessage', () => {
  it('returns the standard message for a known status', () => {
    expect(statusMessage(HttpStatus.CREATED)).toBe('Created');
    expect(statusMessage(HttpStatus.OK)).toBe('OK');
  });

  it('falls back for an unknown status', () => {
    expect(statusMessage(299)).toBe('Unknown');
  });
});

describe('sendSuccess', () => {
  it('wraps data with the standard message for 200', async () => {
    const response = await request(createTestApp()).get('/ok');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'OK', data: { id: 1 } });
  });

  it('uses the standard message for 201', async () => {
    const response = await request(createTestApp()).post('/items');

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true, message: 'Created', data: { id: 1 } });
  });

  it('sends an empty body for 204', async () => {
    const response = await request(createTestApp()).delete('/items/1');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });
});

describe('sendError', () => {
  it('wraps the error with its code and message', async () => {
    const response = await request(createTestApp()).get('/not-found');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Item not found',
      error: { code: 'NOT_FOUND' },
    });
  });

  it('falls back to the status message and a generic code', async () => {
    const response = await request(createTestApp()).get('/bad-request');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Bad request',
      error: { code: 'ERROR' },
    });
  });
});
