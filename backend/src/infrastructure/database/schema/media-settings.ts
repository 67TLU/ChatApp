import { pgTable, uuid, varchar, timestamp, boolean, integer } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const userMediaSettings = pgTable('user_media_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),

  // deviceId của trình duyệt (không phải hardware serial)
  audioInputId: varchar('audio_input_id', { length: 255 }),
  audioOutputId: varchar('audio_output_id', { length: 255 }),
  videoInputId: varchar('video_input_id', { length: 255 }),

  audioInputLabel: varchar('audio_input_label', { length: 255 }),
  audioOutputLabel: varchar('audio_output_label', { length: 255 }),
  videoInputLabel: varchar('video_input_label', { length: 255 }),

  // Xử lý âm thanh
  echoCancellation: boolean('echo_cancellation').default(true).notNull(),
  noiseSuppression: boolean('noise_suppression').default(true).notNull(),
  autoGainControl: boolean('auto_gain_control').default(true).notNull(),

  // Video
  videoResolution: varchar('video_resolution', { length: 20 }).default('720p').notNull(),
  videoFrameRate: integer('video_frame_rate').default(30).notNull(),

  // Hành vi mặc định khi vào cuộc gọi
  joinMuted: boolean('join_muted').default(false).notNull(),
  joinVideoOff: boolean('join_video_off').default(false).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});