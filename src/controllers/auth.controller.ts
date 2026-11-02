import type { Request, Response } from 'express';
import { getValidated } from '../middleware/validate.js';
import { authService } from '../services/auth.service.js';
import { AppError } from '../utils/errors.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from '../validators/auth.validator.js';

export async function registerHandler(_req: Request, res: Response): Promise<void> {
  const input = getValidated<RegisterInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const result = await authService.register(input);
  sendSuccess(res, result, HttpStatus.CREATED, 'Registered successfully');
}

export async function loginHandler(_req: Request, res: Response): Promise<void> {
  const input = getValidated<LoginInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const result = await authService.login(input);
  sendSuccess(res, result, HttpStatus.OK, 'Logged in successfully');
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const result = await authService.getMe(req.user.id);
  sendSuccess(res, result, HttpStatus.OK);
}

export async function changePasswordHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const input = getValidated<ChangePasswordInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  await authService.changePassword(req.user.id, input);
  sendSuccess(res, { success: true }, HttpStatus.OK, 'Password changed successfully');
}

