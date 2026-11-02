/**
 * Converts a text string into a clean, URL-safe slug.
 * Normalizes Vietnamese diacritics and removes non-alphanumeric characters.
 */
export function slugify(text: string): string {
  if (!text) {
    return '';
  }

  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove invalid characters
    .replace(/[\s-]+/g, '-') // collapse whitespace and dashes into single dash
    .replace(/^-+|-+$/g, ''); // remove leading/trailing dashes
}

