import { pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { userRoleEnum } from './enums.js';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.role] }),
  ],
);

