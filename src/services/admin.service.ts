import { and, asc, count, eq } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { adminTiers, museumAdmins, users } from '../db/schemas/index.js';
import { isUniqueViolation } from '../utils/db-errors.js';
import { AppError } from '../utils/errors.js';
import { assertNonEmpty } from '../utils/validation.js';

type AdminTier = typeof adminTiers.$inferSelect;

export interface CreateAdminTierInput {
  name: string;
  permissions?: Record<string, unknown>;
}

export interface UpdateAdminTierInput {
  name?: string;
  permissions?: Record<string, unknown>;
}

export interface AddMuseumAdminInput {
  userId: string;
  tierId?: string | null;
  isOwner?: boolean;
}

export interface UpdateMuseumAdminInput {
  tierId?: string | null;
  isOwner?: boolean;
}

export function createAdminService(database: Database) {
  async function requireTier(museumId: string, tierId: string): Promise<AdminTier> {
    const [tier] = await database
      .select()
      .from(adminTiers)
      .where(and(eq(adminTiers.id, tierId), eq(adminTiers.museumId, museumId)))
      .limit(1);

    if (!tier) {
      throw AppError.badRequest('Admin tier does not belong to this museum', [
        { field: 'tier_id', message: 'must reference a tier of the same museum' },
      ]);
    }

    return tier;
  }

  async function listTiers(museumId: string): Promise<AdminTier[]> {
    return database
      .select()
      .from(adminTiers)
      .where(eq(adminTiers.museumId, museumId))
      .orderBy(asc(adminTiers.name));
  }

  async function createTier(museumId: string, input: CreateAdminTierInput): Promise<AdminTier> {
    try {
      const [tier] = await database
        .insert(adminTiers)
        .values({
          museumId,
          name: assertNonEmpty(input.name, 'name'),
          permissions: input.permissions ?? {},
        })
        .returning();

      if (!tier) {
        throw new Error('Admin tier insert returned no row');
      }

      return tier;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('An admin tier with this name already exists');
      }
      throw error;
    }
  }

  async function updateTier(
    museumId: string,
    tierId: string,
    input: UpdateAdminTierInput,
  ): Promise<AdminTier> {
    const values: Partial<typeof adminTiers.$inferInsert> = {};

    if (input.name !== undefined) {
      values.name = assertNonEmpty(input.name, 'name');
    }
    if (input.permissions !== undefined) {
      values.permissions = input.permissions;
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No admin tier fields to update');
    }

    values.updatedAt = new Date();

    try {
      const [updated] = await database
        .update(adminTiers)
        .set(values)
        .where(and(eq(adminTiers.id, tierId), eq(adminTiers.museumId, museumId)))
        .returning();

      if (!updated) {
        throw AppError.notFound('Admin tier not found');
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('An admin tier with this name already exists');
      }
      throw error;
    }
  }

  /** Deletes a tier; memberships assigned to it become unassigned (`ON DELETE SET NULL`). */
  async function deleteTier(museumId: string, tierId: string): Promise<AdminTier> {
    const [deleted] = await database
      .delete(adminTiers)
      .where(and(eq(adminTiers.id, tierId), eq(adminTiers.museumId, museumId)))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Admin tier not found');
    }

    return deleted;
  }

  async function listAdmins(museumId: string) {
    return database
      .select({
        id: museumAdmins.id,
        museumId: museumAdmins.museumId,
        userId: museumAdmins.userId,
        tierId: museumAdmins.tierId,
        isOwner: museumAdmins.isOwner,
        createdAt: museumAdmins.createdAt,
        displayName: users.displayName,
        email: users.email,
        avatarUrl: users.avatarUrl,
      })
      .from(museumAdmins)
      .innerJoin(users, eq(users.id, museumAdmins.userId))
      .where(eq(museumAdmins.museumId, museumId))
      .orderBy(asc(museumAdmins.createdAt));
  }

  /** Membership lookup used by authorization middleware. */
  async function getMembership(museumId: string, userId: string) {
    const [membership] = await database
      .select()
      .from(museumAdmins)
      .where(and(eq(museumAdmins.museumId, museumId), eq(museumAdmins.userId, userId)))
      .limit(1);

    return membership;
  }

  async function addAdmin(
    museumId: string,
    input: AddMuseumAdminInput,
  ): Promise<typeof museumAdmins.$inferSelect> {
    const [user] = await database
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1);

    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (input.tierId) {
      await requireTier(museumId, input.tierId);
    }

    try {
      const [created] = await database
        .insert(museumAdmins)
        .values({
          museumId,
          userId: input.userId,
          tierId: input.tierId ?? null,
          isOwner: input.isOwner ?? false,
        })
        .returning();

      if (!created) {
        throw new Error('Museum admin insert returned no row');
      }

      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('User is already an admin of this museum');
      }
      throw error;
    }
  }

  async function updateAdmin(
    museumId: string,
    adminId: string,
    input: UpdateMuseumAdminInput,
  ): Promise<typeof museumAdmins.$inferSelect> {
    if (input.tierId) {
      await requireTier(museumId, input.tierId);
    }

    return database.transaction(async (tx) => {
      const [membership] = await tx
        .select()
        .from(museumAdmins)
        .where(and(eq(museumAdmins.id, adminId), eq(museumAdmins.museumId, museumId)))
        .limit(1)
        .for('update');

      if (!membership) {
        throw AppError.notFound('Museum admin not found');
      }

      if (membership.isOwner && input.isOwner === false) {
        await assertAnotherOwnerExists(
          tx,
          museumId,
          'A museum must keep at least one owner',
        );
      }

      const values: Partial<typeof museumAdmins.$inferInsert> = {};

      if (input.tierId !== undefined) {
        values.tierId = input.tierId;
      }
      if (input.isOwner !== undefined) {
        values.isOwner = input.isOwner;
      }

      if (Object.keys(values).length === 0) {
        throw AppError.badRequest('No museum admin fields to update');
      }

      const [updated] = await tx
        .update(museumAdmins)
        .set(values)
        .where(and(eq(museumAdmins.id, adminId), eq(museumAdmins.museumId, museumId)))
        .returning();

      if (!updated) {
        throw AppError.notFound('Museum admin not found');
      }

      return updated;
    });
  }

  /** Removes a membership while preserving at least one museum owner. */
  async function removeAdmin(
    museumId: string,
    adminId: string,
  ): Promise<typeof museumAdmins.$inferSelect> {
    return database.transaction(async (tx) => {
      const [membership] = await tx
        .select()
        .from(museumAdmins)
        .where(and(eq(museumAdmins.id, adminId), eq(museumAdmins.museumId, museumId)))
        .limit(1)
        .for('update');

      if (!membership) {
        throw AppError.notFound('Museum admin not found');
      }

      if (membership.isOwner) {
        await assertAnotherOwnerExists(
          tx,
          museumId,
          'A museum must keep at least one owner',
        );
      }

      const [deleted] = await tx
        .delete(museumAdmins)
        .where(and(eq(museumAdmins.id, adminId), eq(museumAdmins.museumId, museumId)))
        .returning();

      if (!deleted) {
        throw AppError.notFound('Museum admin not found');
      }

      return deleted;
    });
  }

  return {
    listTiers,
    createTier,
    updateTier,
    deleteTier,
    listAdmins,
    getMembership,
    addAdmin,
    updateAdmin,
    removeAdmin,
  };
}

async function assertAnotherOwnerExists(
  tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  museumId: string,
  message: string,
): Promise<void> {
  const [owners] = await tx
    .select({ value: count() })
    .from(museumAdmins)
    .where(and(eq(museumAdmins.museumId, museumId), eq(museumAdmins.isOwner, true)));

  if ((owners?.value ?? 0) <= 1) {
    throw AppError.conflict(message);
  }
}

export const adminService = createAdminService(db);
