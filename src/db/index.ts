import { sql } from 'drizzle-orm';
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

/** Runs a trivial query to verify the database connection. */
export async function checkDb(): Promise<boolean> {
  try {
    await db.execute(sql`SELECT 1`);
    return true;
  } catch (error) {
    console.error('Database check failed:', error);
    return false;
  }
}
