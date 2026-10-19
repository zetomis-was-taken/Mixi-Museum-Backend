import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDb } from './db/index.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down...`);

  server.close(async () => {
    try {
      await closeDb();
    } catch (error) {
      console.error('Error while closing the database pool:', error);
    } finally {
      process.exit(0);
    }
  });
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
