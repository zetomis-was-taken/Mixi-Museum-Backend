import express from 'express';
import { env } from './config/env.js';
import { checkDb } from './db/index.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { HttpStatus, sendError, sendSuccess } from './utils/response.js';

export function createApp() {
  const app = express();

  app.use(createCorsMiddleware());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Liveness only indicates that the process can serve requests.
  app.get('/health', (_req, res) => {
    sendSuccess(res, { status: 'ok', env: env.NODE_ENV });
  });

  // Readiness includes dependencies required to serve traffic.
  app.get('/health/ready', async (_req, res) => {
    try {
      const connected = await checkDb();

      if (!connected) {
        sendError(res, HttpStatus.SERVICE_UNAVAILABLE, {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service unavailable',
          details: { database: 'disconnected' },
        });
        return;
      }

      sendSuccess(res, { status: 'ok', env: env.NODE_ENV, database: 'connected' });
    } catch {
      sendError(res, HttpStatus.SERVICE_UNAVAILABLE, {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
        details: { database: 'disconnected' },
      });
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
