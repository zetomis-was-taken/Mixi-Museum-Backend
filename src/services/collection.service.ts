import { and, asc, count, desc, eq, exists, ilike, inArray } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { collectionImages, collectionTags, collections, tags } from '../db/schemas/index.js';
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
import { requirePublishedMuseumBySlug } from './support.js';

type Collection = typeof collections.$inferSelect;
type CollectionImage = typeof collectionImages.$inferSelect;
type CollectionStatus = Collection['status'];

export interface PublicCollectionListQuery extends PaginationQuery {
  tag?: string;
}

export interface AdminCollectionListQuery extends PaginationQuery {
  q?: string;
  status?: CollectionStatus;
}

export interface CreateCollectionInput {
  title: string;
  slug: string;
  description?: string | null;
  status?: CollectionStatus;
}

export interface UpdateCollectionInput {
  title?: string;
  slug?: string;
  description?: string | null;
  status?: CollectionStatus;
}

export interface AddCollectionImageInput {
  storagePath: string;
  altText?: string | null;
  position?: number;
}

export interface UpdateCollectionImageInput {
  altText?: string | null;
  position?: number;
}

export function createCollectionService(database: Database) {
  async function requireCollection(
    museumId: string,
    collectionId: string,
  ): Promise<Collection> {
    const [collection] = await database
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)))
      .limit(1);

    if (!collection) {
      throw AppError.notFound('Collection not found');
    }

    return collection;
  }

  async function listImages(collectionId: string): Promise<CollectionImage[]> {
    return database
      .select()
      .from(collectionImages)
      .where(eq(collectionImages.collectionId, collectionId))
      .orderBy(asc(collectionImages.position), asc(collectionImages.createdAt));
  }

  async function listCollectionTags(collectionId: string) {
    return database
      .select({ id: tags.id, name: tags.name, slug: tags.slug })
      .from(collectionTags)
      .innerJoin(tags, eq(tags.id, collectionTags.tagId))
      .where(eq(collectionTags.collectionId, collectionId))
      .orderBy(asc(tags.name));
  }

  async function listPublishedCollections(
    museumSlug: string,
    query: PublicCollectionListQuery = {},
  ): Promise<Paginated<Collection>> {
    const museum = await requirePublishedMuseumBySlug(database, museumSlug);
    const pagination = parsePagination(query);
    const tagSlug = query.tag?.trim();

    const tagFilter = tagSlug
      ? exists(
          database
            .select({ id: collectionTags.collectionId })
            .from(collectionTags)
            .innerJoin(tags, eq(tags.id, collectionTags.tagId))
            .where(
              and(
                eq(collectionTags.collectionId, collections.id),
                eq(collectionTags.museumId, museum.id),
                eq(tags.slug, tagSlug),
              ),
            ),
        )
      : undefined;

    const where = and(
      eq(collections.museumId, museum.id),
      eq(collections.status, 'published'),
      tagFilter,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(collections)
        .where(where)
        .orderBy(asc(collections.title))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(collections).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getPublishedCollection(museumSlug: string, collectionSlug: string) {
    const museum = await requirePublishedMuseumBySlug(database, museumSlug);
    const [collection] = await database
      .select()
      .from(collections)
      .where(
        and(
          eq(collections.museumId, museum.id),
          eq(collections.slug, assertSlug(collectionSlug)),
          eq(collections.status, 'published'),
        ),
      )
      .limit(1);

    if (!collection) {
      throw AppError.notFound('Collection not found');
    }

    const [images, collectionTagRows] = await Promise.all([
      listImages(collection.id),
      listCollectionTags(collection.id),
    ]);

    return { collection, images, tags: collectionTagRows };
  }

  async function listCollections(
    museumId: string,
    query: AdminCollectionListQuery = {},
  ): Promise<Paginated<Collection>> {
    const pagination = parsePagination(query);
    const term = query.q?.trim();

    const where = and(
      eq(collections.museumId, museumId),
      term ? ilike(collections.title, containsPattern(term)) : undefined,
      query.status ? eq(collections.status, query.status) : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(collections)
        .where(where)
        .orderBy(desc(collections.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(collections).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getCollection(museumId: string, collectionId: string) {
    const collection = await requireCollection(museumId, collectionId);
    const [images, collectionTagRows] = await Promise.all([
      listImages(collection.id),
      listCollectionTags(collection.id),
    ]);

    return { collection, images, tags: collectionTagRows };
  }

  async function createCollection(
    museumId: string,
    input: CreateCollectionInput,
  ): Promise<Collection> {
    try {
      const [collection] = await database
        .insert(collections)
        .values({
          museumId,
          title: assertNonEmpty(input.title, 'title'),
          slug: assertSlug(input.slug),
          description: input.description?.trim() || null,
          status: input.status ?? 'draft',
        })
        .returning();

      if (!collection) {
        throw new Error('Collection insert returned no row');
      }

      return collection;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A collection with this slug already exists');
      }
      throw error;
    }
  }

  async function updateCollection(
    museumId: string,
    collectionId: string,
    input: UpdateCollectionInput,
  ): Promise<Collection> {
    await requireCollection(museumId, collectionId);

    const values: Partial<typeof collections.$inferInsert> = {};

    if (input.title !== undefined) {
      values.title = assertNonEmpty(input.title, 'title');
    }
    if (input.slug !== undefined) {
      values.slug = assertSlug(input.slug);
    }
    if (input.description !== undefined) {
      values.description = input.description?.trim() || null;
    }
    if (input.status !== undefined) {
      values.status = input.status;
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No collection fields to update');
    }

    values.updatedAt = new Date();

    try {
      const [updated] = await database
        .update(collections)
        .set(values)
        .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)))
        .returning();

      if (!updated) {
        throw AppError.notFound('Collection not found');
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A collection with this slug already exists');
      }
      throw error;
    }
  }

  async function setCollectionStatus(
    museumId: string,
    collectionId: string,
    status: CollectionStatus,
  ): Promise<Collection> {
    const [updated] = await database
      .update(collections)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)))
      .returning();

    if (!updated) {
      throw AppError.notFound('Collection not found');
    }

    return updated;
  }

  async function publishCollection(museumId: string, collectionId: string) {
    return setCollectionStatus(museumId, collectionId, 'published');
  }

  async function archiveCollection(museumId: string, collectionId: string) {
    return setCollectionStatus(museumId, collectionId, 'archived');
  }

  /** Deletes a collection; images and tag memberships cascade. */
  async function deleteCollection(
    museumId: string,
    collectionId: string,
  ): Promise<Collection> {
    const [deleted] = await database
      .delete(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.museumId, museumId)))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Collection not found');
    }

    return deleted;
  }

  async function addImage(
    museumId: string,
    collectionId: string,
    input: AddCollectionImageInput,
  ): Promise<CollectionImage> {
    await requireCollection(museumId, collectionId);

    const [image] = await database
      .insert(collectionImages)
      .values({
        collectionId,
        storagePath: assertNonEmpty(input.storagePath, 'storage_path'),
        altText: input.altText?.trim() || null,
        position: assertPosition(input.position),
      })
      .returning();

    if (!image) {
      throw new Error('Collection image insert returned no row');
    }

    return image;
  }

  async function updateImage(
    museumId: string,
    collectionId: string,
    imageId: string,
    input: UpdateCollectionImageInput,
  ): Promise<CollectionImage> {
    await requireCollectionImage(museumId, collectionId, imageId);

    const values: Partial<typeof collectionImages.$inferInsert> = {};

    if (input.altText !== undefined) {
      values.altText = input.altText?.trim() || null;
    }
    if (input.position !== undefined) {
      values.position = assertPosition(input.position);
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No image fields to update');
    }

    const [updated] = await database
      .update(collectionImages)
      .set(values)
      .where(eq(collectionImages.id, imageId))
      .returning();

    if (!updated) {
      throw AppError.notFound('Collection image not found');
    }

    return updated;
  }

  async function deleteImage(
    museumId: string,
    collectionId: string,
    imageId: string,
  ): Promise<CollectionImage> {
    await requireCollectionImage(museumId, collectionId, imageId);

    const [deleted] = await database
      .delete(collectionImages)
      .where(eq(collectionImages.id, imageId))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Collection image not found');
    }

    return deleted;
  }

  /**
   * Replaces the collection's tag associations. Every tag must belong to the same
   * museum as the collection.
   */
  async function replaceCollectionTags(
    museumId: string,
    collectionId: string,
    tagIds: string[],
  ) {
    await requireCollection(museumId, collectionId);

    const uniqueTagIds = [...new Set(tagIds)];

    if (uniqueTagIds.length > 0) {
      const found = await database
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.museumId, museumId), inArray(tags.id, uniqueTagIds)));

      if (found.length !== uniqueTagIds.length) {
        throw AppError.badRequest('One or more tags do not belong to this museum', [
          { field: 'tag_ids', message: 'all tags must belong to the same museum' },
        ]);
      }
    }

    await database.transaction(async (tx) => {
      await tx.delete(collectionTags).where(eq(collectionTags.collectionId, collectionId));

      if (uniqueTagIds.length > 0) {
        await tx
          .insert(collectionTags)
          .values(uniqueTagIds.map((tagId) => ({ collectionId, tagId, museumId })));
      }
    });

    return listCollectionTags(collectionId);
  }

  async function requireCollectionImage(
    museumId: string,
    collectionId: string,
    imageId: string,
  ): Promise<CollectionImage> {
    const [image] = await database
      .select({ image: collectionImages })
      .from(collectionImages)
      .innerJoin(collections, eq(collections.id, collectionImages.collectionId))
      .where(
        and(
          eq(collectionImages.id, imageId),
          eq(collectionImages.collectionId, collectionId),
          eq(collections.museumId, museumId),
        ),
      )
      .limit(1);

    if (!image) {
      throw AppError.notFound('Collection image not found');
    }

    return image.image;
  }

  return {
    listPublishedCollections,
    getPublishedCollection,
    listCollections,
    getCollection,
    createCollection,
    updateCollection,
    publishCollection,
    archiveCollection,
    deleteCollection,
    addImage,
    updateImage,
    deleteImage,
    replaceCollectionTags,
  };
}

function assertPosition(position: number | undefined): number {
  if (position === undefined) {
    return 0;
  }

  if (!Number.isInteger(position) || position < 0) {
    throw AppError.badRequest('Invalid position', [
      { field: 'position', message: 'must be a non-negative integer' },
    ]);
  }

  return position;
}

export const collectionService = createCollectionService(db);
