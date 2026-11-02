import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { adminTierService } from './admin-tier.service.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockDb = vi.mocked(db);

describe('adminTierService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tiers for a specific museum', async () => {
    const tiers = [{ id: 't-1', name: 'Curator', museumId: 'm-1' }];
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(tiers),
      }),
    } as any);

    const result = await adminTierService.listTiers('m-1');
    expect(result).toEqual(tiers);
  });

  it('creates a new tier when name is unique', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const createdTier = { id: 't-2', name: 'Guide', museumId: 'm-1' };
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([createdTier]),
      }),
    } as any);

    const result = await adminTierService.createTier('m-1', { name: 'Guide', permissions: {} });
    expect(result).toEqual(createdTier);
  });

  it('rejects tier creation if name already exists in the museum', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 't-1', name: 'Guide' }]),
      }),
    } as any);

    await expect(
      adminTierService.createTier('m-1', { name: 'Guide', permissions: {} }),
    ).rejects.toThrow(AppError);
  });
});

