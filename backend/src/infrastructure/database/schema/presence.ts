import { pgTable, uuid, varchar, timestamp, text } from 'drizzle-orm/pg-core';
import { users } from './auth';

// User settings - Lưu trạng thái presence mà user chọn
export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  
  // Trạng thái mặc định khi online (user tự chọn)
  defaultPresence: varchar('default_presence', { length: 20 }).default('ONLINE').notNull(),
  // ONLINE, AWAY, BUSY, DND
  
  customStatus: varchar('custom_status', { length: 100 }),  // "Đang nghe nhạc..."
  
  // Quyền riêng tư
  showLastSeen: varchar('show_last_seen', { length: 20 }).default('FRIENDS').notNull(),
  // EVERYONE, FRIENDS, NOBODY
  
  // Thông báo
  notifyFriendRequest: varchar('notify_friend_request', { length: 20 }).default('ENABLED').notNull(),
  notifyMessage: varchar('notify_message', { length: 20 }).default('ENABLED').notNull(),
  notifyCall: varchar('notify_call', { length: 20 }).default('ENABLED').notNull(),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});