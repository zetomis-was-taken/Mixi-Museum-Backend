import { Router } from 'express';
import {
  addImageHandler,
  createCollectionHandler,
  createMuseumTagHandler,
  deleteCollectionHandler,
  deleteMuseumTagHandler,
  getAdminCollectionHandler,
  getPublicCollectionHandler,
  listAdminCollectionsHandler,
  listMuseumTagsHandler,
  listPublicCollectionsHandler,
  removeImageHandler,
  updateCollectionHandler,
  updateCollectionStatusHandler,
  updateImageHandler,
} from '../controllers/collection.controller.js';
import {
  requireAdminRole,
  requireAuth,
  requireMuseumMember,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  addCollectionImageSchema,
  createCollectionSchema,
  createTagSchema,
  queryCollectionsSchema,
  updateCollectionImageSchema,
  updateCollectionSchema,
  updateCollectionStatusSchema,
} from '../validators/collection.validator.js';

export const collectionRouter = Router({ mergeParams: true });

// --- Public Routes ---
collectionRouter.get(
  '/',
  validate({ query: queryCollectionsSchema }),
  listPublicCollectionsHandler,
);

collectionRouter.get('/tags', listMuseumTagsHandler);

collectionRouter.get('/:collectionSlug', getPublicCollectionHandler);

// --- Admin Management Routes ---
collectionRouter.get(
  '/admin/all',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ query: queryCollectionsSchema }),
  listAdminCollectionsHandler,
);

collectionRouter.get(
  '/admin/:collectionId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  getAdminCollectionHandler,
);

collectionRouter.post(
  '/admin',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ body: createCollectionSchema }),
  createCollectionHandler,
);

collectionRouter.patch(
  '/admin/:collectionId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ body: updateCollectionSchema }),
  updateCollectionHandler,
);

collectionRouter.patch(
  '/admin/:collectionId/status',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ body: updateCollectionStatusSchema }),
  updateCollectionStatusHandler,
);

collectionRouter.delete(
  '/admin/:collectionId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  deleteCollectionHandler,
);

// --- Images Management ---
collectionRouter.post(
  '/admin/:collectionId/images',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ body: addCollectionImageSchema }),
  addImageHandler,
);

collectionRouter.patch(
  '/admin/:collectionId/images/:imageId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ body: updateCollectionImageSchema }),
  updateImageHandler,
);

collectionRouter.delete(
  '/admin/:collectionId/images/:imageId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  removeImageHandler,
);

// --- Tags Management ---
collectionRouter.post(
  '/tags',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ body: createTagSchema }),
  createMuseumTagHandler,
);

collectionRouter.delete(
  '/tags/:tagId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  deleteMuseumTagHandler,
);

