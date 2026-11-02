import dotenv from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const envFile = dotenv.config({ quiet: true });

if (envFile.error) {
  throw new Error('Required .env file was not found. Create a root .env file before running Drizzle commands.');
}

export default defineConfig({
  schema: './src/db/schemas',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
