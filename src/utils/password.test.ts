import { describe, expect, it } from 'vitest';
import { comparePassword, hashPassword } from './password.js';

describe('password utils', () => {
  it('hashes a plain password into a bcrypt hash', async () => {
    const plain = 'secretPassword123!';
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true);
  });

  it('correctly compares a valid password with its hash', async () => {
    const plain = 'mypassword';
    const hash = await hashPassword(plain);

    const isMatch = await comparePassword(plain, hash);
    expect(isMatch).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const plain = 'mypassword';
    const hash = await hashPassword(plain);

    const isMatch = await comparePassword('wrongpassword', hash);
    expect(isMatch).toBe(false);
  });
});

