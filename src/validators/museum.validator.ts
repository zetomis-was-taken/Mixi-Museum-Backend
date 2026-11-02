import { z } from 'zod';

export const createMuseumSchema = z.object({
  name: z.string().trim().min(1, 'Museum name is required'),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  address: z.string().trim().optional(),
  latitude: z.string().trim().optional(),
  longitude: z.string().trim().optional(),
  coverImagePath: z.string().trim().optional(),
  currency: z.string().trim().length(3).default('USD'),
  shopEnabled: z.boolean().default(false),
  ticketsEnabled: z.boolean().default(false),
});

export type CreateMuseumInput = z.infer<typeof createMuseumSchema>;

export const updateMuseumSchema = z.object({
  name: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  address: z.string().trim().optional(),
  latitude: z.string().trim().optional(),
  longitude: z.string().trim().optional(),
  coverImagePath: z.string().trim().optional(),
});

export type UpdateMuseumInput = z.infer<typeof updateMuseumSchema>;

export const updateMuseumSettingsSchema = z.object({
  shopEnabled: z.boolean().optional(),
  ticketsEnabled: z.boolean().optional(),
  currency: z.string().trim().length(3).optional(),
});

export type UpdateMuseumSettingsInput = z.infer<typeof updateMuseumSettingsSchema>;

export const queryMuseumsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  q: z.string().trim().optional(),
});

export type QueryMuseumsInput = z.infer<typeof queryMuseumsSchema>;

export const createAdminTierSchema = z.object({
  name: z.string().trim().min(1, 'Tier name is required'),
  permissions: z.record(z.string(), z.unknown()).default({}),
});

export type CreateAdminTierInput = z.infer<typeof createAdminTierSchema>;

export const updateAdminTierSchema = z.object({
  name: z.string().trim().min(1).optional(),
  permissions: z.record(z.string(), z.unknown()).optional(),
});

export type UpdateAdminTierInput = z.infer<typeof updateAdminTierSchema>;

export const addMuseumAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  tierId: z.string().uuid().optional(),
  isOwner: z.boolean().default(false),
});

export type AddMuseumAdminInput = z.infer<typeof addMuseumAdminSchema>;

export const updateMuseumAdminSchema = z.object({
  tierId: z.string().uuid().nullable().optional(),
  isOwner: z.boolean().optional(),
});

export type UpdateMuseumAdminInput = z.infer<typeof updateMuseumAdminSchema>;

