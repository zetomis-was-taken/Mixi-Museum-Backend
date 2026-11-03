import {
  boolean,
  char,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { museumVisibilityStatusEnum } from './enums.js';

export const museums = pgTable('museums', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  address: text('address'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  coverImagePath: text('cover_image_path'),
  currency: char('currency', { length: 3 }).default('USD').notNull(),
  visibilityStatus: museumVisibilityStatusEnum('visibility_status').default('draft').notNull(),
  shopEnabled: boolean('shop_enabled').default(false).notNull(),
  ticketsEnabled: boolean('tickets_enabled').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const adminTiers = pgTable(
  'admin_tiers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    permissions: jsonb('permissions').default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('admin_tiers_museum_id_name_unique').on(table.museumId, table.name),
  ],
);

export const museumAdmins = pgTable(
  'museum_admins',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tierId: uuid('tier_id').references(() => adminTiers.id, { onDelete: 'set null' }),
    isOwner: boolean('is_owner').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('museum_admins_museum_id_user_id_unique').on(table.museumId, table.userId),
  ],
);
