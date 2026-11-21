import { pgTable, uuid, varchar, timestamp, boolean, integer, text, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Helper function for UUID v7 (time-ordered)
export const uuid7 = sql`gen_random_uuid()`;

// Roles table
export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().default(uuid7),
  name: varchar('name', { length: 50 }).notNull().unique(),
  description: text('description'),
  isSystem: boolean('is_system').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Users table
export const users = pgTable('users', {
  id: uuid('id').primaryKey().default(uuid7),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 32 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  emailVerifiedAt: timestamp('email_verified_at').defaultNow(),
  
  failedLoginAttempts: integer('failed_login_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  twoFactorSecret: varchar('two_factor_secret', { length: 255 }),
  
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
}, (table) => {
  return {
    emailIdx: index('idx_users_email').on(table.email),
    usernameIdx: index('idx_users_username').on(table.username),
    statusIdx: index('idx_users_status').on(table.status),
  };
});

// User profiles table
export const userProfiles = pgTable('user_profiles', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  displayName: varchar('display_name', { length: 64 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  coverUrl: varchar('cover_url', { length: 500 }),
  bio: text('bio'),
  customStatus: varchar('custom_status', { length: 100 }),
  presenceStatus: varchar('presence_status', { length: 20 }).default('ONLINE').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User sessions table
export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().default(uuid7),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  refreshTokenHash: varchar('refresh_token_hash', { length: 255 }).notNull().unique(),
  accessTokenJti: varchar('access_token_jti', { length: 255 }),
  
  deviceType: varchar('device_type', { length: 20 }),
  deviceName: varchar('device_name', { length: 100 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
  lastActiveAt: timestamp('last_active_at').defaultNow().notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdx: index('idx_sessions_user').on(table.userId),
    tokenIdx: index('idx_sessions_token').on(table.refreshTokenHash),
    expiresIdx: index('idx_sessions_expires').on(table.expiresAt),
  };
});

// User roles (many-to-many)
export const userRoles = pgTable('user_roles', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  grantedBy: uuid('granted_by').references(() => users.id),
}, (table) => {
  return {
    pk: { primaryKey: { columns: [table.userId, table.roleId] } },
  };
});
// Email verification tokens
export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: uuid('id').primaryKey().default(uuid7),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('idx_email_token').on(table.token),
  userIdx: index('idx_email_token_user').on(table.userId),
}));

// Password reset tokens
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().default(uuid7),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenIdx: index('idx_reset_token').on(table.token),
  userIdx: index('idx_reset_token_user').on(table.userId),
}));