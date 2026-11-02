import { describe, expect, it } from 'vitest';
import { type AuthTokenPayload, signToken, verifyToken } from './jwt.js';

describe('jwt utils', () => {
  const samplePayload: AuthTokenPayload = {
    sub: '123e4567-e89b-12d3-a456-426614174000',
    email: 'user@museum.com',
    roles: ['user'],
  };

  it('signs and verifies a valid JWT payload', () => {
    const token = signToken(samplePayload);
    expect(typeof token).toBe('string');

    const decoded = verifyToken(token);
    expect(decoded.sub).toBe(samplePayload.sub);
    expect(decoded.email).toBe(samplePayload.email);
    expect(decoded.roles).toEqual(samplePayload.roles);
  });

  it('throws an error when verifying an invalid or tampered token', () => {
    expect(() => verifyToken('invalid.token.here')).toThrow();
  });
});

