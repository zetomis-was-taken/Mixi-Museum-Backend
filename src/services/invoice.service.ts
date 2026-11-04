import { and, asc, count, desc, eq, inArray } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import {
  cartItems,
  carts,
  invoiceItems,
  invoices,
  museums,
  products,
  ticketTypes,
  tickets,
} from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import {
  paginate,
  parsePagination,
  type Paginated,
  type PaginationQuery,
} from '../utils/query.js';
import { assertEmail, assertIsoDate, assertNonEmpty, normalizeEmail } from '../utils/validation.js';

type Invoice = typeof invoices.$inferSelect;
type InvoiceItem = typeof invoiceItems.$inferSelect;
type InvoiceStatus = Invoice['status'];
type InvoiceKind = Invoice['kind'];
type TicketType = typeof ticketTypes.$inferSelect;

export interface CheckoutInput {
  billingName: string;
  billingEmail: string;
  shippingName?: string | null;
  shippingPhone?: string | null;
  shippingAddress?: Record<string, unknown> | null;
}

export interface TicketOrderLineInput {
  ticketTypeId: string;
  quantity: number;
  validDate?: string | null;
}

export interface TicketOrderInput {
  items: TicketOrderLineInput[];
  billingName: string;
  billingEmail: string;
}

export interface InvoiceListQuery extends PaginationQuery {
  status?: InvoiceStatus;
  kind?: InvoiceKind;
}

