import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { collectionService } from './collection.service.js';

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

describe('collectionService.getPublicCollectionBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws not found if collection does not exist or is not published', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    await expect(
      collectionService.getPublicCollectionBySlug('m-1', 'ancient-pottery'),
    ).rejects.toThrow(AppError);
  });

  it('returns published collection with images and tags', async () => {
    const collectionData = {
      id: 'c-1',
      museumId: 'm-1',
      title: 'Ancient Pottery',
      slug: 'ancient-pottery',
      status: 'published',
    };

    let call = 0;
    mockDb.select.mockImplementation(() => {
      call++;
      if (call === 1) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([collectionData]),
          }),
        } as any;
      }
      if (call === 2) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                { id: 'img-1', storagePath: 'pottery.jpg', position: 0 },
              ]),
            }),
          }),
        } as any;
      }
      return {
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([
              { id: 'tag-1', name: 'Ceramics', slug: 'ceramics' },
            ]),
          }),
        }),
      } as any;
    });

    const result = await collectionService.getPublicCollectionBySlug('m-1', 'ancient-pottery');
    expect(result.id).toBe('c-1');
    expect(result.title).toBe('Ancient Pottery');
    expect(result.images).toHaveLength(1);
    expect(result.tags).toHaveLength(1);
  });
});

describe('collectionService.createCollection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws conflict if slug already exists in this museum', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'c-existing' }]),
      }),
    } as any);

    await expect(
      collectionService.createCollection('m-1', { title: 'Ancient Pottery' }),
    ).rejects.toThrow(AppError);
  });

  it('creates collection with draft status by default', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    const created = {
      id: 'c-new',
      museumId: 'm-1',
      title: 'Medieval Swords',
      slug: 'medieval-swords',
      status: 'draft',
    };

    mockDb.transaction.mockImplementation(async (callback: any) => {
      const tx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([created]),
          }),
        }),
      };
      return callback(tx);
    });

    const result = await collectionService.createCollection('m-1', {
      title: 'Medieval Swords',
    });

    expect(result.id).toBe('c-new');
    expect(result.status).toBe('draft');
  });
});

describe('collectionService.updateStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates collection status to published', async () => {
    const updated = {
      id: 'c-1',
      museumId: 'm-1',
      title: 'Medieval Swords',
      status: 'published',
    };

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([updated]),
        }),
      }),
    } as any);

    const result = await collectionService.updateStatus('m-1', 'c-1', 'published');
    expect(result.status).toBe('published');
  });
});
