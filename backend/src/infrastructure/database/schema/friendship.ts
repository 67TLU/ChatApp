import { pgTable, uuid, varchar, timestamp, text, index, uniqueIndex, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { sql } from 'drizzle-orm';

export const uuid7 = sql`gen_random_uuid()`;

// Friendships - Quan hệ bạn bè (1 chiều: requester → addressee)
export const friendships = pgTable('friendships', {
  id: uuid('id').primaryKey().default(uuid7),
  
  requesterId: uuid('requester_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  addresseeId: uuid('addressee_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  status: varchar('status', { length: 20 }).default('PENDING').notNull(),
  // PENDING, ACCEPTED, REJECTED, CANCELLED
  
  message: text('message'),  // Lời nhắn kèm lời mời
  actedAt: timestamp('acted_at'),  // Thời điểm accept/reject
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    requesterIdx: index('idx_friendships_requester').on(table.requesterId, table.status),
    addresseeIdx: index('idx_friendships_addressee').on(table.addresseeId, table.status),
    // Đảm bảo không có 2 lời mời giữa cùng 2 người (cùng chiều)
    uniquePairIdx: uniqueIndex('uq_friendship_pair').on(table.requesterId, table.addresseeId),
  };
});

// Blocks - Chặn người dùng (tách riêng)
export const blocks = pgTable('blocks', {
  blockerId: uuid('blocker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  blockedId: uuid('blocked_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  reason: text('reason'),
  blockedAt: timestamp('blocked_at').defaultNow().notNull(),
}, (table) => {
  return {
    pk: primaryKey({ columns: [table.blockerId, table.blockedId] }),
    blockedIdx: index('idx_blocks_blocked').on(table.blockedId),
  };
});