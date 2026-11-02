import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDb } from './db/index.js';
import { shutdownServer } from './shutdown.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    console.error(`\n${signal} received during shutdown; forcing exit.`);
    server.closeAllConnections();
    process.exit(1);
  }

  shuttingDown = true;
  console.log(`\n${signal} received, shutting down...`);

  const result = await shutdownServer(server, closeDb);
  if (result.timedOut) {
    console.error('Shutdown timed out; open connections were closed forcefully.');
  }
  process.exit(result.timedOut || result.databaseError ? 1 : 0);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
