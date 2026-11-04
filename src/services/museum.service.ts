import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { museums } from '../db/schemas/index.js';
import { isUniqueViolation } from '../utils/db-errors.js';
import { AppError } from '../utils/errors.js';
import {
  containsPattern,
  paginate,
  parsePagination,
  type Paginated,
  type PaginationQuery,
} from '../utils/query.js';
import { assertNonEmpty, assertSlug } from '../utils/validation.js';

type Museum = typeof museums.$inferSelect;
type VisibilityStatus = Museum['visibilityStatus'];

export interface PublicMuseumListQuery extends PaginationQuery {
  q?: string;
}

export interface UpdateMuseumInput {
  slug?: string;
  name?: string;
  description?: string | null;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  coverImagePath?: string | null;
  currency?: string;
  visibilityStatus?: VisibilityStatus;
  shopEnabled?: boolean;
  ticketsEnabled?: boolean;
}

const CURRENCY_PATTERN = /^[A-Z]{3}$/;

export function createMuseumService(database: Database) {
  async function getMuseum(museumId: string): Promise<Museum> {
    const [museum] = await database
      .select()
      .from(museums)
      .where(eq(museums.id, museumId))
      .limit(1);

    if (!museum) {
      throw AppError.notFound('Museum not found');
    }

    return museum;
  }

  async function listPublicMuseums(
    query: PublicMuseumListQuery = {},
  ): Promise<Paginated<Museum>> {
    const pagination = parsePagination(query);
    const term = query.q?.trim();
    const where = term
      ? and(
          eq(museums.visibilityStatus, 'published'),
          or(
            ilike(museums.name, containsPattern(term)),
            ilike(museums.slug, containsPattern(term)),
          ),
        )
      : eq(museums.visibilityStatus, 'published');

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(museums)
        .where(where)
        .orderBy(asc(museums.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(museums).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getPublicMuseumBySlug(slug: string): Promise<Museum> {
    const [museum] = await database
      .select()
      .from(museums)
      .where(
        and(eq(museums.slug, assertSlug(slug)), eq(museums.visibilityStatus, 'published')),
      )
      .limit(1);

    if (!museum) {
      throw AppError.notFound('Museum not found');
    }

    return museum;
  }

  /** Management view for an admin member; every visibility status is allowed. */
  async function getMuseumForAdmin(museumId: string): Promise<Museum> {
    return getMuseum(museumId);
  }

  /**
   * Updates museum settings. Owner-only checks (including the
   * `shop_enabled` / `tickets_enabled` toggles) are enforced by the route guards.
   */
  async function updateMuseum(
    museumId: string,
    input: UpdateMuseumInput,
  ): Promise<Museum> {
    await getMuseum(museumId);

    const values: Partial<typeof museums.$inferInsert> = {};

    if (input.slug !== undefined) {
      values.slug = assertSlug(input.slug);
    }
    if (input.name !== undefined) {
      values.name = assertNonEmpty(input.name, 'name');
    }
    if (input.description !== undefined) {
      values.description = input.description?.trim() || null;
    }
    if (input.address !== undefined) {
      values.address = input.address?.trim() || null;
    }
    if (input.latitude !== undefined) {
      values.latitude = assertCoordinate(input.latitude, 'latitude', 90);
    }
    if (input.longitude !== undefined) {
      values.longitude = assertCoordinate(input.longitude, 'longitude', 180);
    }
    if (input.coverImagePath !== undefined) {
      values.coverImagePath = input.coverImagePath?.trim() || null;
    }
    if (input.currency !== undefined) {
      const currency = input.currency.trim().toUpperCase();
      if (!CURRENCY_PATTERN.test(currency)) {
        throw AppError.badRequest('Invalid currency', [
          { field: 'currency', message: 'must be a three-letter ISO-4217 code' },
        ]);
      }
      values.currency = currency;
    }
    if (input.visibilityStatus !== undefined) {
      values.visibilityStatus = input.visibilityStatus;
    }
    if (input.shopEnabled !== undefined) {
      values.shopEnabled = input.shopEnabled;
    }
    if (input.ticketsEnabled !== undefined) {
      values.ticketsEnabled = input.ticketsEnabled;
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No museum fields to update');
    }

    values.updatedAt = new Date();

    try {
      const [updated] = await database
        .update(museums)
        .set(values)
        .where(eq(museums.id, museumId))
        .returning();

      if (!updated) {
        throw AppError.notFound('Museum not found');
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('Museum slug already exists');
      }
      throw error;
    }
  }

  return { listPublicMuseums, getPublicMuseumBySlug, getMuseumForAdmin, updateMuseum };
}

function assertCoordinate(
  value: string | null,
  field: 'latitude' | 'longitude',
  limit: number,
): string | null {
  if (value === null || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < -limit || parsed > limit) {
    throw AppError.badRequest(`Invalid ${field}`, [
      { field, message: `must be a number between -${limit} and ${limit}` },
    ]);
  }

  return value.trim();
}

export const museumService = createMuseumService(db);
