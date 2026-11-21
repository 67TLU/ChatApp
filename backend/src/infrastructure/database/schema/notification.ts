import { pgTable, uuid, varchar, timestamp, text, boolean, index } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { sql } from 'drizzle-orm';

export const uuid7 = sql`gen_random_uuid()`;

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().default(uuid7),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  type: varchar('type', { length: 50 }).notNull(),
  // MESSAGE, MENTION, FRIEND_REQUEST, GROUP_INVITE, CALL_MISSED, SYSTEM

  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  iconUrl: varchar('icon_url', { length: 500 }),

  actionUrl: varchar('action_url', { length: 500 }),
  resourceType: varchar('resource_type', { length: 50 }),
  resourceId: uuid('resource_id'),

  // Ai gây ra notification (optional)
  actorId: uuid('actor_id').references(() => users.id),

  isRead: boolean('is_read').default(false).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  pushSent: boolean('push_sent').default(false),
pushSentAt: timestamp('push_sent_at'),
}, (table) => ({
  userIdx: index('idx_notifications_user').on(table.userId, table.isRead, table.createdAt.desc()),
  unreadIdx: index('idx_notifications_unread').on(table.userId).where(sql`is_read = false`),
}));