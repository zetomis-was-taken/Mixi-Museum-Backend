import type { Request, Response } from 'express';
import { getValidated } from '../middleware/validate.js';
import { museumService } from '../services/museum.service.js';
import { AppError } from '../utils/errors.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import type {
  CreateMuseumInput,
  QueryMuseumsInput,
  UpdateMuseumInput,
  UpdateMuseumSettingsInput,
} from '../validators/museum.validator.js';

export async function listMuseumsHandler(req: Request, res: Response): Promise<void> {
  const query = getValidated<QueryMuseumsInput>(res, 'query') ?? req.query;
  const result = await museumService.listMuseums(query);
  sendSuccess(res, result);
}

export async function getMuseumHandler(req: Request, res: Response): Promise<void> {
  const raw = req.params.slug ?? req.params.id;
  const identifier = Array.isArray(raw) ? raw[0] : raw;

  if (!identifier) {
    throw AppError.badRequest('Missing museum identifier parameter');
  }

  const museum = await museumService.getMuseumBySlugOrId(identifier);
  sendSuccess(res, museum);
}

export async function createMuseumHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const input = getValidated<CreateMuseumInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const museum = await museumService.createMuseum(req.user.id, input);
  sendSuccess(res, museum, HttpStatus.CREATED, 'Museum created successfully');
}

export async function updateMuseumHandler(_req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const input = getValidated<UpdateMuseumInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const updated = await museumService.updateMuseum(museum.id, input);
  sendSuccess(res, updated, HttpStatus.OK, 'Museum updated successfully');
}

export async function updateSettingsHandler(_req: Request, res: Response): Promise<void> {
  const museum = res.locals.museum;
  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  const input = getValidated<UpdateMuseumSettingsInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const updated = await museumService.updateSettings(museum.id, input);
  sendSuccess(res, updated, HttpStatus.OK, 'Settings updated successfully');
}

