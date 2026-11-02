import { count, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminTiers, museumAdmins, museums, userRoles } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import { type PaginatedResult, buildPaginationResult, parsePagination } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';
import type {
  CreateMuseumInput,
  QueryMuseumsInput,
  UpdateMuseumInput,
  UpdateMuseumSettingsInput,
} from '../validators/museum.validator.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class MuseumService {
  async listMuseums(query: QueryMuseumsInput): Promise<PaginatedResult<typeof museums.$inferSelect>> {
    const { page, limit, offset } = parsePagination(query);

    const filter = query.q ? ilike(museums.name, `%${query.q}%`) : undefined;

    const [totalRow] = await db
      .select({ total: count() })
      .from(museums)
      .where(filter);

    const total = totalRow?.total ? Number(totalRow.total) : 0;

    const items = await db
      .select()
      .from(museums)
      .where(filter)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(museums.createdAt));

    return buildPaginationResult(items, total, page, limit);
  }

  async getMuseumBySlugOrId(identifier: string): Promise<typeof museums.$inferSelect> {
    const filter = UUID_REGEX.test(identifier)
      ? eq(museums.id, identifier)
      : eq(museums.slug, identifier);

    const [museum] = await db
      .select()
      .from(museums)
      .where(filter);

    if (!museum) {
      throw AppError.notFound('Museum not found');
    }

    return museum;
  }

  async createMuseum(userId: string, input: CreateMuseumInput): Promise<typeof museums.$inferSelect> {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);

    if (!slug) {
      throw AppError.badRequest('Unable to generate a valid slug from the museum name');
    }

    const [existing] = await db
      .select({ id: museums.id })
      .from(museums)
      .where(eq(museums.slug, slug));

    if (existing) {
      throw AppError.conflict('A museum with this slug already exists');
    }

    return db.transaction(async (tx) => {
      const [museum] = await tx
        .insert(museums)
        .values({
          name: input.name,
          slug,
          description: input.description,
          address: input.address,
          latitude: input.latitude,
          longitude: input.longitude,
          coverImagePath: input.coverImagePath,
          currency: input.currency ?? 'USD',
          shopEnabled: input.shopEnabled ?? false,
          ticketsEnabled: input.ticketsEnabled ?? false,
        })
        .returning();

      if (!museum) {
        throw new AppError('Failed to create museum');
      }

      // Seed default admin tiers per museum design
      const [founderTier] = await tx
        .insert(adminTiers)
        .values({
          museumId: museum.id,
          name: 'Founder',
          permissions: { manage_all: true },
        })
        .returning();

      await tx.insert(adminTiers).values([
        {
          museumId: museum.id,
          name: 'Project organizer',
          permissions: {},
        },
        {
          museumId: museum.id,
          name: 'Volunteer',
          permissions: {},
        },
      ]);

      // Ensure user has admin role
      await tx
        .insert(userRoles)
        .values({
          userId,
          role: 'admin',
        })
        .onConflictDoNothing();

      // Add user as museum owner with Founder tier
      await tx.insert(museumAdmins).values({
        museumId: museum.id,
        userId,
        tierId: founderTier?.id ?? null,
        isOwner: true,
      });

      return museum;
    });
  }

  async updateMuseum(
    museumId: string,
    input: UpdateMuseumInput,
  ): Promise<typeof museums.$inferSelect> {
    const [updated] = await db
      .update(museums)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(museums.id, museumId))
      .returning();

    if (!updated) {
      throw AppError.notFound('Museum not found');
    }

    return updated;
  }

  async updateSettings(
    museumId: string,
    input: UpdateMuseumSettingsInput,
  ): Promise<typeof museums.$inferSelect> {
    const [updated] = await db
      .update(museums)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(museums.id, museumId))
      .returning();

    if (!updated) {
      throw AppError.notFound('Museum not found');
    }

    return updated;
  }
}

export const museumService = new MuseumService();

