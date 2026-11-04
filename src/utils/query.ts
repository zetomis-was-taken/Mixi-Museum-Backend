import { AppError } from './errors.js';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Raw `page` / `page_size` query parameters as received from HTTP. */
export interface PaginationQuery {
  page?: number | string;
  page_size?: number | string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
}

/** Paginated collection returned by list services. */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

function positiveInteger(value: number | string, field: string): number {
  const parsed = typeof value === 'number' ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw AppError.badRequest('Invalid pagination parameters', [
      { field, message: 'must be a positive integer' },
    ]);
  }

  return parsed;
}

/**
 * Normalizes `page` / `page_size` query parameters.
 *
 * `page` defaults to `1`, `page_size` to `20`, and `page_size` is capped at `100`.
 * Invalid values raise a `400 VALIDATION_ERROR` instead of silently paginating.
 */
export function parsePagination(query: PaginationQuery = {}): Pagination {
  const page = query.page === undefined ? 1 : positiveInteger(query.page, 'page');
  const pageSize =
    query.page_size === undefined
      ? DEFAULT_PAGE_SIZE
      : Math.min(positiveInteger(query.page_size, 'page_size'), MAX_PAGE_SIZE);

  return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

export function paginate<T>(items: T[], total: number, pagination: Pagination): Paginated<T> {
  return { items, page: pagination.page, pageSize: pagination.pageSize, total };
}

/**
 * Builds a case-insensitive `LIKE` pattern from user search text.
 * Escapes the `%`, `_` and `\` wildcard characters.
 */
export function containsPattern(term: string): string {
  return `%${term.trim().replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
}
