export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMetadata;
}

/**
 * Parses page and limit parameters from request query and computes database offset.
 */
export function parsePagination(
  query: { page?: unknown; limit?: unknown },
  options: PaginationOptions = {},
): PaginationParams {
  const defaultLimit = options.defaultLimit ?? 20;
  const maxLimit = options.maxLimit ?? 100;

  const rawPage = Number.parseInt(String(query.page), 10);
  const rawLimit = Number.parseInt(String(query.limit), 10);

  const page = Number.isInteger(rawPage) && rawPage >= 1 ? rawPage : 1;
  let limit = Number.isInteger(rawLimit) && rawLimit >= 1 ? rawLimit : defaultLimit;

  if (limit > maxLimit) {
    limit = maxLimit;
  }

  const offset = (page - 1) * limit;

  return { page, limit, offset };
}

/**
 * Builds a standard paginated response object.
 */
export function buildPaginationResult<T>(
  items: T[],
  totalItems: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / limit) : 1;

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

