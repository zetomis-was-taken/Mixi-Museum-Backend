import {
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { contentStatusEnum } from './enums.js';
import { museums } from './museums.js';

export const collections = pgTable(
  'collections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    status: contentStatusEnum('status').default('draft').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('collections_id_museum_id_unique').on(table.id, table.museumId),
    unique('collections_museum_id_slug_unique').on(table.museumId, table.slug),
    index('collections_museum_id_status_index').on(table.museumId, table.status),
  ],
);

export const collectionImages = pgTable('collection_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  collectionId: uuid('collection_id')
    .notNull()
    .references(() => collections.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  altText: text('alt_text'),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tags = pgTable(
  'tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('tags_id_museum_id_unique').on(table.id, table.museumId),
    unique('tags_museum_id_slug_unique').on(table.museumId, table.slug),
  ],
);

export const collectionTags = pgTable(
  'collection_tags',
  {
    collectionId: uuid('collection_id').notNull(),
    tagId: uuid('tag_id').notNull(),
    museumId: uuid('museum_id').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.collectionId, table.tagId] }),
    foreignKey({
      name: 'collection_tags_collection_museum_fk',
      columns: [table.collectionId, table.museumId],
      foreignColumns: [collections.id, collections.museumId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'collection_tags_tag_museum_fk',
      columns: [table.tagId, table.museumId],
      foreignColumns: [tags.id, tags.museumId],
    }).onDelete('cascade'),
  ],
);
