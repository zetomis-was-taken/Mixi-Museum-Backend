import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { contentStatusEnum } from './enums.js';
import { museums } from './museums.js';

export const products = pgTable(
  'products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    priceMinor: bigint('price_minor', { mode: 'bigint' }).notNull(),
    stockQuantity: integer('stock_quantity').default(0).notNull(),
    status: contentStatusEnum('status').default('draft').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('products_id_museum_id_unique').on(table.id, table.museumId),
    unique('products_museum_id_slug_unique').on(table.museumId, table.slug),
    index('products_museum_id_status_index').on(table.museumId, table.status),
    check('products_price_minor_check', sql`${table.priceMinor} >= 0`),
    check('products_stock_quantity_check', sql`${table.stockQuantity} >= 0`),
  ],
);

export const productImages = pgTable('product_images', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  storagePath: text('storage_path').notNull(),
  altText: text('alt_text'),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const carts = pgTable(
  'carts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('carts_id_museum_id_unique').on(table.id, table.museumId),
    unique('carts_user_id_museum_id_unique').on(table.userId, table.museumId),
  ],
);

export const cartItems = pgTable(
  'cart_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cartId: uuid('cart_id').notNull(),
    productId: uuid('product_id').notNull(),
    museumId: uuid('museum_id').notNull(),
    quantity: integer('quantity').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      name: 'cart_items_cart_museum_fk',
      columns: [table.cartId, table.museumId],
      foreignColumns: [carts.id, carts.museumId],
    }).onDelete('cascade'),
    foreignKey({
      name: 'cart_items_product_museum_fk',
      columns: [table.productId, table.museumId],
      foreignColumns: [products.id, products.museumId],
    }).onDelete('cascade'),
    unique('cart_items_cart_id_product_id_unique').on(table.cartId, table.productId),
    check('cart_items_quantity_check', sql`${table.quantity} >= 1`),
  ],
);
