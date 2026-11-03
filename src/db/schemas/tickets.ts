import { desc, sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { ticketDateModeEnum, ticketStatusEnum, ticketTimeModeEnum } from './enums.js';
import { invoiceItems, invoices } from './invoices.js';
import { museums } from './museums.js';

export const ticketTypes = pgTable(
  'ticket_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    priceMinor: bigint('price_minor', { mode: 'bigint' }).notNull(),
    dateMode: ticketDateModeEnum('date_mode').default('open').notNull(),
    validDate: date('valid_date'),
    timeMode: ticketTimeModeEnum('time_mode').default('all_day').notNull(),
    slotStartTime: time('slot_start_time'),
    slotEndTime: time('slot_end_time'),
    capacity: integer('capacity'),
    salesStartAt: timestamp('sales_start_at', { withTimezone: true }),
    salesEndAt: timestamp('sales_end_at', { withTimezone: true }),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('ticket_types_price_minor_check', sql`${table.priceMinor} >= 0`),
    check(
      'ticket_types_fixed_date_check',
      sql`${table.dateMode} <> 'fixed' OR ${table.validDate} IS NOT NULL`,
    ),
    check(
      'ticket_types_slot_time_check',
      sql`${table.timeMode} <> 'slot' OR (${table.slotStartTime} IS NOT NULL AND ${table.slotEndTime} IS NOT NULL)`,
    ),
    check(
      'ticket_types_slot_order_check',
      sql`${table.slotStartTime} IS NULL OR ${table.slotEndTime} IS NULL OR ${table.slotEndTime} > ${table.slotStartTime}`,
    ),
  ],
);

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    museumId: uuid('museum_id')
      .notNull()
      .references(() => museums.id, { onDelete: 'restrict' }),
    ticketTypeId: uuid('ticket_type_id')
      .notNull()
      .references(() => ticketTypes.id, { onDelete: 'restrict' }),
    invoiceItemId: uuid('invoice_item_id')
      .notNull()
      .references(() => invoiceItems.id, { onDelete: 'restrict' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    invoiceId: uuid('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'restrict' }),
    currency: char('currency', { length: 3 }).notNull(),
    faceValueMinor: bigint('face_value_minor', { mode: 'bigint' }).notNull(),
    qrCode: text('qr_code').notNull().unique(),
    status: ticketStatusEnum('status').default('valid').notNull(),
    validDate: date('valid_date').notNull(),
    slotStartTime: time('slot_start_time'),
    slotEndTime: time('slot_end_time'),
    purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (table) => [
    index('tickets_user_id_purchased_at_index').on(table.userId, desc(table.purchasedAt)),
    index('tickets_museum_id_valid_date_index').on(table.museumId, table.validDate),
    check('tickets_face_value_minor_check', sql`${table.faceValueMinor} >= 0`),
  ],
);
