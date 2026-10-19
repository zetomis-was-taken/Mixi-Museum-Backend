import express from 'express';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { sendSuccess } from './utils/response.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (_req, res) => {
    sendSuccess(res, { status: 'ok', env: env.NODE_ENV });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
