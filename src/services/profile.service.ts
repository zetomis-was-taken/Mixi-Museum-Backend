import { eq } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { users } from '../db/schemas/index.js';
import { isUniqueViolation } from '../utils/db-errors.js';
import { AppError } from '../utils/errors.js';
import { assertEmail, assertNonEmpty } from '../utils/validation.js';

export interface ProvisionProfileInput {
  id: string;
  email: string;
  displayName?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export interface UpdateProfileInput {
  displayName?: string;
  phone?: string | null;
  avatarUrl?: string | null;
}

type User = typeof users.$inferSelect;

export function createProfileService(database: Database) {
  async function findById(userId: string): Promise<User | undefined> {
    const [user] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
    return user;
  }

  /**
   * Returns the application profile for a Supabase user, creating it on first use.
   * The id comes from the verified token, never from the request body.
   */
  async function getOrCreateProfile(input: ProvisionProfileInput): Promise<User> {
    assertNonEmpty(input.id, 'id');
    const email = assertEmail(input.email);
    const existing = await findById(input.id);
    if (existing) {
      return existing;
    }

    const displayName =
      input.displayName?.trim() || email.split('@')[0] || email;

    try {
      const [created] = await database
        .insert(users)
        .values({
          id: input.id,
          email,
          displayName,
          phone: input.phone ?? null,
          avatarUrl: input.avatarUrl ?? null,
        })
        .onConflictDoNothing({ target: users.id })
        .returning();

      if (created) {
        return created;
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A profile with this email already exists');
      }
      throw error;
    }

    // A concurrent request may have provisioned the row between the read and insert.
    const concurrent = await findById(input.id);
    if (!concurrent) {
      throw AppError.conflict('Profile could not be provisioned');
    }

    return concurrent;
  }

  async function updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    const values: Partial<typeof users.$inferInsert> = {};

    if (input.displayName !== undefined) {
      values.displayName = assertNonEmpty(input.displayName, 'display_name');
    }
    if (input.phone !== undefined) {
      values.phone = input.phone?.trim() || null;
    }
    if (input.avatarUrl !== undefined) {
      values.avatarUrl = input.avatarUrl?.trim() || null;
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No profile fields to update');
    }

    values.updatedAt = new Date();

    const [updated] = await database
      .update(users)
      .set(values)
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      throw AppError.notFound('Profile not found');
    }

    return updated;
  }

  return { getOrCreateProfile, updateProfile };
}

export const profileService = createProfileService(db);
