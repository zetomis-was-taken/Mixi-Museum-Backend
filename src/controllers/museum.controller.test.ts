import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { museumService } from '../services/museum.service.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import {
  createMuseumHandler,
  getMuseumHandler,
  listMuseumsHandler,
  updateMuseumHandler,
  updateSettingsHandler,
} from './museum.controller.js';

vi.mock('../services/museum.service.js', () => ({
  museumService: {
    listMuseums: vi.fn(),
    getMuseumBySlugOrId: vi.fn(),
    createMuseum: vi.fn(),
    updateMuseum: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

vi.mock('../utils/response.js', async () => {
  const actual = await vi.importActual('../utils/response.js');
  return {
    ...actual,
    sendSuccess: vi.fn(),
  };
});

const mockMuseumService = vi.mocked(museumService);
const mockSendSuccess = vi.mocked(sendSuccess);

describe('MuseumController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = { locals: {} };
  });

  it('listMuseumsHandler calls museumService.listMuseums', async () => {
    mockReq = { query: { page: '1' } };
    mockRes.locals = { validated: { query: { page: 1 } } };
    const mockResult = { items: [], pagination: {} } as any;
    mockMuseumService.listMuseums.mockResolvedValue(mockResult);

    await listMuseumsHandler(mockReq as Request, mockRes as Response);
    expect(mockMuseumService.listMuseums).toHaveBeenCalledWith({ page: 1 });
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockResult);
  });

  it('getMuseumHandler calls museumService.getMuseumBySlugOrId', async () => {
    mockReq = { params: { slug: 'louvre' } };
    const mockMuseum = { id: 'm-1', name: 'Louvre' } as any;
    mockMuseumService.getMuseumBySlugOrId.mockResolvedValue(mockMuseum);

    await getMuseumHandler(mockReq as Request, mockRes as Response);
    expect(mockMuseumService.getMuseumBySlugOrId).toHaveBeenCalledWith('louvre');
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, mockMuseum);
  });

  it('createMuseumHandler calls museumService.createMuseum with req.user.id', async () => {
    mockReq = { user: { id: 'u-1', email: 'u@museum.com', roles: ['user'] } };
    const input = { name: 'Art Museum' };
    mockRes.locals = { validated: { body: input } };

    const mockMuseum = { id: 'm-2', name: 'Art Museum' } as any;
    mockMuseumService.createMuseum.mockResolvedValue(mockMuseum);

    await createMuseumHandler(mockReq as Request, mockRes as Response);
    expect(mockMuseumService.createMuseum).toHaveBeenCalledWith('u-1', input);
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      mockMuseum,
      HttpStatus.CREATED,
      'Museum created successfully',
    );
  });
});

