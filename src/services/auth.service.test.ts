import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../db/index.js';
import { AppError } from '../utils/errors.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { authService } from './auth.service.js';

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../utils/password.js', () => ({
  hashPassword: vi.fn(),
  comparePassword: vi.fn(),
}));

const mockDb = vi.mocked(db);
const mockHashPassword = vi.mocked(hashPassword);
const mockComparePassword = vi.mocked(comparePassword);

describe('authService.register', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws conflict error if email is already taken', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'existing-id', email: 'test@museum.com' }]),
      }),
    } as any);

    await expect(
      authService.register({
        email: 'test@museum.com',
        password: 'password123',
        displayName: 'Test User',
      }),
    ).rejects.toThrow(AppError);
  });

  it('creates user and returns auth token on success', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    mockHashPassword.mockResolvedValue('hashed_secret');

    const createdUser = {
      id: 'new-uuid',
      email: 'new@museum.com',
      displayName: 'New User',
      phone: null,
      avatarUrl: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb.transaction.mockImplementation(async (callback: any) => {
      const txMock = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([createdUser]),
          }),
        }),
      };
      return callback(txMock);
    });

    const result = await authService.register({
      email: 'new@museum.com',
      password: 'password123',
      displayName: 'New User',
    });

    expect(result.token).toBeDefined();
    expect(result.user.email).toBe('new@museum.com');
    expect(result.user.roles).toEqual(['user']);
  });
});

describe('authService.login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws unauthorized error if user is not found', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    } as any);

    await expect(
      authService.login({ email: 'unknown@museum.com', password: 'password123' }),
    ).rejects.toThrow(AppError);
  });

  it('throws unauthorized error if password does not match', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: 'user-id',
            email: 'user@museum.com',
            passwordHash: 'stored-hash',
            displayName: 'User',
          },
        ]),
      }),
    } as any);

    mockComparePassword.mockResolvedValue(false);

    await expect(
      authService.login({ email: 'user@museum.com', password: 'wrongpassword' }),
    ).rejects.toThrow(AppError);
  });

  it('returns user and JWT token when credentials are valid', async () => {
    const existingUser = {
      id: 'user-id',
      email: 'user@museum.com',
      passwordHash: 'stored-hash',
      displayName: 'User',
      phone: null,
      avatarUrl: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
      callCount++;
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(
            callCount === 1 ? [existingUser] : [{ role: 'user' }],
          ),
        }),
      } as any;
    });

    mockComparePassword.mockResolvedValue(true);

    const result = await authService.login({
      email: 'user@museum.com',
      password: 'correctpassword',
    });

    expect(result.token).toBeDefined();
    expect(result.user.id).toBe('user-id');
    expect(result.user.roles).toEqual(['user']);
  });
});

describe('authService.changePassword', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects if current password is wrong', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            id: 'user-id',
            passwordHash: 'stored-hash',
          },
        ]),
      }),
    } as any);

    mockComparePassword.mockResolvedValue(false);

    await expect(
      authService.changePassword('user-id', {
        currentPassword: 'wrongCurrentPassword',
        newPassword: 'newSecretPassword',
      }),
    ).rejects.toThrow(AppError);
  });
});

