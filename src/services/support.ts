import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { museums } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';

export type MuseumFeature = 'shop' | 'tickets';

type Museum = typeof museums.$inferSelect;

function featureEnabled(museum: Museum, feature: MuseumFeature): boolean {
  return feature === 'shop' ? museum.shopEnabled : museum.ticketsEnabled;
}

export function featureUnavailableMessage(feature: MuseumFeature): string {
  return feature === 'shop'
    ? 'Merchandise is not available for this museum'
    : 'Tickets are not available for this museum';
}

/** Loads a museum by id and rejects when the requested feature flag is off. */
export async function requireMuseumFeature(
  database: Database,
  museumId: string,
  feature: MuseumFeature,
): Promise<Museum> {
  const [museum] = await database.select().from(museums).where(eq(museums.id, museumId)).limit(1);

  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  if (!featureEnabled(museum, feature)) {
    throw AppError.notFound(featureUnavailableMessage(feature));
  }

  return museum;
}

/**
 * Resolves a public museum by slug. Public catalogue/shop/ticket reads require the
 * museum to be `published`, optionally with the shop/ticket feature enabled.
 */
export async function requirePublishedMuseumBySlug(
  database: Database,
  slug: string,
  feature?: MuseumFeature,
): Promise<Museum> {
  const [museum] = await database
    .select()
    .from(museums)
    .where(and(eq(museums.slug, slug.trim()), eq(museums.visibilityStatus, 'published')))
    .limit(1);

  if (!museum) {
    throw AppError.notFound('Museum not found');
  }

  if (feature && !featureEnabled(museum, feature)) {
    throw AppError.notFound(featureUnavailableMessage(feature));
  }

  return museum;
}
