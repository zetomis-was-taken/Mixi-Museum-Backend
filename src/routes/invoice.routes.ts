import { Router } from 'express';
import {
  myInvoiceDetailHandler,
  myInvoicesHandler,
} from '../controllers/invoice.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { queryInvoicesSchema } from '../validators/invoice.validator.js';

export const invoiceRouter = Router();

invoiceRouter.get(
  '/invoices',
  requireAuth,
  validate({ query: queryInvoicesSchema }),
  myInvoicesHandler,
);

invoiceRouter.get(
  '/invoices/:invoiceId',
  requireAuth,
  myInvoiceDetailHandler,
);

