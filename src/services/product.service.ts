import { and, asc, count, desc, eq, ilike } from 'drizzle-orm';
import { db, type Database } from '../db/index.js';
import { productImages, products } from '../db/schemas/index.js';
import { isForeignKeyViolation, isUniqueViolation } from '../utils/db-errors.js';
import { AppError } from '../utils/errors.js';
import {
  containsPattern,
  paginate,
  parsePagination,
  type Paginated,
  type PaginationQuery,
} from '../utils/query.js';
import { assertNonEmpty, assertSlug, toMinorUnits } from '../utils/validation.js';
import { requirePublishedMuseumBySlug } from './support.js';

type Product = typeof products.$inferSelect;
type ProductImage = typeof productImages.$inferSelect;
type ContentStatus = Product['status'];

export interface PublicProductListQuery extends PaginationQuery {
  q?: string;
}

export interface AdminProductListQuery extends PaginationQuery {
  q?: string;
  status?: ContentStatus;
}

export interface CreateProductInput {
  name: string;
  slug: string;
  description?: string | null;
  priceMinor: number | bigint | string;
  stockQuantity?: number;
  status?: ContentStatus;
}

export interface UpdateProductInput {
  name?: string;
  slug?: string;
  description?: string | null;
  priceMinor?: number | bigint | string;
  stockQuantity?: number;
  status?: ContentStatus;
}

export interface AddProductImageInput {
  storagePath: string;
  altText?: string | null;
  position?: number;
}

export interface UpdateProductImageInput {
  altText?: string | null;
  position?: number;
}

