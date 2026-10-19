import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { env } from '../config/env.js';
import * as schema from './schemas/index.js';

export const pool = new Pool({
  connectionString: env.DATABASE_URL || undefined,
});

export const db = drizzle({ client: pool, schema });

export async function closeDb(): Promise<void> {
  await pool.end();
}
