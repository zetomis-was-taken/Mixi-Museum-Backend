import { Router } from 'express';
import {
  createTierHandler,
  deleteTierHandler,
  listTiersHandler,
  updateTierHandler,
} from '../controllers/admin-tier.controller.js';
import {
  checkoutCartHandler,
  museumInvoiceDetailHandler,
  museumInvoicesHandler,
} from '../controllers/invoice.controller.js';
import {
  addAdminHandler,
  listAdminsHandler,
  removeAdminHandler,
  updateAdminHandler,
} from '../controllers/museum-admin.controller.js';
import {
  createMuseumHandler,
  getMuseumHandler,
  listMuseumsHandler,
  updateMuseumHandler,
  updateSettingsHandler,
} from '../controllers/museum.controller.js';
import {
  requireAdminRole,
  requireAuth,
  requireFeature,
  requireMuseumMember,
  requireOwner,
} from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { queryInvoicesSchema } from '../validators/invoice.validator.js';
import {
  addMuseumAdminSchema,
  createAdminTierSchema,
  createMuseumSchema,
  queryMuseumsSchema,
  updateAdminTierSchema,
  updateMuseumAdminSchema,
  updateMuseumSchema,
  updateMuseumSettingsSchema,
} from '../validators/museum.validator.js';
import { collectionRouter } from './collection.routes.js';

export const museumRouter = Router();

// Nested collection routes
museumRouter.use('/:slug/collections', collectionRouter);

// Public routes
museumRouter.get('/', validate({ query: queryMuseumsSchema }), listMuseumsHandler);
museumRouter.get('/:slug', getMuseumHandler);

// Merchandise Cart Checkout route
museumRouter.post(
  '/:slug/cart/checkout',
  requireAuth,
  requireFeature('shop_enabled'),
  checkoutCartHandler,
);

// Protected museum management routes
museumRouter.post('/', requireAuth, validate({ body: createMuseumSchema }), createMuseumHandler);

museumRouter.patch(
  '/:slug',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ body: updateMuseumSchema }),
  updateMuseumHandler,
);

museumRouter.patch(
  '/:slug/settings',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  requireOwner,
  validate({ body: updateMuseumSettingsSchema }),
  updateSettingsHandler,
);

// Admin Invoices routes
museumRouter.get(
  '/:slug/admin/invoices',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  validate({ query: queryInvoicesSchema }),
  museumInvoicesHandler,
);

museumRouter.get(
  '/:slug/admin/invoices/:invoiceId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  museumInvoiceDetailHandler,
);

// Admin Tiers routes
museumRouter.get(
  '/:slug/admin-tiers',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  listTiersHandler,
);

museumRouter.post(
  '/:slug/admin-tiers',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  requireOwner,
  validate({ body: createAdminTierSchema }),
  createTierHandler,
);

museumRouter.patch(
  '/:slug/admin-tiers/:tierId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  requireOwner,
  validate({ body: updateAdminTierSchema }),
  updateTierHandler,
);

museumRouter.delete(
  '/:slug/admin-tiers/:tierId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  requireOwner,
  deleteTierHandler,
);

// Museum Admins routes
museumRouter.get(
  '/:slug/admins',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  listAdminsHandler,
);

museumRouter.post(
  '/:slug/admins',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  requireOwner,
  validate({ body: addMuseumAdminSchema }),
  addAdminHandler,
);

museumRouter.patch(
  '/:slug/admins/:adminId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  requireOwner,
  validate({ body: updateMuseumAdminSchema }),
  updateAdminHandler,
);

museumRouter.delete(
  '/:slug/admins/:adminId',
  requireAuth,
  requireAdminRole,
  requireMuseumMember(),
  requireOwner,
  removeAdminHandler,
);
