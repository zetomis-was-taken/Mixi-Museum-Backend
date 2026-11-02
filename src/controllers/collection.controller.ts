import type { Request, Response } from 'express';
import { getValidated } from '../middleware/validate.js';
import { collectionService } from '../services/collection.service.js';
import { museumService } from '../services/museum.service.js';
import { AppError } from '../utils/errors.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import type {
  AddCollectionImageInput,
  CreateCollectionInput,
  CreateTagInput,
  QueryCollectionsInput,
  UpdateCollectionImageInput,
  UpdateCollectionInput,
  UpdateCollectionStatusInput,
} from '../validators/collection.validator.js';

async function resolveMuseumId(req: Request, res: Response): Promise<string> {
  if (res.locals.museum?.id) {
    return res.locals.museum.id;
  }

  const rawSlug = req.params.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;

  if (!slug) {
    throw AppError.badRequest('Missing museum slug parameter');
  }

  const museum = await museumService.getMuseumBySlugOrId(slug);
  res.locals.museum = museum;
  return museum.id;
}

function getParam(req: Request, paramName: string): string {
  const raw = req.params[paramName];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) {
    throw AppError.badRequest(`Missing ${paramName} parameter`);
  }
  return value;
}

// --- Public Handlers ---

export async function listPublicCollectionsHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const query = getValidated<QueryCollectionsInput>(res, 'query') ?? req.query;
  const result = await collectionService.listPublicCollections(museumId, query);
  sendSuccess(res, result);
}

export async function getPublicCollectionHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionSlug = getParam(req, 'collectionSlug');
  const collection = await collectionService.getPublicCollectionBySlug(museumId, collectionSlug);
  sendSuccess(res, collection);
}

// --- Admin Handlers ---

export async function listAdminCollectionsHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const query = getValidated<QueryCollectionsInput>(res, 'query') ?? req.query;
  const result = await collectionService.listAdminCollections(museumId, query);
  sendSuccess(res, result);
}

export async function getAdminCollectionHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionId = getParam(req, 'collectionId');
  const collection = await collectionService.getAdminCollection(museumId, collectionId);
  sendSuccess(res, collection);
}

export async function createCollectionHandler(_req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(_req, res);
  const input = getValidated<CreateCollectionInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const collection = await collectionService.createCollection(museumId, input);
  sendSuccess(res, collection, HttpStatus.CREATED, 'Collection created successfully');
}

export async function updateCollectionHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionId = getParam(req, 'collectionId');
  const input = getValidated<UpdateCollectionInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const updated = await collectionService.updateCollection(museumId, collectionId, input);
  sendSuccess(res, updated, HttpStatus.OK, 'Collection updated successfully');
}

export async function updateCollectionStatusHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionId = getParam(req, 'collectionId');
  const input = getValidated<UpdateCollectionStatusInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const updated = await collectionService.updateStatus(museumId, collectionId, input.status);
  sendSuccess(res, updated, HttpStatus.OK, 'Collection status updated successfully');
}

export async function deleteCollectionHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionId = getParam(req, 'collectionId');

  await collectionService.deleteCollection(museumId, collectionId);
  sendSuccess(res, { success: true }, HttpStatus.OK, 'Collection deleted successfully');
}

// --- Image Handlers ---

export async function addImageHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionId = getParam(req, 'collectionId');
  const input = getValidated<AddCollectionImageInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const image = await collectionService.addImage(museumId, collectionId, input);
  sendSuccess(res, image, HttpStatus.CREATED, 'Image added successfully');
}

export async function updateImageHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionId = getParam(req, 'collectionId');
  const imageId = getParam(req, 'imageId');
  const input = getValidated<UpdateCollectionImageInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const updated = await collectionService.updateImage(museumId, collectionId, imageId, input);
  sendSuccess(res, updated, HttpStatus.OK, 'Image updated successfully');
}

export async function removeImageHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const collectionId = getParam(req, 'collectionId');
  const imageId = getParam(req, 'imageId');

  await collectionService.removeImage(museumId, collectionId, imageId);
  sendSuccess(res, { success: true }, HttpStatus.OK, 'Image removed successfully');
}

// --- Tag Handlers ---

export async function listMuseumTagsHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const tags = await collectionService.listMuseumTags(museumId);
  sendSuccess(res, tags);
}

export async function createMuseumTagHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const input = getValidated<CreateTagInput>(res, 'body');
  if (!input) {
    throw AppError.badRequest('Missing request body');
  }

  const tag = await collectionService.createMuseumTag(museumId, input);
  sendSuccess(res, tag, HttpStatus.CREATED, 'Tag created successfully');
}

export async function deleteMuseumTagHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const tagId = getParam(req, 'tagId');

  await collectionService.deleteMuseumTag(museumId, tagId);
  sendSuccess(res, { success: true }, HttpStatus.OK, 'Tag deleted successfully');
}

