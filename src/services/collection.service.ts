import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import { collectionImages, collections, collectionTags, tags } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import { type PaginatedResult, buildPaginationResult, parsePagination } from '../utils/pagination.js';
import { slugify } from '../utils/slug.js';
import type {
  AddCollectionImageInput,
  ContentStatus,
  CreateCollectionInput,
  CreateTagInput,
  QueryCollectionsInput,
  UpdateCollectionImageInput,
  UpdateCollectionInput,
} from '../validators/collection.validator.js';

export interface CollectionWithDetails {
  id: string;
  museumId: string;
  title: string;
  slug: string;
  description: string | null;
  status: ContentStatus;
  createdAt: Date;
  updatedAt: Date;
  images: Array<{
    id: string;
    storagePath: string;
    altText: string | null;
    position: number;
    createdAt: Date;
  }>;
  tags: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

export class CollectionService {
  async listPublicCollections(
    museumId: string,
    query: QueryCollectionsInput,
  ): Promise<PaginatedResult<typeof collections.$inferSelect>> {
    const { page, limit, offset } = parsePagination(query);

    const conditions = [
      eq(collections.museumId, museumId),
      eq(collections.status, 'published'),
    ];

    if (query.q) {
      conditions.push(ilike(collections.title, `%${query.q}%`));
    }

    const whereClause = and(...conditions);

    const [totalRow] = await db
      .select({ total: count() })
      .from(collections)
      .where(whereClause);

    const total = totalRow?.total ? Number(totalRow.total) : 0;

    const items = await db
      .select()
      .from(collections)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(collections.createdAt));

    return buildPaginationResult(items, total, page, limit);
  }

