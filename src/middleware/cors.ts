import cors from 'cors';
import { env } from '../config/env.js';

/**
 * CORS middleware. Allowed origins come from `CORS_ORIGINS` (comma-separated,
 * exact; `*` allows any origin). Supabase access tokens travel as a Bearer
 * header, so cookie credentials are not enabled.
 */
export function createCorsMiddleware(rawOrigins: string = env.CORS_ORIGINS) {
  const origins = rawOrigins
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  return cors({
    // Unknown origins get no CORS headers, so browsers block them while
    // server-to-server callers (which send no Origin) keep working.
    origin: origins.includes('*') ? '*' : origins,
    allowedHeaders: ['Authorization', 'Content-Type', 'apikey'],
  });
}