export function createInvoiceService(database: Database) {
  /**
   * Creates a pending merchandise invoice from the user's cart.
   *
   * Current product prices and status are revalidated and the cart is emptied in
   * the same transaction. Stock is only decremented when the invoice is marked
   * paid; the payment/confirmation flow is intentionally out of scope here.
   */
  async function checkoutCart(museumId: string, userId: string, input: CheckoutInput) {
    const billing = normalizeBilling(input);

    return database.transaction(async (tx) => {
      const [museum] = await tx
        .select()
        .from(museums)
        .where(eq(museums.id, museumId))
        .limit(1);

      if (!museum) {
        throw AppError.notFound('Museum not found');
      }

      if (!museum.shopEnabled) {
        throw AppError.notFound('Merchandise is not available for this museum');
      }

      const [cart] = await tx
        .select()
        .from(carts)
        .where(and(eq(carts.museumId, museumId), eq(carts.userId, userId)))
        .limit(1);

      if (!cart) {
        throw AppError.badRequest('Cart is empty');
      }

      const rows = await tx
        .select({ item: cartItems, product: products })
        .from(cartItems)
        .innerJoin(products, eq(products.id, cartItems.productId))
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(cartItems.createdAt));

      if (rows.length === 0) {
        throw AppError.badRequest('Cart is empty');
      }

      for (const { item, product } of rows) {
        if (product.status !== 'published') {
          throw AppError.conflict(`Product "${product.name}" is no longer available`);
        }
        if (product.stockQuantity < item.quantity) {
          throw AppError.conflict(`Insufficient stock for product "${product.name}"`);
        }
      }

      const total = rows.reduce(
        (sum, { item, product }) => sum + product.priceMinor * BigInt(item.quantity),
        0n,
      );

      const [invoice] = await tx
        .insert(invoices)
        .values({
          userId,
          museumId,
          kind: 'merchandise',
          status: 'pending',
          subtotalMinor: total,
          totalMinor: total,
          currency: museum.currency,
          billingEmail: billing.billingEmail,
          billingName: billing.billingName,
          shippingName: input.shippingName?.trim() || null,
          shippingPhone: input.shippingPhone?.trim() || null,
          shippingAddress: input.shippingAddress ?? null,
        })
        .returning();

      if (!invoice) {
        throw new Error('Invoice insert returned no row');
      }

      const items = await tx
        .insert(invoiceItems)
        .values(
          rows.map(({ item, product }) => ({
            invoiceId: invoice.id,
            museumId,
            userId,
            invoiceKind: 'merchandise' as const,
            productId: product.id,
            description: product.name,
            unitPriceMinor: product.priceMinor,
            quantity: item.quantity,
          })),
        )
        .returning();

      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
      await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));

      return { invoice, items };
    });
  }

  /**
   * Creates a pending ticket invoice after validating the ticket types, sale
   * windows, dates and remaining capacity. Issued `tickets` rows are created by
   * the payment/confirmation flow, which is not implemented yet.
   */
  async function createTicketOrder(
    museumId: string,
    userId: string,
    input: TicketOrderInput,
  ) {
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw AppError.badRequest('At least one ticket line is required');
    }

    const billing = normalizeBilling(input);
    const now = new Date();

    return database.transaction(async (tx) => {
      const [museum] = await tx
        .select()
        .from(museums)
        .where(eq(museums.id, museumId))
        .limit(1);

      if (!museum) {
        throw AppError.notFound('Museum not found');
      }

      if (!museum.ticketsEnabled) {
        throw AppError.notFound('Tickets are not available for this museum');
      }

      const resolved: Array<{ type: TicketType; quantity: number; validDate: string }> = [];

      for (const line of input.items) {
        if (!Number.isInteger(line.quantity) || line.quantity < 1) {
          throw AppError.badRequest('Invalid ticket quantity', [
            { field: 'quantity', message: 'must be an integer of at least 1' },
          ]);
        }

        const [type] = await tx
          .select()
          .from(ticketTypes)
          .where(
            and(eq(ticketTypes.id, line.ticketTypeId), eq(ticketTypes.museumId, museumId)),
          )
          .limit(1);

        if (!type) {
          throw AppError.notFound('Ticket type not found');
        }

        if (!type.isActive) {
          throw AppError.conflict(`Ticket type "${type.name}" is not on sale`);
        }
        if (type.salesStartAt && now < type.salesStartAt) {
          throw AppError.conflict(`Sales for "${type.name}" have not started`);
        }
        if (type.salesEndAt && now > type.salesEndAt) {
          throw AppError.conflict(`Sales for "${type.name}" have ended`);
        }

        resolved.push({
          type,
          quantity: line.quantity,
          validDate: resolveValidDate(type, line.validDate),
        });
      }

      await assertCapacity(tx, resolved);

      const total = resolved.reduce(
        (sum, line) => sum + line.type.priceMinor * BigInt(line.quantity),
        0n,
      );

      const [invoice] = await tx
        .insert(invoices)
        .values({
          userId,
          museumId,
          kind: 'ticket',
          status: 'pending',
          subtotalMinor: total,
          totalMinor: total,
          currency: museum.currency,
          billingEmail: billing.billingEmail,
          billingName: billing.billingName,
        })
        .returning();

      if (!invoice) {
        throw new Error('Invoice insert returned no row');
      }

      const items = await tx
        .insert(invoiceItems)
        .values(
          resolved.map((line) => ({
            invoiceId: invoice.id,
            museumId,
            userId,
            invoiceKind: 'ticket' as const,
            ticketTypeId: line.type.id,
            description: line.type.name,
            unitPriceMinor: line.type.priceMinor,
            quantity: line.quantity,
          })),
        )
        .returning();

      return { invoice, items };
    });
  }

  async function listMyInvoices(
    userId: string,
    query: InvoiceListQuery = {},
  ): Promise<Paginated<Invoice>> {
    const pagination = parsePagination(query);

    const where = and(
      eq(invoices.userId, userId),
      query.status ? eq(invoices.status, query.status) : undefined,
      query.kind ? eq(invoices.kind, query.kind) : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(invoices)
        .where(where)
        .orderBy(desc(invoices.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(invoices).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getMyInvoice(userId: string, invoiceId: string) {
    const [invoice] = await database
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)))
      .limit(1);

    if (!invoice) {
      throw AppError.notFound('Invoice not found');
    }

    const items = await database
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoice.id));

    return { invoice, items };
  }

  /** Tenant-scoped invoice listing for the admin dashboard. */
  async function listMuseumInvoices(
    museumId: string,
    query: InvoiceListQuery = {},
  ): Promise<Paginated<Invoice>> {
    const pagination = parsePagination(query);

    const where = and(
      eq(invoices.museumId, museumId),
      query.status ? eq(invoices.status, query.status) : undefined,
      query.kind ? eq(invoices.kind, query.kind) : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(invoices)
        .where(where)
        .orderBy(desc(invoices.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(invoices).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getMuseumInvoice(museumId: string, invoiceId: string) {
    const [invoice] = await database
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.museumId, museumId)))
      .limit(1);

    if (!invoice) {
      throw AppError.notFound('Invoice not found');
    }

    const items: InvoiceItem[] = await database
      .select()
      .from(invoiceItems)
      .where(
        and(
          eq(invoiceItems.invoiceId, invoice.id),
          eq(invoiceItems.museumId, museumId),
        ),
      );

    return { invoice, items };
  }

  return {
    checkoutCart,
    createTicketOrder,
    listMyInvoices,
    getMyInvoice,
    listMuseumInvoices,
    getMuseumInvoice,
  };
}

