import { describe, expect, it } from 'vitest';
import { buildPaginationResult, parsePagination } from './pagination.js';

describe('parsePagination', () => {
  it('uses default values when query is empty', () => {
    const result = parsePagination({});
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('correctly calculates offset from page and limit', () => {
    const result = parsePagination({ page: '3', limit: '10' });
    expect(result).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it('clamps invalid or negative numbers to minimum values', () => {
    const result = parsePagination({ page: '-5', limit: '0' });
    expect(result).toEqual({ page: 1, limit: 20, offset: 0 });
  });

  it('respects maximum limit', () => {
    const result = parsePagination({ page: '1', limit: '500' }, { maxLimit: 50 });
    expect(result).toEqual({ page: 1, limit: 50, offset: 0 });
  });
});

describe('buildPaginationResult', () => {
  it('constructs correct pagination metadata', () => {
    const items = ['a', 'b', 'c'];
    const result = buildPaginationResult(items, 25, 2, 10);

    expect(result).toEqual({
      items,
      pagination: {
        page: 2,
        limit: 10,
        totalItems: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      },
    });
  });

  it('handles edge case when totalItems is 0', () => {
    const result = buildPaginationResult([], 0, 1, 10);

    expect(result.pagination).toEqual({
      page: 1,
      limit: 10,
      totalItems: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });
});

