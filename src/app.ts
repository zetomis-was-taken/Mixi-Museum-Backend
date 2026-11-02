import express from 'express';
import { env } from './config/env.js';
import { checkDb } from './db/index.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { router } from './routes/index.js';
import { sendSuccess } from './utils/response.js';

export function createApp() {
  const app = express();

  app.use(createCorsMiddleware());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', async (_req, res) => {
    const database = (await checkDb()) ? 'connected' : 'disconnected';

    sendSuccess(res, { status: 'ok', env: env.NODE_ENV, database });
  });

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