  async getPublicCollectionBySlug(
    museumId: string,
    slug: string,
  ): Promise<CollectionWithDetails> {
    const [collection] = await db
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.museumId, museumId),
          eq(collections.slug, slug),
          eq(collections.status, 'published'),
        ),
      );

    if (!collection) {
      throw AppError.notFound('Collection not found');
    }

    const images = await db
      .select()
      .from(collectionImages)
      .where(eq(collectionImages.collectionId, collection.id))
      .orderBy(asc(collectionImages.position));

    const collectionTagsList = await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
      })
      .from(collectionTags)
      .innerJoin(tags, eq(collectionTags.tagId, tags.id))
      .where(eq(collectionTags.collectionId, collection.id));

    return {
      ...collection,
      images,
      tags: collectionTagsList,
    };
  }

  async listAdminCollections(
    museumId: string,
    query: QueryCollectionsInput,
  ): Promise<PaginatedResult<typeof collections.$inferSelect>> {
    const { page, limit, offset } = parsePagination(query);

    const conditions = [eq(collections.museumId, museumId)];

    if (query.status) {
      conditions.push(eq(collections.status, query.status));
    }

    if (query.q) {
      conditions.push(ilike(collections.title, `%${query.q}%`));
    }

    const whereClause = and(...conditions);

    const [totalRow] = await db
      .select({ total: count() })
      .from(collections)
      .where(whereClause);

    const total = totalRow?.total ? Number(totalRow.total) : 0;

    const items = await db
      .select()
      .from(collections)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(collections.createdAt));

    return buildPaginationResult(items, total, page, limit);
  }

  async getAdminCollection(
    museumId: string,
    collectionId: string,
  ): Promise<CollectionWithDetails> {
    const [collection] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)));

    if (!collection) {
      throw AppError.notFound('Collection not found in this museum');
    }

    const images = await db
      .select()
      .from(collectionImages)
      .where(eq(collectionImages.collectionId, collection.id))
      .orderBy(asc(collectionImages.position));

    const collectionTagsList = await db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
      })
      .from(collectionTags)
      .innerJoin(tags, eq(collectionTags.tagId, tags.id))
      .where(eq(collectionTags.collectionId, collection.id));

    return {
      ...collection,
      images,
      tags: collectionTagsList,
    };
  }

  async createCollection(
    museumId: string,
    input: CreateCollectionInput,
  ): Promise<typeof collections.$inferSelect> {
    const slug = input.slug ? slugify(input.slug) : slugify(input.title);

    if (!slug) {
      throw AppError.badRequest('Unable to generate a valid slug from the collection title');
    }

    const [existing] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.museumId, museumId), eq(collections.slug, slug)));

    if (existing) {
      throw AppError.conflict('A collection with this slug already exists in this museum');
    }

    return db.transaction(async (tx) => {
      const [collection] = await tx
        .insert(collections)
        .values({
          museumId,
          title: input.title,
          slug,
          description: input.description ?? null,
          status: 'draft',
        })
        .returning();

      if (!collection) {
        throw new AppError('Failed to create collection');
      }

      if (input.tagIds && input.tagIds.length > 0) {
        await tx.insert(collectionTags).values(
          input.tagIds.map((tagId) => ({
            collectionId: collection.id,
            tagId,
          })),
        );
      }

      return collection;
    });
  }

  async updateCollection(
    museumId: string,
    collectionId: string,
    input: UpdateCollectionInput,
  ): Promise<typeof collections.$inferSelect> {
    const [current] = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)));

    if (!current) {
      throw AppError.notFound('Collection not found in this museum');
    }

    let slug = current.slug;
    if (input.slug || (input.title && input.title !== current.title)) {
      slug = input.slug ? slugify(input.slug) : slugify(input.title!);
      if (slug !== current.slug) {
        const [existing] = await db
          .select({ id: collections.id })
          .from(collections)
          .where(and(eq(collections.museumId, museumId), eq(collections.slug, slug)));

        if (existing) {
          throw AppError.conflict('A collection with this slug already exists in this museum');
        }
      }
    }

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(collections)
        .set({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.description !== undefined && { description: input.description }),
          slug,
          updatedAt: new Date(),
        })
        .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)))
        .returning();

      if (!updated) {
        throw AppError.notFound('Collection not found');
      }

      if (input.tagIds !== undefined) {
        await tx
          .delete(collectionTags)
          .where(eq(collectionTags.collectionId, collectionId));

        if (input.tagIds.length > 0) {
          await tx.insert(collectionTags).values(
            input.tagIds.map((tagId) => ({
              collectionId,
              tagId,
            })),
          );
        }
      }

      return updated;
    });
  }

  async updateStatus(
    museumId: string,
    collectionId: string,
    status: ContentStatus,
  ): Promise<typeof collections.$inferSelect> {
    const [updated] = await db
      .update(collections)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)))
      .returning();

    if (!updated) {
      throw AppError.notFound('Collection not found in this museum');
    }

    return updated;
  }

  async deleteCollection(museumId: string, collectionId: string): Promise<void> {
    const [deleted] = await db
      .delete(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Collection not found in this museum');
    }
  }

  // --- Collection Images ---

  async addImage(
    museumId: string,
    collectionId: string,
    input: AddCollectionImageInput,
  ): Promise<typeof collectionImages.$inferSelect> {
    const [collection] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)));

    if (!collection) {
      throw AppError.notFound('Collection not found in this museum');
    }

    const [image] = await db
      .insert(collectionImages)
      .values({
        collectionId,
        storagePath: input.storagePath,
        altText: input.altText ?? null,
        position: input.position ?? 0,
      })
      .returning();

    if (!image) {
      throw new AppError('Failed to add collection image');
    }

    return image;
  }

  async updateImage(
    museumId: string,
    collectionId: string,
    imageId: string,
    input: UpdateCollectionImageInput,
  ): Promise<typeof collectionImages.$inferSelect> {
    const [collection] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)));

    if (!collection) {
      throw AppError.notFound('Collection not found in this museum');
    }

    const [updated] = await db
      .update(collectionImages)
      .set(input)
      .where(
        and(
          eq(collectionImages.id, imageId),
          eq(collectionImages.collectionId, collectionId),
        ),
      )
      .returning();

    if (!updated) {
      throw AppError.notFound('Image not found in this collection');
    }

    return updated;
  }

  async removeImage(
    museumId: string,
    collectionId: string,
    imageId: string,
  ): Promise<void> {
    const [collection] = await db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)));

    if (!collection) {
      throw AppError.notFound('Collection not found in this museum');
    }

    const [deleted] = await db
      .delete(collectionImages)
      .where(
        and(
          eq(collectionImages.id, imageId),
          eq(collectionImages.collectionId, collectionId),
        ),
      )
      .returning();

    if (!deleted) {
      throw AppError.notFound('Image not found in this collection');
    }
  }

  // --- Tags ---

  async listMuseumTags(museumId: string): Promise<typeof tags.$inferSelect[]> {
    return db
      .select()
      .from(tags)
      .where(eq(tags.museumId, museumId))
      .orderBy(asc(tags.name));
  }

  async createMuseumTag(
    museumId: string,
    input: CreateTagInput,
  ): Promise<typeof tags.$inferSelect> {
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);

    if (!slug) {
      throw AppError.badRequest('Unable to generate valid slug from tag name');
    }

    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(and(eq(tags.museumId, museumId), eq(tags.slug, slug)));

    if (existing) {
      throw AppError.conflict('A tag with this name already exists in this museum');
    }

    const [tag] = await db
      .insert(tags)
      .values({
        museumId,
        name: input.name,
        slug,
      })
      .returning();

    if (!tag) {
      throw new AppError('Failed to create tag');
    }

    return tag;
  }

  async deleteMuseumTag(museumId: string, tagId: string): Promise<void> {
    const [deleted] = await db
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.museumId, museumId)))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Tag not found in this museum');
    }
  }
}

export const collectionService = new CollectionService();

