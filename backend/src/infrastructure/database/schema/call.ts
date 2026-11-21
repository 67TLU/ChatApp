import {
  pgTable, uuid, varchar, timestamp, boolean, integer,
  jsonb, index, text,primaryKey, real,
} from 'drizzle-orm/pg-core';
import { users } from './auth';
import { conversations } from './conversation';
import { sql } from 'drizzle-orm';

export const uuid7 = sql`gen_random_uuid()`;

export const callSessions = pgTable('call_sessions', {
  id: uuid('id').primaryKey().default(uuid7),

  callType: varchar('call_type', { length: 20 }).notNull(),
  scope: varchar('scope', { length: 20 }).notNull(),

  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  initiatorId: uuid('initiator_id').notNull().references(() => users.id),

  status: varchar('status', { length: 20 }).default('CREATED').notNull(),

  // ⭐ Mới: đánh dấu phòng đã được đóng hoàn toàn (cleanup idempotent)
  closedAt: timestamp('closed_at'),
  // ⭐ Mới: tin nhắn log cuộc gọi trong conversation
  logMessageId: uuid('log_message_id'),
roomId: varchar('room_id', { length: 100 }),
roomToken: text('room_token'),
  startedAt: timestamp('started_at'),
  endedAt: timestamp('ended_at'),
  endedBy: uuid('ended_by').references(() => users.id),
  endReason: varchar('end_reason', { length: 50 }),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  convIdx: index('idx_calls_conversation').on(table.conversationId, table.createdAt.desc()),
  initiatorIdx: index('idx_calls_initiator').on(table.initiatorId, table.createdAt.desc()),
  statusIdx: index('idx_calls_status').on(table.status),
}));

export const callParticipants = pgTable('call_participants', {
  callId: uuid('call_id').notNull().references(() => callSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
// call.ts
isSpeaking: boolean('is_speaking').default(false),
deviceType: varchar('device_type', { length: 20 }),
isAdmin: boolean('is_admin').default(false),
  status: varchar('status', { length: 20 }).default('INVITED').notNull(),

  isMuted: boolean('is_muted').default(false).notNull(),
  isVideoOn: boolean('is_video_on').default(false).notNull(),
  isScreenSharing: boolean('is_screen_sharing').default(false).notNull(),

  // ⭐ Mới: reconnect
  reconnectCount: integer('reconnect_count').default(0).notNull(),
  lastDisconnectAt: timestamp('last_disconnect_at'),
  lastSeenAt: timestamp('last_seen_at'),
  connectionQuality: varchar('connection_quality', { length: 20 }),

  joinedAt: timestamp('joined_at'),
  leftAt: timestamp('left_at'),
  isHost: boolean('is_host').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.callId, table.userId] }),
  userIdx: index('idx_call_participants_user').on(table.userId, table.status),
}));

export const callEvents = pgTable('call_events', {
  id: uuid('id').primaryKey().default(uuid7),
  callId: uuid('call_id').notNull().references(() => callSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  callIdx: index('idx_call_events_call').on(table.callId, table.createdAt),
}));

// ⭐ MỚI: Screen share sessions
export const callScreenShares = pgTable('call_screen_shares', {
  id: uuid('id').primaryKey().default(uuid7),
  callId: uuid('call_id').notNull().references(() => callSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  sourceType: varchar('source_type', { length: 20 }).default('SCREEN').notNull(),
  // SCREEN | WINDOW | TAB
  withAudio: boolean('with_audio').default(false).notNull(),

  status: varchar('status', { length: 20 }).default('ACTIVE').notNull(),
  // ACTIVE | STOPPED

  startedAt: timestamp('started_at').defaultNow().notNull(),
  stoppedAt: timestamp('stopped_at'),
  stopReason: varchar('stop_reason', { length: 50 }),
}, (table) => ({
  callIdx: index('idx_screen_shares_call').on(table.callId, table.status),
  userIdx: index('idx_screen_shares_user').on(table.userId),
}));

// ⭐ MỚI: Quality samples (chỉ lưu mẫu, không lưu mỗi giây)
export const callQualityStats = pgTable('call_quality_stats', {
  id: uuid('id').primaryKey().default(uuid7),
  callId: uuid('call_id').notNull().references(() => callSessions.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),

  rttMs: integer('rtt_ms'),
  packetLoss: real('packet_loss'),       // %
  jitterMs: integer('jitter_ms'),
  bitrateKbps: integer('bitrate_kbps'),
  frameWidth: integer('frame_width'),
  frameHeight: integer('frame_height'),
  framesPerSecond: integer('frames_per_second'),

  quality: varchar('quality', { length: 20 }), // GOOD | MODERATE | POOR
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  callIdx: index('idx_quality_call').on(table.callId, table.createdAt.desc()),
}));