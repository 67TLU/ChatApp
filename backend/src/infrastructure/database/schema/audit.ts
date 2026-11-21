import { pgTable, uuid, varchar, timestamp, text, jsonb, index, integer, boolean } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { groups } from './group'; // <-- Đổi tên file nếu bảng groups nằm ở file khác
import { sql } from 'drizzle-orm';

export const uuid7 = sql`gen_random_uuid()`;

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().default(uuid7),
  
  actorId: uuid('actor_id').references(() => users.id),
  actorIp: varchar('actor_ip', { length: 45 }),
  actorUserAgent: text('actor_user_agent'),
  
  action: varchar('action', { length: 100 }).notNull(),
  // 'GROUP_CREATE', 'GROUP_DELETE', 'MEMBER_KICK', 'MEMBER_BAN',
  // 'ROLE_CREATE', 'ROLE_DELETE', 'MESSAGE_DELETE', 'OWNER_TRANSFER', ...
  
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: uuid('resource_id'),
  targetUserId: uuid('target_user_id').references(() => users.id),
  
  details: jsonb('details'),
  previousValues: jsonb('previous_values'),
  newValues: jsonb('new_values'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    actorIdx: index('idx_audit_actor').on(table.actorId, table.createdAt.desc()),
    actionIdx: index('idx_audit_action').on(table.action, table.createdAt.desc()),
    resourceIdx: index('idx_audit_resource').on(table.resourceType, table.resourceId),
  };
});
export const userReports = pgTable('user_reports', {
  id: uuid('id').primaryKey().default(uuid7),
  reporterId: uuid('reporter_id').notNull().references(() => users.id),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),
  resourceId: uuid('resource_id').notNull(),
  reason: varchar('reason', { length: 50 }).notNull(),
  description: text('description'),
  screenshotUrls: jsonb('screenshot_urls').default([]),
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at'),
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  statusIdx: index('idx_reports_status').on(table.status, table.createdAt),
}));
export const channels = pgTable('channels', {
  id: uuid('id').primaryKey().default(uuid7),
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 20 }).notNull(),
  description: text('description'),
  position: integer('position').default(0).notNull(),
  parentId: uuid('parent_id'),
  isLocked: boolean('is_locked').default(false),
  isNsfw: boolean('is_nsfw').default(false),
  slowModeSeconds: integer('slow_mode_seconds').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  groupIdx: index('idx_channels_group').on(table.groupId, table.position),
}));