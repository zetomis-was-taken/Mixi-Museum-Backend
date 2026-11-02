import type { Request, Response } from 'express';
import { getValidated } from '../middleware/validate.js';
import { invoiceService } from '../services/invoice.service.js';
import { museumService } from '../services/museum.service.js';
import { AppError } from '../utils/errors.js';
import { HttpStatus, sendSuccess } from '../utils/response.js';
import type { QueryInvoicesInput } from '../validators/invoice.validator.js';

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

/**
 * Handles checking out the user's cart for merchandise.
 */
export async function checkoutCartHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const museumId = await resolveMuseumId(req, res);
  const invoice = await invoiceService.checkoutCart(req.user.id, museumId);

  sendSuccess(res, invoice, HttpStatus.CREATED, 'Checkout completed successfully');
}

/**
 * Lists purchase invoices for the current authenticated user.
 */
export async function myInvoicesHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const query = getValidated<QueryInvoicesInput>(res, 'query') ?? req.query;
  const result = await invoiceService.listUserInvoices(req.user.id, query);

  sendSuccess(res, result);
}

/**
 * Retrieves a single invoice for the current authenticated user.
 */
export async function myInvoiceDetailHandler(req: Request, res: Response): Promise<void> {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const invoiceId = getParam(req, 'invoiceId');
  const invoice = await invoiceService.getUserInvoice(req.user.id, invoiceId);

  sendSuccess(res, invoice);
}

/**
 * Admin handler to list invoices for their museum.
 */
export async function museumInvoicesHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const query = getValidated<QueryInvoicesInput>(res, 'query') ?? req.query;
  const result = await invoiceService.listMuseumInvoices(museumId, query);

  sendSuccess(res, result);
}

/**
 * Admin handler to retrieve single invoice detail in their museum.
 */
export async function museumInvoiceDetailHandler(req: Request, res: Response): Promise<void> {
  const museumId = await resolveMuseumId(req, res);
  const invoiceId = getParam(req, 'invoiceId');
  const invoice = await invoiceService.getMuseumInvoice(museumId, invoiceId);

  sendSuccess(res, invoice);
}

