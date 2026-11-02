import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { museumAdmins, museums, userRoles, users } from '../db/schemas/index.js';
import { AppError } from '../utils/errors.js';
import { type UserRole, signToken } from '../utils/jwt.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
} from '../validators/auth.validator.js';

export interface UserResponse {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  roles: UserRole[];
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthResult {
  user: UserResponse;
  token: string;
}

export interface MuseumMembership {
  museumId: string;
  museumName: string;
  museumSlug: string;
  isOwner: boolean;
  tierId: string | null;
}

export interface MeResponse {
  user: UserResponse;
  memberships: MuseumMembership[];
}

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, input.email));

    if (existing.length > 0) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);

    const createdUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email,
          passwordHash,
          displayName: input.displayName,
          phone: input.phone ?? null,
        })
        .returning();

      if (!user) {
        throw new AppError('Failed to create user account');
      }

      await tx.insert(userRoles).values({
        userId: user.id,
        role: 'user',
      });

      return user;
    });

    const roles: UserRole[] = ['user'];
    const token = signToken({
      sub: createdUser.id,
      email: createdUser.email,
      roles,
    });

    return {
      user: {
        id: createdUser.id,
        email: createdUser.email,
        displayName: createdUser.displayName,
        phone: createdUser.phone,
        avatarUrl: createdUser.avatarUrl,
        emailVerifiedAt: createdUser.emailVerifiedAt,
        roles,
        createdAt: createdUser.createdAt,
        updatedAt: createdUser.updatedAt,
      },
      token,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, input.email));

    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const isValidPassword = await comparePassword(input.password, user.passwordHash);
    if (!isValidPassword) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const rolesRows = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));

    const roles = rolesRows.map((r) => r.role as UserRole);

    const token = signToken({
      sub: user.id,
      email: user.email,
      roles,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        emailVerifiedAt: user.emailVerifiedAt,
        roles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    };
  }

  async getMe(userId: string): Promise<MeResponse> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw AppError.notFound('User not found');
    }

    const rolesRows = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, user.id));

    const roles = rolesRows.map((r) => r.role as UserRole);

    const memberships = await db
      .select({
        museumId: museumAdmins.museumId,
        museumName: museums.name,
        museumSlug: museums.slug,
        isOwner: museumAdmins.isOwner,
        tierId: museumAdmins.tierId,
      })
      .from(museumAdmins)
      .innerJoin(museums, eq(museumAdmins.museumId, museums.id))
      .where(eq(museumAdmins.userId, userId));

    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        emailVerifiedAt: user.emailVerifiedAt,
        roles,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      memberships,
    };
  }

  async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await comparePassword(input.currentPassword, user.passwordHash);
    if (!isMatch) {
      throw AppError.badRequest('Current password is incorrect');
    }

    const newHash = await hashPassword(input.newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }
}

export const authService = new AuthService();

