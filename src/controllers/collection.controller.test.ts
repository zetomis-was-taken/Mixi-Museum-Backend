import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { collectionService } from '../services/collection.service.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import {
  createCollectionHandler,
  deleteCollectionHandler,
  getPublicCollectionHandler,
  listPublicCollectionsHandler,
  updateCollectionStatusHandler,
} from './collection.controller.js';

vi.mock('../services/collection.service.js', () => ({
  collectionService: {
    listPublicCollections: vi.fn(),
    getPublicCollectionBySlug: vi.fn(),
    listAdminCollections: vi.fn(),
    getAdminCollection: vi.fn(),
    createCollection: vi.fn(),
    updateCollection: vi.fn(),
    updateStatus: vi.fn(),
    deleteCollection: vi.fn(),
    addImage: vi.fn(),
    updateImage: vi.fn(),
    removeImage: vi.fn(),
    listMuseumTags: vi.fn(),
    createMuseumTag: vi.fn(),
    deleteMuseumTag: vi.fn(),
  },
}));

vi.mock('../utils/response.js', async () => {
  const actual = await vi.importActual('../utils/response.js');
  return {
    ...actual,
    sendSuccess: vi.fn(),
  };
});

const mockCollectionService = vi.mocked(collectionService);
const mockSendSuccess = vi.mocked(sendSuccess);

describe('CollectionController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = { locals: { museum: { id: 'm-1' } } };
  });

  it('listPublicCollectionsHandler returns published collections', async () => {
    mockReq = { query: {} };
    const mockResult = { items: [], pagination: {} } as any;
    mockCollectionService.listPublicCollections.mockResolvedValue(mockResult);

    await listPublicCollectionsHandler(mockReq as Request, mockRes as Response);
    expect(mockCollectionService.listPublicCollections).toHaveBeenCalledWith('m-1', {});
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockResult);
  });

  it('getPublicCollectionHandler returns single published collection', async () => {
    mockReq = { params: { collectionSlug: 'pottery' } };
    const mockItem = { id: 'c-1', title: 'Pottery' } as any;
    mockCollectionService.getPublicCollectionBySlug.mockResolvedValue(mockItem);

    await getPublicCollectionHandler(mockReq as Request, mockRes as Response);
    expect(mockCollectionService.getPublicCollectionBySlug).toHaveBeenCalledWith('m-1', 'pottery');
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockItem);
  });

  it('createCollectionHandler creates collection with 201', async () => {
    const input = { title: 'Ancient Pottery' };
    mockRes.locals = { museum: { id: 'm-1' }, validated: { body: input } };
    const created = { id: 'c-1', title: 'Ancient Pottery' } as any;
    mockCollectionService.createCollection.mockResolvedValue(created);

    await createCollectionHandler(mockReq as Request, mockRes as Response);
    expect(mockCollectionService.createCollection).toHaveBeenCalledWith('m-1', input);
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      created,
      HttpStatus.CREATED,
      'Collection created successfully',
    );
  });

  it('updateCollectionStatusHandler updates status with 200', async () => {
    mockReq = { params: { collectionId: 'c-1' } };
    mockRes.locals = { museum: { id: 'm-1' }, validated: { body: { status: 'published' } } };
    const updated = { id: 'c-1', status: 'published' } as any;
    mockCollectionService.updateStatus.mockResolvedValue(updated);

    await updateCollectionStatusHandler(mockReq as Request, mockRes as Response);
    expect(mockCollectionService.updateStatus).toHaveBeenCalledWith('m-1', 'c-1', 'published');
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      updated,
      HttpStatus.OK,
      'Collection status updated successfully',
    );
  });

  it('deleteCollectionHandler deletes collection with 200', async () => {
    mockReq = { params: { collectionId: 'c-1' } };
    mockRes.locals = { museum: { id: 'm-1' } };

    await deleteCollectionHandler(mockReq as Request, mockRes as Response);
    expect(mockCollectionService.deleteCollection).toHaveBeenCalledWith('m-1', 'c-1');
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      { success: true },
      HttpStatus.OK,
      'Collection deleted successfully',
    );
  });
});

