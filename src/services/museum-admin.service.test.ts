import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { museumAdminService } from './museum-admin.service.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

const mockDb = vi.mocked(db);

describe('museumAdminService.removeAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects deletion if the admin is the only owner', async () => {
    const mockWhere = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'admin-1', museumId: 'm-1', isOwner: true }])
      .mockResolvedValueOnce([{ total: 1 }]);

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: mockWhere,
      }),
    } as any);

    await expect(museumAdminService.removeAdmin('m-1', 'admin-1')).rejects.toThrow(AppError);
  });
});

describe('museumAdminService.addAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws error if user with email is not found', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    await expect(
      museumAdminService.addAdmin('m-1', { email: 'nonexistent@museum.com', isOwner: false }),
    ).rejects.toThrow(AppError);
  });
});
