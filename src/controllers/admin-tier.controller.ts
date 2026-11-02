import type { Request, Response } from 'express';
import { getValidated } from '../middleware/validate.js';
import { adminTierService } from '../services/admin-tier.service.js';
import { AppError } from '../utils/errors.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import type {
  CreateAdminTierInput,
  UpdateAdminTierInput,
} from '../validators/museum.validator.js';

export async function listTiersHandler(_req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const tiers = await adminTierService.listTiers(museum.id);
  sendSuccess(res, tiers);
}

export async function createTierHandler(_req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const input = getValidated<CreateAdminTierInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const tier = await adminTierService.createTier(museum.id, input);
  sendSuccess(res, tier, HttpStatus.CREATED, 'Admin tier created successfully');
}

export async function updateTierHandler(req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const raw = req.params.tierId;
  const tierId = Array.isArray(raw) ? raw[0] : raw;
  if (!tierId) {
    throw AppError.badRequest('Missing tier ID parameter');
  }

  const input = getValidated<UpdateAdminTierInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const updated = await adminTierService.updateTier(museum.id, tierId, input);
  sendSuccess(res, updated, HttpStatus.OK, 'Admin tier updated successfully');
}

export async function deleteTierHandler(req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const raw = req.params.tierId;
  const tierId = Array.isArray(raw) ? raw[0] : raw;
  if (!tierId) {
    throw AppError.badRequest('Missing tier ID parameter');
  }

  await adminTierService.deleteTier(museum.id, tierId);
  sendSuccess(res, { success: true }, HttpStatus.OK, 'Admin tier deleted successfully');
}

