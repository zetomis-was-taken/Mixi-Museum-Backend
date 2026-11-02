import type { Request, Response } from 'express';
import { getValidated } from '../middleware/validate.js';
import { museumAdminService } from '../services/museum-admin.service.js';
import { AppError } from '../utils/errors.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import type {
  AddMuseumAdminInput,
  UpdateMuseumAdminInput,
} from '../validators/museum.validator.js';

export async function listAdminsHandler(_req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const admins = await museumAdminService.listAdmins(museum.id);
  sendSuccess(res, admins);
}

export async function addAdminHandler(_req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const input = getValidated<AddMuseumAdminInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const admin = await museumAdminService.addAdmin(museum.id, input);
  sendSuccess(res, admin, HttpStatus.CREATED, 'Administrator added successfully');
}

export async function updateAdminHandler(req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const raw = req.params.adminId;
  const adminId = Array.isArray(raw) ? raw[0] : raw;
  if (!adminId) {
    throw AppError.badRequest('Missing admin ID parameter');
  }

  const input = getValidated<UpdateMuseumAdminInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const updated = await museumAdminService.updateAdmin(museum.id, adminId, input);
  sendSuccess(res, updated, HttpStatus.OK, 'Administrator updated successfully');
}

export async function removeAdminHandler(req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const raw = req.params.adminId;
  const adminId = Array.isArray(raw) ? raw[0] : raw;
  if (!adminId) {
    throw AppError.badRequest('Missing admin ID parameter');
  }

  await museumAdminService.removeAdmin(museum.id, adminId);
  sendSuccess(res, { success: true }, HttpStatus.OK, 'Administrator removed successfully');
}

