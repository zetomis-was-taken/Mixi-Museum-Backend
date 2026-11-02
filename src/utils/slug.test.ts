import { describe, expect, it } from 'vitest';
import { slugify } from './slug.js';

describe('slugify', () => {
  it('converts basic text to lowercase slug', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('removes Vietnamese accents and special characters', () => {
    expect(slugify('Bảo Tàng Lịch Sử Việt Nam')).toBe('bao-tang-lich-su-viet-nam');
    expect(slugify('Trưng bày Đồ gốm & Mỹ nghệ #1!')).toBe('trung-bay-do-gom-my-nghe-1');
  });

  it('handles multiple consecutive spaces and dashes', () => {
    expect(slugify('  Ancient---Art   Gallery  ')).toBe('ancient-art-gallery');
  });

  it('handles empty strings and edge cases', () => {
    expect(slugify('')).toBe('');
    expect(slugify('---')).toBe('');
  });
});

