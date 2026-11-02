import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminTierService } from '../services/admin-tier.service.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import {
  createTierHandler,
  deleteTierHandler,
  listTiersHandler,
  updateTierHandler,
} from './admin-tier.controller.js';

vi.mock('../services/admin-tier.service.js', () => ({
  adminTierService: {
    listTiers: vi.fn(),
    createTier: vi.fn(),
    updateTier: vi.fn(),
    deleteTier: vi.fn(),
  },
}));

vi.mock('../utils/response.js', async () => {
  const actual = await vi.importActual('../utils/response.js');
  return {
    ...actual,
    sendSuccess: vi.fn(),
  };
});

const mockAdminTierService = vi.mocked(adminTierService);
const mockSendSuccess = vi.mocked(sendSuccess);

describe('AdminTierController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = { locals: { museum: { id: 'm-1' } } };
  });

  it('listTiersHandler returns museum tiers', async () => {
    mockAdminTierService.listTiers.mockResolvedValue([]);
    await listTiersHandler(mockReq as Request, mockRes as Response);
    expect(mockAdminTierService.listTiers).toHaveBeenCalledWith('m-1');
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, []);
  });

  it('createTierHandler creates tier with 201', async () => {
    const input = { name: 'Manager', permissions: {} };
    mockRes.locals = { museum: { id: 'm-1' }, validated: { body: input } };
    const created = { id: 't-1', name: 'Manager' } as any;
    mockAdminTierService.createTier.mockResolvedValue(created);

    await createTierHandler(mockReq as Request, mockRes as Response);
    expect(mockAdminTierService.createTier).toHaveBeenCalledWith('m-1', input);
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      created,
      HttpStatus.CREATED,
      'Admin tier created successfully',
    );
  });
});

