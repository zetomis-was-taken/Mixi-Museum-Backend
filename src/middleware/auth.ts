import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { museumAdmins, museums } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import { type UserRole, verifyToken } from '../utils/jwt.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: UserRole[];
}

export interface MuseumAdminContext {
  museumId: string;
  isOwner: boolean;
  tierId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function extractIdentifier(req: Request, paramKey?: string): string {
  const key = paramKey ?? (req.params.slug ? 'slug' : req.params.museumId ? 'museumId' : 'id');
  const raw = req.params[key];
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value || typeof value !== 'string') {
    throw AppError.badRequest(`Missing museum identifier parameter (${key})`);
  }

  return value.trim();
}

/**
 * Middleware requiring a valid JWT Bearer token.
 * Populates req.user and res.locals.user.
 */
export const requireAuth: RequestHandler = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw AppError.unauthorized('Missing or malformed Authorization header');
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = verifyToken(token);
    const user: AuthenticatedUser = {
      id: payload.sub,
      email: payload.email,
      roles: payload.roles,
    };

    req.user = user;
    res.locals.user = user;
    next();
  } catch (_err) {
    throw AppError.unauthorized('Invalid or expired authentication token');
  }
};

/**
 * Middleware ensuring the authenticated user has the 'admin' role.
 */
export const requireAdminRole: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  if (!req.user.roles.includes('admin')) {
    throw AppError.forbidden('Admin role required for this action');
  }

  next();
};

/**
 * Middleware ensuring the authenticated user is an admin of the specified museum.
 * Populates res.locals.museum and res.locals.museumAdmin.
 */
export function requireMuseumMember(paramKey?: string): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw AppError.unauthorized('Authentication required');
    }

    const identifier = extractIdentifier(req, paramKey);
    const museumFilter = UUID_REGEX.test(identifier)
      ? eq(museums.id, identifier)
      : eq(museums.slug, identifier);

    const rows = await db
      .select({
        museumId: museums.id,
        museumSlug: museums.slug,
        museumName: museums.name,
        shopEnabled: museums.shopEnabled,
        ticketsEnabled: museums.ticketsEnabled,
        currency: museums.currency,
        isOwner: museumAdmins.isOwner,
        tierId: museumAdmins.tierId,
      })
      .from(museumAdmins)
      .innerJoin(museums, eq(museumAdmins.museumId, museums.id))
      .where(and(eq(museumAdmins.userId, req.user.id), museumFilter));

    const membership = rows[0];

    if (!membership) {
      throw AppError.forbidden('You are not a member of this museum');
    }

    res.locals.museum = {
      id: membership.museumId,
      slug: membership.museumSlug,
      name: membership.museumName,
      shopEnabled: membership.shopEnabled,
      ticketsEnabled: membership.ticketsEnabled,
      currency: membership.currency,
    };

    res.locals.museumAdmin = {
      museumId: membership.museumId,
      isOwner: membership.isOwner,
      tierId: membership.tierId,
    };

    next();
  };
}

/**
 * Middleware ensuring the authenticated museum admin has owner privileges (is_owner = true).
 */
export const requireOwner: RequestHandler = (_req, res, next) => {
  const admin = res.locals.museumAdmin as MuseumAdminContext | undefined;

  if (!admin || !admin.isOwner) {
    throw AppError.forbidden('Museum owner permissions required');
  }

  next();
};

/**
 * Middleware ensuring a museum feature flag is enabled (shop_enabled or tickets_enabled).
 */
export function requireFeature(
  feature: 'shop_enabled' | 'tickets_enabled',
  paramKey?: string,
): RequestHandler {
  const propertyKey = feature === 'shop_enabled' ? 'shopEnabled' : 'ticketsEnabled';

  return async (req: Request, res: Response, next: NextFunction) => {
    let museum = res.locals.museum;

    if (!museum) {
      const identifier = extractIdentifier(req, paramKey);
      const museumFilter = UUID_REGEX.test(identifier)
        ? eq(museums.id, identifier)
        : eq(museums.slug, identifier);

      const [found] = await db
        .select()
        .from(museums)
        .where(museumFilter);

      if (!found) {
        throw AppError.notFound('Museum not found');
      }

      museum = found;
      res.locals.museum = found;
    }

    if (!museum[propertyKey]) {
      throw AppError.forbidden(`The ${feature} feature is disabled for this museum`);
    }

    next();
  };
}
