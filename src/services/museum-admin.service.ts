import { and, count, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminTiers, museumAdmins, userRoles, users } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import type {
  AddMuseumAdminInput,
  UpdateMuseumAdminInput,
} from '../validators/museum.validator.js';

export interface MuseumAdminDetails {
  id: string;
  museumId: string;
  userId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  tierId: string | null;
  tierName: string | null;
  isOwner: boolean;
  createdAt: Date;
}

export class MuseumAdminService {
  async listAdmins(museumId: string): Promise<MuseumAdminDetails[]> {
    const rows = await db
      .select({
        id: museumAdmins.id,
        museumId: museumAdmins.museumId,
        userId: museumAdmins.userId,
        email: users.email,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        tierId: museumAdmins.tierId,
        tierName: adminTiers.name,
        isOwner: museumAdmins.isOwner,
        createdAt: museumAdmins.createdAt,
      })
      .from(museumAdmins)
      .innerJoin(users, eq(museumAdmins.userId, users.id))
      .leftJoin(adminTiers, eq(museumAdmins.tierId, adminTiers.id))
      .where(eq(museumAdmins.museumId, museumId));

    return rows;
  }

  async addAdmin(
    museumId: string,
    input: AddMuseumAdminInput,
  ): Promise<typeof museumAdmins.$inferSelect> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email));

    if (!user) {
      throw AppError.notFound('No user found with the provided email address');
    }

    const [existing] = await db
      .select({ id: museumAdmins.id })
      .from(museumAdmins)
      .where(and(eq(museumAdmins.museumId, museumId), eq(museumAdmins.userId, user.id)));

    if (existing) {
      throw AppError.conflict('User is already an administrator of this museum');
    }

    if (input.tierId) {
      const [tier] = await db
        .select({ id: adminTiers.id })
        .from(adminTiers)
        .where(and(eq(adminTiers.id, input.tierId), eq(adminTiers.museumId, museumId)));

      if (!tier) {
        throw AppError.notFound('Specified admin tier does not exist in this museum');
      }
    }

    return db.transaction(async (tx) => {
      // Ensure user has admin role
      await tx
        .insert(userRoles)
        .values({
          userId: user.id,
          role: 'admin',
        })
        .onConflictDoNothing();

      const [membership] = await tx
        .insert(museumAdmins)
        .values({
          museumId,
          userId: user.id,
          tierId: input.tierId ?? null,
          isOwner: input.isOwner ?? false,
        })
        .returning();

      if (!membership) {
        throw new AppError('Failed to add administrator to museum');
      }

      return membership;
    });
  }

  async updateAdmin(
    museumId: string,
    membershipId: string,
    input: UpdateMuseumAdminInput,
  ): Promise<typeof museumAdmins.$inferSelect> {
    const [current] = await db
      .select()
      .from(museumAdmins)
      .where(and(eq(museumAdmins.id, membershipId), eq(museumAdmins.museumId, museumId)));

    if (!current) {
      throw AppError.notFound('Museum administrator membership not found');
    }

    // Invariant: cannot remove owner role if this is the only owner
    if (input.isOwner === false && current.isOwner) {
      const [ownerCount] = await db
        .select({ total: count() })
        .from(museumAdmins)
        .where(and(eq(museumAdmins.museumId, museumId), eq(museumAdmins.isOwner, true)));

      if (ownerCount && Number(ownerCount.total) <= 1) {
        throw AppError.badRequest('A museum must maintain at least one owner');
      }
    }

    if (input.tierId) {
      const [tier] = await db
        .select({ id: adminTiers.id })
        .from(adminTiers)
        .where(and(eq(adminTiers.id, input.tierId), eq(adminTiers.museumId, museumId)));

      if (!tier) {
        throw AppError.notFound('Specified admin tier does not exist in this museum');
      }
    }

    const [updated] = await db
      .update(museumAdmins)
      .set({
        ...(input.tierId !== undefined && { tierId: input.tierId }),
        ...(input.isOwner !== undefined && { isOwner: input.isOwner }),
      })
      .where(and(eq(museumAdmins.id, membershipId), eq(museumAdmins.museumId, museumId)))
      .returning();

    if (!updated) {
      throw AppError.notFound('Museum administrator membership not found');
    }

    return updated;
  }

  async removeAdmin(museumId: string, membershipId: string): Promise<void> {
    const [current] = await db
      .select()
      .from(museumAdmins)
      .where(and(eq(museumAdmins.id, membershipId), eq(museumAdmins.museumId, museumId)));

    if (!current) {
      throw AppError.notFound('Museum administrator membership not found');
    }

    if (current.isOwner) {
      const [ownerCount] = await db
        .select({ total: count() })
        .from(museumAdmins)
        .where(and(eq(museumAdmins.museumId, museumId), eq(museumAdmins.isOwner, true)));

      if (ownerCount && Number(ownerCount.total) <= 1) {
        throw AppError.badRequest('Cannot remove the only owner of the museum');
      }
    }

    await db
      .delete(museumAdmins)
      .where(and(eq(museumAdmins.id, membershipId), eq(museumAdmins.museumId, museumId)));
  }
}

export const museumAdminService = new MuseumAdminService();

