import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';

export type UserRole = 'user' | 'admin';

export interface AuthTokenPayload {
  sub: string;
  email: string;
  roles: UserRole[];
}

/**
 * Signs an authentication JWT token.
 */
export function signToken(
  payload: AuthTokenPayload,
  expiresIn: string = env.JWT_EXPIRES_IN,
): string {
  const options: SignOptions = {
    expiresIn: expiresIn as unknown as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Verifies and decodes an authentication JWT token.
 * Throws an error if the token is invalid or expired.
 */
export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  return decoded as AuthTokenPayload;
}

