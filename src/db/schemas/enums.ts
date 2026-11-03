import { pgEnum } from 'drizzle-orm/pg-core';

export const contentStatusEnum = pgEnum('content_status', [
  'draft',
  'published',
  'archived',
]);

export const museumVisibilityStatusEnum = pgEnum('museum_visibility_status', [
  'draft',
  'published',
  'archived',
]);

export const invoiceKindEnum = pgEnum('invoice_kind', [
  'merchandise',
  'ticket',
]);

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'pending',
  'paid',
  'cancelled',
  'refunded',
]);

export const ticketDateModeEnum = pgEnum('ticket_date_mode', [
  'open',
  'fixed',
]);

export const ticketTimeModeEnum = pgEnum('ticket_time_mode', [
  'all_day',
  'slot',
]);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'valid',
  'used',
  'cancelled',
  'expired',
]);
