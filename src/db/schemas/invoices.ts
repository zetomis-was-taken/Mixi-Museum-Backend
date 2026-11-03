import { desc, sql } from 'drizzle-orm';
import {
  bigint,
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { products } from './commerce.js';
import { invoiceKindEnum, invoiceStatusEnum } from './enums.js';
import { museums } from './museums.js';
import { ticketTypes } from './tickets.js';

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'restrict' }),
    kind: invoiceKindEnum('kind').notNull(),
    status: invoiceStatusEnum('status').default('pending').notNull(),
    subtotalMinor: bigint('subtotal_minor', { mode: 'bigint' }).notNull(),
    totalMinor: bigint('total_minor', { mode: 'bigint' }).notNull(),
    currency: char('currency', { length: 3 }).notNull(),
    billingEmail: text('billing_email').notNull(),
    billingName: text('billing_name').notNull(),
    shippingName: text('shipping_name'),
    shippingPhone: text('shipping_phone'),
    shippingAddress: jsonb('shipping_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }),
  },
  (table) => [
    index('invoices_user_id_created_at_index').on(table.userId, desc(table.createdAt)),
    check('invoices_subtotal_minor_check', sql`${table.subtotalMinor} >= 0`),
    check('invoices_total_minor_check', sql`${table.totalMinor} >= 0`),
  ],
);

export const invoiceItems = pgTable(
  'invoice_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'restrict' }),
    ticketTypeId: uuid('ticket_type_id').references(() => ticketTypes.id, {
      onDelete: 'restrict',
    }),
    description: text('description').notNull(),
    unitPriceMinor: bigint('unit_price_minor', { mode: 'bigint' }).notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => [
    check('invoice_items_unit_price_minor_check', sql`${table.unitPriceMinor} >= 0`),
    check('invoice_items_quantity_check', sql`${table.quantity} >= 1`),
    check(
      'invoice_items_target_check',
      sql`num_nonnulls(${table.productId}, ${table.ticketTypeId}) = 1`,
    ),
  ],
);