export function createProductService(database: Database) {
  async function requireProduct(museumId: string, productId: string): Promise<Product> {
    const [product] = await database
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.museumId, museumId)))
      .limit(1);

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    return product;
  }

  async function listImages(productId: string): Promise<ProductImage[]> {
    return database
      .select()
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(asc(productImages.position), asc(productImages.createdAt));
  }

  async function listPublicProducts(
    museumSlug: string,
    query: PublicProductListQuery = {},
  ): Promise<Paginated<Product>> {
    const museum = await requirePublishedMuseumBySlug(database, museumSlug, 'shop');
    const pagination = parsePagination(query);
    const term = query.q?.trim();

    const where = and(
      eq(products.museumId, museum.id),
      eq(products.status, 'published'),
      term ? ilike(products.name, containsPattern(term)) : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(products)
        .where(where)
        .orderBy(asc(products.name))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(products).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getPublicProduct(museumSlug: string, productSlug: string) {
    const museum = await requirePublishedMuseumBySlug(database, museumSlug, 'shop');
    const [product] = await database
      .select()
      .from(products)
      .where(
        and(
          eq(products.museumId, museum.id),
          eq(products.slug, assertSlug(productSlug)),
          eq(products.status, 'published'),
        ),
      )
      .limit(1);

    if (!product) {
      throw AppError.notFound('Product not found');
    }

    return { product, images: await listImages(product.id) };
  }

  async function listProducts(
    museumId: string,
    query: AdminProductListQuery = {},
  ): Promise<Paginated<Product>> {
    const pagination = parsePagination(query);
    const term = query.q?.trim();

    const where = and(
      eq(products.museumId, museumId),
      term ? ilike(products.name, containsPattern(term)) : undefined,
      query.status ? eq(products.status, query.status) : undefined,
    );

    const [items, totalRows] = await Promise.all([
      database
        .select()
        .from(products)
        .where(where)
        .orderBy(desc(products.createdAt))
        .limit(pagination.limit)
        .offset(pagination.offset),
      database.select({ value: count() }).from(products).where(where),
    ]);

    return paginate(items, totalRows[0]?.value ?? 0, pagination);
  }

  async function getProduct(museumId: string, productId: string) {
    const product = await requireProduct(museumId, productId);
    return { product, images: await listImages(product.id) };
  }

  async function createProduct(
    museumId: string,
    input: CreateProductInput,
  ): Promise<Product> {
    try {
      const [product] = await database
        .insert(products)
        .values({
          museumId,
          name: assertNonEmpty(input.name, 'name'),
          slug: assertSlug(input.slug),
          description: input.description?.trim() || null,
          priceMinor: toMinorUnits(input.priceMinor, 'price_minor'),
          stockQuantity: assertStock(input.stockQuantity ?? 0),
          status: input.status ?? 'draft',
        })
        .returning();

      if (!product) {
        throw new Error('Product insert returned no row');
      }

      return product;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A product with this slug already exists');
      }
      throw error;
    }
  }

  async function updateProduct(
    museumId: string,
    productId: string,
    input: UpdateProductInput,
  ): Promise<Product> {
    await requireProduct(museumId, productId);

    const values: Partial<typeof products.$inferInsert> = {};

    if (input.name !== undefined) {
      values.name = assertNonEmpty(input.name, 'name');
    }
    if (input.slug !== undefined) {
      values.slug = assertSlug(input.slug);
    }
    if (input.description !== undefined) {
      values.description = input.description?.trim() || null;
    }
    if (input.priceMinor !== undefined) {
      values.priceMinor = toMinorUnits(input.priceMinor, 'price_minor');
    }
    if (input.stockQuantity !== undefined) {
      values.stockQuantity = assertStock(input.stockQuantity);
    }
    if (input.status !== undefined) {
      values.status = input.status;
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No product fields to update');
    }

    values.updatedAt = new Date();

    try {
      const [updated] = await database
        .update(products)
        .set(values)
        .where(and(eq(products.id, productId), eq(products.museumId, museumId)))
        .returning();

      if (!updated) {
        throw AppError.notFound('Product not found');
      }

      return updated;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw AppError.conflict('A product with this slug already exists');
      }
      throw error;
    }
  }

  async function setProductStatus(
    museumId: string,
    productId: string,
    status: ContentStatus,
  ): Promise<Product> {
    const [updated] = await database
      .update(products)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(products.id, productId), eq(products.museumId, museumId)))
      .returning();

    if (!updated) {
      throw AppError.notFound('Product not found');
    }

    return updated;
  }

  async function publishProduct(museumId: string, productId: string) {
    return setProductStatus(museumId, productId, 'published');
  }

  async function archiveProduct(museumId: string, productId: string) {
    return setProductStatus(museumId, productId, 'archived');
  }

  /** Deletes a product; invoice-item history (`ON DELETE RESTRICT`) blocks deletion. */
  async function deleteProduct(museumId: string, productId: string): Promise<Product> {
    try {
      const [deleted] = await database
        .delete(products)
        .where(and(eq(products.id, productId), eq(products.museumId, museumId)))
        .returning();

      if (!deleted) {
        throw AppError.notFound('Product not found');
      }

      return deleted;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw AppError.conflict('Product has invoice history and cannot be deleted');
      }
      throw error;
    }
  }

  async function addImage(
    museumId: string,
    productId: string,
    input: AddProductImageInput,
  ): Promise<ProductImage> {
    await requireProduct(museumId, productId);

    const [image] = await database
      .insert(productImages)
      .values({
        productId,
        storagePath: assertNonEmpty(input.storagePath, 'storage_path'),
        altText: input.altText?.trim() || null,
        position: assertPosition(input.position),
      })
      .returning();

    if (!image) {
      throw new Error('Product image insert returned no row');
    }

    return image;
  }

  async function updateImage(
    museumId: string,
    productId: string,
    imageId: string,
    input: UpdateProductImageInput,
  ): Promise<ProductImage> {
    await requireProductImage(museumId, productId, imageId);

    const values: Partial<typeof productImages.$inferInsert> = {};

    if (input.altText !== undefined) {
      values.altText = input.altText?.trim() || null;
    }
    if (input.position !== undefined) {
      values.position = assertPosition(input.position);
    }

    if (Object.keys(values).length === 0) {
      throw AppError.badRequest('No image fields to update');
    }

    const [updated] = await database
      .update(productImages)
      .set(values)
      .where(eq(productImages.id, imageId))
      .returning();

    if (!updated) {
      throw AppError.notFound('Product image not found');
    }

    return updated;
  }

  async function deleteImage(
    museumId: string,
    productId: string,
    imageId: string,
  ): Promise<ProductImage> {
    await requireProductImage(museumId, productId, imageId);

    const [deleted] = await database
      .delete(productImages)
      .where(eq(productImages.id, imageId))
      .returning();

    if (!deleted) {
      throw AppError.notFound('Product image not found');
    }

    return deleted;
  }

  async function requireProductImage(
    museumId: string,
    productId: string,
    imageId: string,
  ): Promise<ProductImage> {
    const [image] = await database
      .select({ image: productImages })
      .from(productImages)
      .innerJoin(products, eq(products.id, productImages.productId))
      .where(
        and(
          eq(productImages.id, imageId),
          eq(productImages.productId, productId),
          eq(products.museumId, museumId),
        ),
      )
      .limit(1);

    if (!image) {
      throw AppError.notFound('Product image not found');
    }

    return image.image;
  }

  return {
    listPublicProducts,
    getPublicProduct,
    listProducts,
    getProduct,
    createProduct,
    updateProduct,
    publishProduct,
    archiveProduct,
    deleteProduct,
    addImage,
    updateImage,
    deleteImage,
  };
}

function assertStock(stock: number): number {
  if (!Number.isInteger(stock) || stock < 0) {
    throw AppError.badRequest('Invalid stock_quantity', [
      { field: 'stock_quantity', message: 'must be a non-negative integer' },
    ]);
  }

  return stock;
}

function assertPosition(position: number | undefined): number {
  if (position === undefined) {
    return 0;
  }

  if (!Number.isInteger(position) || position < 0) {
    throw AppError.badRequest('Invalid position', [
      { field: 'position', message: 'must be a non-negative integer' },
    ]);
  }

  return position;
}

export const productService = createProductService(db);
