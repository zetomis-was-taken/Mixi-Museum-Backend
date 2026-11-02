import type { Server } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import { shutdownServer } from './shutdown.js';

function fakeServer(close: Server['close']): Server {
  return { close, closeAllConnections: vi.fn() } as unknown as Server;
}

describe('shutdownServer', () => {
  it('closes the server and database successfully', async () => {
    const closeDatabase = vi.fn().mockResolvedValue(undefined);
    const server = fakeServer((callback) => {
      callback?.();
      return server;
    });

    const result = await shutdownServer(server, closeDatabase, 20);

    expect(result).toEqual({ timedOut: false, databaseError: false });
    expect(closeDatabase).toHaveBeenCalledOnce();
  });

  it('forces existing connections closed when server shutdown times out', async () => {
    const closeDatabase = vi.fn().mockResolvedValue(undefined);
    const server = fakeServer(() => server);

    const result = await shutdownServer(server, closeDatabase, 1);

    expect(result).toEqual({ timedOut: true, databaseError: false });
    expect(server.closeAllConnections).toHaveBeenCalledOnce();
    expect(closeDatabase).toHaveBeenCalledOnce();
  });

  it('reports database cleanup failures', async () => {
    const closeDatabase = vi.fn().mockRejectedValue(new Error('close failed'));
    const server = fakeServer((callback) => {
      callback?.();
      return server;
    });

    const result = await shutdownServer(server, closeDatabase, 20);

    expect(result).toEqual({ timedOut: false, databaseError: true });
  });
});
