import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { signToken } from '../utils/jwt.js';
import {
  requireAdminRole,
  requireAuth,
  requireFeature,
  requireMuseumMember,
  requireOwner,
} from './auth.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
  },
}));

const mockDb = vi.mocked(db);

describe('requireAuth middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = { locals: {} };
  });

  it('throws unauthorized error if Authorization header is missing', () => {
    mockReq = { headers: {} };

    expect(() => requireAuth(mockReq as Request, mockRes as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it('throws unauthorized error if token format is invalid', () => {
    mockReq = { headers: { authorization: 'Basic 123456' } };

    expect(() => requireAuth(mockReq as Request, mockRes as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });

  it('populates req.user and res.locals.user on valid token', () => {
    const token = signToken({
      sub: 'user-uuid-1',
      email: 'member@museum.com',
      roles: ['user'],
    });

    mockReq = { headers: { authorization: `Bearer ${token}` } };

    requireAuth(mockReq as Request, mockRes as Response, next);

    expect(next).toHaveBeenCalled();
    expect(mockReq.user).toEqual({
      id: 'user-uuid-1',
      email: 'member@museum.com',
      roles: ['user'],
    });
    expect(mockRes.locals?.user).toEqual(mockReq.user);
  });
});

describe('requireAdminRole middleware', () => {
  let mockRes: Partial<Response>;
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = { locals: {} };
  });

  it('allows request if user has admin role', () => {
    const mockReq = {
      user: { id: 'admin-id', email: 'admin@museum.com', roles: ['admin'] },
    } as Request;

    requireAdminRole(mockReq, mockRes as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('throws forbidden error if user lacks admin role', () => {
    const mockReq = {
      user: { id: 'user-id', email: 'user@museum.com', roles: ['user'] },
    } as Request;

    expect(() => requireAdminRole(mockReq, mockRes as Response, next)).toThrow(AppError);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireMuseumMember & requireOwner middleware', () => {
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows museum member and sets res.locals.museumAdmin', async () => {
    const mockReq = {
      params: { slug: 'louvre' },
      user: { id: 'admin-id', email: 'admin@museum.com', roles: ['admin'] },
    } as unknown as Request;

    const mockRes = { locals: {} } as Response;

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            {
              museumId: 'm-1',
              museumSlug: 'louvre',
              isOwner: true,
              tierId: 'tier-1',
              shopEnabled: true,
              ticketsEnabled: true,
            },
          ]),
        }),
      }),
    } as any);

    await requireMuseumMember()(mockReq, mockRes, next);

    expect(next).toHaveBeenCalled();
    expect(mockRes.locals.museumAdmin.isOwner).toBe(true);

    // Test requireOwner with this res.locals
    const nextOwner = vi.fn();
    requireOwner(mockReq, mockRes, nextOwner);
    expect(nextOwner).toHaveBeenCalled();
  });

  it('rejects requireOwner if isOwner is false', () => {
    const mockReq = {} as Request;
    const mockRes = {
      locals: {
        museumAdmin: { isOwner: false },
      },
    } as unknown as Response;

    const next = vi.fn();
    expect(() => requireOwner(mockReq, mockRes, next)).toThrow(AppError);
  });
});

describe('requireFeature middleware', () => {
  const next = vi.fn();

  it('allows if feature is enabled in preloaded res.locals.museum', async () => {
    const mockReq = { params: { slug: 'national' } } as unknown as Request;
    const mockRes = {
      locals: {
        museum: { id: 'm-1', shopEnabled: true, ticketsEnabled: false },
      },
    } as unknown as Response;

    await requireFeature('shop_enabled')(mockReq, mockRes, next);
    expect(next).toHaveBeenCalled();
  });

  it('throws forbidden if feature is disabled', async () => {
    const mockReq = { params: { slug: 'national' } } as unknown as Request;
    const mockRes = {
      locals: {
        museum: { id: 'm-1', shopEnabled: false, ticketsEnabled: false },
      },
    } as unknown as Response;

    await expect(
      requireFeature('shop_enabled')(mockReq, mockRes, next),
    ).rejects.toThrow(AppError);
  });
});

