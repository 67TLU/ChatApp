import { pgTable, uuid, varchar, timestamp, text, integer, bigint, boolean, index, uniqueIndex, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { conversations } from './conversation';
import { sql } from 'drizzle-orm';

export const uuid7 = sql`gen_random_uuid()`;

// Messages
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().default(uuid7),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id),
  metadata: jsonb('metadata'),
// CALL: { callId, callType, outcome: 'COMPLETED'|'MISSED'|'REJECTED'|'CANCELLED', durationSeconds, participants: [...] }
  // Chống duplicate khi client retry
  clientMessageId: varchar('client_message_id', { length: 64 }).unique(),
  
  // Nội dung
  content: text('content'),
  messageType: varchar('message_type', { length: 20 }).default('TEXT').notNull(),
  // 'TEXT' | 'IMAGE' | 'VIDEO' | 'FILE' | 'SYSTEM' | 'CALL'
  
  // Reply / Forward
  replyToMessageId: uuid('reply_to_message_id'),
  forwardedFromMessageId: uuid('forwarded_from_message_id'),
  
  // Trạng thái
  status: varchar('status', { length: 20 }).default('SENT').notNull(),
  // 'SENDING' | 'SENT' | 'EDITED' | 'DELETED' | 'FAILED'
  
  editedAt: timestamp('edited_at'),
  deletedAt: timestamp('deleted_at'),
  deletedBy: uuid('deleted_by').references(() => users.id),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    // ⭐ Quan trọng nhất cho cursor pagination
    convTimeIdx: index('idx_messages_conv_time').on(table.conversationId, table.createdAt.desc()),
    senderIdx: index('idx_messages_sender').on(table.senderId),
    clientIdIdx: index('idx_messages_client_id').on(table.clientMessageId),
    replyIdx: index('idx_messages_reply').on(table.replyToMessageId),
  };
});

// Attachments
export const messageAttachments = pgTable('message_attachments', {
  id: uuid('id').primaryKey().default(uuid7),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  
  fileName: varchar('file_name', { length: 255 }).notNull(),
  fileType: varchar('file_type', { length: 100 }).notNull(),
  fileSize: bigint('file_size', { mode: 'number' }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  
  storagePath: varchar('storage_path', { length: 500 }).notNull(),
  url: varchar('url', { length: 500 }).notNull(),
  
  width: integer('width'),
  height: integer('height'),
  thumbnailPath: varchar('thumbnail_path', { length: 500 }),
  
  status: varchar('status', { length: 20 }).default('READY').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    msgIdx: index('idx_attachments_message').on(table.messageId),
  };
});

// Receipts (Delivered / Read)
export const messageReceipts = pgTable('message_receipts', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  status: varchar('status', { length: 20 }).notNull(), // 'DELIVERED' | 'READ'
  deliveredAt: timestamp('delivered_at'),
  readAt: timestamp('read_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.messageId, table.userId] }),
    userIdx: index('idx_receipts_user').on(table.userId, table.messageId),
  };
});

// Reactions
export const messageReactions = pgTable('message_reactions', {
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  emoji: varchar('emoji', { length: 32 }).notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.messageId, table.userId, table.emoji] }),
    msgIdx: index('idx_reactions_message').on(table.messageId),
  };
});

// Pins
export const messagePins = pgTable('message_pins', {
  id: uuid('id').primaryKey().default(uuid7),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  pinnedBy: uuid('pinned_by').notNull().references(() => users.id),
  
  pinnedAt: timestamp('pinned_at').defaultNow().notNull(),
}, (table) => {
  return {
    convIdx: index('idx_pins_conversation').on(table.conversationId, table.pinnedAt.desc()),
    msgUniqueIdx: uniqueIndex('idx_pins_message').on(table.messageId),
  };
});