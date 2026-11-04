import { and, asc, eq } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { tags } from '../db/schemas/index.js';
import { isUniqueViolation } from '../utils/db-errors.js';
import { AppError } from '../utils/errors.js';
import { assertNonEmpty, assertSlug } from '../utils/validation.js';

type Tag = typeof tags.$inferSelect;

export interface CreateTagInput {
  name: string;
  slug: string;
}

export interface UpdateTagInput {
  name?: string;
  slug?: string;
}

export function createTagService(database: Database) {
  async function listTags(museumId: string): Promise<Tag[]> {
    return database
      .select()
      .from(tags)
      .where(eq(tags.museumId, museumId))
      .orderBy(asc(tags.name));
  }

  async function createTag(museumId: string, input: CreateTagInput): Promise<Tag> {
    try {
      const [tag] = await database
        .insert(tags)
        .values({
          museumId,
          name: assertNonEmpty(input.name, 'name'),
          slug: assertSlug(input.slug),
        })
        .returning();

      if (!tag) {
        throw new Error('Tag insert returned no row');
      }

      return tag;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A tag with this slug already exists');
      }
      throw error;
    }
  }

  async function updateTag(
    museumId: string,
    tagId: string,
    input: UpdateTagInput,
  ): Promise<Tag> {
    const values: Partial<typeof tags.$inferInsert> = {};

    if (input.name !== undefined) {
      values.name = assertNonEmpty(input.name, 'name');
    }
    if (input.slug !== undefined) {
      values.slug = assertSlug(input.slug);
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No tag fields to update');
    }

    try {
      const [updated] = await database
        .update(tags)
        .set(values)
        .where(and(eq(tags.id, tagId), eq(tags.museumId, museumId)))
        .returning();

      if (!updated) {
        throw AppError.notFound('Tag not found');
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A tag with this slug already exists');
      }
      throw error;
    }
  }

  /** Deletes a tag; `collection_tags` memberships cascade. */
  async function deleteTag(museumId: string, tagId: string): Promise<Tag> {
    const [deleted] = await database
      .delete(tags)
      .where(and(eq(tags.id, tagId), eq(tags.museumId, museumId)))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Tag not found');
    }

    return deleted;
  }

  return { listTags, createTag, updateTag, deleteTag };
}

export const tagService = createTagService(db);
