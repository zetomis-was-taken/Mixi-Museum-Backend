import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminTiers } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import type {
  CreateAdminTierInput,
  UpdateAdminTierInput,
} from '../validators/museum.validator.js';

export class AdminTierService {
  async listTiers(museumId: string): Promise<typeof adminTiers.$inferSelect[]> {
    return db
      .select()
      .from(adminTiers)
      .where(eq(adminTiers.museumId, museumId));
  }

  async createTier(
    museumId: string,
    input: CreateAdminTierInput,
  ): Promise<typeof adminTiers.$inferSelect> {
    const [existing] = await db
      .select({ id: adminTiers.id })
      .from(adminTiers)
      .where(and(eq(adminTiers.museumId, museumId), eq(adminTiers.name, input.name)));

    if (existing) {
      throw AppError.conflict('An admin tier with this name already exists in this museum');
    }

    const [created] = await db
      .insert(adminTiers)
      .values({
        museumId,
        name: input.name,
        permissions: input.permissions ?? {},
      })
      .returning();

    if (!created) {
      throw new AppError('Failed to create admin tier');
    }

    return created;
  }

  async updateTier(
    museumId: string,
    tierId: string,
    input: UpdateAdminTierInput,
  ): Promise<typeof adminTiers.$inferSelect> {
    const [current] = await db
      .select()
      .from(adminTiers)
      .where(and(eq(adminTiers.id, tierId), eq(adminTiers.museumId, museumId)));

    if (!current) {
      throw AppError.notFound('Admin tier not found in this museum');
    }

    if (input.name && input.name !== current.name) {
      const [existing] = await db
        .select({ id: adminTiers.id })
        .from(adminTiers)
        .where(and(eq(adminTiers.museumId, museumId), eq(adminTiers.name, input.name)));

      if (existing) {
        throw AppError.conflict('An admin tier with this name already exists in this museum');
      }
    }

    const [updated] = await db
      .update(adminTiers)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(and(eq(adminTiers.id, tierId), eq(adminTiers.museumId, museumId)))
      .returning();

    if (!updated) {
      throw AppError.notFound('Admin tier not found');
    }

    return updated;
  }

  async deleteTier(museumId: string, tierId: string): Promise<void> {
    const [deleted] = await db
      .delete(adminTiers)
      .where(and(eq(adminTiers.id, tierId), eq(adminTiers.museumId, museumId)))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Admin tier not found in this museum');
    }
  }
}

export const adminTierService = new AdminTierService();

