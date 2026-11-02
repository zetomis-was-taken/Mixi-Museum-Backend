import { z } from 'zod';

export const invoiceKindValues = ['merchandise', 'ticket'] as const;
export type InvoiceKind = (typeof invoiceKindValues)[number];

export const invoiceStatusValues = ['pending', 'paid', 'cancelled', 'refunded'] as const;
export type InvoiceStatus = (typeof invoiceStatusValues)[number];

export const queryInvoicesSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  kind: z.enum(invoiceKindValues).optional(),
  status: z.enum(invoiceStatusValues).optional(),
});

export type QueryInvoicesInput = z.infer<typeof queryInvoicesSchema>;

export const checkoutCartSchema = z.object({
  // Optional customer notes or delivery details if needed in future
  notes: z.string().trim().optional(),
});

export type CheckoutCartInput = z.infer<typeof checkoutCartSchema>;

