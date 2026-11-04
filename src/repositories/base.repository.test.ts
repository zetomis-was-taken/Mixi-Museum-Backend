import { describe, expect, it, vi } from 'vitest';
import { createRepository } from './base.repository.js';

function createQuery(result: unknown) {
  const query: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ['from', 'where', 'values', 'set', 'returning', 'limit', 'offset', 'orderBy', 'delete', 'update', 'insert', 'select']) {
    query[method] = vi.fn(() => query);
  }
  query.then = vi.fn((resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve));
  return query;
}

describe('createRepository', () => {
  it('inserts a row and returns the inserted record', async () => {
    const row = { id: 'id-1', label: 'example' };
    const query = createQuery([row]);
    const repository = createRepository({ insert: vi.fn(() => query) } as never, {} as never);

    await expect(repository.create({ label: 'example' })).resolves.toEqual(row);
    expect(query.values).toHaveBeenCalledWith({ label: 'example' });
    expect(query.returning).toHaveBeenCalledOnce();
  });

  it('returns undefined when no row matches an ID lookup', async () => {
    const query = createQuery([]);
    const repository = createRepository({ select: vi.fn(() => query) } as never, { id: 'id' } as never);

    await expect(repository.findById('missing')).resolves.toBeUndefined();
    expect(query.limit).toHaveBeenCalledWith(1);
  });
});
