import type { Server } from 'node:http';

export interface ShutdownResult {
  timedOut: boolean;
  databaseError: boolean;
}

/** Stops accepting requests, bounds the wait for open connections, then closes dependencies. */
export async function shutdownServer(
  server: Server,
  closeDatabase: () => Promise<void>,
  timeoutMs = 10_000,
): Promise<ShutdownResult> {
  let timedOut = false;
  let databaseError = false;

  await new Promise<void>((resolve) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      timedOut = true;
      server.closeAllConnections();
      resolve();
    }, timeoutMs);

    server.close(() => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve();
    });
  });

  try {
    await closeDatabase();
  } catch (error) {
    databaseError = true;
    console.error('Error while closing the database pool:', error);
  }

  return { timedOut, databaseError };
}