function normalizeBilling(input: { billingName: string; billingEmail: string }) {
  return {
    billingName: assertNonEmpty(input.billingName, 'billing_name'),
    billingEmail: assertEmail(normalizeEmail(input.billingEmail), 'billing_email'),
  };
}

/**
 * Fixed-date types must match their configured date; open-date types require the
 * buyer to choose a date.
 */
function resolveValidDate(type: TicketType, requested: string | null | undefined): string {
  if (type.dateMode === 'fixed') {
    if (!type.validDate) {
      throw AppError.conflict(`Ticket type "${type.name}" has no configured valid date`);
    }

    if (requested && assertIsoDate(requested, 'valid_date') !== type.validDate) {
      throw AppError.badRequest('valid_date does not match the ticket type fixed date', [
        { field: 'valid_date', message: `must be ${type.validDate}` },
      ]);
    }

    return type.validDate;
  }

  if (!requested) {
    throw AppError.badRequest('valid_date is required for open-date ticket types', [
      { field: 'valid_date', message: 'is required' },
    ]);
  }

  return assertIsoDate(requested, 'valid_date');
}

/**
 * Counts issued admissions for each ticket type/date and rejects orders that would
 * exceed capacity. Invoice items stay pending until payment issues real tickets.
 */
async function assertCapacity(
  tx: Parameters<Parameters<Database['transaction']>[0]>[0],
  lines: Array<{ type: TicketType; quantity: number; validDate: string }>,
): Promise<void> {
  const requested = new Map<
    string,
    { type: TicketType; validDate: string; quantity: number }
  >();

  for (const line of lines) {
    const key = `${line.type.id}:${line.validDate}`;
    const current = requested.get(key);
    if (current) {
      current.quantity += line.quantity;
    } else {
      requested.set(key, {
        type: line.type,
        validDate: line.validDate,
        quantity: line.quantity,
      });
    }
  }

  for (const group of requested.values()) {
    if (group.type.capacity === null) {
      continue;
    }

    const [issued] = await tx
      .select({ value: count() })
      .from(tickets)
      .where(
        and(
          eq(tickets.ticketTypeId, group.type.id),
          eq(tickets.validDate, group.validDate),
          inArray(tickets.status, ['valid', 'used']),
        ),
      );

    const remaining = group.type.capacity - (issued?.value ?? 0);
    if (group.quantity > remaining) {
      throw AppError.conflict(
        `Not enough capacity left for "${group.type.name}" on ${group.validDate}`,
      );
    }
  }
}

export const invoiceService = createInvoiceService(db);
