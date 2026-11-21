import { pgTable, uuid, varchar, timestamp, text, boolean, integer, index, uniqueIndex, primaryKey, jsonb, foreignKey } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { sql } from 'drizzle-orm';
import { messages } from './message';

export const uuid7 = sql`gen_random_uuid()`;

// Conversations - Cuộc hội thoại (1-1 hoặc group)
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().default(uuid7),
  
  type: varchar('type', { length: 20 }).notNull(), // 'DIRECT' | 'GROUP'
  
  // Thông tin (chỉ dùng cho GROUP)
  name: varchar('name', { length: 100 }),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  description: text('description'),
  ownerId: uuid('owner_id').references(() => users.id),
  // conversation.ts
customPermissions: jsonb('custom_permissions').default([]),
lastReadMessageId: uuid('last_read_message_id'),
lastReadAt: timestamp('last_read_at'),
  // Trạng thái
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),
  slowModeSeconds: integer('slow_mode_seconds').default(0).notNull(),
  
  // Denormalize cho performance
  lastMessageId: uuid('last_message_id'),
  lastMessageAt: timestamp('last_message_at'),
  lastMessagePreview: text('last_message_preview'),
  lastMessageSenderId: uuid('last_message_sender_id'),
  
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  lastMessageFk: foreignKey({
    columns: [table.lastMessageId],
    foreignColumns: [messages.id],
    name: 'fk_last_message',
  }).onDelete('set null')
  return {
    typeIdx: index('idx_conversations_type').on(table.type, table.status),
    lastMsgIdx: index('idx_conversations_last_msg').on(table.lastMessageAt.desc()),
  };
});

// Conversation Members
export const conversationMembers = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  role: varchar('role', { length: 20 }).default('MEMBER').notNull(),
  // 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER'
  
  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  // 'ACTIVE' | 'LEFT' | 'BANNED' | 'INVITED'
  
  nickname: varchar('nickname', { length: 32 }),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  leftAt: timestamp('left_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.conversationId, table.userId] }),
    userIdx: index('idx_conv_members_user').on(table.userId, table.status),
    convIdx: index('idx_conv_members_conv').on(table.conversationId, table.status),
  };
});

// Read States - ⭐ BẮT BUỘC
export const conversationReadStates = pgTable('conversation_read_states', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  
  lastReadMessageId: uuid('last_read_message_id'),
  lastReadAt: timestamp('last_read_at'),
  unreadCount: integer('unread_count').default(0).notNull(),
  mentionedCount: integer('mentioned_count').default(0).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.conversationId] }),
    userIdx: index('idx_read_states_user').on(table.userId),
  };
});

// Muted Conversations
export const mutedConversations = pgTable('muted_conversations', {
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  
  mutedUntil: timestamp('muted_until'), // NULL = mute vĩnh viễn
  mutedAt: timestamp('muted_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.userId, table.conversationId] }),
  };
});