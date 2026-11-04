const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

/**
 * Finds a PostgreSQL error code, following `cause` chains because Drizzle may
 * wrap driver errors in a query error.
 */
function pgErrorCode(error: unknown, depth = 0): string | undefined {
  if (!error || typeof error !== 'object' || depth > 5) {
    return undefined;
  }

  const code = (error as { code?: unknown }).code;
  if (typeof code === 'string' && /^\d{5}$/.test(code)) {
    return code;
  }

  return pgErrorCode((error as { cause?: unknown }).cause, depth + 1);
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorCode(error) === FOREIGN_KEY_VIOLATION;
}

export function isCheckViolation(error: unknown): boolean {
  return pgErrorCode(error) === CHECK_VIOLATION;
}
