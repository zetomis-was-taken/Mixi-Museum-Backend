import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { museumAdminService } from '../services/museum-admin.service.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import {
  addAdminHandler,
  listAdminsHandler,
  removeAdminHandler,
  updateAdminHandler,
} from './museum-admin.controller.js';

vi.mock('../services/museum-admin.service.js', () => ({
  museumAdminService: {
    listAdmins: vi.fn(),
    addAdmin: vi.fn(),
    updateAdmin: vi.fn(),
    removeAdmin: vi.fn(),
  },
}));

vi.mock('../utils/response.js', async () => {
  const actual = await vi.importActual('../utils/response.js');
  return {
    ...actual,
    sendSuccess: vi.fn(),
  };
});

const mockMuseumAdminService = vi.mocked(museumAdminService);
const mockSendSuccess = vi.mocked(sendSuccess);

describe('MuseumAdminController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = { locals: { museum: { id: 'm-1' } } };
  });

  it('listAdminsHandler returns list of admins', async () => {
    mockMuseumAdminService.listAdmins.mockResolvedValue([]);
    await listAdminsHandler(mockReq as Request, mockRes as Response);
    expect(mockMuseumAdminService.listAdmins).toHaveBeenCalledWith('m-1');
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, []);
  });

  it('addAdminHandler calls addAdmin with input and responds with 201', async () => {
    const input = { email: 'newadmin@museum.com', isOwner: false };
    mockRes.locals = { museum: { id: 'm-1' }, validated: { body: input } };
    const created = { id: 'ma-1', userId: 'u-2' } as any;
    mockMuseumAdminService.addAdmin.mockResolvedValue(created);

    await addAdminHandler(mockReq as Request, mockRes as Response);
    expect(mockMuseumAdminService.addAdmin).toHaveBeenCalledWith('m-1', input);
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      created,
      HttpStatus.CREATED,
      'Administrator added successfully',
    );
  });
});

