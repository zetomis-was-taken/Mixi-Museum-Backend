import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from '../services/auth.service.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import {
  changePasswordHandler,
  loginHandler,
  meHandler,
  registerHandler,
} from './auth.controller.js';

vi.mock('../services/auth.service.js', () => ({
  authService: {
    register: vi.fn(),
    login: vi.fn(),
    getMe: vi.fn(),
    changePassword: vi.fn(),
  },
}));

vi.mock('../utils/response.js', async () => {
  const actual = await vi.importActual('../utils/response.js');
  return {
    ...actual,
    sendSuccess: vi.fn(),
  };
});

const mockAuthService = vi.mocked(authService);
const mockSendSuccess = vi.mocked(sendSuccess);

describe('AuthController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRes = {
      locals: {},
    };
  });

  it('registerHandler calls authService.register and responds with 201', async () => {
    const input = {
      email: 'new@museum.com',
      password: 'password123',
      displayName: 'New User',
    };
    mockRes.locals = { validated: { body: input } };

    const mockResult = {
      user: { id: 'u-1', email: input.email } as any,
      token: 'jwt-token',
    };
    mockAuthService.register.mockResolvedValue(mockResult);

    await registerHandler(mockReq as Request, mockRes as Response);

    expect(mockAuthService.register).toHaveBeenCalledWith(input);
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      mockResult,
      HttpStatus.CREATED,
      'Registered successfully',
    );
  });

  it('loginHandler calls authService.login and responds with 200', async () => {
    const input = { email: 'user@museum.com', password: 'password123' };
    mockRes.locals = { validated: { body: input } };

    const mockResult = {
      user: { id: 'u-1', email: input.email } as any,
      token: 'jwt-token',
    };
    mockAuthService.login.mockResolvedValue(mockResult);

    await loginHandler(mockReq as Request, mockRes as Response);

    expect(mockAuthService.login).toHaveBeenCalledWith(input);
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      mockResult,
      HttpStatus.OK,
      'Logged in successfully',
    );
  });

  it('meHandler calls authService.getMe with req.user.id', async () => {
    mockReq = {
      user: { id: 'u-1', email: 'user@museum.com', roles: ['user'] },
    };

    const meData = { user: mockReq.user, memberships: [] } as any;
    mockAuthService.getMe.mockResolvedValue(meData);

    await meHandler(mockReq as Request, mockRes as Response);

    expect(mockAuthService.getMe).toHaveBeenCalledWith('u-1');
    expect(mockSendSuccess).toHaveBeenCalledWith(mockRes, meData, HttpStatus.OK);
  });

  it('changePasswordHandler calls authService.changePassword and responds with 200', async () => {
    mockReq = {
      user: { id: 'u-1', email: 'user@museum.com', roles: ['user'] },
    };
    const input = {
      currentPassword: 'oldPassword',
      newPassword: 'newPassword123',
    };
    mockRes.locals = { validated: { body: input } };

    await changePasswordHandler(mockReq as Request, mockRes as Response);

    expect(mockAuthService.changePassword).toHaveBeenCalledWith('u-1', input);
    expect(mockSendSuccess).toHaveBeenCalledWith(
      mockRes,
      { success: true },
      HttpStatus.OK,
      'Password changed successfully',
    );
  });
});

