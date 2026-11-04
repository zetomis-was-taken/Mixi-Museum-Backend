import { AppError } from './errors.js';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims and lowercases an email so it matches the stored normalized form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw AppError.badRequest(`Invalid ${field}`, [{ field, message: 'must not be empty' }]);
  }

  return trimmed;
}

export function assertEmail(value: string, field = 'email'): string {
  const normalized = normalizeEmail(value);

  if (!EMAIL_PATTERN.test(normalized)) {
    throw AppError.badRequest(`Invalid ${field}`, [{ field, message: 'must be a valid email address' }]);
  }

  return normalized;
}

/** Validates a URL-safe slug (`lowercase-kebab-case`). */
export function assertSlug(value: string, field = 'slug'): string {
  const trimmed = value.trim();

  if (!SLUG_PATTERN.test(trimmed)) {
    throw AppError.badRequest(`Invalid ${field}`, [
      { field, message: 'must be lowercase letters, numbers and single hyphens' },
    ]);
  }

  return trimmed;
}

/** Validates a `YYYY-MM-DD` calendar date. */
export function assertIsoDate(value: string, field = 'date'): string {
  const trimmed = value.trim();

  if (!ISO_DATE_PATTERN.test(trimmed)) {
    throw AppError.badRequest(`Invalid ${field}`, [{ field, message: 'must use the YYYY-MM-DD format' }]);
  }

  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw AppError.badRequest(`Invalid ${field}`, [{ field, message: 'must be a real calendar date' }]);
  }

  return trimmed;
}

/** Normalizes `HH:MM` or `HH:MM:SS` to `HH:MM:SS` for PostgreSQL `time` columns. */
export function normalizeTimeOfDay(value: string, field = 'time'): string {
  const match = TIME_OF_DAY_PATTERN.exec(value.trim());

  if (!match) {
    throw AppError.badRequest(`Invalid ${field}`, [{ field, message: 'must use the HH:MM or HH:MM:SS format' }]);
  }

  const [, hours = '', minutes = '', seconds = '00'] = match;
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Converts an integer minor-unit amount to `bigint`, rejecting fractions and
 * negative values so services never pass floats to money columns.
 */
export function toMinorUnits(value: number | bigint | string, field = 'amount'): bigint {
  if (typeof value === 'bigint') {
    if (value < 0n) {
      throw AppError.badRequest(`Invalid ${field}`, [{ field, message: 'must not be negative' }]);
    }
    return value;
  }

  const trimmed = String(value).trim();
  if (!/^\d+$/.test(trimmed)) {
    throw AppError.badRequest(`Invalid ${field}`, [{ field, message: 'must be a non-negative integer' }]);
  }

  return BigInt(trimmed);
}
