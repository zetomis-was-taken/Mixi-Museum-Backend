import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { museumService } from './museum.service.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockDb = vi.mocked(db);

describe('museumService.getMuseumBySlugOrId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws not found error when museum does not exist', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    await expect(museumService.getMuseumBySlugOrId('non-existent')).rejects.toThrow(
      AppError,
    );
  });

  it('returns museum when found by slug', async () => {
    const museumData = {
      id: 'm-uuid-1',
      name: 'Louvre',
      slug: 'louvre',
      shopEnabled: true,
      ticketsEnabled: true,
    };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([museumData]),
      }),
    } as any);

    const result = await museumService.getMuseumBySlugOrId('louvre');
    expect(result.id).toBe('m-uuid-1');
    expect(result.name).toBe('Louvre');
  });
});

describe('museumService.createMuseum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates museum, seeds default tiers and sets creator as owner', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const createdMuseum = {
      id: 'new-museum-id',
      name: 'National Museum',
      slug: 'national-museum',
      currency: 'USD',
      shopEnabled: false,
      ticketsEnabled: false,
    };

    mockDb.transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        insert: vi.fn().mockImplementation((table: any) => {
          return {
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([
                table.name === 'admin_tiers'
                  ? { id: 'tier-founder', name: 'Founder' }
                  : createdMuseum,
              ]),
              onConflictDoNothing: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      };
      return callback(txMock);
    });

    const result = await museumService.createMuseum('user-id-1', {
      name: 'National Museum',
    });

    expect(result.id).toBe('new-museum-id');
    expect(result.slug).toBe('national-museum');
  });
});

