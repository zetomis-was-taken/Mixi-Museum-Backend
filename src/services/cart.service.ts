import { and, asc, eq, sql } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { cartItems, carts, products } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import { requireMuseumFeature } from './support.js';

type Cart = typeof carts.$inferSelect;
type CartItem = typeof cartItems.$inferSelect;

export interface AddCartItemInput {
  productId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  quantity: number;
}

export function createCartService(database: Database) {
  async function findCart(museumId: string, userId: string): Promise<Cart | undefined> {
    const [cart] = await database
      .select()
      .from(carts)
      .where(and(eq(carts.museumId, museumId), eq(carts.userId, userId)))
      .limit(1);

    return cart;
  }

  async function requireCart(museumId: string, userId: string): Promise<Cart> {
    const cart = await findCart(museumId, userId);

    if (!cart) {
      throw AppError.notFound('Cart not found');
    }

    return cart;
  }

  /** A user has at most one cart per museum; it is created lazily on first access. */
  async function getOrCreateCart(museumId: string, userId: string): Promise<Cart> {
    const existing = await findCart(museumId, userId);
    if (existing) {
      return existing;
    }

    const [created] = await database
      .insert(carts)
      .values({ museumId, userId })
      .onConflictDoNothing({ target: [carts.userId, carts.museumId] })
      .returning();

    if (created) {
      return created;
    }

    // Another request may have created the cart concurrently.
    const concurrent = await findCart(museumId, userId);
    if (!concurrent) {
      throw AppError.conflict('Cart could not be created');
    }

    return concurrent;
  }

  async function getCart(museumId: string, userId: string) {
    await requireMuseumFeature(database, museumId, 'shop');
    const cart = await getOrCreateCart(museumId, userId);
    const rows = await database
      .select({ item: cartItems, product: products })
      .from(cartItems)
      .innerJoin(products, eq(products.id, cartItems.productId))
      .where(eq(cartItems.cartId, cart.id))
      .orderBy(asc(cartItems.createdAt));

    const items = rows.map(({ item, product }) => ({
      ...item,
      product,
      available: product.status === 'published' && product.stockQuantity >= item.quantity,
    }));

    const subtotalMinor = rows.reduce(
      (total, { item, product }) => total + product.priceMinor * BigInt(item.quantity),
      0n,
    );

    return { cart, items, subtotalMinor };
  }

  async function addItem(
    museumId: string,
    userId: string,
    input: AddCartItemInput,
  ): Promise<CartItem> {
    await requireMuseumFeature(database, museumId, 'shop');
    const quantity = assertQuantity(input.quantity);

    const [product] = await database
      .select()
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.museumId, museumId)))
      .limit(1);

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    if (product.status !== 'published') {
      throw AppError.conflict('Product is not available for purchase');
    }

    const cart = await getOrCreateCart(museumId, userId);

    const [item] = await database
      .insert(cartItems)
      .values({
        cartId: cart.id,
        productId: product.id,
        museumId,
        quantity,
      })
      .onConflictDoUpdate({
        target: [cartItems.cartId, cartItems.productId],
        set: { quantity: sql`${cartItems.quantity} + ${quantity}` },
      })
      .returning();

    if (!item) {
      throw new Error('Cart item insert returned no row');
    }

    await touchCart(cart.id);
    return item;
  }

  /** Replaces an item's quantity; the quantity must be at least `1`. */
  async function updateItem(
    museumId: string,
    userId: string,
    itemId: string,
    input: UpdateCartItemInput,
  ): Promise<CartItem> {
    await requireMuseumFeature(database, museumId, 'shop');
    const quantity = assertQuantity(input.quantity);
    const cart = await requireCart(museumId, userId);

    const [updated] = await database
      .update(cartItems)
      .set({ quantity })
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(cartItems.cartId, cart.id),
          eq(cartItems.museumId, museumId),
        ),
      )
      .returning();

    if (!updated) {
      throw AppError.notFound('Cart item not found');
    }

    await touchCart(cart.id);
    return updated;
  }

  async function removeItem(
    museumId: string,
    userId: string,
    itemId: string,
  ): Promise<CartItem> {
    await requireMuseumFeature(database, museumId, 'shop');
    const cart = await requireCart(museumId, userId);

    const [deleted] = await database
      .delete(cartItems)
      .where(
        and(
          eq(cartItems.id, itemId),
          eq(cartItems.cartId, cart.id),
          eq(cartItems.museumId, museumId),
        ),
      )
      .returning();

    if (!deleted) {
      throw AppError.notFound('Cart item not found');
    }

    await touchCart(cart.id);
    return deleted;
  }

  /** Clears every item in the user's cart for the museum. */
  async function clearCart(museumId: string, userId: string): Promise<number> {
    await requireMuseumFeature(database, museumId, 'shop');
    const cart = await requireCart(museumId, userId);

    const deleted = await database
      .delete(cartItems)
      .where(eq(cartItems.cartId, cart.id))
      .returning({ id: cartItems.id });

    await touchCart(cart.id);
    return deleted.length;
  }

  async function touchCart(cartId: string): Promise<void> {
    await database.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  }

  return { getCart, addItem, updateItem, removeItem, clearCart };
}

function assertQuantity(quantity: number): number {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw AppError.badRequest('Invalid quantity', [
      { field: 'quantity', message: 'must be an integer of at least 1' },
    ]);
  }

  return quantity;
}

export const cartService = createCartService(db);
