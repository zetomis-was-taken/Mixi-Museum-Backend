import { and, count, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  cartItems,
  carts,
  invoiceItems,
  invoices,
  museums,
  products,
  users,
} from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import { type PaginatedResult, buildPaginationResult, parsePagination } from '../utils/pagination.js';
import type {
  InvoiceKind,
  InvoiceStatus,
  QueryInvoicesInput,
} from '../validators/invoice.validator.js';

export interface CreateInvoiceItemInput {
  productId?: string;
  ticketTypeId?: string;
  description: string;
  unitPrice: string | number;
  quantity: number;
}

export interface CreateInvoiceParams {
  userId: string;
  museumId: string;
  kind: InvoiceKind;
  currency: string;
  status?: InvoiceStatus;
  items: CreateInvoiceItemInput[];
}

export interface InvoiceItemDetail {
  id: string;
  invoiceId: string;
  productId: string | null;
  ticketTypeId: string | null;
  description: string;
  unitPrice: string;
  quantity: number;
}

export interface InvoiceWithDetails {
  id: string;
  userId: string;
  museumId: string;
  kind: InvoiceKind;
  status: InvoiceStatus;
  subtotal: string;
  total: string;
  currency: string;
  createdAt: Date;
  paidAt: Date | null;
  items: InvoiceItemDetail[];
  user?: {
    email: string;
    displayName: string;
  };
  museum?: {
    name: string;
    slug: string;
  };
}

export class InvoiceService {
  /**
   * Core invoice creation function used across merchandise checkout and ticket sales.
   * Can run standalone or inside an external transaction.
   */
  async createInvoice(
    params: CreateInvoiceParams,
    existingTx?: any,
  ): Promise<InvoiceWithDetails> {
    if (!params.items || params.items.length === 0) {
      throw AppError.badRequest('Invoice must contain at least one item');
    }

    let subtotalNum = 0;
    for (const item of params.items) {
      const price = Number(item.unitPrice);
      if (Number.isNaN(price) || price < 0) {
        throw AppError.badRequest(`Invalid unit price for item: ${item.description}`);
      }
      if (item.quantity < 1) {
        throw AppError.badRequest(`Quantity must be >= 1 for item: ${item.description}`);
      }
      subtotalNum += price * item.quantity;
    }

    const subtotal = subtotalNum.toFixed(2);
    const total = subtotal;
    const status = params.status ?? 'pending';
    const paidAt = status === 'paid' ? new Date() : null;

    const execute = async (tx: any) => {
      const [invoice] = await tx
        .insert(invoices)
        .values({
          userId: params.userId,
          museumId: params.museumId,
          kind: params.kind,
          status,
          subtotal,
          total,
          currency: params.currency,
          paidAt,
        })
        .returning();

      if (!invoice) {
        throw new AppError('Failed to create invoice record');
      }

      const itemsToInsert = params.items.map((item) => ({
        invoiceId: invoice.id,
        productId: item.productId ?? null,
        ticketTypeId: item.ticketTypeId ?? null,
        description: item.description,
        unitPrice: Number(item.unitPrice).toFixed(2),
        quantity: item.quantity,
      }));

      const insertedItems = await tx
        .insert(invoiceItems)
        .values(itemsToInsert)
        .returning();

      return {
        ...invoice,
        items: insertedItems,
      };
    };

    if (existingTx) {
      return execute(existingTx);
    }

    return db.transaction(execute);
  }

