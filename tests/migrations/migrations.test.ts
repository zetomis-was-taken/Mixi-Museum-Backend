import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../src/config/env.js';
import { closeDb, db } from '../../src/db/index.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle/', import.meta.url));

function journalEntryCount(): number {
  const journal = JSON.parse(
    readFileSync(join(migrationsFolder, 'meta', '_journal.json'), 'utf8'),
  ) as { entries: unknown[] };

  return journal.entries.length;
}

// `docker compose up -d` only creates the default database, so make sure the
// dedicated test database exists before the migrations run against it.
async function ensureTestDatabase(): Promise<void> {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be set in .env.test to run migration tests');
  }

  const url = new URL(env.DATABASE_URL);
  const database = url.pathname.slice(1);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';

  const admin = new Pool({ connectionString: adminUrl.toString() });

  try {
    const { rowCount } = await admin.query('select 1 from pg_database where datname = $1', [
      database,
    ]);

    if (rowCount === 0) {
      await admin.query(`create database "${database.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }
}

describe('database migrations', () => {
  beforeAll(async () => {
    await ensureTestDatabase();
    await migrate(db, { migrationsFolder });
  });

  afterAll(async () => {
    await closeDb();
  });

  it('applies every migration to an empty test database', async () => {
    const result = await db.execute(sql`select count(*)::int as count from drizzle.__drizzle_migrations`);
    const [row] = result.rows as { count: number }[];

    expect(row?.count).toBe(journalEntryCount());
  });

  it('can be run again without changes', async () => {
    await expect(migrate(db, { migrationsFolder })).resolves.toBeUndefined();
  });
});
