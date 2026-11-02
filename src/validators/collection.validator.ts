import { z } from 'zod';

export const contentStatusValues = ['draft', 'published', 'archived'] as const;
export type ContentStatus = (typeof contentStatusValues)[number];

export const createCollectionSchema = z.object({
  title: z.string().trim().min(1, 'Collection title is required'),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;

export const updateCollectionSchema = z.object({
  title: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});

export type UpdateCollectionInput = z.infer<typeof updateCollectionSchema>;

export const updateCollectionStatusSchema = z.object({
  status: z.enum(contentStatusValues),
});

export type UpdateCollectionStatusInput = z.infer<typeof updateCollectionStatusSchema>;

export const queryCollectionsSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.enum(contentStatusValues).optional(),
  tag: z.string().trim().optional(),
  q: z.string().trim().optional(),
});

export type QueryCollectionsInput = z.infer<typeof queryCollectionsSchema>;

export const addCollectionImageSchema = z.object({
  storagePath: z.string().trim().min(1, 'Storage path is required'),
  altText: z.string().trim().optional(),
  position: z.coerce.number().int().min(0).default(0),
});

export type AddCollectionImageInput = z.infer<typeof addCollectionImageSchema>;

export const updateCollectionImageSchema = z.object({
  altText: z.string().trim().optional(),
  position: z.coerce.number().int().min(0).optional(),
});

export type UpdateCollectionImageInput = z.infer<typeof updateCollectionImageSchema>;

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Tag name is required'),
  slug: z.string().trim().min(1).optional(),
});

export type CreateTagInput = z.infer<typeof createTagSchema>;