  /**
   * Checks out the user's merchandise cart for a specific museum.
   * Verifies shop_enabled, stock, updates inventory, creates invoice, and clears cart.
   */
  async checkoutCart(userId: string, museumId: string): Promise<InvoiceWithDetails> {
    const [museum] = await db
      .select({
        id: museums.id,
        shopEnabled: museums.shopEnabled,
        currency: museums.currency,
      })
      .from(museums)
      .where(eq(museums.id, museumId));

    if (!museum) {
      throw AppError.notFound('Museum not found');
    }

    if (!museum.shopEnabled) {
      throw AppError.badRequest('Merchandise shop is currently disabled for this museum');
    }

    const [cart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.userId, userId), eq(carts.museumId, museumId)));

    if (!cart) {
      throw AppError.badRequest('Cart is empty');
    }

    const items = await db
      .select({
        cartItemId: cartItems.id,
        productId: products.id,
        productName: products.name,
        price: products.price,
        stockQuantity: products.stockQuantity,
        status: products.status,
        quantity: cartItems.quantity,
      })
      .from(cartItems)
      .innerJoin(products, eq(cartItems.productId, products.id))
      .where(eq(cartItems.cartId, cart.id));

    if (items.length === 0) {
      throw AppError.badRequest('Cart is empty');
    }

    // Verify stock availability
    for (const item of items) {
      if (item.status !== 'published') {
        throw AppError.badRequest(`Product "${item.productName}" is no longer available`);
      }
      if (item.stockQuantity < item.quantity) {
        throw AppError.badRequest(
          `Insufficient stock for "${item.productName}". Available: ${item.stockQuantity}, Requested: ${item.quantity}`,
        );
      }
    }

    return db.transaction(async (tx) => {
      // 1. Decrement stock for each product
      for (const item of items) {
        await tx
          .update(products)
          .set({
            stockQuantity: sql`${products.stockQuantity} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }

      // 2. Create invoice and line items
      const invoice = await this.createInvoice(
        {
          userId,
          museumId,
          kind: 'merchandise',
          currency: museum.currency,
          status: 'paid',
          items: items.map((i) => ({
            productId: i.productId,
            description: i.productName,
            unitPrice: i.price,
            quantity: i.quantity,
          })),
        },
        tx,
      );

      // 3. Clear cart
      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));

      return invoice;
    });
  }

  /**
   * Lists invoice history for the current authenticated user.
   */
  async listUserInvoices(
    userId: string,
    query: QueryInvoicesInput,
  ): Promise<PaginatedResult<InvoiceWithDetails>> {
    const { page, limit, offset } = parsePagination(query);

    const conditions = [eq(invoices.userId, userId)];

    if (query.kind) {
      conditions.push(eq(invoices.kind, query.kind));
    }

    if (query.status) {
      conditions.push(eq(invoices.status, query.status));
    }

    const whereClause = and(...conditions);

    const [totalRow] = await db
      .select({ total: count() })
      .from(invoices)
      .where(whereClause);

    const total = totalRow?.total ? Number(totalRow.total) : 0;

    const rows = await db
      .select({
        id: invoices.id,
        userId: invoices.userId,
        museumId: invoices.museumId,
        kind: invoices.kind,
        status: invoices.status,
        subtotal: invoices.subtotal,
        total: invoices.total,
        currency: invoices.currency,
        createdAt: invoices.createdAt,
        paidAt: invoices.paidAt,
        museumName: museums.name,
        museumSlug: museums.slug,
      })
      .from(invoices)
      .innerJoin(museums, eq(invoices.museumId, museums.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(invoices.createdAt));

    if (rows.length === 0) {
      return buildPaginationResult([], total, page, limit);
    }

    const invoiceIds = rows.map((r) => r.id);
    const allItems = await db
      .select()
      .from(invoiceItems)
      .where(inArray(invoiceItems.invoiceId, invoiceIds));

    const itemsMap = new Map<string, InvoiceItemDetail[]>();
    for (const item of allItems) {
      const list = itemsMap.get(item.invoiceId) ?? [];
      list.push(item);
      itemsMap.set(item.invoiceId, list);
    }

    const result: InvoiceWithDetails[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      museumId: row.museumId,
      kind: row.kind,
      status: row.status,
      subtotal: row.subtotal,
      total: row.total,
      currency: row.currency,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      museum: {
        name: row.museumName,
        slug: row.museumSlug,
      },
      items: itemsMap.get(row.id) ?? [],
    }));

    return buildPaginationResult(result, total, page, limit);
  }

  /**
   * Retrieves single invoice detail for the current authenticated user.
   */
  async getUserInvoice(userId: string, invoiceId: string): Promise<InvoiceWithDetails> {
    const [row] = await db
      .select({
        id: invoices.id,
        userId: invoices.userId,
        museumId: invoices.museumId,
        kind: invoices.kind,
        status: invoices.status,
        subtotal: invoices.subtotal,
        total: invoices.total,
        currency: invoices.currency,
        createdAt: invoices.createdAt,
        paidAt: invoices.paidAt,
        museumName: museums.name,
        museumSlug: museums.slug,
      })
      .from(invoices)
      .innerJoin(museums, eq(invoices.museumId, museums.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)));

    if (!row) {
      throw AppError.notFound('Invoice not found');
    }

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));

    return {
      id: row.id,
      userId: row.userId,
      museumId: row.museumId,
      kind: row.kind,
      status: row.status,
      subtotal: row.subtotal,
      total: row.total,
      currency: row.currency,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      museum: {
        name: row.museumName,
        slug: row.museumSlug,
      },
      items,
    };
  }

  /**
   * Admin lists invoices for their museum.
   */
  async listMuseumInvoices(
    museumId: string,
    query: QueryInvoicesInput,
  ): Promise<PaginatedResult<InvoiceWithDetails>> {
    const { page, limit, offset } = parsePagination(query);

    const conditions = [eq(invoices.museumId, museumId)];

    if (query.kind) {
      conditions.push(eq(invoices.kind, query.kind));
    }

    if (query.status) {
      conditions.push(eq(invoices.status, query.status));
    }

    const whereClause = and(...conditions);

    const [totalRow] = await db
      .select({ total: count() })
      .from(invoices)
      .where(whereClause);

    const total = totalRow?.total ? Number(totalRow.total) : 0;

    const rows = await db
      .select({
        id: invoices.id,
        userId: invoices.userId,
        museumId: invoices.museumId,
        kind: invoices.kind,
        status: invoices.status,
        subtotal: invoices.subtotal,
        total: invoices.total,
        currency: invoices.currency,
        createdAt: invoices.createdAt,
        paidAt: invoices.paidAt,
        userEmail: users.email,
        userDisplayName: users.displayName,
      })
      .from(invoices)
      .innerJoin(users, eq(invoices.userId, users.id))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(invoices.createdAt));

    if (rows.length === 0) {
      return buildPaginationResult([], total, page, limit);
    }

    const invoiceIds = rows.map((r) => r.id);
    const allItems = await db
      .select()
      .from(invoiceItems)
      .where(inArray(invoiceItems.invoiceId, invoiceIds));

    const itemsMap = new Map<string, InvoiceItemDetail[]>();
    for (const item of allItems) {
      const list = itemsMap.get(item.invoiceId) ?? [];
      list.push(item);
      itemsMap.set(item.invoiceId, list);
    }

    const result: InvoiceWithDetails[] = rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      museumId: row.museumId,
      kind: row.kind,
      status: row.status,
      subtotal: row.subtotal,
      total: row.total,
      currency: row.currency,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      user: {
        email: row.userEmail,
        displayName: row.userDisplayName,
      },
      items: itemsMap.get(row.id) ?? [],
    }));

    return buildPaginationResult(result, total, page, limit);
  }

  /**
   * Admin retrieves single invoice detail in their museum.
   */
  async getMuseumInvoice(
    museumId: string,
    invoiceId: string,
  ): Promise<InvoiceWithDetails> {
    const [row] = await db
      .select({
        id: invoices.id,
        userId: invoices.userId,
        museumId: invoices.museumId,
        kind: invoices.kind,
        status: invoices.status,
        subtotal: invoices.subtotal,
        total: invoices.total,
        currency: invoices.currency,
        createdAt: invoices.createdAt,
        paidAt: invoices.paidAt,
        userEmail: users.email,
        userDisplayName: users.displayName,
      })
      .from(invoices)
      .innerJoin(users, eq(invoices.userId, users.id))
      .where(and(eq(invoices.id, invoiceId), eq(invoices.museumId, museumId)));

    if (!row) {
      throw AppError.notFound('Invoice not found in this museum');
    }

    const items = await db
      .select()
      .from(invoiceItems)
      .where(eq(invoiceItems.invoiceId, invoiceId));

    return {
      id: row.id,
      userId: row.userId,
      museumId: row.museumId,
      kind: row.kind,
      status: row.status,
      subtotal: row.subtotal,
      total: row.total,
      currency: row.currency,
      createdAt: row.createdAt,
      paidAt: row.paidAt,
      user: {
        email: row.userEmail,
        displayName: row.userDisplayName,
      },
      items,
    };
  }
}

export const invoiceService = new InvoiceService();

